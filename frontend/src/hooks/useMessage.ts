import { message } from 'antd';
import { useCallback } from 'react';

/**
 * Hook for using Ant Design message component with proper context support
 * This resolves the warning: "Static function can not consume context like dynamic theme"
 */
export const useMessage = () => {
    const [messageApi, contextHolder] = message.useMessage();

    const success = useCallback((content: string) => {
        messageApi.success(content);
    }, [messageApi]);

    const error = useCallback((content: string) => {
        messageApi.error(content);
    }, [messageApi]);

    const warning = useCallback((content: string) => {
        messageApi.warning(content);
    }, [messageApi]);

    const info = useCallback((content: string) => {
        messageApi.info(content);
    }, [messageApi]);

    return {
        messageApi,
        contextHolder,
        success,
        error,
        warning,
        info
    };
};