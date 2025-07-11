# Python Development Rules for MCP Connector

## Package Management

- **Use uv as the package manager** instead of pip
- Use `uv add` to add dependencies
- Use `uv remove` to remove dependencies
- Use `uv sync` to install dependencies from pyproject.toml
- Use `uv run` to execute commands in the virtual environment
- Maintain dependencies in `pyproject.toml` instead of `requirements.txt`

## FastAPI Best Practices

1. **Use Pydantic models for request and response schemas**
   - Define clear data models for all API inputs and outputs
   - Leverage Pydantic's validation capabilities

2. **Implement dependency injection for shared resources**
   - Use FastAPI's Depends() for database connections, authentication, etc.
   - Create reusable dependency functions

3. **Utilize async/await for non-blocking operations**
   - Use async functions for I/O operations
   - Properly handle database and external API calls asynchronously

4. **Use path operations decorators (@app.get, @app.post, etc.)**
   - Organize routes with appropriate HTTP methods
   - Use proper status codes and response models

5. **Implement proper error handling with HTTPException**
   - Create custom exception handlers
   - Return meaningful error messages and status codes

6. **Use FastAPI's built-in OpenAPI and JSON Schema support**
   - Document APIs with proper descriptions and examples
   - Leverage automatic API documentation generation

## Additional Development Guidelines

### Code Quality
1. **Use type hints for all function parameters and return values**
   - Ensure all functions have proper type annotations
   - Use Union, Optional, and other typing utilities appropriately

2. **Implement proper input validation using Pydantic**
   - Validate all incoming data at API boundaries
   - Use Pydantic validators for complex validation logic

3. **Use FastAPI's background tasks for long-running operations**
   - Implement background processing for MCP server health checks
   - Handle async operations that don't need immediate response

4. **Implement proper CORS handling**
   - Configure CORS for frontend integration
   - Set appropriate origins and methods

5. **Use FastAPI's security utilities for authentication**
   - Implement proper API key validation (when needed)
   - Use OAuth2 or JWT tokens for user authentication

6. **Follow PEP 8 style guide for Python code**
   - Use consistent naming conventions
   - Maintain proper code formatting and structure

7. **Implement comprehensive unit and integration tests**
   - Write tests for all business logic
   - Use pytest with async support
   - Mock external dependencies appropriately

### Project-Specific Rules

#### Database Operations
- **No ORM usage** - implement custom database wrapper
- Use async database connections with asyncpg
- Implement proper connection pooling
- Use parameterized queries to prevent SQL injection

#### MCP Integration
- Always use context managers (`with` statements) for MCP clients
- Implement proper error handling for MCP server failures
- Use async operations for MCP server communication
- Implement retry logic with exponential backoff

#### Vector Operations
- Use pgvector for vector storage and similarity search
- Implement efficient embedding generation and storage
- Cache embeddings when appropriate
- Use proper indexing for vector similarity queries

#### API Design
- Follow RESTful principles for resource endpoints
- Use consistent response formats across all endpoints
- Implement proper pagination for list endpoints
- Use appropriate HTTP status codes

#### Configuration Management
- Use environment variables for all configuration
- Implement configuration validation at startup
- Support different environments (dev, staging, prod)
- Never commit sensitive configuration to version control

#### Logging and Monitoring
- Use structured logging with appropriate log levels
- Log all important operations and errors
- Implement request/response logging for debugging
- Use correlation IDs for request tracing

### Code Organization

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration management
│   ├── api/                 # API routes
│   │   ├── __init__.py
│   │   ├── v1/              # API version 1
│   │   │   ├── __init__.py
│   │   │   ├── openai.py    # OpenAI compatible endpoints
│   │   │   ├── gemini.py    # Gemini compatible endpoints
│   │   │   └── ...
│   ├── core/                # Core business logic
│   │   ├── __init__.py
│   │   ├── mcp_manager.py   # MCP server management
│   │   ├── assistant.py     # Assistant logic
│   │   └── vector_search.py # Vector search implementation
│   ├── db/                  # Database operations
│   │   ├── __init__.py
│   │   ├── connection.py    # Database connection management
│   │   ├── queries.py       # SQL queries
│   │   └── migrations/      # Database migrations
│   ├── models/              # Pydantic models
│   │   ├── __init__.py
│   │   ├── requests.py      # Request models
│   │   ├── responses.py     # Response models
│   │   └── database.py      # Database models
│   └── services/            # Service layer
│       ├── __init__.py
│       ├── mcp_service.py   # MCP operations
│       ├── assistant_service.py # Assistant operations
│       └── vector_service.py # Vector operations
├── tests/                   # Test files
├── scripts/                 # Utility scripts
├── pyproject.toml          # Project configuration and dependencies
└── .env.example            # Environment variables template
```

### Testing Guidelines

- Use pytest for all testing
- Implement async test support with pytest-asyncio
- Mock external dependencies (MCP servers, AI APIs)
- Test both success and failure scenarios
- Maintain high test coverage (>80%)
- Use fixtures for common test data and setup
