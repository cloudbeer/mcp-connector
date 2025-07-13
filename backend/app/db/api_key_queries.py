"""
API Key related database queries.
"""
import hashlib
import secrets
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone

from app.db.connection import db_manager
from app.utils.datetime_utils import parse_datetime


class APIKeyQueries:
    """API Key related queries."""
    
    @staticmethod
    def generate_api_key() -> tuple[str, str, str]:
        """Generate a new API key.
        
        Returns:
            tuple: (full_api_key, key_hash, key_prefix)
        """
        # Generate random key
        random_part = secrets.token_urlsafe(32)
        timestamp = str(int(datetime.now().timestamp()))
        api_key = f"ak-{timestamp[:6]}-{random_part}"
        
        # Create hash for storage
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        # Create prefix for display
        key_prefix = f"ak-{timestamp[:6]}-{random_part[:8]}..."
        
        return api_key, key_hash, key_prefix
    
    @staticmethod
    def hash_api_key(api_key: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    @staticmethod
    async def create_api_key(
        name: str,
        can_manage: bool = False,
        can_call_assistant: bool = True,
        is_disabled: bool = False,
        created_by: str = None,
        expires_at: Union[datetime, str] = None
    ) -> tuple[Dict[str, Any], str]:
        """Create a new API key.
        
        Returns:
            tuple: (api_key_record, full_api_key)
        """
        api_key, key_hash, key_prefix = APIKeyQueries.generate_api_key()
        
        # 处理日期时间
        if expires_at and not isinstance(expires_at, datetime):
            expires_at = parse_datetime(expires_at)
        
        query = """
            INSERT INTO api_key (name, key_hash, key_prefix, can_manage, can_call_assistant, 
                               is_disabled, created_by, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """
        
        record = await db_manager.fetch_one(
            query, name, key_hash, key_prefix, can_manage, can_call_assistant,
            is_disabled, created_by, expires_at
        )
        
        return record, api_key
    
    @staticmethod
    async def get_api_key_by_hash(key_hash: str) -> Optional[Dict[str, Any]]:
        """Get API key by hash."""
        query = "SELECT * FROM api_key WHERE key_hash = $1"
        return await db_manager.fetch_one(query, key_hash)
    
    @staticmethod
    async def get_api_key_by_id(api_key_id: int) -> Optional[Dict[str, Any]]:
        """Get API key by ID."""
        query = "SELECT * FROM api_key WHERE id = $1"
        return await db_manager.fetch_one(query, api_key_id)
    
    @staticmethod
    async def list_api_keys(include_disabled: bool = False) -> List[Dict[str, Any]]:
        """List all API keys."""
        if include_disabled:
            query = "SELECT * FROM api_key ORDER BY created_at DESC"
            return await db_manager.fetch_all(query)
        else:
            query = "SELECT * FROM api_key WHERE is_disabled = false ORDER BY created_at DESC"
            return await db_manager.fetch_all(query)
    
    @staticmethod
    async def update_api_key(
        api_key_id: int,
        name: str = None,
        can_manage: bool = None,
        can_call_assistant: bool = None,
        is_disabled: bool = None,
        expires_at: Union[datetime, str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update API key."""
        updates = []
        params = []
        param_count = 1
        
        if name is not None:
            updates.append(f"name = ${param_count}")
            params.append(name)
            param_count += 1
        
        if can_manage is not None:
            updates.append(f"can_manage = ${param_count}")
            params.append(can_manage)
            param_count += 1
        
        if can_call_assistant is not None:
            updates.append(f"can_call_assistant = ${param_count}")
            params.append(can_call_assistant)
            param_count += 1
        
        if is_disabled is not None:
            updates.append(f"is_disabled = ${param_count}")
            params.append(is_disabled)
            param_count += 1
        
        if expires_at is not None:
            # 处理日期时间
            if not isinstance(expires_at, datetime):
                expires_at = parse_datetime(expires_at)
                
            updates.append(f"expires_at = ${param_count}")
            params.append(expires_at)
            param_count += 1
        
        if not updates:
            return await APIKeyQueries.get_api_key_by_id(api_key_id)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(api_key_id)
        
        query = f"""
            UPDATE api_key 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        
        return await db_manager.fetch_one(query, *params)
    
    @staticmethod
    async def delete_api_key(api_key_id: int) -> bool:
        """Delete API key."""
        query = "DELETE FROM api_key WHERE id = $1"
        result = await db_manager.execute(query, api_key_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def update_last_used(api_key_id: int) -> None:
        """Update last used timestamp."""
        query = "UPDATE api_key SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1"
        await db_manager.execute(query, api_key_id)


class APIKeyAssistantQueries:
    """API Key-Assistant relationship queries."""
    
    @staticmethod
    async def bind_assistant_to_key(api_key_id: int, assistant_id: int) -> Dict[str, Any]:
        """Bind an assistant to an API key."""
        query = """
            INSERT INTO api_key_assistant (api_key_id, assistant_id)
            VALUES ($1, $2)
            ON CONFLICT (api_key_id, assistant_id) DO NOTHING
            RETURNING *
        """
        return await db_manager.fetch_one(query, api_key_id, assistant_id)
    
    @staticmethod
    async def unbind_assistant_from_key(api_key_id: int, assistant_id: int) -> bool:
        """Unbind an assistant from an API key."""
        query = "DELETE FROM api_key_assistant WHERE api_key_id = $1 AND assistant_id = $2"
        result = await db_manager.execute(query, api_key_id, assistant_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def get_key_assistants(api_key_id: int) -> List[Dict[str, Any]]:
        """Get all assistants for an API key."""
        query = """
            SELECT a.*, aka.created_at as bound_at
            FROM assistant a
            JOIN api_key_assistant aka ON a.id = aka.assistant_id
            WHERE aka.api_key_id = $1 AND a.enabled = true
            ORDER BY aka.created_at
        """
        return await db_manager.fetch_all(query, api_key_id)
    
    @staticmethod
    async def get_assistant_keys(assistant_id: int) -> List[Dict[str, Any]]:
        """Get all API keys for an assistant."""
        query = """
            SELECT ak.*, aka.created_at as bound_at
            FROM api_key ak
            JOIN api_key_assistant aka ON ak.id = aka.api_key_id
            WHERE aka.assistant_id = $1 AND ak.is_disabled = false
            ORDER BY aka.created_at
        """
        return await db_manager.fetch_all(query, assistant_id)
    
    @staticmethod
    async def check_key_assistant_access(api_key_id: int, assistant_id: int) -> bool:
        """Check if an API key has access to an assistant."""
        query = """
            SELECT 1 FROM api_key_assistant 
            WHERE api_key_id = $1 AND assistant_id = $2
        """
        result = await db_manager.fetch_one(query, api_key_id, assistant_id)
        return result is not None
    
    @staticmethod
    async def set_key_assistants(api_key_id: int, assistant_ids: List[int]) -> None:
        """Set assistants for an API key (replace all existing)."""
        # First, remove all existing bindings
        await db_manager.execute(
            "DELETE FROM api_key_assistant WHERE api_key_id = $1",
            api_key_id
        )
        
        # Then add new bindings
        if assistant_ids:
            values = [(api_key_id, assistant_id) for assistant_id in assistant_ids]
            await db_manager.execute_many(
                "INSERT INTO api_key_assistant (api_key_id, assistant_id) VALUES ($1, $2)",
                values
            )


class APIKeyUsageLogQueries:
    """API Key usage log queries."""
    
    @staticmethod
    async def log_usage(
        api_key_id: int,
        endpoint: str,
        status_code: int,
        assistant_id: int = None,
        ip_address: str = None,
        user_agent: str = None,
        request_size: int = None,
        response_size: int = None,
        error_message: str = None
    ) -> Dict[str, Any]:
        """Log API key usage."""
        query = """
            INSERT INTO api_key_usage_log (
                api_key_id, endpoint, assistant_id, ip_address, user_agent,
                request_size, response_size, status_code, error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """
        return await db_manager.fetch_one(
            query, api_key_id, endpoint, assistant_id, ip_address, user_agent,
            request_size, response_size, status_code, error_message
        )
    
    @staticmethod
    async def get_key_usage_stats(api_key_id: int, days: int = 30) -> Dict[str, Any]:
        """Get usage statistics for an API key."""
        query = """
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
                COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
                MAX(created_at) as last_used_at
            FROM api_key_usage_log 
            WHERE api_key_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '%s days'
        """
        stats = await db_manager.fetch_one(query % days, api_key_id)
        
        # Get most used endpoint
        endpoint_query = """
            SELECT endpoint, COUNT(*) as count
            FROM api_key_usage_log 
            WHERE api_key_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '%s days'
            GROUP BY endpoint
            ORDER BY count DESC
            LIMIT 1
        """
        most_used_endpoint = await db_manager.fetch_one(endpoint_query % days, api_key_id)
        
        # Get most used assistant
        assistant_query = """
            SELECT a.name, COUNT(*) as count
            FROM api_key_usage_log l
            JOIN assistant a ON l.assistant_id = a.id
            WHERE l.api_key_id = $1 AND l.created_at >= CURRENT_TIMESTAMP - INTERVAL '%s days'
            GROUP BY a.name
            ORDER BY count DESC
            LIMIT 1
        """
        most_used_assistant = await db_manager.fetch_one(assistant_query % days, api_key_id)
        
        return {
            "total_requests": stats["total_requests"] or 0,
            "successful_requests": stats["successful_requests"] or 0,
            "failed_requests": stats["failed_requests"] or 0,
            "last_used_at": stats["last_used_at"],
            "most_used_endpoint": most_used_endpoint["endpoint"] if most_used_endpoint else None,
            "most_used_assistant": most_used_assistant["name"] if most_used_assistant else None
        }
    
    @staticmethod
    async def get_key_usage_logs(
        api_key_id: int, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get usage logs for an API key."""
        query = """
            SELECT l.*, a.name as assistant_name
            FROM api_key_usage_log l
            LEFT JOIN assistant a ON l.assistant_id = a.id
            WHERE l.api_key_id = $1
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        """
        return await db_manager.fetch_all(query, api_key_id, limit, offset)
