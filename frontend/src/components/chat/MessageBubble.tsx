import React from 'react';
import { Typography, Card, Space } from 'antd';
import { UserOutlined, RobotOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { MessageBubbleProps } from '@/types/chat';
import './ChatStyles.css';

const { Text } = Typography;

/**
 * Renders message content with special handling for <thinking> tags
 */
const renderMessageContent = (content: string) => {
    // Regular expression to match <thinking>...</thinking> tags
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;

    // Check if there are any thinking tags
    const hasThinkingTags = thinkingRegex.test(content);

    // Reset regex state after test
    thinkingRegex.lastIndex = 0;

    // If no thinking tags, just render the content as markdown
    if (!hasThinkingTags) {
        return (
            <ReactMarkdown
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                            <SyntaxHighlighter
                                style={tomorrow}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        );
    }

    // Process content with thinking tags
    const parts = [];
    let lastIndex = 0;
    let match;

    // Find all thinking tags and their positions
    while ((match = thinkingRegex.exec(content)) !== null) {
        // Add text before the thinking tag
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.substring(lastIndex, match.index)
            });
        }

        // Add the thinking content
        parts.push({
            type: 'thinking',
            content: match[1] // The content inside the thinking tags
        });

        lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last thinking tag
    if (lastIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.substring(lastIndex)
        });
    }

    // Render each part
    return (
        <>
            {parts.map((part, index) => {
                if (part.type === 'thinking') {
                    return (
                        <div key={`thinking-${index}`} className="thinking-content">
                            <LoadingOutlined className="loading-icon" />
                            <div style={{ width: '100%' }}>
                                <ReactMarkdown
                                    components={{
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            return !inline && match ? (
                                                <SyntaxHighlighter
                                                    style={tomorrow}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                    }}
                                >
                                    {part.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <ReactMarkdown
                            key={`text-${index}`}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={tomorrow}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {part.content}
                        </ReactMarkdown>
                    );
                }
            })}
        </>
    );
};

/**
 * Component to display a single message in the chat interface
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    // Format timestamp if available
    const formattedTime = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <div className={`message-bubble ${isUser ? 'user-message' : isSystem ? 'system-message' : 'assistant-message'}`}>
            {isSystem ? (
                <Card
                    size="small"
                    style={{
                        maxWidth: '90%',
                        borderRadius: 8,
                        backgroundColor: '#f6ffed',
                        borderColor: '#b7eb8f',
                        margin: '0 auto',
                    }}
                    styles={{ body: { padding: '8px 12px' } }}
                >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <InfoCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                            <Text type="secondary" style={{ fontSize: '0.9rem' }}>
                                {message.content}
                            </Text>
                        </div>
                    </Space>
                </Card>
            ) : (
                <Card
                    size="small"
                    className={isUser ? 'user-bubble' : 'assistant-bubble'}
                    style={{
                        maxWidth: '80%',
                        borderRadius: 8,
                        backgroundColor: isUser ? '#e6f7ff' : '#fff',
                        borderColor: isUser ? '#91caff' : '#d9d9d9',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    }}
                    styles={{ body: { padding: '8px 12px' } }}
                >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        {/* Message header with role and time */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                                {isUser ? (
                                    <UserOutlined style={{ color: '#1890ff' }} />
                                ) : (
                                    <RobotOutlined style={{ color: '#52c41a' }} />
                                )}
                                <Text strong style={{ fontSize: '0.9rem' }}>
                                    {isUser ? 'You' : 'Assistant'}
                                </Text>
                                {message.isStreaming && (
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                )}
                            </Space>
                            {formattedTime && (
                                <Text type="secondary" style={{ fontSize: '0.8rem', marginLeft: 8 }}>
                                    {formattedTime}
                                </Text>
                            )}
                        </div>

                        {/* Message content with markdown support */}
                        <div className="message-content">
                            {renderMessageContent(message.content)}
                        </div>
                    </Space>
                </Card>
            )}
        </div>
    );
};

export default MessageBubble;