"""
Agent Manager for persistent agent instances.
"""
import logging
import asyncio
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta

from strands import Agent

from app.db.assistant_queries import AssistantQueries
from app.core.mcp_manager import mcp_manager

logger = logging.getLogger(__name__)


class AgentManager:
    """Manager for persistent agent instances."""
    
    def __init__(self):
        self._agents: Dict[int, Agent] = {}  # assistant_id -> Agent
        self._agent_info: Dict[int, Dict[str, Any]] = {}  # assistant_id -> agent info
        self._lock = asyncio.Lock()
        self._last_used: Dict[int, datetime] = {}  # assistant_id -> last used timestamp
        self._session_data: Dict[str, Dict[str, Any]] = {}  # session_id -> session data
        self._max_idle_time = timedelta(minutes=30)  # Maximum idle time before agent cleanup
        logger.info("Agent Manager initialized")
    
    async def get_agent_for_assistant(self, assistant_id: int, force_refresh: bool = False) -> Optional[Agent]:
        """
        Get or create an agent for an assistant.
        
        Args:
            assistant_id: The assistant ID
            force_refresh: Whether to force refresh the agent
            
        Returns:
            Agent instance or None if failed
        """
        async with self._lock:
            # Check if we already have an agent for this assistant and it's not forced to refresh
            if not force_refresh and assistant_id in self._agents:
                # Update last used time
                self._last_used[assistant_id] = datetime.utcnow()
                return self._agents[assistant_id]
            
            # Get assistant from database
            assistant = await AssistantQueries.get_assistant_with_tools(assistant_id)
            if not assistant:
                logger.warning(f"Assistant {assistant_id} not found")
                return None
            
            # Get tool IDs for the assistant
            tool_ids = await self._get_tool_ids_for_assistant(assistant)
            
            # Create agent using MCP manager
            agent = await mcp_manager.get_agent_for_tools(tool_ids)
            if not agent:
                logger.error(f"Failed to create agent for assistant {assistant_id}")
                return None
            
            # Store agent and info
            self._agents[assistant_id] = agent
            self._agent_info[assistant_id] = {
                "assistant_id": assistant_id,
                "name": assistant["name"],
                "type": assistant["type"],
                "tool_ids": tool_ids,
                "created_at": datetime.utcnow().isoformat(),
            }
            self._last_used[assistant_id] = datetime.utcnow()
            
            logger.info(f"Created agent for assistant {assistant_id}: {assistant['name']}")
            return agent
    
    async def refresh_agent(self, assistant_id: int) -> bool:
        """
        Refresh an agent for an assistant.
        
        Args:
            assistant_id: The assistant ID
            
        Returns:
            bool: Whether the refresh was successful
        """
        try:
            await self.get_agent_for_assistant(assistant_id, force_refresh=True)
            return True
        except Exception as e:
            logger.error(f"Error refreshing agent for assistant {assistant_id}: {e}")
            return False
    
    async def create_session(self, assistant_id: int, user_id: str = None) -> str:
        """
        Create a new session for an assistant.
        
        Args:
            assistant_id: The assistant ID
            user_id: Optional user identifier
            
        Returns:
            str: Session ID
        """
        import uuid
        session_id = str(uuid.uuid4())
        
        self._session_data[session_id] = {
            "assistant_id": assistant_id,
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "last_used": datetime.utcnow().isoformat(),
            "messages": [],
            "metadata": {}
        }
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session data.
        
        Args:
            session_id: The session ID
            
        Returns:
            Dict or None: Session data
        """
        session = self._session_data.get(session_id)
        if session:
            # Update last used time
            session["last_used"] = datetime.utcnow().isoformat()
        return session
    
    def add_message_to_session(self, session_id: str, role: str, content: str) -> bool:
        """
        Add a message to a session.
        
        Args:
            session_id: The session ID
            role: Message role (user, assistant, system)
            content: Message content
            
        Returns:
            bool: Whether the message was added
        """
        session = self.get_session(session_id)
        if not session:
            return False
        
        session["messages"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return True
    
    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all messages in a session.
        
        Args:
            session_id: The session ID
            
        Returns:
            List: Session messages
        """
        session = self.get_session(session_id)
        if not session:
            return []
        
        return session["messages"]
    
    async def cleanup_idle_agents(self) -> int:
        """
        Clean up idle agents that haven't been used for a while.
        
        Returns:
            int: Number of agents cleaned up
        """
        now = datetime.utcnow()
        to_remove = []
        
        async with self._lock:
            for assistant_id, last_used in self._last_used.items():
                if now - last_used > self._max_idle_time:
                    to_remove.append(assistant_id)
            
            for assistant_id in to_remove:
                if assistant_id in self._agents:
                    del self._agents[assistant_id]
                if assistant_id in self._agent_info:
                    del self._agent_info[assistant_id]
                if assistant_id in self._last_used:
                    del self._last_used[assistant_id]
            
            logger.info(f"Cleaned up {len(to_remove)} idle agents")
            return len(to_remove)
    
    async def _get_tool_ids_for_assistant(self, assistant: Dict[str, Any]) -> List[int]:
        """Get tool IDs for an assistant."""
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
            from app.db.queries import MCPToolQueries
            tools_data = await MCPToolQueries.list_enabled_tools()
            tool_ids = [tool["id"] for tool in tools_data]
            
            # Limit to max_tools if specified
            max_tools = assistant.get("max_tools", 5)
            if len(tool_ids) > max_tools:
                tool_ids = tool_ids[:max_tools]
        
        return tool_ids


# Global agent manager instance
agent_manager = AgentManager()


# Background task to clean up idle agents
async def cleanup_idle_agents_task():
    """Background task to clean up idle agents."""
    while True:
        try:
            await agent_manager.cleanup_idle_agents()
        except Exception as e:
            logger.error(f"Error in cleanup_idle_agents_task: {e}")
        
        # Sleep for 5 minutes
        await asyncio.sleep(300)
