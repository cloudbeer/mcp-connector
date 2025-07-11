"""
Database connection management.
"""
import asyncio
import logging
from typing import Optional, Any, Dict, List
from contextlib import asynccontextmanager

import asyncpg
from asyncpg import Pool, Connection

from app.config import settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Database connection manager."""
    
    def __init__(self):
        self._pool: Optional[Pool] = None
    
    async def connect(self) -> None:
        """Create database connection pool."""
        try:
            self._pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=10,
                command_timeout=60,
            )
            logger.info("Database connection pool created")
        except Exception as e:
            logger.error(f"Failed to create database pool: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Close database connection pool."""
        if self._pool:
            await self._pool.close()
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection from pool."""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self._pool.acquire() as connection:
            yield connection
    
    async def execute(self, query: str, *args) -> str:
        """Execute a query and return status."""
        async with self.get_connection() as conn:
            return await conn.execute(query, *args)
    
    async def fetch_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch one row."""
        async with self.get_connection() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, *args) -> List[Dict[str, Any]]:
        """Fetch all rows."""
        async with self.get_connection() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    
    async def fetch_val(self, query: str, *args) -> Any:
        """Fetch single value."""
        async with self.get_connection() as conn:
            return await conn.fetchval(query, *args)
    
    async def execute_many(self, query: str, args_list: List[tuple]) -> None:
        """Execute query with multiple parameter sets."""
        async with self.get_connection() as conn:
            await conn.executemany(query, args_list)
    
    async def transaction(self):
        """Get transaction context manager."""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        return self._pool.acquire()


# 全局数据库管理器实例
db_manager = DatabaseManager()
