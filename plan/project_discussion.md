# MCP 服务端集合工具项目讨论记录

## 项目概述
构建一个 MCP (Model Context Protocol) 服务端集合管理工具

## 核心架构设计

### 1. 数据库管理层
- 使用数据库管理 MCP server 的信息和配置
- 配置完成后自动启动 MCP server
- 支持单个 host 运行多个 MCP server

### 2. 助手路由系统
#### 专用助手 (如 aws_helper)
- 可选择绑定 1-5 个特定的 MCP server
- 针对特定领域优化

#### 通用全域助手
- 通过意图识别自动召回 1-5 个相关 MCP server
- 智能路由到合适的服务

### 3. 多平台兼容的 API 层
- 兼容 OpenAI API 标准
- 兼容 Gemini API 标准  
- 兼容 Bedrock API 标准
- 兼容 Anthropic API 标准
- 对外提供统一的 RESTful 服务

## 问题1：数据库管理和 MCP Server 管理

### 用户回答：
- **数据库选型**：PostgreSQL
- **服务器承载量分组**：
  - 考虑单个服务器的 MCP 工具数量限制
  - 配置 MCP 工具时按服务器承载量分组
  - 服务启动时带分组参数，只启动特定分组的 MCP server
- **连接方式兼容性**：stdio、HTTP、SSE 三种类型都要支持
- **健康检查**：需要轮询工具检查 MCP server 状态
- **启动策略**：
  - 配置添加到数据库后不立即操作
  - 只有服务启动/重启时才读取新配置
  - 可探索自动刷新工具功能
- **故障处理**：失败的 MCP 需要重试，若干次后标记为失败状态

## 问题2：助手系统设计

### 用户回答：
- **专用助手配置**：
  - 助手需要在数据库中预配置好绑定的 MCP server
  - 尽量支持动态配置（取决于 Strands Agent 的能力）
  - 工具调用策略交由 Strands Agent 处理
- **通用全域助手的意图识别**：
  - 使用 LLM 提取意图
  - 使用向量检索从工具中调取相关 MCP server
  - Rerank 策略待定，需要建议
- **助手管理**：
  - 助手配置存储在 PostgreSQL 中
  - 如果能支持动态创建/修改/删除最好

### 针对 Rerank 的建议：
1. **混合评分策略**：
   - 向量相似度得分 (40%)
   - 工具使用频率/成功率 (30%)
   - 工具响应时间 (20%)
   - 用户反馈评分 (10%)

2. **上下文感知 Rerank**：
   - 考虑对话历史中已使用的工具
   - 根据用户角色/权限过滤工具
   - 基于时间窗口的工具热度

3. **学习型 Rerank**：
   - 记录用户选择偏好
   - 基于成功调用的工具组合进行推荐

## 问题3：多平台 API 兼容性

### 用户回答：
- **API 路由设计**：按照建议的例子实现，符合各平台规范
  - `/v1/openai/chat/completions`
  - `/v1/gemini/generateContent`
  - `/v1/bedrock/invoke-model`
  - `/v1/anthropic/messages`
- **请求/响应格式转换**：
  - 格式转换通过代码实现
  - 只需支持核心对话功能
  - 保留扩展能力
- **流式响应**：
  - 需要支持流式响应
  - Strands 能处理协调问题
  - 只需将 Strands 的输出封装到 REST 响应中

### 注意：认证和限流问题未回答，需要后续确认

## 问题4：技术架构和实现

### 用户回答：
- **技术栈选择**：
  - 后端框架：FastAPI
  - 需要异步处理能力（如状态更新）
  - 数据库：不使用任何 ORM，自己写简单封装
- **向量检索实现**：
  - 向量数据库：pgvector（PostgreSQL 扩展）
  - 向量化内容：工具的描述 + 变体
- **服务部署和扩展**：暂不考虑
- **监控和日志**：暂不考虑

## 问题5：数据库设计和项目结构

### 用户回答：
- **数据库表设计**：使用单数命名
  - `mcp_tool` - MCP 工具配置
  - `server_group` - 服务器分组
  - `assistant` - 助手配置
  - `assistant_tool` - 助手与工具的关联关系
  - `tool_vector` - 工具向量化数据
  - `tool_status` - 工具状态记录

### 重要补充需求：
- **认证和限流**：暂不设计
- **Strands Model Provider 配置**：
  - 需要配置 Model Provider
  - 写到环境变量中
  - 开发模式下使用 .env 文件
- **Web 前端**：
  - 需要做一个 chatbox 的 web 前端
  - 目录结构需要相应调整
  - 前端页面稍后规划

### 调整后的项目目录结构：
```
mcp-connector/
├── backend/
│   ├── app/
│   │   ├── api/          # API 路由
│   │   ├── core/         # 核心业务逻辑
│   │   ├── db/           # 数据库操作
│   │   ├── models/       # 数据模型
│   │   └── services/     # 服务层
│   ├── config/           # 配置文件
│   ├── scripts/          # 脚本工具
│   ├── .env.example      # 环境变量示例
│   └── requirements.txt  # Python 依赖
├── frontend/             # Web 前端（稍后规划）
├── plan/                 # 项目规划文档
├── docker-compose.yml    # 开发环境
└── README.md
```

## 稍后规划的功能
- API Key 认证
- 限流降级
- 监控和日志
- 服务部署和扩展
