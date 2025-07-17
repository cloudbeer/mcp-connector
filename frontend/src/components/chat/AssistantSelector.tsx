import React, { useState, useEffect } from 'react';
import { Select, Spin, Typography, Space } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { AssistantService } from '@/services/assistant.service';
import type { AssistantSelectorProps } from '@/types/chat';
import type { Assistant } from '@/types/assistant.types';

const { Text } = Typography;
const { Option } = Select;

/**
 * Component for selecting an assistant to chat with
 */
const AssistantSelector: React.FC<AssistantSelectorProps> = ({
    onSelectAssistant,
    selectedAssistantId,
    disabled = false
}) => {
    // Fetch available assistants
    const { data: assistantsData, isLoading, error } = useQuery({
        queryKey: ['assistants', 'enabled'],
        queryFn: () => AssistantService.listAssistants(true), // Only fetch enabled assistants
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Handle assistant selection
    const handleChange = (value: string, option: any) => {
        const assistantName = option.label || '';
        onSelectAssistant(value, assistantName);
    };

    // Filter assistants to only show enabled ones
    const enabledAssistants = assistantsData?.data?.filter(assistant => assistant.enabled) || [];

    return (
        <div className="assistant-selector" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Select an Assistant:</Text>
                <Select
                    placeholder={isLoading ? "Loading assistants..." : "Select an assistant to chat with"}
                    style={{ width: '100%' }}
                    value={selectedAssistantId}
                    onChange={handleChange}
                    loading={isLoading}
                    disabled={disabled || isLoading}
                    notFoundContent={error ? "Error loading assistants" : isLoading ? <Spin size="small" /> : "No assistants available"}
                    optionLabelProp="label"
                >
                    {enabledAssistants.map((assistant: Assistant) => (
                        <Option
                            key={assistant.id.toString()}
                            value={assistant.id.toString()}
                            label={assistant.name}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                <Space direction="vertical" size={0}>
                                    <Text strong>{assistant.name}</Text>
                                    {assistant.description && (
                                        <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                                            {assistant.description.length > 60
                                                ? `${assistant.description.substring(0, 60)}...`
                                                : assistant.description}
                                        </Text>
                                    )}
                                </Space>
                            </div>
                        </Option>
                    ))}
                </Select>
                {error && (
                    <Text type="danger" style={{ fontSize: '0.8rem' }}>
                        Failed to load assistants. Please try again later.
                    </Text>
                )}
            </Space>
        </div>
    );
};

export default AssistantSelector;