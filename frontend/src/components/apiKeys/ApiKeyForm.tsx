import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Switch,
  DatePicker,
  Button,
  Space,
  Divider,
  Select,
  Alert,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { AssistantService } from '@/services/assistant.service';
import type { ApiKey, ApiKeyCreate, ApiKeyUpdate } from '@/types/apiKey.types';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface ApiKeyFormProps {
  initialValues?: ApiKey;
  onFinish: (values: ApiKeyCreate | ApiKeyUpdate) => void;
  onCancel: () => void;
  loading: boolean;
  isEdit?: boolean;
}

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  initialValues,
  onFinish,
  onCancel,
  loading,
  isEdit = false,
}) => {
  const [form] = Form.useForm();
  const [canCallAssistant, setCanCallAssistant] = useState(initialValues?.can_call_assistant ?? true);

  // Fetch all assistants for selection
  const { data: assistantsData, isLoading: isAssistantsLoading } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => AssistantService.listAssistants(true),
  });

  // Set initial form values
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        expires_at: initialValues.expires_at ? dayjs(initialValues.expires_at) : undefined,
      });
      setCanCallAssistant(initialValues.can_call_assistant);
    }
  }, [initialValues, form]);

  const handleValuesChange = (changedValues: any) => {
    if ('can_call_assistant' in changedValues) {
      setCanCallAssistant(changedValues.can_call_assistant);
    }
  };

  const handleFinish = (values: any) => {
    // Convert dayjs to ISO string for expires_at
    const formattedValues = {
      ...values,
      expires_at: values.expires_at ? values.expires_at.toISOString() : undefined,
    };
    onFinish(formattedValues);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      onValuesChange={handleValuesChange}
      initialValues={{
        name: '',
        can_manage: false,
        can_call_assistant: true,
        is_disabled: false,
        assistant_ids: [],
        ...initialValues,
      }}
    >
      <Form.Item
        name="name"
        label="API Key Name"
        rules={[{ required: true, message: 'Please enter API key name' }]}
      >
        <Input placeholder="Enter API key name" />
      </Form.Item>

      <Divider orientation="left">Permissions</Divider>

      <Form.Item
        name="can_manage"
        label="Management Permission"
        valuePropName="checked"
        help="Allow this key to manage API keys, tools, and assistants"
      >
        <Switch />
      </Form.Item>

      <Form.Item
        name="can_call_assistant"
        label="Assistant Call Permission"
        valuePropName="checked"
        help="Allow this key to call assistants via the API"
      >
        <Switch />
      </Form.Item>

      <Form.Item
        name="is_disabled"
        label="Disabled"
        valuePropName="checked"
        help="Disable this API key (it won't work for any operations)"
      >
        <Switch />
      </Form.Item>

      <Divider orientation="left">Expiration</Divider>

      <Form.Item
        name="expires_at"
        label="Expiration Date"
        help="Leave empty for no expiration"
      >
        <DatePicker
          showTime
          format="YYYY-MM-DD HH:mm:ss"
          style={{ width: '100%' }}
          placeholder="Select expiration date and time (optional)"
        />
      </Form.Item>

      <Divider orientation="left">Assistant Access</Divider>

      {!canCallAssistant && (
        <Alert
          message="Assistant Call Permission Disabled"
          description="This API key won't be able to call any assistants because Assistant Call Permission is disabled. You can still select assistants, but they won't be accessible."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item
        name="assistant_ids"
        label="Accessible Assistants"
        help="Select which assistants this API key can access"
      >
        <Select
          mode="multiple"
          placeholder="Select assistants"
          loading={isAssistantsLoading}
          style={{ width: '100%' }}
          optionFilterProp="children"
          disabled={isAssistantsLoading}
        >
          {(assistantsData?.data || []).map(assistant => (
            <Option key={assistant.id} value={assistant.id}>
              {assistant.name} - {assistant.type === 'dedicated' ? 'Dedicated' : 'Universal'}
              {!assistant.enabled && ' (Disabled)'}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit ? 'Update' : 'Create'} API Key
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ApiKeyForm;
