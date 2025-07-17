"""
MCP Tools management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.mcp_tool import (
    MCPTool, MCPToolCreate, MCPToolUpdate, MCPToolResponse, MCPToolListResponse
)
from app.db.queries import MCPToolQueries
from app.core.auth import manage_auth

router = APIRouter()
security = HTTPBearer()


@router.post("/tools", response_model=MCPToolResponse)
async def create_mcp_tool(
    tool_data: MCPToolCreate,
    current_key: dict = Depends(manage_auth)
):
    """Create a new MCP tool."""
    try:
        # Validate server groups if provided
        if tool_data.group_ids:
            for group_id in tool_data.group_ids:
                group = await ServerGroupQueries.get_group_by_id(group_id)
                if not group:
                    raise HTTPException(status_code=404, detail=f"Server group {group_id} not found")
        
        # Create the tool
        tool_record = await MCPToolQueries.create_tool(
            name=tool_data.name,
            description=tool_data.description,
            connection_type=tool_data.connection_type,
            command=tool_data.command,
            args=tool_data.args,
            env=tool_data.env,
            url=tool_data.url,
            headers=tool_data.headers,
            timeout=tool_data.timeout,
            retry_count=tool_data.retry_count,
            retry_delay=tool_data.retry_delay,
            disabled=tool_data.disabled,
            auto_approve=tool_data.auto_approve,
            enabled=tool_data.enabled,
            group_ids=tool_data.group_ids
        )
        
        return MCPToolResponse(
            success=True,
            message="MCP tool created successfully",
            data=MCPTool(**tool_record)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tools/export-config")
async def export_tools_config(
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    current_key: dict = Depends(manage_auth)
):
    """Export MCP tools configuration as JSON."""
    try:
        if group_id:
            # Get tools from specific group
            tools = await MCPToolQueries.get_tools_by_group(group_id)
            # Also get disabled tools in the group
            all_tools = await MCPToolQueries.list_all_tools(enabled_only=False)
            disabled_tools = [tool for tool in all_tools if tool["group_id"] == group_id and not tool["enabled"]]
            tools.extend(disabled_tools)
        else:
            # Get all tools
            tools = await MCPToolQueries.list_all_tools(enabled_only=False)
        
        # Convert to MCP servers format
        mcp_servers = {}
        for tool in tools:
            connection_type = tool["connection_type"]
            
            # Create server config based on connection type
            if connection_type in ["http", "sse"]:
                # For HTTP/SSE connections, use URL
                server_config = {
                    "url": tool["url"],
                    "args": tool["args"] or [],
                    "env": tool["env"] or {},
                    "autoApprove": tool["auto_approve"] or [],
                    "disabled": tool["disabled"] or not tool["enabled"]
                }
            else:
                # For stdio connections, use command
                server_config = {
                    "command": tool["command"],
                    "args": tool["args"] or [],
                    "env": tool["env"] or {},
                    "autoApprove": tool["auto_approve"] or [],
                    "disabled": tool["disabled"] or not tool["enabled"]
                }
            
            # Remove empty fields to keep JSON clean
            if not server_config.get("args"):
                server_config.pop("args", None)
            if not server_config.get("env"):
                server_config.pop("env", None)
            if not server_config.get("autoApprove"):
                server_config.pop("autoApprove", None)
            if not server_config.get("disabled"):
                server_config.pop("disabled", None)
            
            mcp_servers[tool["name"]] = server_config
        
        return {
            "success": True,
            "message": f"Exported {len(tools)} tools configuration",
            "data": {
                "mcpServers": mcp_servers
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tools/batch-import")
async def batch_import_tools(
    import_data: dict,
    current_key: dict = Depends(manage_auth)
):
    """Batch import MCP tools from JSON configuration."""
    try:
        # Validate input structure
        if "mcpServers" not in import_data:
            raise HTTPException(status_code=400, detail="Invalid format: 'mcpServers' key not found")
        
        mcp_servers = import_data["mcpServers"]
        group_ids = import_data.get("group_ids", [])  # Optional group IDs
        
        # Validate server groups if provided
        if group_ids:
            for group_id in group_ids:
                group = await ServerGroupQueries.get_group_by_id(group_id)
                if not group:
                    raise HTTPException(status_code=404, detail=f"Server group {group_id} not found")
        
        # Get existing tool names to handle duplicates
        existing_tools = await MCPToolQueries.list_all_tools(enabled_only=False)
        existing_names = {tool["name"].lower() for tool in existing_tools}
        
        imported_tools = []
        errors = []
        
        for server_name, server_config in mcp_servers.items():
            try:
                # Generate unique name if duplicate exists
                original_name = server_name
                unique_name = original_name
                counter = 1
                
                while unique_name.lower() in existing_names:
                    unique_name = f"{original_name}-{counter}"
                    counter += 1
                
                # Add to existing names to prevent duplicates within this batch
                existing_names.add(unique_name.lower())
                
                # Parse server configuration
                url = server_config.get("url")
                command = server_config.get("command")
                args = server_config.get("args", [])
                env = server_config.get("env", {})
                auto_approve = server_config.get("autoApprove", [])
                disabled = server_config.get("disabled", False)
                
                # Determine connection type based on configuration
                connection_type = "stdio"  # Default for most MCP servers
                
                # Check if URL is provided (HTTP-based)
                if url:
                    if "sse" in str(url).lower() or "sse" in str(args).lower():
                        connection_type = "sse"
                    else:
                        connection_type = "http"
                    # For HTTP/SSE connections, command should be null
                    command = None
                # Check command for HTTP/HTTPS
                elif command in ["http", "https"]:
                    connection_type = "http"
                    # For HTTP connections, command should be null
                    command = None
                # Check args for SSE
                elif "sse" in str(args).lower():
                    connection_type = "sse"
                
                # Create tool
                tool_record = await MCPToolQueries.create_tool(
                    name=unique_name,
                    description=f"Imported from batch: {original_name}",
                    connection_type=connection_type,
                    command=command,
                    args=args,
                    env=env,
                    url=url,  # Add URL parameter
                    headers={},  # Default empty headers
                    timeout=30,  # Default timeout
                    retry_count=3,  # Default retry count
                    retry_delay=5,  # Default retry delay
                    disabled=disabled,
                    auto_approve=auto_approve,
                    enabled=not disabled,
                    group_ids=group_ids if group_ids else None
                )
                
                imported_tools.append({
                    "original_name": original_name,
                    "imported_name": unique_name,
                    "id": tool_record["id"],
                    "renamed": unique_name != original_name
                })
                
            except Exception as e:
                errors.append({
                    "tool_name": server_name,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "message": f"Batch import completed. {len(imported_tools)} tools imported, {len(errors)} errors",
            "data": {
                "imported": imported_tools,
                "errors": errors,
                "summary": {
                    "total_attempted": len(mcp_servers),
                    "successfully_imported": len(imported_tools),
                    "errors": len(errors),
                    "renamed_count": sum(1 for tool in imported_tools if tool["renamed"])
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tools", response_model=MCPToolListResponse)
async def list_mcp_tools(
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    enabled_only: bool = Query(True, description="Only return enabled tools"),
    current_key: dict = Depends(manage_auth)
):
    """List MCP tools."""
    try:
        if group_id:
            if enabled_only:
                tools = await MCPToolQueries.get_tools_by_group(group_id)
            else:
                # Get all tools in group (including disabled)
                tools = await MCPToolQueries.list_all_tools(enabled_only=False)
                tools = [tool for tool in tools if tool["group_id"] == group_id]
        else:
            tools = await MCPToolQueries.list_all_tools(enabled_only=enabled_only)
        
        return MCPToolListResponse(
            success=True,
            message="MCP tools retrieved successfully",
            data=[MCPTool(**tool) for tool in tools],
            total=len(tools)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tools/{tool_id}", response_model=MCPToolResponse)
async def get_mcp_tool(
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get MCP tool by ID."""
    try:
        tool = await MCPToolQueries.get_tool_by_id(tool_id)
        if not tool:
            raise HTTPException(status_code=404, detail="MCP tool not found")
        
        return MCPToolResponse(
            success=True,
            message="MCP tool retrieved successfully",
            data=MCPTool(**tool)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/tools/{tool_id}", response_model=MCPToolResponse)
async def update_mcp_tool(
    tool_id: int,
    tool_data: MCPToolUpdate,
    current_key: dict = Depends(manage_auth)
):
    """Update MCP tool."""
    try:
        # Check if tool exists
        existing_tool = await MCPToolQueries.get_tool_by_id(tool_id)
        if not existing_tool:
            raise HTTPException(status_code=404, detail="MCP tool not found")
        
        # Validate server groups if provided
        if tool_data.group_ids is not None:
            for group_id in tool_data.group_ids:
                group = await ServerGroupQueries.get_group_by_id(group_id)
                if not group:
                    raise HTTPException(status_code=404, detail=f"Server group {group_id} not found")
        
        # Update the tool
        updated_tool = await MCPToolQueries.update_tool(
            tool_id=tool_id,
            name=tool_data.name,
            description=tool_data.description,
            connection_type=tool_data.connection_type,
            command=tool_data.command,
            args=tool_data.args,
            env=tool_data.env,
            url=tool_data.url,
            headers=tool_data.headers,
            timeout=tool_data.timeout,
            retry_count=tool_data.retry_count,
            retry_delay=tool_data.retry_delay,
            disabled=tool_data.disabled,
            auto_approve=tool_data.auto_approve,
            enabled=tool_data.enabled,
            group_ids=tool_data.group_ids
        )
        
        return MCPToolResponse(
            success=True,
            message="MCP tool updated successfully",
            data=MCPTool(**updated_tool)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/tools/{tool_id}")
async def delete_mcp_tool(
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Delete MCP tool."""
    try:
        # Check if tool exists
        existing_tool = await MCPToolQueries.get_tool_by_id(tool_id)
        if not existing_tool:
            raise HTTPException(status_code=404, detail="MCP tool not found")
        
        # Delete the tool
        success = await MCPToolQueries.delete_tool(tool_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete MCP tool")
        
        return {
            "success": True,
            "message": "MCP tool deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/tools/{tool_id}/status")
async def update_tool_status(
    tool_id: int,
    status_data: dict,
    current_key: dict = Depends(manage_auth)
):
    """Update tool status (enable/disable)."""
    try:
        # Check if tool exists
        existing_tool = await MCPToolQueries.get_tool_by_id(tool_id)
        if not existing_tool:
            raise HTTPException(status_code=404, detail="MCP tool not found")
        
        enabled = status_data.get("enabled")
        if enabled is None:
            raise HTTPException(status_code=400, detail="'enabled' field is required")
        
        # Update tool status
        await MCPToolQueries.update_tool_status(tool_id, enabled)
        
        return {
            "success": True,
            "message": f"Tool {'enabled' if enabled else 'disabled'} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
