import axios, { AxiosError, isAxiosError } from 'axios';
import type {
  AdminOverview, AdminUser, AlertSettings, DailyUsage, CountLine, ImportCheck, ImportMapping, ImportPreview, ImportResult, DebtPayment, Product, StockMovement, TransactionItemInput, RefreshResult, User, Shop, Transaction, ChatSession, ChatMessage,
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

// On a 401, get a fresh access token once and retry. Concurrent 401s share one refresh:
// the server rotates the refresh token on every use, so a second parallel refresh would
// present an already-used token and be refused.
let refreshing: Promise<RefreshResult> | null = null;

export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= api
    .post<RefreshResult>('/api/v1/auth/refresh')
    .then((r) => { setAccessToken(r.data.accessToken); return r.data; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// Set by the auth store: called when the session can't be renewed, so the app signs out.
let onSessionExpired: () => void = () => {};
export function setSessionExpiredHandler(fn: () => void) { onSessionExpired = fn; }

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as (typeof err.config & { _retry?: boolean }) | undefined;
    // Auth endpoints answer 401 for bad credentials or a dead session — refreshing
    // there would loop (the refresh call itself 401s and triggers another refresh).
    const isAuthCall = original?.url?.startsWith('/api/v1/auth/');
    if (err.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const { accessToken } = await refreshSession();
        original.headers!['Authorization'] = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearAccessToken();
        onSessionExpired();
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

  refresh: () => refreshSession(),

  logout: () =>
    api.post('/api/v1/auth/logout'),

  /** From the link in the confirmation email. Works signed in or out. */
  verifyEmail: (token: string) =>
    api.post<{ verified: true }>('/api/v1/auth/verify-email', { token }),

  // Always answers the same, whether or not an account uses the email.
  forgotPassword: (email: string) =>
    api.post<{ sent: true }>('/api/v1/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<{ reset: true }>('/api/v1/auth/reset-password', { token, password }).then((r) => r.data),

  resendVerification: () =>
    api.post<{ sent?: true; email?: string; alreadyVerified?: true }>('/api/v1/auth/resend-verification').then((r) => r.data),
};

// ── Account ───────────────────────────────────────────────────
export const accountApi = {
  alertSettings: () =>
    api.get<AlertSettings>('/api/v1/account/alert-settings').then((r) => r.data),

  updateAlertSettings: (body: Partial<Pick<AlertSettings, 'emailAlerts' | 'quietStart' | 'quietEnd'>>) =>
    api.patch<AlertSettings>('/api/v1/account/alert-settings', body).then((r) => r.data),
};

// ── Business dashboard (admins only) ──────────────────────────
export const adminApi = {
  overview: () => api.get<AdminOverview>('/api/v1/admin/overview').then((r) => r.data),
  users: () => api.get<{ data: AdminUser[]; total: number; limit: number }>('/api/v1/admin/users').then((r) => r.data),
};

// ── Shops ─────────────────────────────────────────────────────
export const shopsApi = {
  list: () =>
    api.get<{ data: Shop[] }>('/api/v1/shops').then((r) => r.data.data),

  get: (shopId: string) =>
    api.get<Shop>(`/api/v1/shops/${shopId}`),

  create: (body: Pick<Shop, 'name' | 'type' | 'location' | 'currency'>) =>
    api.post<Shop>('/api/v1/shops', body),

  update: (shopId: string, body: Partial<Pick<Shop, 'name' | 'type' | 'location' | 'currency'>>) =>
    api.patch<Shop>(`/api/v1/shops/${shopId}`, body),

  switchActive: (shopId: string) =>
    api.post<{ activeShopId: string }>('/api/v1/shops/switch', { shopId }),

  uploadBranding: (shopId: string, kind: BrandingKind, file: Blob) => {
    const form = new FormData();
    form.append('file', file, `${kind}.png`);
    return api.put<Shop>(`/api/v1/shops/${shopId}/branding/${kind}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeBranding: (shopId: string, kind: BrandingKind) =>
    api.delete<Shop>(`/api/v1/shops/${shopId}/branding/${kind}`),
};

export type BrandingKind = 'logo' | 'signature';

// ── Transactions ──────────────────────────────────────────────
export type NewTransactionBody =
  Omit<Transaction, 'id' | 'shopId' | 'userId' | 'aiCategorized' | 'amountPaid' | 'balance' | 'items' | 'createdAt' | 'updatedAt'>
  & { items?: TransactionItemInput[] };

export const transactionsApi = {
  list: (shopId: string, params?: {
    type?: string; status?: string; category?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) => {
    // The API names the date range dateFrom/dateTo; sending from/to was silently ignored.
    const { from, to, ...rest } = params ?? {};
    return api.get<PaginatedResponse<Transaction>>(`/api/v1/shops/${shopId}/transactions`, {
      params: { ...rest, dateFrom: from || undefined, dateTo: to || undefined },
    });
  },

  get: (shopId: string, txId: string) =>
    api.get<Transaction>(`/api/v1/shops/${shopId}/transactions/${txId}`),

  create: (shopId: string, body: NewTransactionBody) =>
    api.post<Transaction>(`/api/v1/shops/${shopId}/transactions`, body),

  update: (shopId: string, txId: string, body: Partial<Transaction>) =>
    api.patch<Transaction>(`/api/v1/shops/${shopId}/transactions/${txId}`, body),

  delete: (shopId: string, txId: string) =>
    api.delete(`/api/v1/shops/${shopId}/transactions/${txId}`),

  // Payments towards a debt. Omitting amount pays off everything still owed; omitting
  // paidOn means today.
  listPayments: (shopId: string, txId: string) =>
    api.get<{ data: DebtPayment[] }>(`/api/v1/shops/${shopId}/transactions/${txId}/payments`).then((r) => r.data.data),

  recordPayment: (shopId: string, txId: string, body: { amount?: number; paidOn?: string }) =>
    api.post<{ transaction: Transaction; payment: DebtPayment }>(`/api/v1/shops/${shopId}/transactions/${txId}/payments`, body)
      .then((r) => r.data),

  removePayment: (shopId: string, txId: string, paymentId: string) =>
    api.delete<Transaction>(`/api/v1/shops/${shopId}/transactions/${txId}/payments/${paymentId}`).then((r) => r.data),
};

// ── Stock ─────────────────────────────────────────────────────
export type ProductFields = {
  name: string; unit?: string; lowStockLevel?: number | null; costPrice?: number | null; sellingPrice?: number | null;
};

export const stockApi = {
  listProducts: (shopId: string) =>
    api.get<{ data: Product[] }>(`/api/v1/shops/${shopId}/stock/products`).then((r) => r.data.data),

  createProduct: (shopId: string, body: ProductFields & { openingQuantity?: number }) =>
    api.post<Product>(`/api/v1/shops/${shopId}/stock/products`, body).then((r) => r.data),

  updateProduct: (shopId: string, productId: string, body: Partial<ProductFields>) =>
    api.patch<Product>(`/api/v1/shops/${shopId}/stock/products/${productId}`, body).then((r) => r.data),

  /** Takes it off the stock list; its history stays for past sales and reports. */
  removeProduct: (shopId: string, productId: string) =>
    api.delete(`/api/v1/shops/${shopId}/stock/products/${productId}`),

  listMovements: (shopId: string, productId: string) =>
    api.get<{ data: StockMovement[] }>(`/api/v1/shops/${shopId}/stock/products/${productId}/movements`).then((r) => r.data.data),

  /** restock: more came in (change > 0). adjustment: damaged, expired, used… (usually < 0). */
  adjust: (shopId: string, productId: string, body: { kind: 'restock' | 'adjustment'; change: number; occurredOn?: string; note?: string }) =>
    api.post<{ product: Product; movement: StockMovement }>(`/api/v1/shops/${shopId}/stock/products/${productId}/movements`, body)
      .then((r) => r.data),

  undoMovement: (shopId: string, movementId: string) =>
    api.delete<Product>(`/api/v1/shops/${shopId}/stock/movements/${movementId}`).then((r) => r.data),

  count: (shopId: string, body: { items: { productId: string; counted: number }[]; occurredOn?: string; note?: string }) =>
    api.post<{ data: CountLine[] }>(`/api/v1/shops/${shopId}/stock/counts`, body).then((r) => r.data.data),
};

// ── Chat ──────────────────────────────────────────────────────
export const chatApi = {
  listSessions: () =>
    api.get<{ data: ChatSession[] }>('/api/v1/chat/sessions').then((r) => r.data.data),

  createSession: (shopId: string) =>
    api.post<ChatSession>('/api/v1/chat/sessions', { shopId }),

  listMessages: (sessionId: string) =>
    api.get<{ data: ChatMessage[] }>(`/api/v1/chat/sessions/${sessionId}/messages`).then((r) => r.data.data),

  usage: () => api.get<DailyUsage>('/api/v1/chat/usage').then((r) => r.data),

  sendMessage: (sessionId: string, content: string) =>
    api.post<{ userMessage: ChatMessage; assistantMessage: ChatMessage; dailyUsage: DailyUsage }>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
      { content },
    ),
};

// ── Reports ───────────────────────────────────────────────────
export const reportsApi = {
  generate: (type: ReportType, body: Record<string, unknown>) =>
    api.post<Blob>(`/api/v1/reports/${type}`, body, { responseType: 'blob' }),
};

/** The file name the server chose (Content-Disposition), or a fallback. */
export function downloadName(headers: Record<string, unknown>, fallback: string): string {
  const cd = String(headers['content-disposition'] ?? '');
  return /filename="([^"]+)"/.exec(cd)?.[1] ?? fallback;
}

/**
 * The server's error message for a request made with responseType 'blob' — the error
 * body then arrives as a Blob too, so it has to be read as text before parsing.
 */
export async function blobErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (!isAxiosError(err)) return fallback;
  const data: unknown = err.response?.data;
  try {
    const text = data instanceof Blob ? await data.text() : JSON.stringify(data);
    return (JSON.parse(text) as { message?: string }).message ?? fallback;
  } catch {
    return fallback;
  }
}

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
  /** Uploads and reads the file; the reply is a preview with guessed columns. */
  upload: (shopId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('shopId', shopId);
    return api.post<ImportPreview>('/api/v1/imports/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  /** Checks every row with these column choices. */
  validate: (importId: string, mapping: ImportMapping) =>
    api.post<ImportCheck>(`/api/v1/imports/${importId}/validate`, mapping).then((r) => r.data),

  confirm: (importId: string, includeDuplicates: boolean) =>
    api.post<ImportResult>(`/api/v1/imports/${importId}/confirm`, { includeDuplicates }).then((r) => r.data),

  undo: (importId: string) =>
    api.post<{ removed: number }>(`/api/v1/imports/${importId}/undo`).then((r) => r.data),

  list: (shopId: string) =>
    api.get<{ data: ExcelImport[] }>('/api/v1/imports', { params: { shopId } }).then((r) => r.data.data),

  template: () =>
    api.get<Blob>('/api/v1/imports/template', { responseType: 'blob' }),
};

export default api;
