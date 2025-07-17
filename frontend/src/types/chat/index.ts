// Chat message types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: string;
    isStreaming?: boolean;
}

// Chat session types
export interface ChatSession {
    id: string;
    assistantId: string;
    assistantName: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

// OpenAI API compatible types
export interface ChatCompletionMessage {
    role: MessageRole;
    content: string;
}

export interface ChatCompletionRequest {
    model: string; // Assistant name
    messages: ChatCompletionMessage[];
    stream: boolean;
    temperature?: number;
    max_tokens?: number;
    session_id?: string;
}

export interface ChatCompletionChoice {
    index: number;
    message: {
        role: MessageRole;
        content: string;
    };
    finish_reason: string;
}

export interface ChatCompletionUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: ChatCompletionUsage;
    session_id?: string;
}

// Streaming response types
export interface ChatCompletionChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: MessageRole;
            content?: string;
        };
        finish_reason: string | null;
    }[];
}

// Component props types
export interface MessageBubbleProps {
    message: ChatMessage;
}

export interface MessageListProps {
    messages: ChatMessage[];
    streamingMessage?: string;
}

export interface MessageInputProps {
    onSendMessage: (content: string) => void;
    isLoading: boolean;
    disabled?: boolean;
}

export interface AssistantSelectorProps {
    onSelectAssistant: (assistantId: string, assistantName: string) => void;
    selectedAssistantId?: string;
    disabled?: boolean;
}

export interface ChatInterfaceProps {
    messages: ChatMessage[];
    onSendMessage: (content: string) => void;
    isLoading: boolean;
    streamingMessage?: string;
    disabled?: boolean;
}