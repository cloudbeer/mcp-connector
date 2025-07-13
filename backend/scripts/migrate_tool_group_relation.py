#!/usr/bin/env python3
"""
Migration script to change tool-group relationship from one-to-many to many-to-many.
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mcp_connector")

async def migrate_database():
    """Migrate database to support many-to-many relationship between tools and groups."""
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Start transaction
        async with conn.transaction():
            print("Starting migration...")
            
            # 1. Create the many-to-many relationship table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tool_group_relation (
                    id SERIAL PRIMARY KEY,
                    tool_id INTEGER NOT NULL REFERENCES mcp_tool(id) ON DELETE CASCADE,
                    group_id INTEGER NOT NULL REFERENCES server_group(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(tool_id, group_id)
                );
            """)
            print("✓ Created tool_group_relation table")
            
            # 2. Create indexes for better performance
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tool_group_relation_tool_id ON tool_group_relation(tool_id);
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tool_group_relation_group_id ON tool_group_relation(group_id);
            """)
            print("✓ Created indexes")
            
            # 3. Migrate existing data from mcp_tool.group_id to the new relation table
            existing_relations = await conn.fetch("""
                SELECT id, group_id FROM mcp_tool WHERE group_id IS NOT NULL
            """)
            
            if existing_relations:
                print(f"Migrating {len(existing_relations)} existing tool-group relations...")
                for relation in existing_relations:
                    await conn.execute("""
                        INSERT INTO tool_group_relation (tool_id, group_id)
                        VALUES ($1, $2)
                        ON CONFLICT (tool_id, group_id) DO NOTHING
                    """, relation['id'], relation['group_id'])
                print("✓ Migrated existing relations")
            
            # 4. Remove the old group_id column from mcp_tool table
            # First check if the column exists
            column_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'mcp_tool' AND column_name = 'group_id'
                )
            """)
            
            if column_exists:
                await conn.execute("ALTER TABLE mcp_tool DROP COLUMN group_id")
                print("✓ Removed group_id column from mcp_tool table")
            else:
                print("✓ group_id column already removed")
            
            print("Migration completed successfully!")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate_database())
