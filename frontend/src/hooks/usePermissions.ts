import { useState, useEffect } from 'react';
import { ApiKeyService } from '@/services/apiKey.service';

interface Permissions {
    canManage: boolean;
    canCallAssistant: boolean;
    isLoading: boolean;
}

export const usePermissions = (): Permissions => {
    const [permissions, setPermissions] = useState<Permissions>({
        canManage: false,
        canCallAssistant: false,
        isLoading: true
    });

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const response = await ApiKeyService.getMyKeyInfo();
                if (response.success && response.data) {
                    setPermissions({
                        canManage: response.data.can_manage,
                        canCallAssistant: response.data.can_call_assistant,
                        isLoading: false
                    });
                } else {
                    setPermissions({
                        canManage: false,
                        canCallAssistant: false,
                        isLoading: false
                    });
                }
            } catch (error) {
                console.error('Failed to fetch permissions:', error);
                setPermissions({
                    canManage: false,
                    canCallAssistant: false,
                    isLoading: false
                });
            }
        };

        fetchPermissions();
    }, []);

    return permissions;
};