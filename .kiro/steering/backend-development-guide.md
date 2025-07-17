---
inclusion: fileMatch
fileMatchPattern: 'backend/**'
---

# 后端开发指南

## 技术栈概览

### 核心技术
- **FastAPI**: 现代、快速的 Web 框架
- **PostgreSQL**: 关系型数据库
- **pgvector**: PostgreSQL 向量扩展
- **asyncpg**: 异步 PostgreSQL 驱动
- **Pydantic**: 数据验证和序列化
- **Strands Agents SDK**: MCP 集成和 AI Agent 管理
- **uvicorn**: ASGI 服务器

### 开发工具
- **uv**: Python 包管理器
- **Black**: 代码格式化
- **isort**: 导入排序
- **mypy**: 静态类型检查
- **pytest**: 测试框架

## 项目结构详解

```
backend/app/
├── api/                 # API 路由层
│   └── v1/             # API 版本 1
│       ├── api_keys.py # API Key 管理路由
│       ├── assistants.py # 助手管理路由
│       ├── mcp_tools.py # MCP 工具管理路由
│       └── openai_compatible.py # OpenAI 兼容 API
├── core/               # 核心业务逻辑
│   ├── auth.py        # 认证和授权
│   ├── mcp_manager.py # MCP 工具管理器
│   └── session_manager.py # 会话管理
├── db/                 # 数据库操作层
│   ├── connection.py  # 数据库连接
│   ├── queries.py     # 通用查询
│   └── api_key_queries.py # API Key 查询
├── models/             # Pydantic 数据模型
│   ├── api_key.py     # API Key 模型
│   ├── assistant.py   # 助手模型
│   └── mcp_tool.py    # MCP 工具模型
├── services/           # 业务服务层
└── utils/              # 工具函数
    └── datetime_utils.py
```

## FastAPI 应用架构

### 应用入口
```python
# app/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg

from app.api.v1 import api_keys, assistants, mcp_tools
from app.db.connection import get_db_pool, close_db_pool
from app.core.mcp_manager import MCPManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化
    await get_db_pool()
    mcp_manager = MCPManager()
    await mcp_manager.initialize()
    app.state.mcp_manager = mcp_manager
    
    yield
    
    # 关闭时清理
    await close_db_pool()
    await mcp_manager.cleanup()

app = FastAPI(
    title="MCP Connector API",
    description="MCP 服务端集合管理工具 API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(api_keys.router, prefix="/api/v1", tags=["API Keys"])
app.include_router(assistants.router, prefix="/api/v1", tags=["Assistants"])
app.include_router(mcp_tools.router, prefix="/api/v1", tags=["MCP Tools"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
```

### 路由定义
```python
# app/api/v1/api_keys.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.models.api_key import ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest
from app.core.auth import get_current_api_key, require_management_permission
from app.db.api_key_queries import ApiKeyQueries

router = APIRouter()

@router.get("/api-keys", response_model=List[ApiKey])
async def get_api_keys(
    current_key: dict = Depends(require_management_permission)
):
    """获取 API Key 列表"""
    try:
        api_keys = await ApiKeyQueries.get_all()
        return api_keys
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取 API Key 列表失败: {str(e)}"
        )

@router.post("/api-keys", response_model=ApiKey)
async def create_api_key(
    request: CreateApiKeyRequest,
    current_key: dict = Depends(require_management_permission)
):
    """创建新的 API Key"""
    try:
        api_key = await ApiKeyQueries.create(request)
        return api_key
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建 API Key 失败: {str(e)}"
        )

@router.put("/api-keys/{api_key_id}", response_model=ApiKey)
async def update_api_key(
    api_key_id: int,
    request: UpdateApiKeyRequest,
    current_key: dict = Depends(require_management_permission)
):
    """更新 API Key"""
    try:
        api_key = await ApiKeyQueries.update(api_key_id, request)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API Key 不存在"
            )
        return api_key
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新 API Key 失败: {str(e)}"
        )
```

## 数据模型定义

