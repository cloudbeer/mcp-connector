"""
MCP Server Manager for dynamic loading and management of MCP clients.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager
from datetime import datetime

from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.tools.mcp import MCPClient
from strands.agent.conversation_manager import NullConversationManager


from app.db.queries import MCPToolQueries

logger = logging.getLogger(__name__)


class MCPServerManager:
    """Manager for MCP server instances."""
    
    def __init__(self):
        self._clients: Dict[int, MCPClient] = {}  # tool_id -> MCPClient
        self._client_info: Dict[int, Dict[str, Any]] = {}  # tool_id -> client info
        self._lock = asyncio.Lock()
    
    async def start_mcp_server(self, tool_config: Dict[str, Any]) -> bool:
        """Start an MCP server based on tool configuration."""
        tool_id = tool_config["id"]
        
        async with self._lock:
            # Check if already running
            if tool_id in self._clients:
                logger.warning(f"MCP server for tool {tool_id} is already running")
                return False
            
            try:
                # Create MCP client based on connection type
                mcp_client = await self._create_mcp_client(tool_config)
                
                # Store client and info
                self._clients[tool_id] = mcp_client
                self._client_info[tool_id] = {
                    "tool_id": tool_id,
                    "name": tool_config["name"],
                    "connection_type": tool_config["connection_type"],
                    "status": "running",
                    "started_at": datetime.utcnow().isoformat(),
                    "command": tool_config.get("command"),
                    "args": tool_config.get("args", []),
                    "env": tool_config.get("env", {}),
                    "url": tool_config.get("url"),
                }
                
                logger.info(f"Started MCP server for tool {tool_id}: {tool_config['name']}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to start MCP server for tool {tool_id}: {e}")
                return False
    
    async def stop_mcp_server(self, tool_id: int) -> bool:
        """Stop an MCP server."""
        async with self._lock:
            if tool_id not in self._clients:
                logger.warning(f"MCP server for tool {tool_id} is not running")
                return False
            
            try:
                # Get client and close it
                client = self._clients[tool_id]
                # Note: MCPClient from strands_agents may not have explicit close method
                # We'll remove it from our tracking
                
                # Remove from tracking
                del self._clients[tool_id]
                if tool_id in self._client_info:
                    del self._client_info[tool_id]
                
                logger.info(f"Stopped MCP server for tool {tool_id}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to stop MCP server for tool {tool_id}: {e}")
                return False
    
    async def restart_mcp_server(self, tool_config: Dict[str, Any]) -> bool:
        """Restart an MCP server."""
        tool_id = tool_config["id"]
        
        # Stop if running
        if tool_id in self._clients:
            await self.stop_mcp_server(tool_id)
        
        # Start again
        return await self.start_mcp_server(tool_config)
    
    def get_client(self, tool_id: int) -> Optional[MCPClient]:
        """Get MCP client by tool ID."""
        return self._clients.get(tool_id)
    
    def get_client_info(self, tool_id: int) -> Optional[Dict[str, Any]]:
        """Get client info by tool ID."""
        return self._client_info.get(tool_id)
    
    def list_running_clients(self) -> List[Dict[str, Any]]:
        """List all running MCP clients."""
        return list(self._client_info.values())
    
    def is_running(self, tool_id: int) -> bool:
        """Check if MCP server is running for a tool."""
        return tool_id in self._clients
    
    async def get_tools_from_client(self, tool_id: int) -> Optional[List[Any]]:
        """Get tools from a running MCP client."""
        client = self.get_client(tool_id)
        if not client:
            return None
        
        try:
            # Get tools from the MCP server
            with client:
                tools = client.list_tools_sync()
                return tools
        except Exception as e:
            logger.error(f"Failed to get tools from MCP client {tool_id}: {e}")
            return None
    
    async def create_agent_with_tools(self, tool_ids: List[int]) -> Optional[Dict[str, Any]]:
        """Create an agent with tools from specified MCP servers.
        
        Args:
            tool_ids: List of tool IDs to include
            
        Returns:
            Dict containing tools and clients, or None if failed
        """
        try:
            # Get all running clients for the specified tools
            clients = []
            for tool_id in tool_ids:
                if not self.is_running(tool_id):
                    # Try to start the server if it's not running
                    tool_config = await MCPToolQueries.get_tool_by_id(tool_id)
                    if not tool_config:
                        continue
                    
                    success = await self.start_mcp_server(tool_config)
                    if not success:
                        continue
                
                client = self.get_client(tool_id)
                if client:
                    clients.append(client)
            
            if not clients:
                return {"tools": [], "clients": []}
            
            # Get tools from all clients
            all_tools = []
            for client in clients:
                try:
                    # Get tools from this client
                    with client:
                        client_tools = client.list_tools_sync()
                        if client_tools:
                            all_tools.extend(client_tools)
                except Exception as e:
                    logger.error(f"Error getting tools from client: {e}")
            
            # Return tools and clients
            return {
                "tools": all_tools,
                "clients": clients
            }
            
        except Exception as e:
            logger.error(f"Error preparing agent tools: {e}")
            return None
    
    async def _create_mcp_client(self, tool_config: Dict[str, Any]) -> MCPClient:
        """Create MCP client based on tool configuration."""
        connection_type = tool_config["connection_type"]
        
        if connection_type == "stdio":
            return await self._create_stdio_client(tool_config)
        elif connection_type == "http":
            return await self._create_http_client(tool_config)
        elif connection_type == "sse":
            return await self._create_sse_client(tool_config)
        else:
            raise ValueError(f"Unsupported connection type: {connection_type}")
    
    async def _create_stdio_client(self, tool_config: Dict[str, Any]) -> MCPClient:
        """Create stdio MCP client."""
        command = tool_config["command"]
        args = tool_config.get("args", [])
        env = tool_config.get("env", {})
        
        # Create stdio client
        stdio_mcp_client = MCPClient(lambda: stdio_client(
            StdioServerParameters(
                command=command,
                args=args,
                env=env if env else None
            )
        ))
        
        return stdio_mcp_client
    
    async def _create_http_client(self, tool_config: Dict[str, Any]) -> MCPClient:
        """Create HTTP MCP client."""
        url = tool_config.get("url")
        
        if not url:
            raise ValueError("URL is required for HTTP connection")
        
        # Create streamable HTTP client
        http_mcp_client = MCPClient(lambda: streamablehttp_client(url))
        
        return http_mcp_client
    
    async def _create_sse_client(self, tool_config: Dict[str, Any]) -> MCPClient:
        """Create SSE MCP client."""
        url = tool_config.get("url")
        
        if not url:
            raise ValueError("URL is required for SSE connection")
        
        # Create SSE client
        sse_mcp_client = MCPClient(lambda: sse_client(url))
        
        return sse_mcp_client


# Global MCP manager instance
mcp_manager = MCPServerManager()
