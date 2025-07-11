#!/usr/bin/env python3
"""
Database initialization script.
"""
import asyncio
import logging
import sys
from pathlib import Path

import asyncpg

# Add parent directory to path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

from app.config import settings

logger = logging.getLogger(__name__)


async def create_database():
    """Create database if it doesn't exist."""
    # For existing database, we'll skip database creation
    # and just verify connection
    try:
        conn = await asyncpg.connect(settings.database_url)
        
        # Test connection
        result = await conn.fetchval("SELECT 1")
        logger.info(f"Successfully connected to database '{settings.database_name}'")
        
        await conn.close()
        
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


async def run_migrations():
    """Run database migrations."""
    try:
        conn = await asyncpg.connect(settings.database_url)
        
        # Read and execute the schema file
        schema_path = Path(__file__).parent.parent.parent / "plan" / "database_schema.sql"
        
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")
        
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # Execute the schema
        await conn.execute(schema_sql)
        logger.info("Database schema applied successfully")
        
        await conn.close()
        
    except Exception as e:
        logger.error(f"Failed to run migrations: {e}")
        raise


async def verify_setup():
    """Verify database setup."""
    try:
        conn = await asyncpg.connect(settings.database_url)
        
        # Check if pgvector extension is available
        vector_exists = await conn.fetchval(
            "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
        )
        
        if vector_exists:
            logger.info("pgvector extension is installed")
        else:
            logger.warning("pgvector extension is not installed")
        
        # Check tables
        tables = await conn.fetch("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        table_names = [row['table_name'] for row in tables]
        logger.info(f"Created tables: {table_names}")
        
        # Check sample data
        groups_count = await conn.fetchval("SELECT COUNT(*) FROM server_group")
        assistants_count = await conn.fetchval("SELECT COUNT(*) FROM assistant")
        
        logger.info(f"Sample data - Groups: {groups_count}, Assistants: {assistants_count}")
        
        await conn.close()
        
    except Exception as e:
        logger.error(f"Failed to verify setup: {e}")
        raise


async def main():
    """Main function."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger.info("Starting database initialization...")
    
    try:
        await create_database()
        await run_migrations()
        await verify_setup()
        logger.info("Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
