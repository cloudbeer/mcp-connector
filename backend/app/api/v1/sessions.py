"""
Session management API endpoints.
"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from app.core.auth import api_key_auth
from app.core.agent_manager import agent_manager
from app.db.assistant_queries import AssistantQueries
from app.db.api_key_queries import APIKeyAssistantQueries

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sessions", response_model=Dict[str, Any])
async def create_session(
    assistant_id: int,
    current_key: dict = Depends(api_key_auth)
):
    """
    Create a new session for an assistant.
    
    Args:
        assistant_id: The assistant ID
        
    Returns:
        Dict with session information
    """
    try:
        # Check if assistant exists
        assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail=f"Assistant {assistant_id} not found")
        
        # Check if API key has access to this assistant
        has_access = await APIKeyAssistantQueries.check_key_assistant_access(
            current_key["id"], assistant_id
        )
        
        if not has_access:
            raise HTTPException(
                status_code=403, 
                detail=f"API key does not have access to assistant: {assistant['name']}"
            )
        
        # Create session
        session_id = await agent_manager.create_session(assistant_id, user_id=current_key["id"])
        
        return {
            "session_id": session_id,
            "assistant_id": assistant_id,
            "assistant_name": assistant["name"],
            "created_at": agent_manager.get_session(session_id)["created_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}", response_model=Dict[str, Any])
async def get_session(
    session_id: str,
    current_key: dict = Depends(api_key_auth)
):
    """
    Get session information.
    
    Args:
        session_id: The session ID
        
    Returns:
        Dict with session information
    """
    session = agent_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    # Check if API key has access to this assistant
    assistant_id = session["assistant_id"]
    has_access = await APIKeyAssistantQueries.check_key_assistant_access(
        current_key["id"], assistant_id
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="API key does not have access to this session")
    
    # Get assistant info
    assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
    
    return {
        "session_id": session_id,
        "assistant_id": assistant_id,
        "assistant_name": assistant["name"] if assistant else "Unknown",
        "created_at": session["created_at"],
        "last_used": session["last_used"],
        "message_count": len(session["messages"])
    }


@router.get("/sessions/{session_id}/messages", response_model=List[Dict[str, Any]])
async def get_session_messages(
    session_id: str,
    current_key: dict = Depends(api_key_auth)
):
    """
    Get all messages in a session.
    
    Args:
        session_id: The session ID
        
    Returns:
        List of messages
    """
    session = agent_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    # Check if API key has access to this assistant
    assistant_id = session["assistant_id"]
    has_access = await APIKeyAssistantQueries.check_key_assistant_access(
        current_key["id"], assistant_id
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="API key does not have access to this session")
    
    return session["messages"]


@router.post("/sessions/{session_id}/messages", response_model=Dict[str, Any])
async def add_message_to_session(
    session_id: str,
    role: str,
    content: str,
    current_key: dict = Depends(api_key_auth)
):
    """
    Add a message to a session.
    
    Args:
        session_id: The session ID
        role: Message role (user, assistant, system)
        content: Message content
        
    Returns:
        Dict with success status
    """
    session = agent_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    # Check if API key has access to this assistant
    assistant_id = session["assistant_id"]
    has_access = await APIKeyAssistantQueries.check_key_assistant_access(
        current_key["id"], assistant_id
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="API key does not have access to this session")
    
    # Validate role
    if role not in ["user", "assistant", "system"]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    # Add message
    success = agent_manager.add_message_to_session(session_id, role, content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add message to session")
    
    return {"success": True, "message": "Message added to session"}


@router.get("/sessions", response_model=List[Dict[str, Any]])
async def list_sessions(
    current_key: dict = Depends(api_key_auth),
    assistant_id: Optional[int] = Query(None, description="Filter by assistant ID")
):
    """
    List all sessions for the current API key.
    
    Args:
        assistant_id: Optional filter by assistant ID
        
    Returns:
        List of sessions
    """
    # This is a simplified implementation that would need to be enhanced
    # with proper database storage for sessions in a production environment
    
    # For now, we'll just return sessions from memory that match the user_id
    sessions = []
    
    for session_id, session in agent_manager._session_data.items():
        if session.get("user_id") == current_key["id"]:
            # If assistant_id filter is provided, check it
            if assistant_id is not None and session.get("assistant_id") != assistant_id:
                continue
                
            # Check if API key has access to this assistant
            has_access = await APIKeyAssistantQueries.check_key_assistant_access(
                current_key["id"], session["assistant_id"]
            )
            
            if has_access:
                # Get assistant info
                assistant = await AssistantQueries.get_assistant_by_id(session["assistant_id"])
                
                sessions.append({
                    "session_id": session_id,
                    "assistant_id": session["assistant_id"],
                    "assistant_name": assistant["name"] if assistant else "Unknown",
                    "created_at": session["created_at"],
                    "last_used": session["last_used"],
                    "message_count": len(session["messages"])
                })
    
    return sessions
