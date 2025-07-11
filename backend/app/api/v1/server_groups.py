"""
Server Groups management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends

from app.models.server_group import (
    ServerGroup, ServerGroupCreate, ServerGroupUpdate, 
    ServerGroupResponse, ServerGroupListResponse
)
from app.db.queries import ServerGroupQueries, MCPToolQueries
from app.core.auth import manage_auth

router = APIRouter()


@router.post("/groups", response_model=ServerGroupResponse)
async def create_server_group(
    group_data: ServerGroupCreate,
    current_key: dict = Depends(manage_auth)
):
    """Create a new server group."""
    try:
        # Create the group
        group_record = await ServerGroupQueries.create_group(
            name=group_data.name,
            description=group_data.description,
            max_tools=group_data.max_tools
        )
        
        return ServerGroupResponse(
            success=True,
            message="Server group created successfully",
            data=ServerGroup(**group_record)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/groups", response_model=ServerGroupListResponse)
async def list_server_groups(
    current_key: dict = Depends(manage_auth)
):
    """List all server groups."""
    try:
        groups = await ServerGroupQueries.list_groups()
        
        return ServerGroupListResponse(
            success=True,
            message="Server groups retrieved successfully",
            data=[ServerGroup(**group) for group in groups],
            total=len(groups)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/groups/{group_id}", response_model=ServerGroupResponse)
async def get_server_group(
    group_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get server group by ID."""
    try:
        group = await ServerGroupQueries.get_group_by_id(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Server group not found")
        
        return ServerGroupResponse(
            success=True,
            message="Server group retrieved successfully",
            data=ServerGroup(**group)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/groups/{group_id}", response_model=ServerGroupResponse)
async def update_server_group(
    group_id: int,
    group_data: ServerGroupUpdate,
    current_key: dict = Depends(manage_auth)
):
    """Update server group."""
    try:
        # Check if group exists
        existing_group = await ServerGroupQueries.get_group_by_id(group_id)
        if not existing_group:
            raise HTTPException(status_code=404, detail="Server group not found")
        
        # If reducing max_tools, check current tool count
        if group_data.max_tools and group_data.max_tools < existing_group["max_tools"]:
            current_tools = await MCPToolQueries.get_tools_by_group(group_id)
            if len(current_tools) > group_data.max_tools:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot reduce max_tools to {group_data.max_tools}. "
                           f"Group currently has {len(current_tools)} tools."
                )
        
        # Update the group
        updated_group = await ServerGroupQueries.update_group(
            group_id=group_id,
            name=group_data.name,
            description=group_data.description,
            max_tools=group_data.max_tools
        )
        
        return ServerGroupResponse(
            success=True,
            message="Server group updated successfully",
            data=ServerGroup(**updated_group)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/groups/{group_id}")
async def delete_server_group(
    group_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Delete server group."""
    try:
        # Check if group exists
        existing_group = await ServerGroupQueries.get_group_by_id(group_id)
        if not existing_group:
            raise HTTPException(status_code=404, detail="Server group not found")
        
        # Check if group has tools
        tools_in_group = await MCPToolQueries.get_tools_by_group(group_id)
        if tools_in_group:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete group with {len(tools_in_group)} tools. "
                       "Please move or delete the tools first."
            )
        
        # Delete the group
        success = await ServerGroupQueries.delete_group(group_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete server group")
        
        return {
            "success": True,
            "message": "Server group deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/groups/{group_id}/tools")
async def get_group_tools(
    group_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get all tools in a server group."""
    try:
        # Check if group exists
        group = await ServerGroupQueries.get_group_by_id(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Server group not found")
        
        # Get tools in group
        tools = await MCPToolQueries.get_tools_by_group(group_id)
        
        return {
            "success": True,
            "message": "Group tools retrieved successfully",
            "data": tools,
            "total": len(tools)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
