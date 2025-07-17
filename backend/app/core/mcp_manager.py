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

from app.db.queries import MCPToolQueries

logger = logging.getLogger(__name__)


class MCPServerManager:
    """Manager for MCP server instances."""
    
    def __init__(self):
        self._clients: Dict[int, MCPClient] = {}  # tool_id -> MCPClient
        self._client_info: Dict[int, Dict[str, Any]] = {}  # tool_id -> client info
        self._lock = asyncio.Lock()
        self._active_clients: Dict[int, bool] = {}  # tool_id -> is_active
        self._tools_cache: Dict[int, List[Any]] = {}  # tool_id -> tools
        self._agents_cache: Dict[str, Agent] = {}  # tool_ids_key -> Agent
        logger.info("MCP Server Manager initialized")
    
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
                
                # 初始化客户端并缓存工具
                try:
                    # 进入客户端上下文
                    mcp_client.__enter__()
                    self._active_clients[tool_id] = True
                    
                    # 获取并缓存工具
                    tools = mcp_client.list_tools_sync()
                    self._tools_cache[tool_id] = tools
                    
                    logger.info(f"Started and initialized MCP server for tool {tool_id}: {tool_config['name']}")
                except Exception as e:
                    logger.error(f"Failed to initialize MCP client for tool {tool_id}: {e}")
                    # 如果初始化失败，清理资源
                    if tool_id in self._clients:
                        del self._clients[tool_id]
                    if tool_id in self._client_info:
                        del self._client_info[tool_id]
                    return False
                
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
                
                # 如果客户端处于活跃状态，退出上下文
                if tool_id in self._active_clients and self._active_clients[tool_id]:
                    try:
                        client.__exit__(None, None, None)
                        self._active_clients[tool_id] = False
                    except Exception as e:
                        logger.error(f"Error exiting client context for tool {tool_id}: {e}")
                
                # Remove from tracking
                del self._clients[tool_id]
                if tool_id in self._client_info:
                    del self._client_info[tool_id]
                if tool_id in self._active_clients:
                    del self._active_clients[tool_id]
                if tool_id in self._tools_cache:
                    del self._tools_cache[tool_id]
                
                # 清理相关的 agent 缓存
                agents_to_remove = []
                for key in self._agents_cache:
                    if str(tool_id) in key.split(','):
                        agents_to_remove.append(key)
                
                for key in agents_to_remove:
                    if key in self._agents_cache:
                        del self._agents_cache[key]
                
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
    
    def is_active(self, tool_id: int) -> bool:
        """Check if MCP client is active (context entered)."""
        return tool_id in self._active_clients and self._active_clients[tool_id]
    
    async def get_tools_from_client(self, tool_id: int) -> Optional[List[Any]]:
        """Get tools from a running MCP client."""
        # 如果工具已经缓存，直接返回
        if tool_id in self._tools_cache:
            return self._tools_cache[tool_id]
        
        client = self.get_client(tool_id)
        if not client:
            return None
        
        try:
            # 如果客户端不活跃，进入上下文
            if not self.is_active(tool_id):
                client.__enter__()
                self._active_clients[tool_id] = True
            
            # 获取工具
            tools = client.list_tools_sync()
            
            # 缓存工具
            self._tools_cache[tool_id] = tools
            
            return tools
        except Exception as e:
            logger.error(f"Failed to get tools from MCP client {tool_id}: {e}")
            return None
    
    async def get_agent_for_tools(self, tool_ids: List[int]) -> Optional[Agent]:
        """Get an agent with tools for specified tool IDs.
        
        Args:
            tool_ids: List of tool IDs to include
            
        Returns:
            Agent instance or None if failed
        """
        if not tool_ids:
            logger.warning("No tool IDs provided for agent creation")
            return Agent()
            
        try:
            # 生成缓存键
            sorted_tool_ids = sorted(tool_ids)  # 排序以确保相同的工具集合生成相同的键
            cache_key = ','.join(map(str, sorted_tool_ids))
            
            # 检查缓存
            if cache_key in self._agents_cache:
                logger.info(f"Using cached agent for tools {cache_key}")
                return self._agents_cache[cache_key]
            
            # 确保所有客户端都在运行并处于活跃状态
            all_tools = []
            for tool_id in tool_ids:
                try:
                    if not self.is_running(tool_id):
                        # 尝试启动服务器
                        tool_config = await MCPToolQueries.get_tool_by_id(tool_id)
                        if not tool_config:
                            logger.warning(f"Tool {tool_id} not found in database")
                            continue
                        
                        success = await self.start_mcp_server(tool_config)
                        if not success:
                            logger.warning(f"Failed to start MCP server for tool {tool_id}")
                            continue
                    
                    # 获取工具
                    tools = await self.get_tools_from_client(tool_id)
                    if tools:
                        all_tools.extend(tools)
                    else:
                        logger.warning(f"No tools found for tool ID {tool_id}")
                except Exception as e:
                    logger.error(f"Error processing tool {tool_id}: {e}")
                    continue
            
            if not all_tools:
                logger.warning("No tools available for agent creation")
                return Agent()
            
            # 创建 Agent
            agent = Agent(tools=all_tools)
            
            # 缓存 Agent
            self._agents_cache[cache_key] = agent
            
            logger.info(f"Created new agent for tools {cache_key}")
            return agent
            
        except Exception as e:
            logger.error(f"Error creating agent with tools: {e}", exc_info=True)
            # 返回一个没有工具的 Agent，而不是 None
            return Agent()
    
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
