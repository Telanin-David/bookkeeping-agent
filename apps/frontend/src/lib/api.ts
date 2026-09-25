import axios, { AxiosError } from 'axios';
import type {
  User, Shop, Transaction, ChatSession, ChatMessage,
  Alert, ExcelImport, PaginatedResponse, ReportType,
} from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true, // sends HttpOnly refresh cookie automatically
});

// Attach access token from in-memory store on every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh access token on 401, retry once
api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        const { data } = await api.post<{ accessToken: string }>('/api/v1/auth/refresh');
        setAccessToken(data.accessToken);
        original.headers!['Authorization'] = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        clearAccessToken();
      }
    }
    return Promise.reject(err);
  },
);

// In-memory token — avoids localStorage XSS exposure
let _accessToken: string | null = null;
export const getAccessToken = () => _accessToken;
export const setAccessToken = (t: string) => { _accessToken = t; };
export const clearAccessToken = () => { _accessToken = null; };

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  signup: (body: { name: string; email: string; phone?: string; password: string }) =>
    api.post<{ user: User; accessToken: string }>('/api/v1/auth/signup', body),

  login: (body: { email: string; password: string }) =>
    api.post<{ user: User; accessToken: string }>('/api/v1/auth/login', body),

  refresh: () =>
    api.post<{ accessToken: string }>('/api/v1/auth/refresh'),

  logout: () =>
    api.post('/api/v1/auth/logout'),
};

// ── Shops ─────────────────────────────────────────────────────
export const shopsApi = {
  list: () =>
    api.get<Shop[]>('/api/v1/shops'),

  get: (shopId: string) =>
    api.get<Shop>(`/api/v1/shops/${shopId}`),

  create: (body: Pick<Shop, 'name' | 'type' | 'location' | 'currency'>) =>
    api.post<Shop>('/api/v1/shops', body),

  update: (shopId: string, body: Partial<Pick<Shop, 'name' | 'type' | 'location' | 'currency'>>) =>
    api.patch<Shop>(`/api/v1/shops/${shopId}`, body),

  switchActive: (shopId: string) =>
    api.post<{ activeShopId: string }>('/api/v1/shops/switch', { shopId }),
};

// ── Transactions ──────────────────────────────────────────────
export const transactionsApi = {
  list: (shopId: string, params?: {
    type?: string; status?: string; category?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) =>
    api.get<PaginatedResponse<Transaction>>(`/api/v1/shops/${shopId}/transactions`, { params }),

  get: (shopId: string, txId: string) =>
    api.get<Transaction>(`/api/v1/shops/${shopId}/transactions/${txId}`),

  create: (shopId: string, body: Omit<Transaction, 'id' | 'shopId' | 'userId' | 'aiCategorized' | 'createdAt' | 'updatedAt'>) =>
    api.post<Transaction>(`/api/v1/shops/${shopId}/transactions`, body),

  update: (shopId: string, txId: string, body: Partial<Transaction>) =>
    api.patch<Transaction>(`/api/v1/shops/${shopId}/transactions/${txId}`, body),

  delete: (shopId: string, txId: string) =>
    api.delete(`/api/v1/shops/${shopId}/transactions/${txId}`),
};

// ── Chat ──────────────────────────────────────────────────────
export const chatApi = {
  listSessions: () =>
    api.get<ChatSession[]>('/api/v1/chat/sessions'),

  createSession: (shopId: string) =>
    api.post<ChatSession>('/api/v1/chat/sessions', { shopId }),

  listMessages: (sessionId: string) =>
    api.get<ChatMessage[]>(`/api/v1/chat/sessions/${sessionId}/messages`),

  sendMessage: (sessionId: string, content: string) =>
    api.post<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
      { content },
    ),
};

// ── Reports ───────────────────────────────────────────────────
export const reportsApi = {
  generate: (type: ReportType, body: Record<string, unknown>) =>
    api.post(`/api/v1/reports/${type}`, body, { responseType: 'blob' }),
};

// ── Alerts ────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: { shopId?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Alert>>('/api/v1/alerts', { params }),

  acknowledge: (alertId: string) =>
    api.patch<Alert>(`/api/v1/alerts/${alertId}/acknowledge`),

  dismiss: (alertId: string) =>
    api.patch<Alert>(`/api/v1/alerts/${alertId}/dismiss`),
};

// ── Imports ───────────────────────────────────────────────────
export const importsApi = {
  upload: (shopId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('shopId', shopId);
    return api.post<ExcelImport>('/api/v1/imports/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  preview: (importId: string) =>
    api.get<{ importId: string; detectedColumns: string[]; previewRows: Record<string, unknown>[] }>(
      `/api/v1/imports/${importId}/preview`,
    ),

  validate: (importId: string, columnMapping: Record<string, string>) =>
    api.post<{ importId: string; totalRows: number; validRows: number; errorRows: number; qualityScore: number; errors: unknown[] }>(
      `/api/v1/imports/${importId}/validate`,
      columnMapping,
    ),

  confirm: (importId: string) =>
    api.post<{ importId: string; rowsIngested: number; rowsSkipped: number; detectedPatterns: Record<string, unknown> }>(
      `/api/v1/imports/${importId}/confirm`,
    ),
};

export default api;
