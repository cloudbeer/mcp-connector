# MCP Connector - Kiro 文档中心

欢迎使用 MCP Connector 项目的 Kiro 文档中心。这里包含了项目开发、部署和维护的完整指南。

## 📋 文档目录

### 🏗️ 项目概览
- **[项目概览](steering/project-overview.md)** - 项目架构、技术栈和核心功能介绍
- **[开发标准](steering/development-standards.md)** - 代码规范、项目结构和最佳实践

### 🔧 开发指南
- **[后端开发指南](steering/backend-development-guide.md)** - FastAPI 后端开发完整指南
- **[前端开发指南](steering/frontend-development-guide.md)** - React 前端开发完整指南
- **[数据库架构指南](steering/database-schema-guide.md)** - 数据库设计和操作指南

### 🔌 集成指南
- **[API 集成指南](steering/api-integration-guide.md)** - API 使用和集成说明
- **[MCP 集成指南](steering/mcp-integration-guide.md)** - MCP 工具集成和管理

### 🚀 部署运维
- **[部署指南](steering/deployment-guide.md)** - 开发和生产环境部署指南

## 🎯 快速导航

### 新手入门
1. 阅读 [项目概览](steering/project-overview.md) 了解项目架构
2. 查看 [开发标准](steering/development-standards.md) 了解开发规范
3. 根据需要选择 [后端](steering/backend-development-guide.md) 或 [前端](steering/frontend-development-guide.md) 开发指南

### 开发者指南
- **后端开发**: [后端开发指南](steering/backend-development-guide.md) + [数据库架构指南](steering/database-schema-guide.md)
- **前端开发**: [前端开发指南](steering/frontend-development-guide.md) + [API 集成指南](steering/api-integration-guide.md)
- **MCP 集成**: [MCP 集成指南](steering/mcp-integration-guide.md)

### 运维人员
- **部署**: [部署指南](steering/deployment-guide.md)
- **API 文档**: [API 集成指南](steering/api-integration-guide.md)

## 🔍 文档使用说明

### Kiro Steering 机制
这些文档使用 Kiro 的 Steering 机制，会在以下情况自动加载：

- **项目概览** - 始终包含，提供项目基础信息
- **开发标准** - 始终包含，确保代码质量
- **后端指南** - 当处理 `backend/**` 文件时自动加载
- **前端指南** - 当处理 `frontend/**` 文件时自动加载
- **数据库指南** - 当处理 `**/db/**` 文件时自动加载
- **MCP 指南** - 当处理 `**/mcp_*` 文件时自动加载

### 手动引用文档
在与 Kiro 对话时，你可以使用以下方式引用特定文档：

```
#project-overview     - 项目概览
#development-standards - 开发标准
#backend-guide        - 后端开发指南
#frontend-guide       - 前端开发指南
#database-guide       - 数据库架构指南
#api-guide           - API 集成指南
#mcp-guide           - MCP 集成指南
#deployment-guide     - 部署指南
```

## 📚 相关资源

### 项目文档
- [主 README](../README.md) - 项目主要说明文档
- [后端 README](../backend/README.md) - 后端服务说明
- [前端 README](../frontend/README.md) - 前端应用说明

### 规划文档
- [项目讨论记录](../plan/project_discussion.md) - 需求分析和设计决策
- [数据库设计](../plan/database_schema.sql) - 数据库结构定义

### 开发规范
- [Python 开发规范](../backend/.amazonq/rules/python.md) - 后端代码规范
- [React 开发规范](../frontend/.amazonq/rules/react.md) - 前端代码规范

## 🤝 贡献指南

### 更新文档
1. 文档位于 `.kiro/steering/` 目录下
2. 使用 Markdown 格式编写
3. 遵循现有的文档结构和风格
4. 更新后测试 Kiro 的自动加载功能

### 文档规范
- 使用清晰的标题层次结构
- 提供实用的代码示例
- 包含必要的配置说明
- 保持内容的时效性和准确性

## 📞 获取帮助

如果你在使用过程中遇到问题：

1. 首先查阅相关的文档指南
2. 检查项目的 README 文件
3. 查看代码中的注释和示例
4. 在项目仓库中提交 Issue

---

**提示**: 这些文档会随着项目的发展持续更新，建议定期查看最新版本。