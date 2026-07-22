import axios from 'axios';
import { useTenantStore } from '../store/tenant-store';
import { usePeriodStore } from '../store/period-store';
import { useUserContextStore } from '../store/user-context-store';
import { useToastStore } from '../store/toast-store';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_SERVICE_URL ?? 'http://localhost:3002',
});

apiClient.interceptors.request.use((config) => {
  const tenantId = useTenantStore.getState().tenantId;
  const periodId = usePeriodStore.getState().periodId;
  const actingAsUserId = useUserContextStore.getState().actingAsUserId;

  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId;
  }

  if (periodId) {
    config.headers['x-period-id'] = periodId;
  }

  if (actingAsUserId) {
    config.headers['x-user-id'] = actingAsUserId;
  }

  return config;
});

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;

    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join('; ') : data.message;
    }

    if (error.response) {
      return `Request failed (${error.response.status})`;
    }

    return error.message || 'Network error — could not reach the server';
  }

  return 'Something went wrong';
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    useToastStore.getState().addToast(extractErrorMessage(error), 'error');
    return Promise.reject(error);
  },
);
