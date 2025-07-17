import React, { useRef, useEffect } from 'react';
import { Empty, Spin } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import MessageBubble from './MessageBubble';
import type { MessageListProps, ChatMessage } from '@/types/chat';
import './ChatStyles.css';

/**
 * Component to display a list of messages with auto-scrolling
 */
const MessageList: React.FC<MessageListProps> = ({ messages, streamingMessage }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Create a streaming message object if one exists
    const streamingMessageObj: ChatMessage | null = streamingMessage
        ? {
            id: 'streaming-' + uuidv4(),
            role: 'assistant',
            content: streamingMessage,
            timestamp: new Date().toISOString(),
            isStreaming: true,
        }
        : null;

    // Combine regular messages with streaming message
    const allMessages = [
        ...messages,
        ...(streamingMessageObj ? [streamingMessageObj] : []),
    ];

    return (
        <div
            className="message-list"
            style={{
                height: '100%',
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {allMessages.length === 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    opacity: 0.7
                }}>
                    <Empty
                        description="No messages yet"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            ) : (
                allMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))
            )}

            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;