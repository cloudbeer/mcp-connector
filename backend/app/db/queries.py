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
    
    return result


class ServerGroupQueries:
    """Server group related queries."""
    
    @staticmethod
    async def create_group(name: str, description: str = None, max_tools: int = 10) -> Dict[str, Any]:
        """Create a new server group."""
        query = """
            INSERT INTO server_group (name, description, max_tools)
            VALUES ($1, $2, $3)
            RETURNING *
        """
        return await db_manager.fetch_one(query, name, description, max_tools)
    
    @staticmethod
    async def get_group_by_id(group_id: int) -> Optional[Dict[str, Any]]:
        """Get server group by ID."""
        query = "SELECT * FROM server_group WHERE id = $1"
        return await db_manager.fetch_one(query, group_id)
    
    @staticmethod
    async def get_group_by_name(name: str) -> Optional[Dict[str, Any]]:
        """Get server group by name."""
        query = "SELECT * FROM server_group WHERE name = $1"
        return await db_manager.fetch_one(query, name)
    
    @staticmethod
    async def list_groups() -> List[Dict[str, Any]]:
        """List all server groups."""
        query = "SELECT * FROM server_group ORDER BY created_at"
        return await db_manager.fetch_all(query)
    
    @staticmethod
    async def update_group(
        group_id: int,
        name: str = None,
        description: str = None,
        max_tools: int = None
    ) -> Optional[Dict[str, Any]]:
        """Update server group."""
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
        
        if max_tools is not None:
            updates.append(f"max_tools = ${param_count}")
            params.append(max_tools)
            param_count += 1
        
        if not updates:
            return await ServerGroupQueries.get_group_by_id(group_id)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(group_id)
        
        query = f"""
            UPDATE server_group 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        
        return await db_manager.fetch_one(query, *params)
    
    @staticmethod
    async def delete_group(group_id: int) -> bool:
        """Delete server group."""
        query = "DELETE FROM server_group WHERE id = $1"
        result = await db_manager.execute(query, group_id)
        return "DELETE 1" in result


class MCPToolQueries:
    """MCP tool related queries."""
    
    @staticmethod
    async def create_tool(
        name: str,
        description: str,
        connection_type: str,
        group_id: int,
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
        enabled: bool = True
    ) -> Dict[str, Any]:
        """Create a new MCP tool."""
        import json
        
        query = """
            INSERT INTO mcp_tool (
                name, description, connection_type, group_id,
                command, args, env, url, headers, timeout, retry_count, retry_delay,
                disabled, auto_approve, enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        """
        result = await db_manager.fetch_one(
            query, name, description, connection_type, group_id,
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
        """Get MCP tool by ID."""
        query = "SELECT * FROM mcp_tool WHERE id = $1"
        result = await db_manager.fetch_one(query, tool_id)
        return parse_mcp_tool_json_fields(result)
    
    @staticmethod
    async def get_tools_by_group(group_id: int) -> List[Dict[str, Any]]:
        """Get all tools in a group."""
        query = "SELECT * FROM mcp_tool WHERE group_id = $1 AND enabled = true ORDER BY created_at"
        results = await db_manager.fetch_all(query, group_id)
        return [parse_mcp_tool_json_fields(result) for result in results]
    
    @staticmethod
    async def list_enabled_tools() -> List[Dict[str, Any]]:
        """List all enabled tools."""
        query = "SELECT * FROM mcp_tool WHERE enabled = true ORDER BY created_at"
        results = await db_manager.fetch_all(query)
        return [parse_mcp_tool_json_fields(result) for result in results]
    
    @staticmethod
    async def update_tool_status(tool_id: int, enabled: bool) -> None:
        """Update tool enabled status."""
        query = "UPDATE mcp_tool SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
        await db_manager.execute(query, enabled, tool_id)
    
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
        group_id: int = None
    ) -> Optional[Dict[str, Any]]:
        """Update MCP tool."""
        import json
        
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
        
        if group_id is not None:
            updates.append(f"group_id = ${param_count}")
            params.append(group_id)
            param_count += 1
        
        if not updates:
            return await MCPToolQueries.get_tool_by_id(tool_id)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(tool_id)
        
        query = f"""
            UPDATE mcp_tool 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        
        result = await db_manager.fetch_one(query, *params)
        return parse_mcp_tool_json_fields(result)
    
    @staticmethod
    async def delete_tool(tool_id: int) -> bool:
        """Delete MCP tool."""
        query = "DELETE FROM mcp_tool WHERE id = $1"
        result = await db_manager.execute(query, tool_id)
        return "DELETE 1" in result
    
    @staticmethod
    async def list_all_tools(enabled_only: bool = True) -> List[Dict[str, Any]]:
        """List all tools with optional filtering."""
        if enabled_only:
            query = "SELECT * FROM mcp_tool WHERE enabled = true ORDER BY created_at DESC"
        else:
            query = "SELECT * FROM mcp_tool ORDER BY created_at DESC"
        
        results = await db_manager.fetch_all(query)
        return [parse_mcp_tool_json_fields(result) for result in results]


class ToolStatusQueries:
    """Tool status related queries."""
    
    @staticmethod
    async def create_status(
        tool_id: int,
        status: str,
        error_message: str = None
    ) -> Dict[str, Any]:
        """Create tool status record."""
        query = """
            INSERT INTO tool_status (tool_id, status, error_message, last_health_check)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING *
        """
        return await db_manager.fetch_one(query, tool_id, status, error_message)
    
    @staticmethod
    async def update_status(
        tool_id: int,
        status: str,
        error_message: str = None,
        retry_count: int = 0
    ) -> None:
        """Update tool status."""
        query = """
            UPDATE tool_status 
            SET status = $1, error_message = $2, retry_count = $3, 
                last_health_check = CURRENT_TIMESTAMP
            WHERE tool_id = $4
        """
        await db_manager.execute(query, status, error_message, retry_count, tool_id)
    
    @staticmethod
    async def get_tool_status(tool_id: int) -> Optional[Dict[str, Any]]:
        """Get current tool status."""
        query = "SELECT * FROM tool_status WHERE tool_id = $1 ORDER BY created_at DESC LIMIT 1"
        return await db_manager.fetch_one(query, tool_id)


class AssistantQueries:
    """Assistant related queries."""
    
    @staticmethod
    async def create_assistant(
        name: str,
        description: str,
        assistant_type: str,
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
            query, name, description, assistant_type, intent_model, max_tools, enabled
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
    async def list_enabled_assistants() -> List[Dict[str, Any]]:
        """List all enabled assistants."""
        query = "SELECT * FROM assistant WHERE enabled = true ORDER BY created_at"
        return await db_manager.fetch_all(query)


class AssistantToolQueries:
    """Assistant-tool relationship queries."""
    
    @staticmethod
    async def bind_tool_to_assistant(
        assistant_id: int,
        tool_id: int,
        priority: int = 1
    ) -> Dict[str, Any]:
        """Bind a tool to an assistant."""
        query = """
            INSERT INTO assistant_tool (assistant_id, tool_id, priority)
            VALUES ($1, $2, $3)
            ON CONFLICT (assistant_id, tool_id) 
            DO UPDATE SET priority = $3
            RETURNING *
        """
        return await db_manager.fetch_one(query, assistant_id, tool_id, priority)
    
    @staticmethod
    async def get_assistant_tools(assistant_id: int) -> List[Dict[str, Any]]:
        """Get all tools for an assistant."""
        query = """
            SELECT t.*, at.priority
            FROM mcp_tool t
            JOIN assistant_tool at ON t.id = at.tool_id
            WHERE at.assistant_id = $1 AND t.enabled = true
            ORDER BY at.priority, t.created_at
        """
        return await db_manager.fetch_all(query, assistant_id)
