"""
Authentication and authorization utilities.
"""
from typing import Optional
from datetime import datetime
from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.api_key_queries import APIKeyQueries, APIKeyUsageLogQueries


class APIKeyAuth:
    """API Key authentication handler."""
    
    @staticmethod
    async def authenticate_api_key(api_key: str) -> Optional[dict]:
        """Authenticate an API key and return key record."""
        key_hash = APIKeyQueries.hash_api_key(api_key)
        key_record = await APIKeyQueries.get_api_key_by_hash(key_hash)
        
        if not key_record:
            return None
        
        # Check if key is disabled
        if key_record["is_disabled"]:
            raise HTTPException(status_code=401, detail="API key is disabled")
        
        # Check if key has expired
        if key_record["expires_at"] and key_record["expires_at"] < datetime.utcnow():
            raise HTTPException(status_code=401, detail="API key has expired")
        
        # Update last used timestamp
        await APIKeyQueries.update_last_used(key_record["id"])
        
        return key_record
    
    @staticmethod
    async def check_manage_permission(key_record: dict) -> bool:
        """Check if API key has management permission."""
        return key_record.get("can_manage", False)
    
    @staticmethod
    async def check_assistant_permission(key_record: dict) -> bool:
        """Check if API key can call assistants."""
        return key_record.get("can_call_assistant", False)
    
    @staticmethod
    async def check_assistant_access(key_record: dict, assistant_id: int) -> bool:
        """Check if API key has access to specific assistant."""
        from app.db.api_key_queries import APIKeyAssistantQueries
        return await APIKeyAssistantQueries.check_key_assistant_access(
            key_record["id"], assistant_id
        )
    
    @staticmethod
    async def log_api_usage(
        request: Request,
        key_record: dict,
        status_code: int,
        assistant_id: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """Log API key usage."""
        try:
            # Get request info
            endpoint = str(request.url.path)
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            
            # Estimate request/response sizes (simplified)
            request_size = len(str(request.url)) + sum(len(f"{k}: {v}") for k, v in request.headers.items())
            response_size = None  # Would need to be set by response middleware
            
            await APIKeyUsageLogQueries.log_usage(
                api_key_id=key_record["id"],
                endpoint=endpoint,
                status_code=status_code,
                assistant_id=assistant_id,
                ip_address=ip_address,
                user_agent=user_agent,
                request_size=request_size,
                response_size=response_size,
                error_message=error_message
            )
        except Exception as e:
            # Don't fail the request if logging fails
            print(f"Failed to log API usage: {e}")


class OptionalAPIKeyAuth(HTTPBearer):
    """Optional API key authentication (for public endpoints)."""
    
    def __init__(self, auto_error: bool = False):
        super().__init__(auto_error=auto_error)
    
    async def __call__(self, request: Request) -> Optional[dict]:
        try:
            credentials: HTTPAuthorizationCredentials = await super().__call__(request)
            if credentials:
                return await APIKeyAuth.authenticate_api_key(credentials.credentials)
            return None
        except HTTPException:
            if self.auto_error:
                raise
            return None


class RequiredAPIKeyAuth(HTTPBearer):
    """Required API key authentication."""
    
    def __init__(self, require_manage: bool = False, require_assistant: bool = False):
        super().__init__(auto_error=True)
        self.require_manage = require_manage
        self.require_assistant = require_assistant
    
    async def __call__(self, request: Request) -> dict:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)
        key_record = await APIKeyAuth.authenticate_api_key(credentials.credentials)
        
        if not key_record:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        # Check permissions
        if self.require_manage and not await APIKeyAuth.check_manage_permission(key_record):
            raise HTTPException(status_code=403, detail="Management permission required")
        
        if self.require_assistant and not await APIKeyAuth.check_assistant_permission(key_record):
            raise HTTPException(status_code=403, detail="Assistant access permission required")
        
        return key_record


# Convenience instances
optional_auth = OptionalAPIKeyAuth()
required_auth = RequiredAPIKeyAuth()
manage_auth = RequiredAPIKeyAuth(require_manage=True)
assistant_auth = RequiredAPIKeyAuth(require_assistant=True)