### Pydantic 模型
```python
# app/models/api_key.py
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime

class ApiKeyPermissions(BaseModel):
    can_manage: bool = False
    can_call_assistant: bool = True
    is_disabled: bool = False

class ApiKeyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    permissions: ApiKeyPermissions = Field(default_factory=ApiKeyPermissions)

class CreateApiKeyRequest(ApiKeyBase):
    assistant_ids: Optional[List[int]] = Field(default_factory=list)

class UpdateApiKeyRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    permissions: Optional[ApiKeyPermissions] = None
    assistant_ids: Optional[List[int]] = None

class ApiKey(ApiKeyBase):
    id: int
    key_prefix: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ApiKeyWithSecret(ApiKey):
    """包含完整密钥的模型，仅在创建时返回"""
    key: str
```

### 数据库模型
```python
# app/models/database.py
from typing import Optional, Dict, Any
from datetime import datetime

class DatabaseRecord:
    """数据库记录基类"""
    
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            key: value for key, value in self.__dict__.items()
            if not key.startswith('_')
        }

class ApiKeyRecord(DatabaseRecord):
    """API Key 数据库记录"""
    id: int
    name: str
    key_hash: str
    key_prefix: str
    permissions: Dict[str, Any]
    is_disabled: bool
    created_at: datetime
    updated_at: datetime
```

## 数据库操作层

### 连接管理
```python
# app/db/connection.py
import asyncpg
from typing import Optional
import os

_db_pool: Optional[asyncpg.Pool] = None

async def get_db_pool() -> asyncpg.Pool:
    """获取数据库连接池"""
    global _db_pool
    if _db_pool is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        _db_pool = await asyncpg.create_pool(
            database_url,
            min_size=5,
            max_size=20,
            command_timeout=60
        )
    return _db_pool

async def close_db_pool():
    """关闭数据库连接池"""
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None

async def get_db_connection():
    """获取数据库连接"""
    pool = await get_db_pool()
    async with pool.acquire() as connection:
        yield connection
```

### 查询操作
```python
# app/db/api_key_queries.py
import asyncpg
import hashlib
import secrets
from typing import List, Optional
from datetime import datetime

from app.db.connection import get_db_pool
from app.models.api_key import CreateApiKeyRequest, UpdateApiKeyRequest, ApiKey, ApiKeyWithSecret

class ApiKeyQueries:
    @staticmethod
    async def get_all() -> List[ApiKey]:
        """获取所有 API Key"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, name, key_prefix, permissions, is_disabled, 
                       created_at, updated_at
                FROM api_key
                ORDER BY created_at DESC
            """)
            return [ApiKey(**dict(row)) for row in rows]

    @staticmethod
    async def get_by_hash(key_hash: str) -> Optional[dict]:
        """根据哈希值获取 API Key"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, name, key_hash, permissions, is_disabled
                FROM api_key
                WHERE key_hash = $1
            """, key_hash)
            return dict(row) if row else None

    @staticmethod
    async def create(request: CreateApiKeyRequest) -> ApiKeyWithSecret:
        """创建新的 API Key"""
        # 生成 API Key
        key = f"ak-{secrets.randbelow(999999):06d}-{secrets.token_urlsafe(22)}"
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        key_prefix = key[:20] + "..."
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 插入 API Key
                row = await conn.fetchrow("""
                    INSERT INTO api_key (name, key_hash, key_prefix, permissions)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, name, key_prefix, permissions, is_disabled, 
                              created_at, updated_at
                """, request.name, key_hash, key_prefix, request.permissions.dict())
                
                api_key_id = row['id']
                
                # 关联助手
                if request.assistant_ids:
                    for assistant_id in request.assistant_ids:
                        await conn.execute("""
                            INSERT INTO api_key_assistant (api_key_id, assistant_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        """, api_key_id, assistant_id)
                
                return ApiKeyWithSecret(**dict(row), key=key)

    @staticmethod
    async def update(api_key_id: int, request: UpdateApiKeyRequest) -> Optional[ApiKey]:
        """更新 API Key"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 构建更新字段
                update_fields = []
                params = []
                param_count = 1
                
                if request.name is not None:
                    update_fields.append(f"name = ${param_count}")
                    params.append(request.name)
                    param_count += 1
                
                if request.permissions is not None:
                    update_fields.append(f"permissions = ${param_count}")
                    params.append(request.permissions.dict())
                    param_count += 1
                
                if not update_fields:
                    # 没有更新字段，直接返回当前记录
                    row = await conn.fetchrow("""
                        SELECT id, name, key_prefix, permissions, is_disabled,
                               created_at, updated_at
                        FROM api_key WHERE id = $1
                    """, api_key_id)
                    return ApiKey(**dict(row)) if row else None
                
                update_fields.append(f"updated_at = ${param_count}")
                params.append(datetime.utcnow())
                params.append(api_key_id)
                
                # 执行更新
                query = f"""
                    UPDATE api_key 
                    SET {', '.join(update_fields)}
                    WHERE id = ${param_count + 1}
                    RETURNING id, name, key_prefix, permissions, is_disabled,
                              created_at, updated_at
                """
                
                row = await conn.fetchrow(query, *params)
                
                if not row:
                    return None
                
                # 更新助手关联
                if request.assistant_ids is not None:
                    # 删除现有关联
                    await conn.execute("""
                        DELETE FROM api_key_assistant WHERE api_key_id = $1
                    """, api_key_id)
                    
                    # 添加新关联
                    for assistant_id in request.assistant_ids:
                        await conn.execute("""
                            INSERT INTO api_key_assistant (api_key_id, assistant_id)
                            VALUES ($1, $2)
                        """, api_key_id, assistant_id)
                
                return ApiKey(**dict(row))
```

