import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Form } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import type { MessageInputProps } from '@/types/chat';
import './ChatStyles.css';

const { TextArea } = Input;

/**
 * Component for entering and sending chat messages
 */
const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage,
    isLoading,
    disabled = false
}) => {
    const [message, setMessage] = useState('');
    const [form] = Form.useForm();
    const textAreaRef = useRef<any>(null);

    // Focus the input when the component mounts
    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.focus();
        }
    }, []);

    // Handle form submission
    const handleSubmit = () => {
        const trimmedMessage = message.trim();
        if (trimmedMessage && !isLoading && !disabled) {
            onSendMessage(trimmedMessage);
            setMessage('');
            form.resetFields();

            // Re-focus the input after sending
            setTimeout(() => {
                if (textAreaRef.current) {
                    textAreaRef.current.focus();
                }
            }, 0);
        }
    };

    // Handle pressing Enter to send (but Shift+Enter for new line)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="message-input" style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
            <Form form={form} onFinish={handleSubmit} style={{ display: 'flex' }}>
                <Form.Item
                    name="message"
                    style={{ flex: 1, marginBottom: 0, marginRight: 8 }}
                    rules={[{ required: true, message: '' }]}
                >
                    <TextArea
                        ref={textAreaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message..."
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={isLoading || disabled}
                        onKeyDown={handleKeyDown}
                        style={{
                            borderRadius: '8px',
                            resize: 'none',
                            padding: '8px 12px'
                        }}
                    />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        loading={isLoading}
                        disabled={!message.trim() || disabled}
                        style={{
                            borderRadius: '8px',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    />
                </Form.Item>
            </Form>
            {isLoading && (
                <div style={{
                    fontSize: '0.8rem',
                    color: '#8c8c8c',
                    marginTop: 4,
                    textAlign: 'center'
                }}>
                    Assistant is typing...
                </div>
            )}
        </div>
    );
};

export default MessageInput;