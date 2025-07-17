"""
OpenAI compatible API endpoints.
"""
import logging
import time
import json
import uuid
import asyncio
from typing import List, Optional, Dict, Any, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, Request, Response, Header, Cookie
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from strands import Agent

from app.core.auth import api_key_auth
from app.db.assistant_queries import AssistantQueries
from app.db.queries import MCPToolQueries
from app.core.mcp_manager import mcp_manager
from app.core.agent_manager import agent_manager
from app.db.api_key_queries import APIKeyAssistantQueries

logger = logging.getLogger(__name__)

router = APIRouter()


class Message(BaseModel):
    """Chat message."""
    role: str = Field(..., description="The role of the message author (system, user, assistant)")
    content: str = Field(..., description="The content of the message")


class ChatCompletionRequest(BaseModel):
    """Chat completion request compatible with OpenAI API."""
    model: str = Field(..., description="The assistant name to use")
    messages: List[Message] = Field(..., description="The messages to generate a response for")
    stream: bool = Field(False, description="Whether to stream the response")
    temperature: Optional[float] = Field(0.7, description="The sampling temperature")
    max_tokens: Optional[int] = Field(None, description="The maximum number of tokens to generate")
    tools: Optional[List[Dict[str, Any]]] = Field(None, description="Override tools to use")
    session_id: Optional[str] = Field(None, description="Session ID for continuing a conversation")


class ChatCompletionChoice(BaseModel):
    """Chat completion choice."""
    index: int
    message: Message
    finish_reason: str = "stop"


