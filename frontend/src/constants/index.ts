// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'MCP Connector';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';

// Local Storage Keys
export const STORAGE_KEYS = {
  API_KEY: 'mcp_connector_api_key',
  THEME: 'mcp_connector_theme',
  USER_PREFERENCES: 'mcp_connector_preferences',
} as const;

// Connection Types
export const CONNECTION_TYPES = [
  { value: 'stdio', label: 'Standard I/O' },
  { value: 'http', label: 'HTTP' },
  { value: 'sse', label: 'Server-Sent Events' },
] as const;

// Default Values
export const DEFAULT_TIMEOUT = 30;
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 5;
export const DEFAULT_MAX_TOOLS = 10;

// Validation Rules
export const VALIDATION_RULES = {
  API_KEY_NAME: {
    min: 1,
    max: 100,
  },
  TOOL_NAME: {
    min: 1,
    max: 100,
  },
  GROUP_NAME: {
    min: 1,
    max: 100,
  },
  TIMEOUT: {
    min: 1,
    max: 300,
  },
  RETRY_COUNT: {
    min: 0,
    max: 10,
  },
  RETRY_DELAY: {
    min: 1,
    max: 60,
  },
  MAX_TOOLS: {
    min: 1,
    max: 100,
  },
} as const;

// Status Colors
export const STATUS_COLORS = {
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
  disabled: '#d9d9d9',
} as const;

// Permission Labels
export const PERMISSION_LABELS = {
  can_manage: 'Management Access',
  can_call_assistant: 'Assistant Access',
  is_disabled: 'Disabled',
} as const;
