"""
Assistant related database queries.
"""
from typing import List, Dict, Any, Optional
from app.db.connection import db_manager


class AssistantQueries:
    """Assistant related queries."""
    
    @staticmethod
    async def create_assistant(
        name: str, 
        description: str = None, 
        type: str = "dedicated",
        intent_model: str = None,
        max_tools: int = 5,
        enabled: bool = True
    ) -> Dict[str, Any]:
        """Create a new assistant."""
        query = """
            INSERT INTO assistant (name, description, type, intent_model, max_tools, enabled)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        """
        return await db_manager.fetch_one(
            query, name, description, type, intent_model, max_tools, enabled
        )
    
    @staticmethod
    async def get_assistant_by_id(assistant_id: int) -> Optional[Dict[str, Any]]:
        """Get assistant by ID."""
        query = "SELECT * FROM assistant WHERE id = $1"
        return await db_manager.fetch_one(query, assistant_id)
    
    @staticmethod
    async def get_assistant_by_name(name: str) -> Optional[Dict[str, Any]]:
        """Get assistant by name."""
        query = "SELECT * FROM assistant WHERE name = $1"
        return await db_manager.fetch_one(query, name)
    
    @staticmethod
    async def list_assistants(enabled_only: bool = False) -> List[Dict[str, Any]]:
        """List all assistants."""
        if enabled_only:
            query = "SELECT * FROM assistant WHERE enabled = true ORDER BY created_at DESC"
        else:
            query = "SELECT * FROM assistant ORDER BY created_at DESC"
        return await db_manager.fetch_all(query)
    
    @staticmethod
    async def update_assistant(
        assistant_id: int,
        name: str = None,
        description: str = None,
        type: str = None,
        intent_model: str = None,
        max_tools: int = None,
        enabled: bool = None
    ) -> Optional[Dict[str, Any]]:
        """Update assistant."""
        updates = []
        params = []
        param_count = 1
        
        if name is not None:
            updates.append(f"name = ${param_count}")
            params.append(name)
            param_count += 1
        
        if description is not None:
            updates.append(f"description = ${param_count}")
            params.append(description)
            param_count += 1
        
        if type is not None:
            updates.append(f"type = ${param_count}")
            params.append(type)
            param_count += 1
        
        if intent_model is not None:
            updates.append(f"intent_model = ${param_count}")
            params.append(intent_model)
            param_count += 1
        
        if max_tools is not None:
            updates.append(f"max_tools = ${param_count}")
            params.append(max_tools)
            param_count += 1
        
        if enabled is not None:
            updates.append(f"enabled = ${param_count}")
            params.append(enabled)
            param_count += 1
        
        if not updates:
            return await AssistantQueries.get_assistant_by_id(assistant_id)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(assistant_id)
        
        query = f"""
            UPDATE assistant 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        
        return await db_manager.fetch_one(query, *params)
    
    @staticmethod
    async def delete_assistant(assistant_id: int) -> bool:
        """Delete assistant."""
        query = "DELETE FROM assistant WHERE id = $1"
        result = await db_manager.execute(query, assistant_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def get_assistant_with_tools(assistant_id: int) -> Optional[Dict[str, Any]]:
        """Get assistant with its tools."""
        query = """
            SELECT a.*,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', t.id,
                               'name', t.name,
                               'description', t.description,
                               'connection_type', t.connection_type,
                               'priority', at.priority
                           )
                       ) FILTER (WHERE t.id IS NOT NULL),
                       '[]'::json
                   ) as tools
            FROM assistant a
            LEFT JOIN assistant_tool at ON a.id = at.assistant_id
            LEFT JOIN mcp_tool t ON at.tool_id = t.id AND t.enabled = true
            WHERE a.id = $1
            GROUP BY a.id
        """
        result = await db_manager.fetch_one(query, assistant_id)
        
        # 确保 tools 字段是一个 Python 列表
        if result and 'tools' in result:
            import json
            if isinstance(result['tools'], str):
                try:
                    result['tools'] = json.loads(result['tools'])
                except json.JSONDecodeError:
                    result['tools'] = []
        
        return result


class AssistantToolQueries:
    """Assistant-Tool relationship queries."""
    
    @staticmethod
    async def add_tool_to_assistant(
        assistant_id: int, 
        tool_id: int, 
        priority: int = 1
    ) -> Dict[str, Any]:
        """Add a tool to an assistant."""
        query = """
            INSERT INTO assistant_tool (assistant_id, tool_id, priority)
            VALUES ($1, $2, $3)
            ON CONFLICT (assistant_id, tool_id) DO UPDATE
            SET priority = $3
            RETURNING *
        """
        return await db_manager.fetch_one(query, assistant_id, tool_id, priority)
    
    @staticmethod
    async def remove_tool_from_assistant(assistant_id: int, tool_id: int) -> bool:
        """Remove a tool from an assistant."""
        query = "DELETE FROM assistant_tool WHERE assistant_id = $1 AND tool_id = $2"
        result = await db_manager.execute(query, assistant_id, tool_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def get_assistant_tools(assistant_id: int) -> List[Dict[str, Any]]:
        """Get all tools for an assistant."""
        query = """
            SELECT at.*, t.name as tool_name, t.description as tool_description
            FROM assistant_tool at
            JOIN mcp_tool t ON at.tool_id = t.id
            WHERE at.assistant_id = $1 AND t.enabled = true
            ORDER BY at.priority
        """
        return await db_manager.fetch_all(query, assistant_id)
    
    @staticmethod
    async def set_assistant_tools(
        assistant_id: int, 
        tool_ids: List[int]
    ) -> None:
        """Set tools for an assistant (replace all existing)."""
        # First, remove all existing bindings
        await db_manager.execute(
            "DELETE FROM assistant_tool WHERE assistant_id = $1",
            assistant_id
        )
        
        # Then add new bindings with default priority
        if tool_ids:
            values = [(assistant_id, tool_id, i+1) for i, tool_id in enumerate(tool_ids)]
            await db_manager.execute_many(
                "INSERT INTO assistant_tool (assistant_id, tool_id, priority) VALUES ($1, $2, $3)",
                values
            )
    
    @staticmethod
    async def update_tool_priority(
        assistant_id: int, 
        tool_id: int, 
        priority: int
    ) -> Optional[Dict[str, Any]]:
        """Update tool priority for an assistant."""
        query = """
            UPDATE assistant_tool
            SET priority = $3
            WHERE assistant_id = $1 AND tool_id = $2
            RETURNING *
        """
        return await db_manager.fetch_one(query, assistant_id, tool_id, priority)