## 认证和授权

### 认证中间件
```python
# app/core/auth.py
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
from typing import Optional

from app.db.api_key_queries import ApiKeyQueries

security = HTTPBearer()

async def get_current_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """获取当前 API Key 信息"""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key is required"
        )
    
    # 计算 API Key 哈希
    key_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    
    # 查询数据库
    api_key_info = await ApiKeyQueries.get_by_hash(key_hash)
    if not api_key_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )
    
    # 检查是否被禁用
    if api_key_info.get('is_disabled', False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key is disabled"
        )
    
    return api_key_info

async def require_management_permission(
    current_key: dict = Depends(get_current_api_key)
) -> dict:
    """要求管理权限"""
    permissions = current_key.get('permissions', {})
    if not permissions.get('can_manage', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Management permission required"
        )
    return current_key

async def require_assistant_permission(
    current_key: dict = Depends(get_current_api_key)
) -> dict:
    """要求助手调用权限"""
    permissions = current_key.get('permissions', {})
    if not permissions.get('can_call_assistant', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant permission required"
        )
    return current_key
```

## MCP 工具管理

### MCP 管理器
```python
# app/core/mcp_manager.py
import asyncio
import logging
from typing import Dict, List, Optional
from strands_agents import Agent, AgentConfig

from app.db.queries import get_enabled_mcp_tools, update_tool_status
from app.models.mcp_tool import MCPTool

logger = logging.getLogger(__name__)

class MCPManager:
    def __init__(self):
        self.agents: Dict[int, Agent] = {}
        self.tool_status: Dict[int, str] = {}
        self._health_check_task: Optional[asyncio.Task] = None

    async def initialize(self):
        """初始化 MCP 管理器"""
        logger.info("Initializing MCP Manager")
        
        # 加载启用的工具
        tools = await get_enabled_mcp_tools()
        for tool in tools:
            await self.start_tool(tool)
        
        # 启动健康检查任务
        self._health_check_task = asyncio.create_task(self._health_check_loop())

    async def start_tool(self, tool: MCPTool) -> bool:
        """启动 MCP 工具"""
        try:
            logger.info(f"Starting MCP tool: {tool.name}")
            
            # 创建 Agent 配置
            config = AgentConfig(
                name=tool.name,
                description=tool.description,
                connection_type=tool.connection_type,
                command=tool.command,
                args=tool.args,
                env=tool.env
            )
            
            # 创建并启动 Agent
            agent = Agent(config)
            await agent.start()
            
            self.agents[tool.id] = agent
            self.tool_status[tool.id] = "running"
            
            # 更新数据库状态
            await update_tool_status(tool.id, "running", None)
            
            logger.info(f"MCP tool {tool.name} started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start MCP tool {tool.name}: {e}")
            self.tool_status[tool.id] = "error"
            await update_tool_status(tool.id, "error", str(e))
            return False

    async def stop_tool(self, tool_id: int) -> bool:
        """停止 MCP 工具"""
        try:
            if tool_id in self.agents:
                agent = self.agents[tool_id]
                await agent.stop()
                del self.agents[tool_id]
            
            self.tool_status[tool_id] = "stopped"
            await update_tool_status(tool_id, "stopped", None)
            
            logger.info(f"MCP tool {tool_id} stopped")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop MCP tool {tool_id}: {e}")
            return False

    async def get_tool_agent(self, tool_id: int) -> Optional[Agent]:
        """获取工具的 Agent 实例"""
        return self.agents.get(tool_id)

    async def _health_check_loop(self):
        """健康检查循环"""
        while True:
            try:
                await asyncio.sleep(30)  # 每30秒检查一次
                await self._perform_health_check()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")

    async def _perform_health_check(self):
        """执行健康检查"""
        for tool_id, agent in self.agents.items():
            try:
                # 检查 Agent 状态
                is_healthy = await agent.is_healthy()
                if is_healthy:
                    if self.tool_status[tool_id] != "running":
                        self.tool_status[tool_id] = "running"
                        await update_tool_status(tool_id, "running", None)
                else:
                    self.tool_status[tool_id] = "error"
                    await update_tool_status(tool_id, "error", "Health check failed")
                    
            except Exception as e:
                logger.error(f"Health check failed for tool {tool_id}: {e}")
                self.tool_status[tool_id] = "error"
                await update_tool_status(tool_id, "error", str(e))

    async def cleanup(self):
        """清理资源"""
        logger.info("Cleaning up MCP Manager")
        
        # 取消健康检查任务
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        # 停止所有 Agent
        for tool_id in list(self.agents.keys()):
            await self.stop_tool(tool_id)
```

