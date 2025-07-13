"""
Authentication utilities for API endpoints.
"""
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.api_key_queries import APIKeyQueries

security = HTTPBearer()


async def get_api_key_from_request(request: Request) -> Optional[Dict[str, Any]]:
    """Get API key from request headers."""
    # Try Authorization header first (Bearer token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        api_key = auth_header.replace("Bearer ", "")
        return await get_api_key_by_value(api_key)
    
    # Try X-API-Key header next
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return await get_api_key_by_value(api_key)
    
    # Try query parameter
    api_key = request.query_params.get("api_key")
    if api_key:
        return await get_api_key_by_value(api_key)
    
    return None


async def get_api_key_by_value(api_key: str) -> Optional[Dict[str, Any]]:
    """Get API key record by value."""
    if not api_key:
        return None
    
    key_hash = APIKeyQueries.hash_api_key(api_key)
    key_record = await APIKeyQueries.get_api_key_by_hash(key_hash)
    
    if not key_record:
        return None
    
    if key_record["is_disabled"]:
        return None
    
    if key_record["expires_at"] and key_record["expires_at"] < datetime.utcnow():
        return None
    
    # Update last used timestamp
    await APIKeyQueries.update_last_used(key_record["id"])
    
    return key_record


async def api_key_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Authenticate API key from Authorization header."""
    api_key = credentials.credentials
    key_record = await get_api_key_by_value(api_key)
    
    if not key_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return key_record


async def manage_auth(key_record: Dict[str, Any] = Depends(api_key_auth)) -> Dict[str, Any]:
    """Require management permission."""
    if not key_record["can_manage"]:
        raise HTTPException(
            status_code=403,
            detail="Management permission required",
        )
    
    return key_record


async def assistant_auth(key_record: Dict[str, Any] = Depends(api_key_auth)) -> Dict[str, Any]:
    """Require assistant call permission."""
    if not key_record["can_call_assistant"]:
        raise HTTPException(
            status_code=403,
            detail="Assistant call permission required",
        )
    
    return key_record
