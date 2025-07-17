"""
Assistant management endpoints.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends

from app.models.assistant import (
    Assistant, AssistantCreate, AssistantUpdate, AssistantWithTools,
    AssistantListResponse, AssistantResponse, AssistantToolsResponse
)
from app.db.assistant_queries import AssistantQueries, AssistantToolQueries
from app.db.queries import MCPToolQueries
from app.core.auth import manage_auth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/assistants", response_model=AssistantResponse)
async def create_assistant(
    assistant_data: AssistantCreate,
    current_key: dict = Depends(manage_auth)
):
    """Create a new assistant."""
    try:
        # Check if name already exists
        existing = await AssistantQueries.get_assistant_by_name(assistant_data.name)
        if existing:
            raise HTTPException(status_code=400, detail="Assistant name already exists")
        
        # Create assistant
        assistant = await AssistantQueries.create_assistant(
            name=assistant_data.name,
            description=assistant_data.description,
            type=assistant_data.type,
            intent_model=assistant_data.intent_model,
            max_tools=assistant_data.max_tools,
            enabled=assistant_data.enabled
        )
        
        # Add tools if provided (for dedicated assistants)
        if assistant_data.tool_ids and assistant_data.type == "dedicated":
            await AssistantToolQueries.set_assistant_tools(
                assistant["id"], assistant_data.tool_ids
            )
        
        # Get assistant with tools
        result = await AssistantQueries.get_assistant_with_tools(assistant["id"])
        
        return AssistantResponse(
            success=True,
            message="Assistant created successfully",
            data=AssistantWithTools(**result)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assistants", response_model=AssistantListResponse)
async def list_assistants(
    enabled_only: bool = Query(False, description="Only show enabled assistants"),
    current_key: dict = Depends(manage_auth)
):
    """List all assistants."""
    try:
        assistants = await AssistantQueries.list_assistants(enabled_only)
        
        return AssistantListResponse(
            success=True,
            message="Assistants retrieved successfully",
            data=[Assistant(**assistant) for assistant in assistants],
            total=len(assistants)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assistants/{assistant_id}", response_model=AssistantResponse)
async def get_assistant(
    assistant_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get assistant by ID with its tools."""
    try:
        assistant = await AssistantQueries.get_assistant_with_tools(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # 确保 tools 字段是一个列表
        if 'tools' in assistant and not isinstance(assistant['tools'], list):
            import json
            if isinstance(assistant['tools'], str):
                try:
                    assistant['tools'] = json.loads(assistant['tools'])
                except json.JSONDecodeError:
                    assistant['tools'] = []
            else:
                assistant['tools'] = []
        
        return AssistantResponse(
            success=True,
            message="Assistant retrieved successfully",
            data=AssistantWithTools(**assistant)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/assistants/{assistant_id}", response_model=AssistantResponse)
async def update_assistant(
    assistant_id: int,
    assistant_data: AssistantUpdate,
    current_key: dict = Depends(manage_auth)
):
    """Update assistant."""
    try:
        # Check if assistant exists
        existing = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Check if name already exists (if changing name)
        if assistant_data.name and assistant_data.name != existing["name"]:
            name_check = await AssistantQueries.get_assistant_by_name(assistant_data.name)
            if name_check:
                raise HTTPException(status_code=400, detail="Assistant name already exists")
        
        # Update assistant
        await AssistantQueries.update_assistant(
            assistant_id=assistant_id,
            name=assistant_data.name,
            description=assistant_data.description,
            type=assistant_data.type,
            intent_model=assistant_data.intent_model,
            max_tools=assistant_data.max_tools,
            enabled=assistant_data.enabled
        )
        
        # Update tools if provided
        if assistant_data.tool_ids is not None:
            await AssistantToolQueries.set_assistant_tools(
                assistant_id, assistant_data.tool_ids
            )
        
        # Get updated assistant with tools
        result = await AssistantQueries.get_assistant_with_tools(assistant_id)
        
        # 刷新助手的 agent
        try:
            from app.api.v1.openai_compatible import refresh_assistant_agent
            await refresh_assistant_agent(assistant_id)
        except Exception as e:
            # 即使刷新失败，也不影响更新操作
            logger.warning(f"Failed to refresh agent for assistant {assistant_id}: {e}")
        
        return AssistantResponse(
            success=True,
            message="Assistant updated successfully",
            data=AssistantWithTools(**result)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assistants/{assistant_id}")
async def delete_assistant(
    assistant_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Delete assistant."""
    try:
        # Check if assistant exists
        existing = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Delete assistant (will cascade delete assistant_tool relations)
        success = await AssistantQueries.delete_assistant(assistant_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete assistant")
        
        # 刷新助手的 agent
        try:
            from app.api.v1.openai_compatible import refresh_assistant_agent
            await refresh_assistant_agent(assistant_id)
        except Exception as e:
            # 即使刷新失败，也不影响删除操作
            logger.warning(f"Failed to refresh agent for assistant {assistant_id}: {e}")
        
        return {
            "success": True,
            "message": "Assistant deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assistants/{assistant_id}/tools", response_model=AssistantToolsResponse)
async def get_assistant_tools(
    assistant_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get tools for an assistant."""
    try:
        # Check if assistant exists
        existing = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Get tools
        tools = await AssistantToolQueries.get_assistant_tools(assistant_id)
        
        return AssistantToolsResponse(
            success=True,
            message="Assistant tools retrieved successfully",
            data=tools,
            total=len(tools)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistants/{assistant_id}/tools/{tool_id}")
async def add_tool_to_assistant(
    assistant_id: int,
    tool_id: int,
    priority: int = Query(1, description="Tool priority (lower number = higher priority)"),
    current_key: dict = Depends(manage_auth)
):
    """Add a tool to an assistant."""
    try:
        # Check if assistant exists
        assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Check if tool exists
        tool = await MCPToolQueries.get_tool_by_id(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        # Check if assistant is dedicated type
        if assistant["type"] != "dedicated":
            raise HTTPException(
                status_code=400, 
                detail="Tools can only be added to dedicated assistants"
            )
        
        # Add tool to assistant
        await AssistantToolQueries.add_tool_to_assistant(
            assistant_id, tool_id, priority
        )
        
        # 刷新助手的 agent
        try:
            from app.api.v1.openai_compatible import refresh_assistant_agent
            await refresh_assistant_agent(assistant_id)
        except Exception as e:
            # 即使刷新失败，也不影响添加操作
            logger.warning(f"Failed to refresh agent for assistant {assistant_id}: {e}")
        
        return {
            "success": True,
            "message": "Tool added to assistant successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assistants/{assistant_id}/tools/{tool_id}")
async def remove_tool_from_assistant(
    assistant_id: int,
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Remove a tool from an assistant."""
    try:
        # Check if assistant exists
        assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Remove tool from assistant
        success = await AssistantToolQueries.remove_tool_from_assistant(
            assistant_id, tool_id
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Tool not found in assistant"
            )
        
        # 刷新助手的 agent
        try:
            from app.api.v1.openai_compatible import refresh_assistant_agent
            await refresh_assistant_agent(assistant_id)
        except Exception as e:
            # 即使刷新失败，也不影响移除操作
            logger.warning(f"Failed to refresh agent for assistant {assistant_id}: {e}")
        
        return {
            "success": True,
            "message": "Tool removed from assistant successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/assistants/{assistant_id}/tools/{tool_id}/priority")
async def update_tool_priority(
    assistant_id: int,
    tool_id: int,
    priority: int = Query(..., description="New priority (lower number = higher priority)"),
    current_key: dict = Depends(manage_auth)
):
    """Update tool priority for an assistant."""
    try:
        # Check if assistant exists
        assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        # Update priority
        result = await AssistantToolQueries.update_tool_priority(
            assistant_id, tool_id, priority
        )
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail="Tool not found in assistant"
            )
        
        # 刷新助手的 agent
        try:
            from app.api.v1.openai_compatible import refresh_assistant_agent
            await refresh_assistant_agent(assistant_id)
        except Exception as e:
            # 即使刷新失败，也不影响更新操作
            logger.warning(f"Failed to refresh agent for assistant {assistant_id}: {e}")
        
        return {
            "success": True,
            "message": "Tool priority updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
