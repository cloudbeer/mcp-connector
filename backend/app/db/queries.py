"""
Database queries for MCP Connector.
"""
from typing import List, Dict, Any, Optional
import json
from app.db.connection import db_manager


def parse_mcp_tool_json_fields(result: Dict[str, Any]) -> Dict[str, Any]:
    """Parse JSON fields in MCP tool result."""
    if not result:
        return result
    
    result = dict(result)
    
    # Parse args field
    if result.get('args') and isinstance(result['args'], str):
        try:
            result['args'] = json.loads(result['args'])
        except (json.JSONDecodeError, TypeError):
            result['args'] = []
    
    # Parse env field
    if result.get('env') and isinstance(result['env'], str):
        try:
            result['env'] = json.loads(result['env'])
        except (json.JSONDecodeError, TypeError):
            result['env'] = {}
    
    # Parse headers field
    if result.get('headers') and isinstance(result['headers'], str):
        try:
            result['headers'] = json.loads(result['headers'])
        except (json.JSONDecodeError, TypeError):
            result['headers'] = {}
    
    # Parse auto_approve field
    if result.get('auto_approve') and isinstance(result['auto_approve'], str):
        try:
            result['auto_approve'] = json.loads(result['auto_approve'])
        except (json.JSONDecodeError, TypeError):
            result['auto_approve'] = []
    
    # Parse groups field
    if result.get('groups') and isinstance(result['groups'], str):
        try:
            result['groups'] = json.loads(result['groups'])
        except (json.JSONDecodeError, TypeError):
            result['groups'] = []
    
    return result



