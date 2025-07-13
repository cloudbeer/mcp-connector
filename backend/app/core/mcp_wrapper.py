"""
MCP client wrapper for maintaining active contexts.
"""
import logging
from typing import List, Any, Dict, Optional
from strands import Agent

logger = logging.getLogger(__name__)


class MCPAgentWrapper:
    """
    包装 MCP 客户端和 Agent，确保在使用 Agent 时客户端上下文始终是活跃的。
    
    这个类维护一个持久的客户端上下文，并提供方法来安全地使用 Agent。
    """
    
    def __init__(self, clients: List[Any], tools: List[Any]):
        """
        初始化 MCP Agent 包装器。
        
        Args:
            clients: MCP 客户端列表
            tools: 工具列表
        """
        self.clients = clients
        self.tools = tools
        self.agent = None
        self.active_contexts = []
        self.is_initialized = False
        logger.info(f"Created MCPAgentWrapper with {len(clients)} clients and {len(tools)} tools")
    
    def initialize(self) -> bool:
        """
        初始化包装器，进入所有客户端的上下文并创建 Agent。
        
        Returns:
            bool: 是否成功初始化
        """
        if self.is_initialized:
            logger.warning("MCPAgentWrapper is already initialized")
            return True
        
        try:
            # 进入所有客户端的上下文
            self.active_contexts = []
            for client in self.clients:
                try:
                    client.__enter__()
                    self.active_contexts.append(client)
                    logger.debug(f"Entered context for client {client}")
                except Exception as e:
                    logger.error(f"Error entering client context: {e}")
                    # 如果有任何客户端上下文创建失败，关闭已创建的上下文
                    self._cleanup_contexts()
                    return False
            
            # 创建 Agent
            self.agent = Agent(tools=self.tools)
            self.is_initialized = True
            logger.info("MCPAgentWrapper initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing MCPAgentWrapper: {e}")
            self._cleanup_contexts()
            return False
    
    def _cleanup_contexts(self):
        """清理所有活跃的上下文。"""
        for client in reversed(self.active_contexts):
            try:
                client.__exit__(None, None, None)
                logger.debug(f"Exited context for client {client}")
            except Exception as e:
                logger.error(f"Error exiting client context: {e}")
        
        self.active_contexts = []
        self.is_initialized = False
    
    def close(self):
        """关闭包装器，退出所有客户端的上下文。"""
        if self.is_initialized:
            self._cleanup_contexts()
            logger.info("MCPAgentWrapper closed")
    
    def invoke(self, prompt: str) -> str:
        """
        调用 Agent 处理提示。
        
        Args:
            prompt: 提示文本
            
        Returns:
            str: Agent 的响应
            
        Raises:
            RuntimeError: 如果包装器未初始化
        """
        if not self.is_initialized:
            if not self.initialize():
                raise RuntimeError("Failed to initialize MCPAgentWrapper")
        
        try:
            # 调用 Agent
            response = self.agent(prompt)
            return str(response)
        except Exception as e:
            logger.error(f"Error invoking agent: {e}")
            # 如果调用失败，尝试重新初始化
            self._cleanup_contexts()
            if not self.initialize():
                raise RuntimeError("Failed to reinitialize MCPAgentWrapper")
            # 重试一次
            response = self.agent(prompt)
            return str(response)
    
    async def stream_async(self, prompt: str):
        """
        异步流式调用 Agent 处理提示。
        
        Args:
            prompt: 提示文本
            
        Yields:
            Agent 的流式响应
            
        Raises:
            RuntimeError: 如果包装器未初始化
        """
        if not self.is_initialized:
            if not self.initialize():
                raise RuntimeError("Failed to initialize MCPAgentWrapper")
        
        try:
            # 流式调用 Agent
            async for event in self.agent.stream_async(prompt):
                yield event
        except Exception as e:
            logger.error(f"Error streaming from agent: {e}")
            # 如果调用失败，尝试重新初始化
            self._cleanup_contexts()
            if not self.initialize():
                raise RuntimeError("Failed to reinitialize MCPAgentWrapper")
            # 重试一次
            async for event in self.agent.stream_async(prompt):
                yield event
