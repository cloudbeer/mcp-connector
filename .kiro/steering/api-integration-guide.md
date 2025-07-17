# API 集成指南

## API 基础信息

### 基础 URL
- 开发环境: `http://localhost:8000`
- API 版本: `v1`
- 完整路径: `http://localhost:8000/api/v1`

### 认证方式
所有 API 请求需要在 Header 中包含 API Key：
```
Authorization: Bearer {api_key}
```

### 示例 API Key
```bash
# 管理员权限 (完整管理权限)
ak-130984-tdU8Rs604uqVmx-N-c2A3A

# 助手用户权限 (仅助手调用权限)
ak-130984-5_oHlqm-iyeZFPFPEiWlZQ
```

## 核心 API 端点

### 1. API Key 管理

#### 获取 API Key 列表
```http
GET /api/v1/api-keys
Authorization: Bearer {api_key}
```

#### 创建 API Key
```http
POST /api/v1/api-keys
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "name": "新的API Key",
  "permissions": {
    "can_manage": true,
    "can_call_assistant": true,
    "is_disabled": false
  },
  "assistant_ids": [1, 2, 3]
}
```

#### 更新 API Key
```http
PUT /api/v1/api-keys/{id}
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "name": "更新的API Key",
  "permissions": {
    "can_manage": false,
    "can_call_assistant": true,
    "is_disabled": false
  }
}
```

### 2. 助手管理

#### 获取助手列表
```http
GET /api/v1/assistants
Authorization: Bearer {api_key}
```

#### 创建助手
```http
POST /api/v1/assistants
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "name": "AWS 助手",
  "description": "专门处理 AWS 相关任务的助手",
  "type": "dedicated",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "tool_ids": [1, 2, 3]
}
```

### 3. MCP 工具管理

#### 获取工具列表
```http
GET /api/v1/mcp-tools
Authorization: Bearer {api_key}
```

#### 创建 MCP 工具
```http
POST /api/v1/mcp-tools
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "name": "AWS CLI 工具",
  "description": "AWS 命令行工具集成",
  "connection_type": "stdio",
  "command": "aws-mcp-server",
  "args": ["--region", "us-east-1"],
  "env": {
    "AWS_PROFILE": "default"
  },
  "server_group_id": 1
}
```

### 4. 服务器分组管理

#### 获取服务器分组
```http
GET /api/v1/server-groups
Authorization: Bearer {api_key}
```

#### 创建服务器分组
```http
POST /api/v1/server-groups
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "name": "AWS 工具组",
  "description": "AWS 相关工具的分组",
  "max_tools": 5
}
```

## 多平台 API 兼容

### OpenAI 兼容 API
```http
POST /v1/openai/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "帮我查看 AWS EC2 实例状态"
    }
  ],
  "assistant_id": 1,
  "stream": false
}
```

### Gemini 兼容 API
```http
POST /v1/gemini/generateContent
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "contents": [
    {
      "parts": [
        {
          "text": "帮我查看 AWS EC2 实例状态"
        }
      ]
    }
  ],
  "assistant_id": 1
}
```

### Anthropic 兼容 API
```http
POST /v1/anthropic/messages
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "帮我查看 AWS EC2 实例状态"
    }
  ],
  "assistant_id": 1
}
```

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "示例数据",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": {
      "field": "name",
      "issue": "不能为空"
    }
  }
}
```

## 流式响应

对于支持流式响应的端点，响应格式为 Server-Sent Events (SSE)：

```http
POST /v1/openai/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}
```

响应：
```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

## 错误代码

| 错误代码 | HTTP 状态码 | 描述 |
|---------|------------|------|
| UNAUTHORIZED | 401 | API Key 无效或缺失 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 422 | 请求参数验证失败 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| MCP_CONNECTION_ERROR | 502 | MCP 工具连接失败 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 |

## 测试工具

### 使用 curl 测试
```bash
# 获取助手列表
curl -X GET "http://localhost:8000/api/v1/assistants" \
  -H "Authorization: Bearer ak-130984-tdU8Rs604uqVmx-N-c2A3A"

# 创建新助手
curl -X POST "http://localhost:8000/api/v1/assistants" \
  -H "Authorization: Bearer ak-130984-tdU8Rs604uqVmx-N-c2A3A" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试助手",
    "description": "用于测试的助手",
    "type": "dedicated"
  }'
```

### 使用 REST Client 测试
项目包含完整的 REST API 测试用例：
```bash
# 查看测试用例
cat backend/tests/api.rest
```

可以使用 VS Code REST Client 扩展或其他 REST 客户端工具执行测试。