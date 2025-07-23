import React from 'react';
import { Modal, Input, Button } from 'antd';

interface ApiKeyCreatedModalProps {
    apiKey: string;
    visible: boolean;
    onClose: () => void;
    onCopy: () => void;
}

const ApiKeyCreatedModal: React.FC<ApiKeyCreatedModalProps> = ({
    apiKey,
    visible,
    onClose,
    onCopy,
}) => {
    return (
        <Modal
            title="API Key Created"
            open={visible}
            onOk={onClose}
            okText="I have saved the API key"
            cancelButtonProps={{ style: { display: 'none' } }}
            maskClosable={false}
            width={600}
        >
            <div>
                <p style={{ color: 'red', fontWeight: 'bold' }}>
                    IMPORTANT: Please copy this key now as it won't be shown again!
                </p>
                <Input.TextArea
                    value={apiKey}
                    readOnly
                    rows={3}
                    style={{ marginBottom: 16, fontWeight: 'bold', fontSize: '16px' }}
                />
                <Button
                    type="primary"
                    onClick={onCopy}
                >
                    Copy to Clipboard
                </Button>
            </div>
        </Modal>
    );
};

export default ApiKeyCreatedModal;