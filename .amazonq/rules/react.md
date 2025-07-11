# React Frontend Development Rules for MCP Connector

## Package Management

- **Use bun as the package manager** instead of npm or yarn
- Use `bun add` to add dependencies
- Use `bun remove` to remove dependencies
- Use `bun install` to install dependencies from package.json
- Use `bun run` to execute scripts
- Use **https://registry.npmmirror.com** as the npm registry mirror

## Development Tools

- **Use Vite as the build tool and development server**
- Use `bun run dev` to start development server
- Use `bun run build` to build for production
- Use `bun run preview` to preview production build
- Configure Vite for optimal development experience

## UI Framework

- **Use Ant Design (antd) as the primary UI component library**
- Follow Ant Design design principles and guidelines
- Use Ant Design components consistently across the application
- Leverage Ant Design's theming capabilities

## React Best Practices

### Component Development
1. **Use functional components with hooks**
   - Prefer function components over class components
   - Use React hooks for state management and side effects
   - Create custom hooks for reusable logic

2. **Follow component structure conventions**
   ```
   src/
   ├── components/          # Reusable UI components
   │   ├── common/         # Common components
   │   ├── forms/          # Form components
   │   └── layout/         # Layout components
   ├── pages/              # Page components
   ├── hooks/              # Custom hooks
   ├── services/           # API services
   ├── utils/              # Utility functions
   ├── types/              # TypeScript type definitions
   └── constants/          # Application constants
   ```

3. **Use TypeScript for type safety**
   - Define interfaces for all props and state
   - Use proper typing for API responses
   - Leverage TypeScript's strict mode

### State Management
1. **Use React Context for global state**
   - Create contexts for authentication, theme, etc.
   - Use useContext hook to consume context values
   - Consider React Query for server state management

2. **Use local state for component-specific data**
   - Use useState for simple local state
   - Use useReducer for complex state logic
   - Keep state as close to where it's used as possible

### API Integration
1. **Create dedicated service modules**
   - Separate API calls into service functions
   - Use consistent error handling patterns
   - Implement proper loading states

2. **Use React Query for data fetching**
   - Leverage caching and background updates
   - Handle loading and error states consistently
   - Implement optimistic updates where appropriate

## Code Quality Standards

### Naming Conventions
1. **Use PascalCase for components**
   - Component files: `UserProfile.tsx`
   - Component names: `UserProfile`

2. **Use camelCase for functions and variables**
   - Function names: `handleSubmit`, `fetchUserData`
   - Variable names: `userData`, `isLoading`

3. **Use UPPER_SNAKE_CASE for constants**
   - Constants: `API_BASE_URL`, `DEFAULT_PAGE_SIZE`

### File Organization
1. **Group related files together**
   - Keep component, styles, and tests in the same directory
   - Use index files for clean imports

2. **Use consistent file naming**
   - Components: `ComponentName.tsx`
   - Hooks: `useHookName.ts`
   - Services: `serviceName.service.ts`
   - Types: `typeName.types.ts`

### Styling
1. **Use CSS Modules or styled-components**
   - Avoid global CSS conflicts
   - Keep styles close to components
   - Use Ant Design's theme variables

2. **Follow responsive design principles**
   - Use Ant Design's grid system
   - Implement mobile-first approach
   - Test on different screen sizes

## Performance Optimization

1. **Implement code splitting**
   - Use React.lazy for route-based splitting
   - Implement component-level splitting where needed

2. **Optimize re-renders**
   - Use React.memo for expensive components
   - Use useCallback and useMemo appropriately
   - Avoid creating objects in render

3. **Optimize bundle size**
   - Use tree shaking
   - Analyze bundle with tools like webpack-bundle-analyzer
   - Import only needed Ant Design components

## Testing Guidelines

1. **Write unit tests for components**
   - Use React Testing Library
   - Test user interactions, not implementation details
   - Maintain good test coverage

2. **Write integration tests for critical flows**
   - Test complete user workflows
   - Mock API calls appropriately
   - Test error scenarios

## Security Best Practices

1. **Implement proper authentication**
   - Store tokens securely
   - Implement token refresh logic
   - Handle authentication errors gracefully

2. **Validate user inputs**
   - Use Ant Design's form validation
   - Implement client-side validation
   - Never trust client-side validation alone

3. **Sanitize data display**
   - Escape user-generated content
   - Use proper encoding for different contexts

## Project-Specific Rules

### MCP Connector Frontend
1. **API Key Management**
   - Implement secure API key display (show only prefix)
   - Provide clear permission indicators
   - Implement proper key creation workflows

2. **Tool Management**
   - Use consistent forms for tool configuration
   - Implement proper validation for different connection types
   - Provide clear status indicators

3. **Assistant Management**
   - Implement intuitive assistant-tool binding interface
   - Provide clear access control visualization
   - Support bulk operations where appropriate

### Development Workflow
1. **Use consistent commit messages**
   - Follow conventional commit format
   - Include scope and description
   - Reference issues where applicable

2. **Implement proper error boundaries**
   - Catch and handle React errors gracefully
   - Provide meaningful error messages to users
   - Log errors for debugging

3. **Use environment variables**
   - Store API URLs and keys in environment variables
   - Support different environments (dev, staging, prod)
   - Never commit sensitive information

## Configuration Files

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "type-check": "tsc --noEmit"
  }
}
```

### Vite Configuration
- Configure path aliases for clean imports
- Set up proxy for API calls during development
- Configure build optimizations
- Set up environment variable handling

### ESLint and Prettier
- Use consistent code formatting
- Enforce coding standards
- Configure for TypeScript and React
- Integrate with editor for real-time feedback

## Accessibility (a11y)

1. **Follow WCAG guidelines**
   - Use semantic HTML elements
   - Provide proper ARIA labels
   - Ensure keyboard navigation works

2. **Use Ant Design's accessibility features**
   - Leverage built-in accessibility support
   - Test with screen readers
   - Ensure proper color contrast

## Browser Support

- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Use appropriate polyfills if needed
- Test on different browsers and devices
- Consider progressive enhancement

## Documentation

1. **Document complex components**
   - Use JSDoc comments for functions
   - Document prop interfaces
   - Provide usage examples

2. **Maintain README files**
   - Document setup and development process
   - Include troubleshooting guides
   - Keep documentation up to date
