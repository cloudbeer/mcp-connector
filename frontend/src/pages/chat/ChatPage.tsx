import React, { useState, useEffect } from 'react';
import { Card, Typography, Alert, Empty, Button, Modal } from 'antd';
import { MessageOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import AssistantSelector from '@/components/chat/AssistantSelector';
import MessageList from '@/components/chat/MessageList';
import MessageInput from '@/components/chat/MessageInput';
import { ChatService } from '@/services/chat/chatService';
import type { ChatMessage, ChatSession } from '@/types/chat';
import '@/components/chat/ChatStyles.css';

const { Title, Text } = Typography;

/**
 * Main chat page component
 */
const ChatPage: React.FC = () => {
    // State for the chat interface
    const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');
    const [selectedAssistantName, setSelectedAssistantName] = useState<string>('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [streamingMessage, setStreamingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [abortStream, setAbortStream] = useState<(() => void) | null>(null);
    const [sessionExpired, setSessionExpired] = useState<boolean>(false);

    // Local storage keys for session persistence
    const SESSION_STORAGE_KEY = 'chat_session';
    const SESSION_TIMESTAMP_KEY = 'chat_session_timestamp';

    // Session expiration time (24 hours in milliseconds)
    const SESSION_EXPIRATION = 24 * 60 * 60 * 1000;

    // Load session from local storage on component mount
    useEffect(() => {
        loadSessionFromStorage();
    }, []);

    // Save session to local storage when it changes
    useEffect(() => {
        if (selectedAssistantId && messages.length > 0) {
            saveSessionToStorage();
        }
    }, [selectedAssistantId, messages, sessionId]);

    // Check session expiration
    useEffect(() => {
        const checkSessionExpiration = () => {
            const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
            if (timestamp) {
                const sessionTime = parseInt(timestamp, 10);
                const currentTime = Date.now();

                if (currentTime - sessionTime > SESSION_EXPIRATION) {
                    setSessionExpired(true);
                }
            }
        };

        checkSessionExpiration();

        // Check session expiration every minute
        const interval = setInterval(checkSessionExpiration, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Save current session to local storage
    const saveSessionToStorage = () => {
        try {
            const sessionData: ChatSession = {
                id: sessionId || uuidv4(),
                assistantId: selectedAssistantId,
                assistantName: selectedAssistantName,
                messages,
                createdAt: localStorage.getItem(SESSION_TIMESTAMP_KEY) || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
            localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());

            // Update session ID if it was newly created
            if (!sessionId) {
                setSessionId(sessionData.id);
            }
        } catch (error) {
            console.error('Error saving session to storage:', error);
        }
    };

    // Load session from local storage
    const loadSessionFromStorage = () => {
        try {
            const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
            const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);

            if (sessionData && timestamp) {
                const session: ChatSession = JSON.parse(sessionData);
                const sessionTime = parseInt(timestamp, 10);
                const currentTime = Date.now();

                // Check if session is expired (24 hours)
                if (currentTime - sessionTime > SESSION_EXPIRATION) {
                    setSessionExpired(true);
                    return;
                }

                // Restore session state
                setSelectedAssistantId(session.assistantId);
                setSelectedAssistantName(session.assistantName);
                setMessages(session.messages);
                setSessionId(session.id);
            }
        } catch (error) {
            console.error('Error loading session from storage:', error);
        }
    };

    // Handle session expiration
    const handleSessionExpired = () => {
        // Clear expired session
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_TIMESTAMP_KEY);

        // Reset state
        setSessionExpired(false);
        setMessages([]);
        setSessionId(undefined);

        // Re-add the system message if an assistant is selected
        if (selectedAssistantId && selectedAssistantName) {
            const systemMessage: ChatMessage = {
                id: uuidv4(),
                role: 'system',
                content: `You are now chatting with ${selectedAssistantName}. Type a message to start the conversation.`,
                timestamp: new Date().toISOString()
            };
            setMessages([systemMessage]);
        }
    };

    // Handle assistant selection
    const handleSelectAssistant = (assistantId: string, assistantName: string) => {
        // If changing assistants, reset the chat
        if (selectedAssistantId && selectedAssistantId !== assistantId) {
            setMessages([]);
            setSessionId(undefined);
            setStreamingMessage('');
            setError(null);

            // Cancel any ongoing streaming
            if (abortStream) {
                abortStream();
                setAbortStream(null);
            }
        }

        setSelectedAssistantId(assistantId);
        setSelectedAssistantName(assistantName);

        // Add system message when selecting an assistant
        if (assistantId && assistantName && (!selectedAssistantId || selectedAssistantId !== assistantId)) {
            const systemMessage: ChatMessage = {
                id: uuidv4(),
                role: 'system',
                content: `You are now chatting with ${assistantName}. Type a message to start the conversation.`,
                timestamp: new Date().toISOString()
            };
            setMessages([systemMessage]);
        }
    };

    // Handle sending a message
    const handleSendMessage = async (content: string) => {
        if (!selectedAssistantId || !content.trim()) return;

        // Cancel any ongoing streaming
        if (abortStream) {
            abortStream();
            setAbortStream(null);
        }

        // Add user message to the chat
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        };

        setMessages(prevMessages => [...prevMessages, userMessage]);
        setError(null);
        setIsLoading(true);

        try {
            // Prepare messages for API request
            const apiMessages = messages
                .filter(msg => msg.role !== 'system') // Filter out system messages
                .concat(userMessage)
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            // Use streaming for better user experience
            setStreamingMessage('');

            // Store the current streaming content in a variable to ensure we capture the complete response
            let currentStreamingContent = '';

            const abort = ChatService.streamMessage(
                selectedAssistantName,
                apiMessages,
                // Handle each chunk of the streaming response
                (chunk) => {
                    currentStreamingContent += chunk;
                    setStreamingMessage(currentStreamingContent);
                },
                // Handle completion of the stream
                () => {
                    // Add the complete assistant message to the chat
                    if (currentStreamingContent) {
                        const assistantMessage: ChatMessage = {
                            id: uuidv4(),
                            role: 'assistant',
                            content: currentStreamingContent,
                            timestamp: new Date().toISOString()
                        };
                        setMessages(prevMessages => [...prevMessages, assistantMessage]);
                    }
                    setStreamingMessage('');
                    setIsLoading(false);
                    setAbortStream(null);
                },
                // Handle errors
                (error) => {
                    console.error('Streaming error:', error);
                    setError(error instanceof Error ? error.message : 'An error occurred while getting a response');
                    setIsLoading(false);
                    setStreamingMessage('');
                    setAbortStream(null);
                },
                // Options
                {
                    sessionId,
                    retryOnError: true
                }
            );

            // Store the abort function
            setAbortStream(() => abort);

        } catch (error) {
            console.error('Error sending message:', error);
            setError(error instanceof Error ? error.message : 'An error occurred while sending your message');
            setIsLoading(false);
        }
    };

    // Reset the chat
    const handleResetChat = () => {
        // Cancel any ongoing streaming
        if (abortStream) {
            abortStream();
            setAbortStream(null);
        }

        setMessages([]);
        setSessionId(undefined);
        setStreamingMessage('');
        setError(null);
        setIsLoading(false);

        // Re-add the system message if an assistant is selected
        if (selectedAssistantId && selectedAssistantName) {
            const systemMessage: ChatMessage = {
                id: uuidv4(),
                role: 'system',
                content: `You are now chatting with ${selectedAssistantName}. Type a message to start the conversation.`,
                timestamp: new Date().toISOString()
            };
            setMessages([systemMessage]);
        }
    };

    return (
        <div className="chat-page">
            <Title level={2}>
                <MessageOutlined style={{ marginRight: 8 }} />
                Chat with Assistants
            </Title>
            <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                Select an assistant and start a conversation using the OpenAI-compatible API.
            </Text>

            <Card style={{ marginBottom: 24 }}>
                <AssistantSelector
                    onSelectAssistant={handleSelectAssistant}
                    selectedAssistantId={selectedAssistantId}
                    disabled={isLoading}
                />

                {error && (
                    <Alert
                        message="Error"
                        description={error}
                        type="error"
                        showIcon
                        closable
                        style={{ marginBottom: 16 }}
                        onClose={() => setError(null)}
                    />
                )}

                <div
                    className="chat-container"
                    style={{
                        height: '60vh',
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {selectedAssistantId ? (
                        <>
                            <div style={{
                                padding: '8px 16px',
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: '#fafafa',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <Text strong>{selectedAssistantName}</Text>
                                <div>
                                    {sessionId && (
                                        <Text type="secondary" style={{ fontSize: '0.8rem', marginRight: 8 }}>
                                            Session ID: {sessionId.substring(0, 8)}...
                                        </Text>
                                    )}
                                    <Button
                                        type="text"
                                        icon={<ReloadOutlined />}
                                        onClick={handleResetChat}
                                        disabled={isLoading}
                                        size="small"
                                    >
                                        Reset Chat
                                    </Button>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <MessageList
                                        messages={messages}
                                        streamingMessage={streamingMessage}
                                    />
                                </div>
                                <MessageInput
                                    onSendMessage={handleSendMessage}
                                    isLoading={isLoading}
                                    disabled={!selectedAssistantId}
                                />
                            </div>
                        </>
                    ) : (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            flexDirection: 'column',
                            padding: 24
                        }}>
                            <Empty
                                description="Select an assistant to start chatting"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        </div>
                    )}
                </div>
            </Card>

            {/* Session Expiration Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                        Session Expired
                    </div>
                }
                open={sessionExpired}
                onOk={handleSessionExpired}
                onCancel={handleSessionExpired}
                okText="Start New Session"
                cancelText="Close"
                centered
            >
                <p>Your chat session has expired. Would you like to start a new session?</p>
            </Modal>
        </div>
    );
};

export default ChatPage;