## 错误处理

### 全局异常处理
```python
# app/main.py
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_ERROR",
                "message": exc.detail,
                "status_code": exc.status_code
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

## 测试

### 单元测试示例
```python
# tests/test_api_keys.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.models.api_key import ApiKey, CreateApiKeyRequest

client = TestClient(app)

@pytest.fixture
def mock_api_key():
    return ApiKey(
        id=1,
        name="Test API Key",
        key_prefix="ak-123456-abc...",
        permissions={"can_manage": True, "can_call_assistant": True},
        is_disabled=False,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )

@patch('app.db.api_key_queries.ApiKeyQueries.get_all')
@patch('app.core.auth.get_current_api_key')
async def test_get_api_keys(mock_auth, mock_get_all, mock_api_key):
    # Mock 认证
    mock_auth.return_value = {"permissions": {"can_manage": True}}
    
    # Mock 数据库查询
    mock_get_all.return_value = [mock_api_key]
    
    response = client.get(
        "/api/v1/api-keys",
        headers={"Authorization": "Bearer test-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test API Key"

@patch('app.db.api_key_queries.ApiKeyQueries.create')
@patch('app.core.auth.get_current_api_key')
async def test_create_api_key(mock_auth, mock_create, mock_api_key):
    # Mock 认证
    mock_auth.return_value = {"permissions": {"can_manage": True}}
    
    # Mock 创建操作
    mock_create.return_value = mock_api_key
    
    request_data = {
        "name": "New API Key",
        "permissions": {
            "can_manage": False,
            "can_call_assistant": True
        }
    }
    
    response = client.post(
        "/api/v1/api-keys",
        json=request_data,
        headers={"Authorization": "Bearer test-key"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test API Key"
```

## 部署配置

### 环境变量
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/mcp_connector
OPENAI_API_KEY=your_openai_api_key
STRANDS_API_KEY=your_strands_api_key

# 可选配置
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
MAX_DB_CONNECTIONS=20
```

### Docker 配置
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装 uv
RUN pip install uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装依赖
RUN uv sync --frozen

# 复制应用代码
COPY app/ ./app/

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```