# MCP Connector Frontend

A React-based web interface for managing MCP (Model Context Protocol) tools and API keys.

## Features

- 🔐 **API Key Management**: Create, update, and manage API keys with granular permissions
- 🛠️ **MCP Tools**: Configure and manage MCP tools and services
- 🏢 **Server Groups**: Organize tools into logical groups
- 📊 **Dashboard**: Overview of system status and quick actions
- 🎨 **Modern UI**: Built with Ant Design for a professional look and feel

## Tech Stack

- **React 19** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Ant Design** - Professional UI components
- **Vite** - Fast build tool and dev server
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Fetch API** - Native HTTP client
- **Bun** - Fast package manager

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Backend API server running on http://localhost:8000

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The application will be available at http://localhost:3000

### Build for Production

```bash
# Build the application
bun run build

# Preview the production build
bun run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Common components
│   ├── forms/          # Form components
│   └── layout/         # Layout components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API services
├── types/              # TypeScript type definitions
├── constants/          # Application constants
└── utils/              # Utility functions
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=MCP Connector
VITE_APP_VERSION=0.1.0
```

### API Configuration

The frontend communicates with the backend API. Make sure the backend server is running and accessible.

## Authentication

The application uses API key-based authentication. Users need to provide a valid API key to access the management interface.

### Sample API Keys

For development, you can use these sample keys:

- **Admin Key**: `ak-130984-tdU8Rs604uqVmx-N-c2A3A` (Full management access)
- **Assistant Key**: `ak-130984-5_oHlqm-iyeZFPFPEiWlZQ` (Assistant access only)

## Development

### Code Style

The project uses Prettier for code formatting and ESLint for linting:

```bash
# Format code
bun run format

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix

# Type check
bun run type-check
```

### Adding New Features

1. Create components in the appropriate directory under `src/components/`
2. Add new pages in `src/pages/`
3. Define types in `src/types/`
4. Create API services in `src/services/`
5. Add constants in `src/constants/`

## API Integration

The frontend integrates with the MCP Connector backend API. Key services include:

- **ApiKeyService**: Manage API keys and permissions
- **McpToolService**: Manage MCP tools and configurations
- **ServerGroupService**: Manage server groups

## Contributing

1. Follow the established code style and patterns
2. Add TypeScript types for all new features
3. Write tests for new components and utilities
4. Update documentation as needed

## License

MIT License
