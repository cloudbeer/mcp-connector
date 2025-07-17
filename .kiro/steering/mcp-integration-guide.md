---
inclusion: fileMatch
fileMatchPattern: '**/mcp_*'
---

# MCP 集成指南

## MCP (Model Context Protocol) 概述

MCP 是一个用于连接 AI 模型和外部工具的协议标准。本项目通过 Strands Agents SDK 集成 MCP 功能，提供统一的工具管理和调用接口。

## 支持的连接类型

### 1. stdio 连接
最常见的连接方式，通过标准输入输出与 MCP 服务器通信。

```json
{
  "name": "AWS CLI 工具",
  "connection_type": "stdio",
  "command": "aws-mcp-server",
  "args": ["--region", "us-east-1"],
  "env": {
    "AWS_PROFILE": "default",
    "AWS_ACCESS_KEY_ID": "your_key",
    "AWS_SECRET_ACCESS_KEY": "your_secret"
  }
}
```

### 2. HTTP 连接
通过 HTTP 协议与 MCP 服务器通信。

```json
{
  "name": "HTTP MCP 服务",
  "connection_type": "http",
  "command": "http://localhost:8080/mcp",
  "args": [],
  "env": {
    "API_KEY": "your_api_key"
  }
}
```

### 3. SSE (Server-Sent Events) 连接
通过 SSE 协议进行实时通信。

```json
{
  "name": "SSE MCP 服务",
  "connection_type": "sse",
  "command": "http://localhost:8080/mcp/events",
  "args": [],
  "env": {
    "TOKEN": "your_token"
  }
}
```

## MCP 工具配置

### 数据库表结构
```sql
CREATE TABLE mcp_tool (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    connection_type VARCHAR(50) NOT NULL, -- stdio, http, sse
    command VARCHAR(255),
    args JSONB DEFAULT '[]',
    env JSONB DEFAULT '{}',
    server_group_id INTEGER REFERENCES server_group(id),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 配置示例

#### AWS 工具集成
```json
{
  "name": "AWS 管理工具",
  "description": "AWS 云服务管理工具集合",
  "connection_type": "stdio",
  "command": "uvx",
  "args": ["mcp-server-aws"],
  "env": {
    "AWS_REGION": "us-east-1",
    "AWS_PROFILE": "default"
  },
  "server_group_id": 1
}
```

#### GitHub 工具集成
```json
{
  "name": "GitHub 工具",
  "description": "GitHub 仓库和问题管理",
  "connection_type": "stdio",
  "command": "uvx",
  "args": ["mcp-server-github"],
  "env": {
    "GITHUB_TOKEN": "your_github_token"
  },
  "server_group_id": 1
}
```

#### 文件系统工具
```json
{
  "name": "文件系统工具",
  "description": "本地文件系统操作",
  "connection_type": "stdio",
  "command": "uvx",
  "args": ["mcp-server-filesystem", "--base-path", "/workspace"],
  "env": {},
  "server_group_id": 2
}
```

## MCP 管理器实现

### 核心管理器类
```python
# app/core/mcp_manager.py
import asyncio
import logging
from typing import Dict, List, Optional
from strands_agents import Agent, AgentConfig

class MCPManager:
    def __init__(self):
        self.agents: Dict[int, Agent] = {}
        self.tool_status: Dict[int, str] = {}
        self._health_check_task: Optional[asyncio.Task] = None

    async def initialize(self):
        """初始化 MCP 管理器"""
        logger.info("Initializing MCP Manager")
        
        # 加载启用的工具
        tools = await self._load_enabled_tools()
        for tool in tools:
            await self.start_tool(tool)
        
        # 启动健康检查
        self._health_check_task = asyncio.create_task(self._health_check_loop())

    async def start_tool(self, tool: MCPTool) -> bool:
        """启动 MCP 工具"""
        try:
            config = AgentConfig(
                name=tool.name,
                description=tool.description,
                connection_type=tool.connection_type,
                command=tool.command,
                args=tool.args,
                env=tool.env
            )
            
            agent = Agent(config)
            await agent.start()
            
            self.agents[tool.id] = agent
            self.tool_status[tool.id] = "running"
            
            await self._update_tool_status(tool.id, "running", None)
            return True
            
        except Exception as e:
            logger.error(f"Failed to start MCP tool {tool.name}: {e}")
            self.tool_status[tool.id] = "error"
            await self._update_tool_status(tool.id, "error", str(e))
            return False
```

### 工具状态管理
```python
class ToolStatusManager:
    @staticmethod
    async def update_status(tool_id: int, status: str, error_message: str = None):
        """更新工具状态"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO tool_status (mcp_tool_id, status, error_message, last_check_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (mcp_tool_id) 
                DO UPDATE SET 
                    status = EXCLUDED.status,
                    error_message = EXCLUDED.error_message,
                    last_check_at = EXCLUDED.last_check_at,
                    retry_count = CASE 
                        WHEN EXCLUDED.status = 'error' THEN tool_status.retry_count + 1
                        ELSE 0
                    END
            """, tool_id, status, error_message)

    @staticmethod
    async def get_tool_status(tool_id: int) -> Optional[dict]:
        """获取工具状态"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT status, error_message, last_check_at, retry_count
                FROM tool_status
                WHERE mcp_tool_id = $1
            """, tool_id)
            return dict(row) if row else None
