# MCP 服务端集合工具

一个基于 Strands Agents SDK 的 MCP (Model Context Protocol) 服务端集合管理工具，支持多平台 API 兼容和智能助手路由。

## 项目结构

```
mcp-connector/
├── backend/              # 后端服务 (FastAPI + PostgreSQL)
│   ├── app/             # 应用代码
│   ├── tests/           # 测试文件
│   ├── scripts/         # 工具脚本
│   ├── .env.example     # 环境变量示例
│   └── pyproject.toml   # Python 项目配置和依赖
├── frontend/            # Web 前端 (React + Ant Design)
│   ├── src/             # 源代码
│   ├── public/          # 静态资源
│   ├── .env.example     # 环境变量示例
│   └── package.json     # 前端依赖配置
├── plan/               # 项目规划文档
│   ├── project_discussion.md    # 需求讨论记录
│   ├── implementation_plan.md   # 实现计划
│   └── database_schema.sql      # 数据库设计
└── README.md           # 项目说明
```

## 核心功能

### 1. API Key 管理 ✅
- **多维度权限控制**：管理权限、助手调用权限、禁用状态
- **助手访问控制**：API Key 与助手的精细化绑定
- **使用统计和日志**：详细的调用记录和统计分析
- **安全存储**：哈希存储，前缀显示

### 2. MCP 工具管理 ✅
- 支持 stdio、HTTP、SSE 三种连接方式
- 按服务器承载量分组管理
- 自动健康检查和故障重试
- 动态启动/停止工具
- 环境变量和参数配置

### 3. 智能助手系统 🚧
- **专用助手**：预配置特定领域的工具集合
- **通用全域助手**：基于意图识别和向量检索的智能工具召回

### 4. 多平台 API 兼容 🚧
- OpenAI API 标准
- Gemini API 标准
- Bedrock API 标准
- Anthropic API 标准
- 支持流式响应

### 5. Web 管理界面 ✅
- 现代化的 React + Ant Design 界面
- 响应式设计，支持移动端
- 实时数据更新和状态监控
- 直观的权限和配置管理

## 技术栈

### 后端
- **框架**：FastAPI + uvicorn
- **数据库**：PostgreSQL + pgvector
- **包管理**：uv
- **MCP 集成**：Strands Agents SDK
- **向量检索**：pgvector + OpenAI Embeddings

### 前端
- **框架**：React 19 + TypeScript
- **UI 库**：Ant Design
- **构建工具**：Vite
- **包管理**：bun
- **状态管理**：React Query + Context
- **路由**：React Router

## 快速开始

### 1. 环境准备

```bash
# 后端依赖
curl -LsSf https://astral.sh/uv/install.sh | sh  # 安装 uv

# 前端依赖
curl -fsSL https://bun.sh/install.sh | bash      # 安装 bun

# 数据库
# 确保 PostgreSQL 已安装并运行
```

### 2. 后端启动

```bash
# 进入后端目录
cd backend

# 安装依赖
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 初始化数据库
uv run python scripts/init_db.py

# 启动后端服务
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖并启动
./start.sh

# 或者手动启动
bun install
bun run dev
```

### 4. 访问应用

- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **前端界面**: http://localhost:3000

### 5. 登录系统

使用以下示例 API Key 登录：

- **管理员**: `ak-130984-tdU8Rs604uqVmx-N-c2A3A` (完整管理权限)
- **助手用户**: `ak-130984-5_oHlqm-iyeZFPFPEiWlZQ` (仅助手调用权限)

## API 测试

后端提供了完整的 REST API 测试用例：

```bash
# 查看测试用例
cat backend/tests/api.rest

# 使用 VS Code REST Client 扩展或其他 REST 客户端工具执行测试
```

## 开发指南

### 后端开发
- 遵循 `backend/.amazonq/rules/python.md` 中的开发规范
- 使用 uv 管理依赖
- 使用 FastAPI 最佳实践
- 实现异步操作和错误处理

### 前端开发
- 遵循 `frontend/.amazonq/rules/react.md` 中的开发规范
- 使用 bun 管理依赖
- 使用 TypeScript 确保类型安全
- 遵循 Ant Design 设计规范

## 项目状态

### ✅ 已完成
1. **基础架构**：FastAPI + PostgreSQL + React 架构搭建
2. **API Key 管理**：完整的权限控制和管理功能
3. **MCP 工具管理**：工具配置和分组管理
4. **Web 界面**：现代化的管理界面
5. **认证系统**：基于 API Key 的认证和授权

### 🚧 开发中
1. **智能助手系统**：通用全域助手和向量检索
2. **多平台 API 兼容**：OpenAI/Gemini/Bedrock API 适配
3. **高级功能**：监控、限流、缓存等

### 📋 计划中
1. **部署方案**：Docker 容器化部署
2. **监控告警**：系统监控和告警机制
3. **性能优化**：缓存和性能优化
4. **文档完善**：API 文档和用户手册

## 文档

- [需求讨论记录](plan/project_discussion.md)
- [数据库设计](plan/database_schema.sql)
- [后端开发规范](backend/.amazonq/rules/python.md)
- [前端开发规范](frontend/.amazonq/rules/react.md)
- [前端 README](frontend/README.md)

## 许可证

MIT License
