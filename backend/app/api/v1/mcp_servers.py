"""
MCP Server management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.auth import manage_auth
from app.core.mcp_manager import mcp_manager
from app.db.queries import MCPToolQueries

router = APIRouter()


class MCPServerStartRequest(BaseModel):
    """Request to start MCP server."""
    tool_id: int


class MCPServerResponse(BaseModel):
    """MCP server response."""
    success: bool
    message: str
    data: Optional[dict] = None


class MCPClientInfo(BaseModel):
    """MCP client information."""
    tool_id: int
    name: str
    connection_type: str
    status: str
    started_at: str
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[dict] = None
    url: Optional[str] = None


class MCPClientListResponse(BaseModel):
    """MCP client list response."""
    success: bool
    message: str
    data: List[MCPClientInfo]
    total: int


class AgentQueryRequest(BaseModel):
    """Request to query agent with tools."""
    tool_ids: List[int]
    query: str


class AgentQueryResponse(BaseModel):
    """Agent query response."""
    success: bool
    message: str
    data: Optional[dict] = None


@router.post("/mcp-servers/start", response_model=MCPServerResponse)
async def start_mcp_server(
    request: MCPServerStartRequest,
    current_key: dict = Depends(manage_auth)
):
    """Start an MCP server for a tool."""
    try:
        # Get tool configuration
        tool_config = await MCPToolQueries.get_tool_by_id(request.tool_id)
        if not tool_config:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        if not tool_config["enabled"]:
            raise HTTPException(status_code=400, detail="Tool is disabled")
        
        # Check if already running
        if mcp_manager.is_running(request.tool_id):
            return MCPServerResponse(
                success=False,
                message=f"MCP server for tool {request.tool_id} is already running"
            )
        
        # Start MCP server
        success = await mcp_manager.start_mcp_server(tool_config)
        
        if success:
            client_info = mcp_manager.get_client_info(request.tool_id)
            return MCPServerResponse(
                success=True,
                message=f"MCP server started successfully for tool: {tool_config['name']}",
                data=client_info
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to start MCP server")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp-servers/stop/{tool_id}", response_model=MCPServerResponse)
async def stop_mcp_server(
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Stop an MCP server for a tool."""
    try:
        # Check if running
        if not mcp_manager.is_running(tool_id):
            return MCPServerResponse(
                success=False,
                message=f"MCP server for tool {tool_id} is not running"
            )
        
        # Stop MCP server
        success = await mcp_manager.stop_mcp_server(tool_id)
        
        if success:
            return MCPServerResponse(
                success=True,
                message=f"MCP server stopped successfully for tool {tool_id}"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to stop MCP server")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp-servers/restart", response_model=MCPServerResponse)
async def restart_mcp_server(
    request: MCPServerStartRequest,
    current_key: dict = Depends(manage_auth)
):
    """Restart an MCP server for a tool."""
    try:
        # Get tool configuration
        tool_config = await MCPToolQueries.get_tool_by_id(request.tool_id)
        if not tool_config:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        if not tool_config["enabled"]:
            raise HTTPException(status_code=400, detail="Tool is disabled")
        
        # Restart MCP server
        success = await mcp_manager.restart_mcp_server(tool_config)
        
        if success:
            client_info = mcp_manager.get_client_info(request.tool_id)
            return MCPServerResponse(
                success=True,
                message=f"MCP server restarted successfully for tool: {tool_config['name']}",
                data=client_info
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to restart MCP server")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mcp-servers", response_model=MCPClientListResponse)
async def list_mcp_servers(
    current_key: dict = Depends(manage_auth)
):
    """List all running MCP servers."""
    try:
        running_clients = mcp_manager.list_running_clients()
        
        client_infos = [
            MCPClientInfo(**client_info) 
            for client_info in running_clients
        ]
        
        return MCPClientListResponse(
            success=True,
            message="Running MCP servers retrieved successfully",
            data=client_infos,
            total=len(client_infos)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mcp-servers/{tool_id}/status", response_model=MCPServerResponse)
async def get_mcp_server_status(
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get MCP server status for a tool."""
    try:
        if mcp_manager.is_running(tool_id):
            print("Here is printing....")
            client_info = mcp_manager.get_client_info(tool_id)
            return MCPServerResponse(
                success=True,
                message=f"MCP server is running for tool {tool_id}",
                data=client_info
            )
        else:
            return MCPServerResponse(
                success=False,
                message=f"MCP server is not running for tool {tool_id}"
            )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mcp-servers/{tool_id}/tools", response_model=MCPServerResponse)
async def get_mcp_server_tools(
    tool_id: int,
    current_key: dict = Depends(manage_auth)
):
    """Get tools from a running MCP server."""
    try:
        if not mcp_manager.is_running(tool_id):
            raise HTTPException(status_code=400, detail=f"MCP server for tool {tool_id} is not running")
        
        tools = await mcp_manager.get_tools_from_client(tool_id)
        
        if tools is None:
            raise HTTPException(status_code=500, detail="Failed to get tools from MCP server")
        
        
        
        return MCPServerResponse(
            success=True,
            message=f"Tools retrieved successfully from MCP server {tool_id}",
            data={
                "tool_id": tool_id,
                "tools":  [{"tool_name": tool.tool_name, "tool_spec": tool.tool_spec} for tool in tools],
                "tool_count": len(tools)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp-servers/query", response_model=AgentQueryResponse)
async def query_agent_with_tools(
    request: AgentQueryRequest,
    current_key: dict = Depends(manage_auth)
):
    """Query an agent with tools from specified MCP servers."""
    try:
        # Check if all tools are running
        not_running = []
        for tool_id in request.tool_ids:
            if not mcp_manager.is_running(tool_id):
                not_running.append(tool_id)
        
        if not_running:
            raise HTTPException(
                status_code=400, 
                detail=f"MCP servers not running for tools: {not_running}"
            )
        
        # Create agent with tools
        agent = await mcp_manager.create_agent_with_tools(request.tool_ids)
        
        if not agent:
            raise HTTPException(status_code=500, detail="Failed to create agent with tools")
        
        # Query the agent
        try:
            response = agent(request.query)
            
            return AgentQueryResponse(
                success=True,
                message="Agent query completed successfully",
                data={
                    "query": request.query,
                    "response": response,
                    "tool_ids": request.tool_ids
                }
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Agent query failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
