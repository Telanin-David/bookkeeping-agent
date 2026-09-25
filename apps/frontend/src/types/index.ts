export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  type: 'retail' | 'wholesale' | 'services' | 'food' | 'other';
  location?: string;
  currency: string;
  isActive: boolean;
}

export type TransactionType =
  | 'income'
  | 'expense'
  | 'receivable'
  | 'payable'
  | 'transfer';

export type TransactionStatus = 'pending' | 'completed' | 'overdue' | 'cancelled';

export interface Transaction {
  id: string;
  shopId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  counterparty?: string;
  date: string;
  dueDate?: string;
  status: TransactionStatus;
  aiCategorized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  shopId: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  type: 'text' | 'voice' | 'image';
  content: string;
  mediaUrl?: string;
  createdAt: string;
}

export type AlertType =
  | 'low_cash'
  | 'high_payable'
  | 'overdue_receivable'
  | 'unusual_expense'
  | 'budget_exceeded';

export type AlertStatus = 'active' | 'acknowledged' | 'dismissed';

export interface Alert {
  id: string;
  userId: string;
  shopId: string;
  type: AlertType;
  status: AlertStatus;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ImportStatus =
  | 'uploaded'
  | 'validating'
  | 'validated'
  | 'confirmed'
  | 'failed';

export interface ExcelImport {
  id: string;
  userId: string;
  shopId: string;
  filename: string;
  status: ImportStatus;
  rowCount?: number;
  validRows?: number;
  errorRows?: number;
  qualityScore?: number;
  columnMapping?: Record<string, string>;
  errorLog?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string>;
}

export type ReportType = 'receipt' | 'credit' | 'stock' | 'pl';
