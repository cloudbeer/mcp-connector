"""
Endpoints for retrieving assistants accessible to the current API key.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends

from app.models.assistant import Assistant, AssistantListResponse
from app.db.api_key_queries import APIKeyAssistantQueries
from app.core.auth import api_key_auth, assistant_auth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/my-assistants", response_model=AssistantListResponse)
async def get_my_assistants(current_key: dict = Depends(assistant_auth)):
    """Get assistants accessible to the current API key."""
    try:
        # Get assistants for the current API key
        assistants = await APIKeyAssistantQueries.get_key_assistants(current_key["id"])
        
        return AssistantListResponse(
            success=True,
            message="Assistants retrieved successfully",
            data=[Assistant(**assistant) for assistant in assistants],
            total=len(assistants)
        )
        
    except Exception as e:
        logger.error(f"Error getting assistants for API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))