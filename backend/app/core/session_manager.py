"""
Session manager for MCP clients and agents.
"""
import time
import logging
import uuid
from typing import Dict, Any, List, Tuple, Optional
from strands import Agent

logger = logging.getLogger(__name__)


class SessionManager:
    """
    管理与会话 ID 关联的 clients 和 agent 对象。
    允许在多次请求之间复用这些资源，减少初始化开销。
    """
    
    def __init__(self, expiry_time: int = 30 * 60):
        """
        初始化会话管理器。
        
        Args:
            expiry_time: 会话过期时间（秒），默认 30 分钟
        """
        self.sessions: Dict[str, Dict[str, Any]] = {}  # session_id -> session_data
        self.session_expiry: Dict[str, float] = {}  # session_id -> expiry_time
        self.expiry_time = expiry_time
        logger.info(f"Session manager initialized with expiry time: {expiry_time} seconds")
    
    def create_session(
        self, 
        session_id: Optional[str], 
        assistant_id: int, 
        clients: List[Any], 
        tools: List[Any]
    ) -> Tuple[str, Agent]:
        """
        创建新会话。
        
        Args:
            session_id: 会话 ID，如果为 None 则自动生成
            assistant_id: 助手 ID
            clients: MCP 客户端列表
            tools: 工具列表
            
        Returns:
            Tuple[str, Agent]: 会话 ID 和 Agent 实例
        """
        # 如果没有提供会话 ID，则生成一个
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        # 如果会话已存在，先关闭它
        if session_id in self.sessions:
            self.close_session(session_id)
        
        logger.info(f"Creating new session {session_id} for assistant {assistant_id}")
        
        # 创建 Agent
        agent = Agent(tools=tools)
        
        # 存储会话数据
        self.sessions[session_id] = {
            'assistant_id': assistant_id,
            'clients': clients,
            'agent': agent,
            'tools': tools,
            'created_at': time.time(),
            'last_used_at': time.time()
        }
        
        # 设置过期时间
        self.session_expiry[session_id] = time.time() + self.expiry_time
        
        return session_id, agent
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        获取会话，如果存在则更新过期时间。
        
        Args:
            session_id: 会话 ID
            
        Returns:
            Optional[Dict[str, Any]]: 会话数据，如果不存在则返回 None
        """
        if session_id in self.sessions:
            # 更新过期时间和最后使用时间
            self.session_expiry[session_id] = time.time() + self.expiry_time
            self.sessions[session_id]['last_used_at'] = time.time()
            logger.debug(f"Session {session_id} accessed, expiry updated")
            return self.sessions[session_id]
        
        logger.debug(f"Session {session_id} not found")
        return None
    
    def close_session(self, session_id: str) -> bool:
        """
        关闭会话，释放资源。
        
        Args:
            session_id: 会话 ID
            
        Returns:
            bool: 是否成功关闭
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            logger.info(f"Closing session {session_id} for assistant {session['assistant_id']}")
            
            # 删除会话数据
            del self.sessions[session_id]
            del self.session_expiry[session_id]
            
            return True
        
        logger.debug(f"Attempted to close non-existent session {session_id}")
        return False
    
    def cleanup_expired_sessions(self) -> int:
        """
        清理过期会话。
        
        Returns:
            int: 清理的会话数量
        """
        current_time = time.time()
        expired_sessions = [
            session_id for session_id, expiry_time in self.session_expiry.items()
            if current_time > expiry_time
        ]
        
        for session_id in expired_sessions:
            logger.info(f"Cleaning up expired session {session_id}")
            self.close_session(session_id)
        
        return len(expired_sessions)
    
    def get_session_count(self) -> int:
        """
        获取当前会话数量。
        
        Returns:
            int: 会话数量
        """
        return len(self.sessions)
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        获取会话信息（不包含实际的客户端和代理对象）。
        
        Args:
            session_id: 会话 ID
            
        Returns:
            Optional[Dict[str, Any]]: 会话信息，如果不存在则返回 None
        """
        if session_id in self.sessions:
            session = self.sessions[session_id]
            return {
                'session_id': session_id,
                'assistant_id': session['assistant_id'],
                'created_at': session['created_at'],
                'last_used_at': session['last_used_at'],
                'expires_at': self.session_expiry[session_id],
                'client_count': len(session['clients']),
                'tool_count': len(session['tools'])
            }
        return None
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        列出所有会话的基本信息。
        
        Returns:
            List[Dict[str, Any]]: 会话信息列表
        """
        return [
            self.get_session_info(session_id)
            for session_id in self.sessions
        ]
    
    def clear_all_sessions(self) -> int:
        """
        清除所有会话。
        
        Returns:
            int: 清除的会话数量
        """
        session_ids = list(self.sessions.keys())
        for session_id in session_ids:
            self.close_session(session_id)
        
        return len(session_ids)


# 全局会话管理器实例
session_manager = SessionManager()