class MCPToolQueries:
    """MCP tool related queries."""
    
    @staticmethod
    async def create_tool(
        name: str,
        description: str,
        connection_type: str,
        command: str = None,
        args: List[str] = None,
        env: Dict[str, str] = None,
        url: str = None,
        headers: Dict[str, str] = None,
        timeout: int = 30,
        retry_count: int = 3,
        retry_delay: int = 5,
        disabled: bool = False,
        auto_approve: List[str] = None,
        enabled: bool = True,
        group_ids: List[int] = None
    ) -> Dict[str, Any]:
        """Create a new MCP tool."""
        # Create the tool first
        query = """
            INSERT INTO mcp_tool (
                name, description, connection_type,
                command, args, env, url, headers, timeout, retry_count, retry_delay,
                disabled, auto_approve, enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        """
        result = await db_manager.fetch_one(
            query, name, description, connection_type,
            command, 
            json.dumps(args) if args else None,
            json.dumps(env) if env else None,
            url, 
            json.dumps(headers) if headers else None,
            timeout, retry_count, retry_delay,
            disabled, 
            json.dumps(auto_approve) if auto_approve else None,
            enabled
        )
        
        
        return parse_mcp_tool_json_fields(result)
    
    @staticmethod
    async def get_tool_by_id(tool_id: int) -> Optional[Dict[str, Any]]:
        """Get MCP tool by ID with its groups."""
        query = """
            SELECT t.*
            FROM mcp_tool t
            WHERE t.id = $1
        """
        result = await db_manager.fetch_one(query, tool_id)
        return parse_mcp_tool_json_fields(result)
    

    @staticmethod
    async def list_enabled_tools() -> List[Dict[str, Any]]:
        """List all enabled tools with their groups."""
        query = """
            SELECT t.*
            FROM mcp_tool t
            WHERE t.enabled = true
            ORDER BY t.created_at
        """
        results = await db_manager.fetch_all(query)
        return [parse_mcp_tool_json_fields(result) for result in results]
    
    @staticmethod
    async def list_all_tools(enabled_only: bool = True) -> List[Dict[str, Any]]:
        """List all tools with optional filtering and their groups."""
        where_clause = "WHERE t.enabled = true" if enabled_only else ""
        
        query = f"""
            SELECT t.*
            FROM mcp_tool t
            {where_clause}
            ORDER BY t.created_at DESC
        """
        
        results = await db_manager.fetch_all(query)
        return [parse_mcp_tool_json_fields(result) for result in results]
    
    @staticmethod
    async def update_tool(
        tool_id: int,
        name: str = None,
        description: str = None,
        connection_type: str = None,
        command: str = None,
        args: List[str] = None,
        env: Dict[str, str] = None,
        url: str = None,
        headers: Dict[str, str] = None,
        timeout: int = None,
        retry_count: int = None,
        retry_delay: int = None,
        disabled: bool = None,
        auto_approve: List[str] = None,
        enabled: bool = None,
        group_ids: List[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Update MCP tool."""
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
        
        if connection_type is not None:
            updates.append(f"connection_type = ${param_count}")
            params.append(connection_type)
            param_count += 1
        
        if command is not None:
            updates.append(f"command = ${param_count}")
            params.append(command)
            param_count += 1
        
        if args is not None:
            updates.append(f"args = ${param_count}")
            params.append(json.dumps(args) if args else None)
            param_count += 1
        
        if env is not None:
            updates.append(f"env = ${param_count}")
            params.append(json.dumps(env) if env else None)
            param_count += 1
        
        if url is not None:
            updates.append(f"url = ${param_count}")
            params.append(url)
            param_count += 1
        
        if headers is not None:
            updates.append(f"headers = ${param_count}")
            params.append(json.dumps(headers) if headers else None)
            param_count += 1
        
        if timeout is not None:
            updates.append(f"timeout = ${param_count}")
            params.append(timeout)
            param_count += 1
        
        if retry_count is not None:
            updates.append(f"retry_count = ${param_count}")
            params.append(retry_count)
            param_count += 1
        
        if retry_delay is not None:
            updates.append(f"retry_delay = ${param_count}")
            params.append(retry_delay)
            param_count += 1
        
        if disabled is not None:
            updates.append(f"disabled = ${param_count}")
            params.append(disabled)
            param_count += 1
        
        if auto_approve is not None:
            updates.append(f"auto_approve = ${param_count}")
            params.append(json.dumps(auto_approve) if auto_approve else None)
            param_count += 1
        
        if enabled is not None:
            updates.append(f"enabled = ${param_count}")
            params.append(enabled)
            param_count += 1
        
        # Update tool fields if any
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(tool_id)
            
            query = f"""
                UPDATE mcp_tool 
                SET {', '.join(updates)}
                WHERE id = ${param_count}
            """
            
            await db_manager.execute(query, *params)
    
            
  
        
        return await MCPToolQueries.get_tool_by_id(tool_id)
    
    @staticmethod
    async def delete_tool(tool_id: int) -> bool:
        """Delete MCP tool and its group relations."""
        # Relations will be deleted automatically due to CASCADE
        query = "DELETE FROM mcp_tool WHERE id = $1"
        result = await db_manager.execute(query, tool_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def update_tool_status(tool_id: int, enabled: bool) -> bool:
        """Update tool status."""
        query = "UPDATE mcp_tool SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
        result = await db_manager.execute(query, enabled, tool_id)
        return "UPDATE 1" in result


class AssistantQueries:
    """Assistant related queries."""
    
    @staticmethod
    async def create_assistant(name: str, description: str = None) -> Dict[str, Any]:
        """Create a new assistant."""
        query = """
            INSERT INTO assistant (name, description)
            VALUES ($1, $2)
            RETURNING *
        """
        return await db_manager.fetch_one(query, name, description)
    
    @staticmethod
    async def get_assistant_by_id(assistant_id: int) -> Optional[Dict[str, Any]]:
        """Get assistant by ID."""
        query = "SELECT * FROM assistant WHERE id = $1"
        return await db_manager.fetch_one(query, assistant_id)
    
    @staticmethod
    async def list_assistants() -> List[Dict[str, Any]]:
        """List all assistants."""
        query = "SELECT * FROM assistant ORDER BY created_at"
        return await db_manager.fetch_all(query)
    
    @staticmethod
    async def update_assistant(
        assistant_id: int,
        name: str = None,
        description: str = None
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
