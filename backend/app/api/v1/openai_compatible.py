"""
OpenAI compatible API endpoints.
"""
import logging
import time
import json
import uuid
import asyncio
from typing import List, Optional, Dict, Any, AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, Request, Header, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

from app.core.auth import api_key_auth
from app.db.assistant_queries import AssistantQueries
from app.db.queries import MCPToolQueries
from app.core.mcp_manager import mcp_manager
from app.db.api_key_queries import APIKeyAssistantQueries
from app.core.session_manager import session_manager

# 全局字典，用于存储 assistant_id -> agent 配置的映射
_assistant_configs = {}

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
    response: Response,
    session_id: Optional[str] = Header(None),
    current_key: dict = Depends(api_key_auth)
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
        
        # 处理会话
        if session_id:
            logger.info(f"Request with session ID: {session_id}")
            # 尝试获取现有会话
            session = session_manager.get_session(session_id)
            if session and session['assistant_id'] == assistant["id"]:
                # 会话存在且匹配当前助手
                logger.info(f"Using existing session {session_id} for assistant {assistant['id']}")
                wrapper = session['wrapper']
                
                # 在响应头中返回会话 ID
                response.headers["Session-ID"] = session_id
                
                # 处理请求
                if request.stream:
                    return await stream_chat_completion_with_session(request, assistant, wrapper, session_id, response)
                else:
                    return await regular_chat_completion_with_session(request, assistant, wrapper, response)
            else:
                # 会话不存在或不匹配，创建新会话
                if session:
                    # 关闭旧会话
                    logger.info(f"Closing mismatched session {session_id}")
                    session_manager.close_session(session_id)
                
                # 获取助手配置
                config = await get_assistant_config(assistant)
                
                # 创建新会话
                try:
                    new_session_id, wrapper = session_manager.create_session(
                        session_id, 
                        assistant["id"], 
                        config['clients'], 
                        config['tools']
                    )
                    
                    # 在响应头中返回会话 ID
                    response.headers["Session-ID"] = new_session_id
                    
                    # 处理请求
                    if request.stream:
                        return await stream_chat_completion_with_session(request, assistant, wrapper, new_session_id, response)
                    else:
                        return await regular_chat_completion_with_session(request, assistant, wrapper, response)
                except Exception as e:
                    logger.error(f"Failed to create session: {e}")
                    # 如果创建会话失败，回退到临时上下文
                    return await fallback_to_temporary_context(request, assistant, req, response)
        else:
            # 没有会话 ID，使用临时上下文
            return await fallback_to_temporary_context(request, assistant, req, response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_chat_completion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def fallback_to_temporary_context(request, assistant, req, response):
    """当会话管理失败时，回退到临时上下文"""
    logger.info("Falling back to temporary context")
    # 使用临时上下文
    async with get_agent_context(assistant) as agent:
        if request.stream:
            return await stream_chat_completion(request, assistant, agent, response)
        else:
            return await regular_chat_completion(request, assistant, agent)


async def get_assistant_config(assistant: Dict[str, Any]) -> Dict[str, Any]:
    """获取助手配置（工具和客户端）"""
    assistant_id = assistant["id"]
    
    # 如果已经有这个 assistant 的配置，直接使用
    if assistant_id in _assistant_configs:
        logger.info(f"Using cached config for assistant {assistant_id}")
        return _assistant_configs[assistant_id]
    
    logger.info(f"Creating new config for assistant {assistant_id}")
    
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
        
        # Get tools and clients
        config = await mcp_manager.create_agent_with_tools(tool_ids)
        
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
        
        # Get tools and clients
        config = await mcp_manager.create_agent_with_tools(tool_ids)
    
    if not config:
        raise HTTPException(
            status_code=500, 
            detail="Failed to create agent configuration"
        )
    
    # 缓存配置
    _assistant_configs[assistant_id] = config
    
    return config


@asynccontextmanager
async def get_agent_context(assistant: Dict[str, Any]):
    """
    Context manager for getting an agent with tools for an assistant.
    
    Args:
        assistant: Assistant configuration
        
    Yields:
        Agent instance
    """
    # 获取助手配置
    config = await get_assistant_config(assistant)
    
    # 使用同步上下文管理器
    # 注意：这里我们需要手动管理多个客户端的上下文
    clients = config["clients"]
    client_contexts = []
    
    try:
        # 进入所有客户端的上下文
        for client in clients:
            client_context = client.__enter__()
            client_contexts.append((client, client_context))
        
        # 创建 Agent
        from strands import Agent
        agent = Agent(tools=config["tools"])
        
        # 返回 Agent
        yield agent
        
    finally:
        # 退出所有客户端的上下文
        for client, _ in reversed(client_contexts):
            try:
                client.__exit__(None, None, None)
            except Exception as e:
                logger.error(f"Error exiting client context: {e}")


async def stream_chat_completion(
    request: ChatCompletionRequest,
    assistant: Dict[str, Any],
    agent: Any,
    response: Response
) -> StreamingResponse:
    """Stream chat completion using temporary context."""
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


async def stream_chat_completion_with_session(
    request: ChatCompletionRequest,
    assistant: Dict[str, Any],
    wrapper: Any,
    session_id: str,
    response: Response
) -> StreamingResponse:
    """Stream chat completion using a persistent session."""
    async def generate() -> AsyncGenerator[str, None]:
        try:
            logger.info(f"Starting stream chat completion with session {session_id} for assistant {assistant['id']}")
            
            # Prepare the prompt from messages
            prompt = prepare_prompt_from_messages(request.messages)
            
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
            
            # Stream the content using the wrapper
            logger.info(f"Starting stream_async with wrapper for session {session_id}")
            async for event in wrapper.stream_async(prompt):
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
            logger.info(f"Completed stream chat completion with session {session_id}")
            
        except Exception as e:
            logger.error(f"Error in stream_chat_completion_with_session: {e}", exc_info=True)
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
    agent: Any
) -> ChatCompletionResponse:
    """Regular chat completion using temporary context."""
    try:
        # Prepare the prompt from messages
        prompt = prepare_prompt_from_messages(request.messages)
        
        # Get the response using direct agent invocation
        # 注意：agent() 是同步调用，不是异步的
        response = agent(prompt)
        
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
            usage=ChatCompletionUsage()
        )
        
    except Exception as e:
        logger.error(f"Error in regular_chat_completion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def regular_chat_completion_with_session(
    request: ChatCompletionRequest,
    assistant: Dict[str, Any],
    wrapper: Any,
    response: Response
) -> ChatCompletionResponse:
    """Regular chat completion using a persistent session."""
    try:
        # Prepare the prompt from messages
        prompt = prepare_prompt_from_messages(request.messages)
        
        # Get the response using the wrapper
        response_text = wrapper.invoke(prompt)
        
        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4()}",
            created=int(time.time()),
            model=request.model,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=Message(
                        role="assistant",
                        content=response_text
                    ),
                    finish_reason="stop"
                )
            ],
            usage=ChatCompletionUsage()
        )
        
    except Exception as e:
        logger.error(f"Error in regular_chat_completion_with_session: {e}", exc_info=True)
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
    刷新指定助手的配置缓存。
    当助手配置（如关联的工具）发生变化时，应该调用此函数。
    
    Args:
        assistant_id: 助手 ID
        
    Returns:
        bool: 是否成功刷新
    """
    if assistant_id in _assistant_configs:
        logger.info(f"Refreshing config for assistant {assistant_id}")
        del _assistant_configs[assistant_id]
        return True
    return False


async def clear_all_assistant_configs() -> int:
    """
    清除所有缓存的助手配置。
    系统重启或全局配置变更时可以调用此函数。
    
    Returns:
        int: 清除的配置数量
    """
    count = len(_assistant_configs)
    logger.info(f"Clearing all {count} cached assistant configs")
    _assistant_configs.clear()
    return count


# 会话管理端点
@router.get("/sessions", response_model=Dict[str, Any])
async def list_sessions(current_key: dict = Depends(api_key_auth)):
    """List all active sessions."""
    if not current_key["can_manage"]:
        raise HTTPException(status_code=403, detail="Management permission required")
    
    sessions = session_manager.list_sessions()
    return {
        "success": True,
        "count": len(sessions),
        "sessions": sessions
    }


@router.delete("/sessions/{session_id}")
async def close_session(
    session_id: str,
    current_key: dict = Depends(api_key_auth)
):
    """Close a specific session."""
    if not current_key["can_manage"]:
        raise HTTPException(status_code=403, detail="Management permission required")
    
    success = session_manager.close_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "success": True,
        "message": f"Session {session_id} closed successfully"
    }


@router.delete("/sessions")
async def close_all_sessions(current_key: dict = Depends(api_key_auth)):
    """Close all sessions."""
    if not current_key["can_manage"]:
        raise HTTPException(status_code=403, detail="Management permission required")
    
    count = session_manager.clear_all_sessions()
    return {
        "success": True,
        "message": f"All {count} sessions closed successfully"
    }


# 定期清理过期会话的任务
async def cleanup_expired_sessions():
    """Periodically clean up expired sessions."""
    while True:
        try:
            await asyncio.sleep(60)  # 每分钟检查一次
            count = session_manager.cleanup_expired_sessions()
            if count > 0:
                logger.info(f"Cleaned up {count} expired sessions")
        except Exception as e:
            logger.error(f"Error in cleanup_expired_sessions: {e}")


# 在应用启动时启动清理任务
def start_session_cleanup():
    """Start the session cleanup task."""
    asyncio.create_task(cleanup_expired_sessions())