```

## 服务器分组管理

### 分组策略
服务器分组用于管理 MCP 工具的负载分布和资源隔离。

```python
# app/models/server_group.py
from pydantic import BaseModel
from typing import List, Optional

class ServerGroup(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    max_tools: int = 10
    current_tools: int = 0
    is_active: bool = True

class CreateServerGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    max_tools: int = 10

# 分组管理逻辑
class ServerGroupManager:
    @staticmethod
    async def assign_tool_to_group(tool_id: int) -> Optional[int]:
        """自动分配工具到合适的分组"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # 查找有空余容量的分组
            row = await conn.fetchrow("""
                SELECT sg.id
                FROM server_group sg
                LEFT JOIN (
                    SELECT server_group_id, COUNT(*) as tool_count
                    FROM mcp_tool
                    WHERE is_enabled = true
                    GROUP BY server_group_id
                ) tc ON sg.id = tc.server_group_id
                WHERE sg.is_active = true
                AND COALESCE(tc.tool_count, 0) < sg.max_tools
                ORDER BY COALESCE(tc.tool_count, 0) ASC
                LIMIT 1
            """)
            
            if row:
                group_id = row['id']
                # 更新工具的分组
                await conn.execute("""
                    UPDATE mcp_tool 
                    SET server_group_id = $1 
                    WHERE id = $2
                """, group_id, tool_id)
                return group_id
            
            return None
```

## 健康检查机制

### 健康检查实现
```python
class HealthChecker:
    def __init__(self, mcp_manager: MCPManager):
        self.mcp_manager = mcp_manager
        self.check_interval = 30  # 30秒检查一次
        self.max_retries = 3

    async def start_health_check(self):
        """启动健康检查循环"""
        while True:
            try:
                await asyncio.sleep(self.check_interval)
                await self._perform_health_check()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")

    async def _perform_health_check(self):
        """执行健康检查"""
        for tool_id, agent in self.mcp_manager.agents.items():
            try:
                # 检查 Agent 连接状态
                is_healthy = await self._check_agent_health(agent)
                
                if is_healthy:
                    await ToolStatusManager.update_status(tool_id, "running")
                else:
                    await self._handle_unhealthy_tool(tool_id, agent)
                    
            except Exception as e:
                logger.error(f"Health check failed for tool {tool_id}: {e}")
                await ToolStatusManager.update_status(tool_id, "error", str(e))

    async def _check_agent_health(self, agent: Agent) -> bool:
        """检查单个 Agent 的健康状态"""
        try:
            # 发送 ping 请求
            response = await agent.ping(timeout=5)
            return response.get('status') == 'ok'
        except Exception:
            return False

    async def _handle_unhealthy_tool(self, tool_id: int, agent: Agent):
        """处理不健康的工具"""
        status = await ToolStatusManager.get_tool_status(tool_id)
        retry_count = status.get('retry_count', 0) if status else 0
        
        if retry_count < self.max_retries:
            # 尝试重启
            logger.info(f"Attempting to restart tool {tool_id} (retry {retry_count + 1})")
            await self._restart_tool(tool_id, agent)
        else:
            # 标记为失败
            logger.error(f"Tool {tool_id} failed after {self.max_retries} retries")
            await ToolStatusManager.update_status(tool_id, "failed", "Max retries exceeded")

    async def _restart_tool(self, tool_id: int, agent: Agent):
        """重启工具"""
        try:
            await agent.restart()
            await ToolStatusManager.update_status(tool_id, "running")
            logger.info(f"Tool {tool_id} restarted successfully")
        except Exception as e:
            await ToolStatusManager.update_status(tool_id, "error", f"Restart failed: {e}")
```

## 向量检索集成

### 工具向量化
```python
# app/services/vector_service.py
import openai
from typing import List
from app.db.connection import get_db_pool

class VectorService:
    def __init__(self, openai_api_key: str):
        self.client = openai.AsyncOpenAI(api_key=openai_api_key)

    async def vectorize_tool(self, tool_id: int, content: str):
        """将工具描述向量化"""
        try:
            # 生成向量
            response = await self.client.embeddings.create(
                model="text-embedding-ada-002",
                input=content
            )
            
            embedding = response.data[0].embedding
            
            # 存储到数据库
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO tool_vector (mcp_tool_id, content, embedding)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (mcp_tool_id) 
                    DO UPDATE SET 
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        updated_at = CURRENT_TIMESTAMP
                """, tool_id, content, embedding)
                
        except Exception as e:
            logger.error(f"Failed to vectorize tool {tool_id}: {e}")

    async def search_similar_tools(self, query: str, limit: int = 5) -> List[dict]:
        """基于查询搜索相似工具"""
        try:
            # 生成查询向量
            response = await self.client.embeddings.create(
                model="text-embedding-ada-002",
                input=query
            )
            
            query_embedding = response.data[0].embedding
            
            # 向量检索
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT 
                        mt.id, mt.name, mt.description,
                        tv.content,
                        1 - (tv.embedding <=> $1::vector) as similarity
                    FROM tool_vector tv
                    JOIN mcp_tool mt ON tv.mcp_tool_id = mt.id
                    WHERE mt.is_enabled = true
                    ORDER BY tv.embedding <=> $1::vector
                    LIMIT $2
                """, query_embedding, limit)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
```

## 常见 MCP 服务器

### 官方 MCP 服务器
```bash
# 文件系统操作
uvx mcp-server-filesystem --base-path /workspace

# SQLite 数据库
uvx mcp-server-sqlite --db-path ./database.db

# Git 操作
uvx mcp-server-git --repository /path/to/repo

# HTTP 请求
uvx mcp-server-fetch
```

### 第三方 MCP 服务器
```bash
# AWS 服务
uvx mcp-server-aws

# GitHub 集成
uvx mcp-server-github

# Google Drive
uvx mcp-server-gdrive

# Slack 集成
uvx mcp-server-slack
```

## 错误处理和重试机制

### 连接错误处理
```python
class MCPConnectionHandler:
    @staticmethod
    async def handle_connection_error(tool_id: int, error: Exception):
        """处理连接错误"""
        error_type = type(error).__name__
        error_message = str(error)
        
        # 记录错误
        logger.error(f"MCP connection error for tool {tool_id}: {error_message}")
        
        # 更新状态
        await ToolStatusManager.update_status(tool_id, "error", error_message)
        
        # 根据错误类型决定重试策略
        if error_type in ["ConnectionRefusedError", "TimeoutError"]:
            # 网络相关错误，延迟重试
            await asyncio.sleep(5)
            return True  # 可以重试
        elif error_type in ["FileNotFoundError", "PermissionError"]:
            # 配置错误，不重试
            return False
        else:
            # 其他错误，短暂延迟后重试
            await asyncio.sleep(1)
            return True

    @staticmethod
    async def retry_with_backoff(func, max_retries: int = 3, base_delay: float = 1.0):
        """带退避的重试机制"""
        for attempt in range(max_retries):
            try:
                return await func()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                
                delay = base_delay * (2 ** attempt)  # 指数退避
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)
```

## 性能优化

### 连接池管理
```python
class MCPConnectionPool:
    def __init__(self, max_connections: int = 10):
        self.max_connections = max_connections
        self.active_connections = {}
        self.connection_semaphore = asyncio.Semaphore(max_connections)

    async def get_connection(self, tool_id: int) -> Agent:
        """获取工具连接"""
        async with self.connection_semaphore:
            if tool_id not in self.active_connections:
                # 创建新连接
                agent = await self._create_agent(tool_id)
                self.active_connections[tool_id] = agent
            
            return self.active_connections[tool_id]

    async def release_connection(self, tool_id: int):
        """释放连接"""
        if tool_id in self.active_connections:
            agent = self.active_connections[tool_id]
            await agent.close()
            del self.active_connections[tool_id]
```

### 缓存机制
```python
from functools import lru_cache
import asyncio

class MCPCache:
    def __init__(self, ttl: int = 300):  # 5分钟 TTL
        self.cache = {}
        self.ttl = ttl

    async def get_or_set(self, key: str, func, *args, **kwargs):
        """获取缓存或设置新值"""
        now = asyncio.get_event_loop().time()
        
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.ttl:
                return value
        
        # 缓存过期或不存在，重新获取
        value = await func(*args, **kwargs)
        self.cache[key] = (value, now)
        return value

    def invalidate(self, pattern: str = None):
        """清除缓存"""
        if pattern:
            keys_to_remove = [k for k in self.cache.keys() if pattern in k]
            for key in keys_to_remove:
                del self.cache[key]
        else:
            self.cache.clear()
```

## 监控和日志

### MCP 操作日志
```python
import structlog
from datetime import datetime

logger = structlog.get_logger()

class MCPLogger:
    @staticmethod
    def log_tool_operation(tool_id: int, operation: str, status: str, details: dict = None):
        """记录工具操作日志"""
        logger.info(
            "mcp_tool_operation",
            tool_id=tool_id,
            operation=operation,
            status=status,
            details=details or {},
            timestamp=datetime.utcnow().isoformat()
        )

    @staticmethod
    def log_agent_call(tool_id: int, method: str, args: dict, response: dict, duration: float):
        """记录 Agent 调用日志"""
        logger.info(
            "mcp_agent_call",
            tool_id=tool_id,
            method=method,
            args=args,
            response=response,
            duration=duration,
            timestamp=datetime.utcnow().isoformat()
        )
```

### 性能监控
```python
import time
from contextlib import asynccontextmanager

@asynccontextmanager
async def monitor_mcp_call(tool_id: int, operation: str):
    """监控 MCP 调用性能"""
    start_time = time.time()
    try:
        yield
        duration = time.time() - start_time
        MCPLogger.log_tool_operation(tool_id, operation, "success", {"duration": duration})
    except Exception as e:
        duration = time.time() - start_time
        MCPLogger.log_tool_operation(tool_id, operation, "error", {
            "duration": duration,
            "error": str(e)
        })
        raise
```