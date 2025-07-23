"""
API Key management endpoints.
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.api_key import (
    APIKey, APIKeyCreate, APIKeyUpdate, APIKeyWithSecret,
    APIKeyListResponse, APIKeyResponse, APIKeyCreateResponse,
    APIKeyStats, APIKeyUsageLog
)
from app.db.api_key_queries import (
    APIKeyQueries, APIKeyAssistantQueries, APIKeyUsageLogQueries
)
from app.db.queries import AssistantQueries
from app.utils.datetime_utils import parse_datetime

router = APIRouter()
security = HTTPBearer()


async def get_current_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current API key from authorization header."""
    api_key = credentials.credentials
    key_hash = APIKeyQueries.hash_api_key(api_key)
    
    key_record = await APIKeyQueries.get_api_key_by_hash(key_hash)
    if not key_record:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    if key_record["is_disabled"]:
        raise HTTPException(status_code=401, detail="API key is disabled")
    
    # 使用不带时区的 datetime 进行比较，与数据库保持一致
    now = datetime.utcnow()
    if key_record["expires_at"] and key_record["expires_at"] < now:
        raise HTTPException(status_code=401, detail="API key has expired")
    
    return key_record


async def require_manage_permission(current_key: dict = Depends(get_current_api_key)) -> dict:
    """Require management permission."""
    if not current_key["can_manage"]:
        raise HTTPException(status_code=403, detail="Management permission required")
    return current_key


@router.post("/api-keys", response_model=APIKeyCreateResponse)
async def create_api_key(
    key_data: APIKeyCreate,
    current_key: dict = Depends(require_manage_permission)
):
    """Create a new API key."""
    try:
        # Create the API key
        key_record, full_api_key = await APIKeyQueries.create_api_key(
            name=key_data.name,
            can_manage=key_data.can_manage,
            can_call_assistant=key_data.can_call_assistant,
            is_disabled=key_data.is_disabled,
            created_by=current_key.get("name", "unknown"),
            expires_at=key_data.expires_at
        )
        
        # Bind assistants if specified
        if key_data.assistant_ids:
            await APIKeyAssistantQueries.set_key_assistants(
                key_record["id"], key_data.assistant_ids
            )
        
        # Create response with full API key
        api_key_with_secret = APIKeyWithSecret(
            **key_record,
            api_key=full_api_key
        )
        
        return APIKeyCreateResponse(
            success=True,
            message="API key created successfully",
            data=api_key_with_secret
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys", response_model=APIKeyListResponse)
async def list_api_keys(
    include_disabled: bool = Query(False, description="Include disabled keys"),
    current_key: dict = Depends(require_manage_permission)
):
    """List all API keys."""
    try:
        keys = await APIKeyQueries.list_api_keys(include_disabled)
        
        return APIKeyListResponse(
            success=True,
            message="API keys retrieved successfully",
            data=[APIKey(**key) for key in keys],
            total=len(keys)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: int,
    current_key: dict = Depends(require_manage_permission)
):
    """Get API key by ID."""
    try:
        key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        return APIKeyResponse(
            success=True,
            message="API key retrieved successfully",
            data=APIKey(**key)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api-keys/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: int,
    key_data: APIKeyUpdate,
    current_key: dict = Depends(require_manage_permission)
):
    """Update API key."""
    try:
        # Check if key exists
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Update the key
        updated_key = await APIKeyQueries.update_api_key(
            api_key_id=key_id,
            name=key_data.name,
            can_manage=key_data.can_manage,
            can_call_assistant=key_data.can_call_assistant,
            is_disabled=key_data.is_disabled,
            expires_at=key_data.expires_at
        )
        
        # Update assistant bindings if specified
        if key_data.assistant_ids is not None:
            await APIKeyAssistantQueries.set_key_assistants(
                key_id, key_data.assistant_ids
            )
        
        return APIKeyResponse(
            success=True,
            message="API key updated successfully",
            data=APIKey(**updated_key)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    current_key: dict = Depends(require_manage_permission)
):
    """Delete API key."""
    try:
        # Check if key exists
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        # Prevent self-deletion
        if existing_key["id"] == current_key["id"]:
            raise HTTPException(status_code=400, detail="Cannot delete your own API key")
        
        success = await APIKeyQueries.delete_api_key(key_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete API key")
        
        return {
            "success": True,
            "message": "API key deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys/{key_id}/assistants")
async def get_key_assistants(
    key_id: int,
    current_key: dict = Depends(require_manage_permission)
):
    """Get assistants bound to an API key."""
    try:
        # Check if key exists
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        assistants = await APIKeyAssistantQueries.get_key_assistants(key_id)
        
        return {
            "success": True,
            "message": "Assistants retrieved successfully",
            "data": assistants,
            "total": len(assistants)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api-keys/{key_id}/assistants/{assistant_id}")
async def bind_assistant_to_key(
    key_id: int,
    assistant_id: int,
    current_key: dict = Depends(require_manage_permission)
):
    """Bind an assistant to an API key."""
    try:
        # Check if key and assistant exist
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        assistant = await AssistantQueries.get_assistant_by_id(assistant_id)
        if not assistant:
            raise HTTPException(status_code=404, detail="Assistant not found")
        
        await APIKeyAssistantQueries.bind_assistant_to_key(key_id, assistant_id)
        
        return {
            "success": True,
            "message": "Assistant bound to API key successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}/assistants/{assistant_id}")
async def unbind_assistant_from_key(
    key_id: int,
    assistant_id: int,
    current_key: dict = Depends(require_manage_permission)
):
    """Unbind an assistant from an API key."""
    try:
        success = await APIKeyAssistantQueries.unbind_assistant_from_key(key_id, assistant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Binding not found")
        
        return {
            "success": True,
            "message": "Assistant unbound from API key successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys/{key_id}/stats")
async def get_key_stats(
    key_id: int,
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_key: dict = Depends(require_manage_permission)
):
    """Get usage statistics for an API key."""
    try:
        # Check if key exists
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        stats = await APIKeyUsageLogQueries.get_key_usage_stats(key_id, days)
        
        return {
            "success": True,
            "message": "Statistics retrieved successfully",
            "data": APIKeyStats(**stats)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys/{key_id}/logs")
async def get_key_usage_logs(
    key_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip"),
    current_key: dict = Depends(require_manage_permission)
):
    """Get usage logs for an API key."""
    try:
        # Check if key exists
        existing_key = await APIKeyQueries.get_api_key_by_id(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail="API key not found")
        
        logs = await APIKeyUsageLogQueries.get_key_usage_logs(key_id, limit, offset)
        
        return {
            "success": True,
            "message": "Usage logs retrieved successfully",
            "data": [APIKeyUsageLog(**log) for log in logs],
            "total": len(logs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-key")
async def get_my_key_info(current_key: dict = Depends(get_current_api_key)):
    """Get information about the current API key."""
    print(current_key)
    return {
        "success": True,
        "message": "Current API key information",
        "data": APIKey(**current_key)
    }


@router.get("/my-assistants")
async def get_my_assistants(current_key: dict = Depends(get_current_api_key)):
    """Get assistants accessible by the current API key."""
    try:
        assistants = await APIKeyAssistantQueries.get_key_assistants(current_key["id"])
        
        return {
            "success": True,
            "message": "Accessible assistants retrieved successfully",
            "data": assistants,
            "total": len(assistants)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
