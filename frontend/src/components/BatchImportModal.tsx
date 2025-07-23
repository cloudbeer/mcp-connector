import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Alert,
  Typography,
  List,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ImportOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface BatchImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onImport: (data: { mcpServers: any }) => Promise<any>;
  loading: boolean;
}

const BatchImportModal: React.FC<BatchImportModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  onImport,
  loading,
}) => {
  const [form] = Form.useForm();
  const [jsonInput, setJsonInput] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [parseError, setParseError] = useState<string>('');
  const [importResult, setImportResult] = useState<any>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

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

  const handleImport = async () => {
    if (!parsedData) return;

    try {
      const result = await onImport({
        mcpServers: parsedData.mcpServers,
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

  const renderInputStep = () => (
    <div style={{ minHeight: 450 }}>
      <Form form={form} layout="vertical">
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
            rows={16}
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

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
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
                        {config.url ? (
                          <Tag color="green">{config.url}</Tag>
                        ) : (
                          <Tag color="blue">{config.command}</Tag>
                        )}
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
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
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
          </div>
        )}

        {errors.length > 0 && (
          <div>
            <Title level={5}>Errors:</Title>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
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
            onClick={handleImport}
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
      width={900}
      style={{ top: 20 }}
    >
      {step === 'input' && renderInputStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'result' && renderResultStep()}

    </Modal>
  );
};

export default BatchImportModal;