import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
  List,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import {
  ImportOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { ServerGroup } from '@/types/api.types';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface BatchImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  groups: ServerGroup[];
  onImport: (data: { mcpServers: any; group_id: number }) => Promise<any>;
  loading: boolean;
}

const BatchImportModal: React.FC<BatchImportModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  groups,
  onImport,
  loading,
}) => {
  const [form] = Form.useForm();
  const [jsonInput, setJsonInput] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [parseError, setParseError] = useState<string>('');
  const [importResult, setImportResult] = useState<any>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');
  const [showExample, setShowExample] = useState(false);

  const exampleJson = `{
  "mcpServers": {
    "your-mcp-server": {
      "command": "uvx",
      "args": ["your-mcp-server"],
      "env": {
        "LOG_LEVEL": "ERROR"
      },
      "autoApprove": [],
      "disabled": false
    }
  }
}`;

  const placeholderText = `Paste your MCP servers JSON configuration here...

Example format:
{
  "mcpServers": {
    "your-mcp-server": {
      "command": "uvx",
      "args": ["your-mcp-server"],
      "env": { "LOG_LEVEL": "ERROR" }
    }
  }
}`;

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setParseError('');
    setParsedData(null);
    
    if (!value.trim()) return;
    
    try {
      const parsed = JSON.parse(value);
      if (!parsed.mcpServers) {
        setParseError('Invalid format: "mcpServers" key not found');
        return;
      }
      
      setParsedData(parsed);
    } catch (error) {
      setParseError('Invalid JSON format');
    }
  };

  const handlePreview = () => {
    if (!parsedData) return;
    setStep('preview');
  };

  const handleImport = async (values: { group_id: number }) => {
    if (!parsedData) return;
    
    try {
      const result = await onImport({
        mcpServers: parsedData.mcpServers,
        group_id: values.group_id,
      });
      
      setImportResult(result.data);
      setStep('result');
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  const handleReset = () => {
    setStep('input');
    setJsonInput('');
    setParsedData(null);
    setParseError('');
    setImportResult(null);
    setShowExample(false);
    form.resetFields();
  };

  const handleClose = () => {
    handleReset();
    onCancel();
  };

  const handleFinish = () => {
    handleReset();
    onSuccess();
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(exampleJson);
    message.success('Example JSON copied to clipboard!');
  };

  const renderInputStep = () => (
    <div>
      <Form form={form} layout="vertical">
        <Form.Item
          name="group_id"
          label="Target Server Group"
          rules={[{ required: true, message: 'Please select a server group' }]}
        >
          <Select placeholder="Select server group">
            {groups.map(group => (
              <Option key={group.id} value={group.id}>
                {group.name} ({group.max_tools} max tools)
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label={
          <Space>
            <span>JSON Configuration</span>
            {parsedData && (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                {Object.keys(parsedData.mcpServers).length} servers found
              </Tag>
            )}
          </Space>
        }>
          <TextArea
            value={jsonInput}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder={placeholderText}
            rows={12}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        {parseError && (
          <Alert
            message="Parse Error"
            description={parseError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<CodeOutlined />}
          onClick={() => setShowExample(!showExample)}
        >
          {showExample ? 'Hide' : 'Show'} Example
        </Button>
        {showExample && (
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopyExample}
          >
            Copy Example
          </Button>
        )}
      </Space>
      
      {showExample && (
        <Card size="small" title="Example JSON Configuration">
          <pre style={{ fontSize: '12px', margin: 0, overflow: 'auto' }}>
            {exampleJson}
          </pre>
        </Card>
      )}
    </div>
  );

  const renderPreviewStep = () => {
    const servers = parsedData?.mcpServers || {};
    
    return (
      <div>
        <Alert
          message="Import Preview"
          description={`Ready to import ${Object.keys(servers).length} MCP tools`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <List
          dataSource={Object.entries(servers)}
          renderItem={([name, config]: [string, any]) => (
            <List.Item>
              <Card size="small" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Text strong>{name}</Text>
                  </Col>
                  <Col span={8}>
                    <Space>
                      <Tag color="blue">{config.command}</Tag>
                      {config.disabled && <Tag color="red">Disabled</Tag>}
                    </Space>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">
                      {config.args?.length || 0} args, {Object.keys(config.env || {}).length} env vars
                    </Text>
                  </Col>
                </Row>
                {config.args && config.args.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Args: {config.args.join(' ')}
                    </Text>
                  </div>
                )}
              </Card>
            </List.Item>
          )}
        />
      </div>
    );
  };

  const renderResultStep = () => {
    if (!importResult) return null;

    const { imported, errors, summary } = importResult;

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Successfully Imported"
                value={summary.successfully_imported}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Renamed"
                value={summary.renamed_count}
                prefix={<InfoCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Errors"
                value={summary.errors}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {imported.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Successfully Imported Tools:</Title>
            <List
              size="small"
              dataSource={imported}
              renderItem={(item: any) => (
                <List.Item>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text>{item.imported_name}</Text>
                    {item.renamed && (
                      <Tag color="orange">Renamed from: {item.original_name}</Tag>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}

        {errors.length > 0 && (
          <div>
            <Title level={5}>Errors:</Title>
            <List
              size="small"
              dataSource={errors}
              renderItem={(error: any) => (
                <List.Item>
                  <Space>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    <Text>{error.tool_name}: {error.error}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    );
  };

  const getFooterButtons = () => {
    switch (step) {
      case 'input':
        return [
          <Button key="cancel" onClick={handleClose}>
            Cancel
          </Button>,
          <Button
            key="preview"
            type="primary"
            onClick={handlePreview}
            disabled={!parsedData || !!parseError}
            icon={<ImportOutlined />}
          >
            Preview Import
          </Button>,
        ];
      
      case 'preview':
        return [
          <Button key="back" onClick={() => setStep('input')}>
            Back
          </Button>,
          <Button
            key="import"
            type="primary"
            onClick={() => form.submit()}
            loading={loading}
            icon={<ImportOutlined />}
          >
            Import Tools
          </Button>,
        ];
      
      case 'result':
        return [
          <Button key="finish" type="primary" onClick={handleFinish}>
            Finish
          </Button>,
        ];
      
      default:
        return [];
    }
  };

  return (
    <Modal
      title="From JSON"
      open={visible}
      onCancel={handleClose}
      footer={getFooterButtons()}
      width={800}
      destroyOnClose
    >
      <Form form={form} onFinish={handleImport}>
        {step === 'input' && renderInputStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'result' && renderResultStep()}
      </Form>
    </Modal>
  );
};

export default BatchImportModal;
