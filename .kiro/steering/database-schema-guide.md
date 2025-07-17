---
inclusion: fileMatch
fileMatchPattern: '**/db/**'
---

# 数据库架构指南

## 数据库设计原则

### 命名规范
- 表名使用单数形式：`api_key`, `assistant`, `mcp_tool`
- 字段名使用下划线分隔：`created_at`, `server_group_id`
- 主键统一使用 `id`
- 外键使用 `{table}_id` 格式

### 数据类型规范
- 主键：`SERIAL PRIMARY KEY`
- 时间戳：`TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- 布尔值：`BOOLEAN DEFAULT FALSE`
- JSON 数据：`JSONB`
- 文本：`VARCHAR(255)` 或 `TEXT`

## 核心数据表

### 1. api_key - API 密钥表
```sql
CREATE TABLE api_key (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明：**
- `key_hash`: API Key 的 SHA-256 哈希值
- `key_prefix`: API Key 的前缀，用于显示
- `permissions`: 权限配置 JSON，包含 `can_manage`, `can_call_assistant` 等

### 2. server_group - 服务器分组表
```sql
CREATE TABLE server_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_tools INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 3. mcp_tool - MCP 工具表
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

**字段说明：**
- `connection_type`: 连接类型，支持 stdio、http、sse
- `args`: 命令行参数数组
- `env`: 环境变量对象

### 4. assistant - 助手表
```sql
CREATE TABLE assistant (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- dedicated, universal
    config JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明：**
- `type`: 助手类型，dedicated（专用）或 universal（通用）
- `config`: 助手配置，包含模型参数等

### 5. assistant_tool - 助手工具关联表
```sql
CREATE TABLE assistant_tool (
    id SERIAL PRIMARY KEY,
    assistant_id INTEGER REFERENCES assistant(id) ON DELETE CASCADE,
    mcp_tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assistant_id, mcp_tool_id)
);
```

### 6. api_key_assistant - API Key 助手关联表
```sql
CREATE TABLE api_key_assistant (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_key(id) ON DELETE CASCADE,
    assistant_id INTEGER REFERENCES assistant(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_key_id, assistant_id)
);
```

### 7. tool_vector - 工具向量表
```sql
CREATE TABLE tool_vector (
    id SERIAL PRIMARY KEY,
    mcp_tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**注意：** 需要安装 pgvector 扩展：
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 8. tool_status - 工具状态表
```sql
CREATE TABLE tool_status (
    id SERIAL PRIMARY KEY,
    mcp_tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- running, stopped, error, starting
    error_message TEXT,
    last_check_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 索引优化

### 基础索引
```sql
-- API Key 查询优化
CREATE INDEX idx_api_key_hash ON api_key(key_hash);
CREATE INDEX idx_api_key_prefix ON api_key(key_prefix);

-- 工具查询优化
CREATE INDEX idx_mcp_tool_server_group ON mcp_tool(server_group_id);
CREATE INDEX idx_mcp_tool_enabled ON mcp_tool(is_enabled);

-- 助手查询优化
CREATE INDEX idx_assistant_type ON assistant(type);
CREATE INDEX idx_assistant_enabled ON assistant(is_enabled);

-- 关联表优化
CREATE INDEX idx_assistant_tool_assistant ON assistant_tool(assistant_id);
CREATE INDEX idx_assistant_tool_tool ON assistant_tool(mcp_tool_id);

-- 向量检索优化
CREATE INDEX idx_tool_vector_embedding ON tool_vector USING ivfflat (embedding vector_cosine_ops);
```

### 复合索引
```sql
-- 工具状态查询
CREATE INDEX idx_tool_status_tool_status ON tool_status(mcp_tool_id, status);

-- 时间范围查询
CREATE INDEX idx_api_key_created ON api_key(created_at);
CREATE INDEX idx_tool_status_check ON tool_status(last_check_at);
```

## 数据库操作模式

### 查询模式
```python
# 获取 API Key 的权限信息
async def get_api_key_permissions(key_hash: str) -> dict:
    query = """
    SELECT permissions, is_disabled 
    FROM api_key 
    WHERE key_hash = $1
    """
    return await db.fetchrow(query, key_hash)

# 获取助手的工具列表
async def get_assistant_tools(assistant_id: int) -> list:
    query = """
    SELECT mt.* 
    FROM mcp_tool mt
    JOIN assistant_tool at ON mt.id = at.mcp_tool_id
    WHERE at.assistant_id = $1 AND mt.is_enabled = true
    """
    return await db.fetch(query, assistant_id)
```

### 向量检索模式
```python
# 基于向量相似度检索工具
async def search_tools_by_vector(embedding: list, limit: int = 5) -> list:
    query = """
    SELECT mt.*, tv.content,
           1 - (tv.embedding <=> $1::vector) as similarity
    FROM tool_vector tv
    JOIN mcp_tool mt ON tv.mcp_tool_id = mt.id
    WHERE mt.is_enabled = true
    ORDER BY tv.embedding <=> $1::vector
    LIMIT $2
    """
    return await db.fetch(query, embedding, limit)
```

## 数据迁移

### 初始化脚本
参考 `backend/scripts/init_db.py` 进行数据库初始化。

### 迁移脚本示例
```python
# 添加新字段的迁移
async def migrate_add_field():
    await db.execute("""
    ALTER TABLE mcp_tool 
    ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 30
    """)
```

## 性能优化建议

### 查询优化
1. 使用适当的索引
2. 避免 N+1 查询问题
3. 使用 EXPLAIN ANALYZE 分析查询性能
4. 合理使用 JOIN 和子查询

### 连接池配置
```python
# asyncpg 连接池配置
DATABASE_CONFIG = {
    "min_size": 5,
    "max_size": 20,
    "command_timeout": 60,
    "server_settings": {
        "jit": "off"  # 对于简单查询可以关闭 JIT
    }
}
```

### 向量检索优化
1. 合理设置 ivfflat 索引的 lists 参数
2. 定期 VACUUM 和 ANALYZE 向量表
3. 考虑使用 HNSW 索引（PostgreSQL 14+）

## 备份和恢复

### 备份策略
```bash
# 全量备份
pg_dump -h localhost -U postgres -d mcp_connector > backup.sql

# 仅数据备份
pg_dump -h localhost -U postgres -d mcp_connector --data-only > data_backup.sql
```

### 恢复策略
```bash
# 恢复数据库
psql -h localhost -U postgres -d mcp_connector < backup.sql
```