class ChatCompletionUsage(BaseModel):
    """Chat completion usage."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    """Chat completion response compatible with OpenAI API."""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: ChatCompletionUsage
    session_id: Optional[str] = None  # Session ID for continuing the conversation


class DeltaMessage(BaseModel):
    """Delta message for streaming."""
    role: Optional[str] = None
    content: Optional[str] = None


class ChatCompletionChunk(BaseModel):
    """Chat completion chunk for streaming."""
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[Dict[str, Any]]


@router.post("/chat/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(
    request: ChatCompletionRequest,
    req: Request,
    current_key: dict = Depends(api_key_auth),
    x_session_id: Optional[str] = Header(None)
):
    """Create a chat completion."""
    try:
        # Check if the user has access to the requested assistant
        assistant_name = request.model
        assistant = await get_assistant_by_name(assistant_name)
        
        # Check if the API key has access to this assistant
        has_access = await APIKeyAssistantQueries.check_key_assistant_access(
            current_key["id"], assistant["id"]
        )
        
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail=f"API key does not have access to assistant: {assistant_name}"
            )
        
        # Get or create session
        session_id = request.session_id or x_session_id
        if session_id:
            # Verify session exists and belongs to this assistant
            session = agent_manager.get_session(session_id)
            if not session or session.get("assistant_id") != assistant["id"]:
                # Invalid session, create a new one
                session_id = await agent_manager.create_session(assistant["id"], user_id=current_key["id"])
        else:
            # Create new session
            session_id = await agent_manager.create_session(assistant["id"], user_id=current_key["id"])
        
        # Get agent for this assistant
        agent = await agent_manager.get_agent_for_assistant(assistant["id"])
        if not agent:
            raise HTTPException(
                status_code=500,
                detail="Failed to create agent with tools"
            )
        
        # Add user messages to session
        for message in request.messages:
            if message.role == "user":
                agent_manager.add_message_to_session(session_id, "user", message.content)
        
        # 处理请求
        if request.stream:
            return await stream_chat_completion(request, assistant, agent, session_id)
        else:
            return await regular_chat_completion(request, assistant, agent, session_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_chat_completion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def get_tool_ids_for_assistant(assistant: Dict[str, Any]) -> List[int]:
    """获取助手的工具 ID 列表。"""
    assistant_id = assistant["id"]
    
    if assistant["type"] == "dedicated":
        # For dedicated assistants, get the associated tools
        assistant_with_tools = await AssistantQueries.get_assistant_with_tools(assistant_id)
        # Ensure tools is a list
        if not isinstance(assistant_with_tools["tools"], list):
            import json
            if isinstance(assistant_with_tools["tools"], str):
                try:
                    assistant_with_tools["tools"] = json.loads(assistant_with_tools["tools"])
                except json.JSONDecodeError:
                    assistant_with_tools["tools"] = []
            else:
                assistant_with_tools["tools"] = []
        
        # Get tool IDs sorted by priority
        tool_ids = [
            tool["id"] for tool in sorted(
                assistant_with_tools["tools"], 
                key=lambda x: x.get("priority", 999)
            )
        ]
        
    else:  # Universal assistant
        # For universal assistants, we'll use all available tools
        # In a real implementation, you'd use vector search to find relevant tools
        # based on the query, but for simplicity we'll use all enabled tools
        tools_data = await MCPToolQueries.list_enabled_tools()
        tool_ids = [tool["id"] for tool in tools_data]
        
        # Limit to max_tools if specified
        max_tools = assistant.get("max_tools", 5)
        if len(tool_ids) > max_tools:
            tool_ids = tool_ids[:max_tools]
    
    return tool_ids


async def stream_chat_completion(
    request: ChatCompletionRequest,
    assistant: Dict[str, Any],
    agent: Agent,
    session_id: str
) -> StreamingResponse:
    """Stream chat completion."""
    async def generate() -> AsyncGenerator[str, None]:
        try:
            logger.info(f"Starting stream chat completion for assistant {assistant['id']}")
            
            # Prepare the prompt from messages
            prompt = prepare_prompt_from_messages(request.messages)
            logger.info(f"Prepared prompt for assistant {assistant['id']}")
            
            # Stream the response
            chunk_id = f"chatcmpl-{uuid.uuid4()}"
            created = int(time.time())
            
            # Send the first chunk with role
            first_chunk = ChatCompletionChunk(
                id=chunk_id,
                created=created,
                model=request.model,
                choices=[{
                    "index": 0,
                    "delta": {"role": "assistant"},
                    "finish_reason": None
                }]
            )
            yield f"data: {json.dumps(first_chunk.model_dump())}\n\n"
            
            # Stream the content
            logger.info(f"Starting stream_async for assistant {assistant['id']}")
            full_response = ""
            
            async for event in agent.stream_async(prompt):
                if "data" in event and event["data"]:
                    chunk = ChatCompletionChunk(
                        id=chunk_id,
                        created=created,
                        model=request.model,
                        choices=[{
                            "index": 0,
                            "delta": {"content": event["data"]},
                            "finish_reason": None
                        }]
                    )
                    yield f"data: {json.dumps(chunk.model_dump())}\n\n"
                    full_response += event["data"]
            
            # Add assistant response to session
            agent_manager.add_message_to_session(session_id, "assistant", full_response)
            
            # Send the final chunk
            final_chunk = ChatCompletionChunk(
                id=chunk_id,
                created=created,
                model=request.model,
                choices=[{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }]
            )
            yield f"data: {json.dumps(final_chunk.model_dump())}\n\n"
            yield "data: [DONE]\n\n"
            logger.info(f"Completed stream chat completion for assistant {assistant['id']}")
            
        except Exception as e:
            logger.error(f"Error in stream_chat_completion: {e}", exc_info=True)
            error_chunk = {
                "error": {
                    "message": str(e),
                    "type": "internal_error"
                }
            }
            yield f"data: {json.dumps(error_chunk)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


async def regular_chat_completion(
    request: ChatCompletionRequest,
    assistant: Dict[str, Any],
    agent: Agent,
    session_id: str
) -> ChatCompletionResponse:
    """Regular chat completion."""
    try:
        # Prepare the prompt from messages
        prompt = prepare_prompt_from_messages(request.messages)
        
        # Get the response using direct agent invocation
        response = agent(prompt)
        
        # Add assistant response to session
        agent_manager.add_message_to_session(session_id, "assistant", str(response))
        
        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4()}",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=Message(
                        role="assistant",
                        content=str(response)
                    ),
                    finish_reason="stop"
                )
            ],
            usage=ChatCompletionUsage(),
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Error in regular_chat_completion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def get_assistant_by_name(name: str) -> Dict[str, Any]:
    """Get assistant by name."""
    # First try exact match
    assistants = await AssistantQueries.list_assistants(enabled_only=True)
    for assistant in assistants:
        if assistant["name"] == name:
            return assistant
    
    # Then try case-insensitive match
    for assistant in assistants:
        if assistant["name"].lower() == name.lower():
            return assistant
    
    raise HTTPException(status_code=404, detail=f"Assistant not found: {name}")


def prepare_prompt_from_messages(messages: List[Message]) -> str:
    """Prepare a prompt from a list of messages."""
    prompt = ""
    
    for message in messages:
        role = message.role.lower()
        content = message.content
        
        if role == "system":
            prompt += f"System: {content}\n\n"
        elif role == "user":
            prompt += f"User: {content}\n\n"
        elif role == "assistant":
            prompt += f"Assistant: {content}\n\n"
    
    # Add a final assistant prefix to indicate it's the assistant's turn
    prompt += "Assistant: "
    
    return prompt


async def refresh_assistant_agent(assistant_id: int) -> bool:
    """
    刷新指定助手的 Agent。
    当助手配置（如关联的工具）发生变化时，应该调用此函数。
    
    Args:
        assistant_id: 助手 ID
        
    Returns:
        bool: 是否成功刷新
    """
    try:
        # 使用agent_manager刷新助手的Agent
        return await agent_manager.refresh_agent(assistant_id)
    except Exception as e:
        logger.error(f"Error refreshing agent for assistant {assistant_id}: {e}")
        return False
