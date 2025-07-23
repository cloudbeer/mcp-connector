-- MCP 服务端集合工具数据库 Schema
-- 使用 PostgreSQL + pgvector

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- MCP 工具配置表
CREATE TABLE mcp_tool (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('stdio', 'http', 'sse')),
    
    -- stdio 配置
    command VARCHAR(500),
    args JSONB,
    env JSONB, -- 环境变量
    
    -- http/sse 配置
    url VARCHAR(500),
    headers JSONB,
    
    -- 通用配置
    timeout INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 5,
    disabled BOOLEAN DEFAULT false, -- 是否禁用
    auto_approve JSONB, -- 自动批准的操作列表
    
    -- 状态
    enabled BOOLEAN DEFAULT true,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 工具状态记录表
CREATE TABLE tool_status (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'stopped', 'failed', 'starting')),
    error_message TEXT,
    last_health_check TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 助手配置表
CREATE TABLE assistant (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('dedicated', 'universal')),
    
    -- 通用全域助手配置
    intent_model VARCHAR(100), -- LLM 模型名称
    max_tools INTEGER DEFAULT 5, -- 最大召回工具数
    
    -- 配置
    enabled BOOLEAN DEFAULT true,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 助手与工具关联表（专用助手使用）
CREATE TABLE assistant_tool (
    id SERIAL PRIMARY KEY,
    assistant_id INTEGER REFERENCES assistant(id) ON DELETE CASCADE,
    tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1, -- 优先级，数字越小优先级越高
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(assistant_id, tool_id)
);

-- 工具向量化数据表（通用助手使用）
CREATE TABLE tool_vector (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES mcp_tool(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- 向量化的原始内容（描述+变体）
    embedding vector(1536), -- 向量数据，假设使用 OpenAI embedding 维度
    
    -- 元数据
    model_name VARCHAR(100) NOT NULL, -- 使用的 embedding 模型
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tool_id)
);

-- 创建索引
CREATE INDEX idx_mcp_tool_enabled ON mcp_tool(enabled);
CREATE INDEX idx_tool_status_tool_id ON tool_status(tool_id);
CREATE INDEX idx_tool_status_status ON tool_status(status);
CREATE INDEX idx_assistant_type ON assistant(type);
CREATE INDEX idx_assistant_enabled ON assistant(enabled);
CREATE INDEX idx_assistant_tool_assistant_id ON assistant_tool(assistant_id);
CREATE INDEX idx_assistant_tool_priority ON assistant_tool(priority);

-- 向量相似度搜索索引
CREATE INDEX idx_tool_vector_embedding ON tool_vector USING ivfflat (embedding vector_cosine_ops);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间戳触发器
CREATE TRIGGER update_mcp_tool_updated_at BEFORE UPDATE ON mcp_tool FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assistant_updated_at BEFORE UPDATE ON assistant FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- API Key 管理表
CREATE TABLE api_key (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- API Key 名称/描述
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- API Key 哈希值
    key_prefix VARCHAR(20) NOT NULL, -- API Key 前缀（用于显示）
    
    -- 权限控制
    can_manage BOOLEAN DEFAULT false, -- 是否能后台管理
    can_call_assistant BOOLEAN DEFAULT true, -- 是否能调用助手
    is_disabled BOOLEAN DEFAULT false, -- 是否禁用
    
    -- 元数据
    created_by VARCHAR(100), -- 创建者
    last_used_at TIMESTAMP, -- 最后使用时间
    expires_at TIMESTAMP, -- 过期时间
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Key 与助手的映射关系表
CREATE TABLE api_key_assistant (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_key(id) ON DELETE CASCADE,
    assistant_id INTEGER REFERENCES assistant(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(api_key_id, assistant_id)
);

-- API Key 使用日志表
CREATE TABLE api_key_usage_log (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_key(id) ON DELETE CASCADE,
    endpoint VARCHAR(200), -- 调用的端点
    assistant_id INTEGER REFERENCES assistant(id) ON DELETE SET NULL, -- 调用的助手
    ip_address INET, -- 客户端IP
    user_agent TEXT, -- 用户代理
    request_size INTEGER, -- 请求大小
    response_size INTEGER, -- 响应大小
    status_code INTEGER, -- HTTP状态码
    error_message TEXT, -- 错误信息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_api_key_hash ON api_key(key_hash);
CREATE INDEX idx_api_key_disabled ON api_key(is_disabled);
CREATE INDEX idx_api_key_assistant_key_id ON api_key_assistant(api_key_id);
CREATE INDEX idx_api_key_assistant_assistant_id ON api_key_assistant(assistant_id);
CREATE INDEX idx_api_key_usage_log_key_id ON api_key_usage_log(api_key_id);
CREATE INDEX idx_api_key_usage_log_created_at ON api_key_usage_log(created_at);

-- 为 api_key 表添加更新时间戳触发器
CREATE TRIGGER update_api_key_updated_at BEFORE UPDATE ON api_key FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入示例数据
-- INSERT INTO api_key (name, key_hash, key_prefix, can_manage, can_call_assistant, created_by) VALUES 
-- ('Admin Key', 'hash_of_admin_key_here', 'ak-admin-', true, true, 'system'),
-- ('Assistant Key', 'hash_of_assistant_key_here', 'ak-assist-', false, true, 'system'),
-- ('Read Only Key', 'hash_of_readonly_key_here', 'ak-readonly-', false, false, 'system');