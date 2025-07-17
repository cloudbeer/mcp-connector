import React from 'react';
import { Typography, Card, Space, Tag } from 'antd';
import { UserOutlined, RobotOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { MessageBubbleProps } from '@/types/chat';
import './ChatStyles.css';

const { Text } = Typography;

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
                            <ReactMarkdown
                                components={{
                                    // Add syntax highlighting for code blocks
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
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    </Space>
                </Card>
            )}
        </div>
    );
};

export default MessageBubble;