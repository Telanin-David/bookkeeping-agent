export type TransactionType = 'sale' | 'expense' | 'receivable' | 'payable';
export type TransactionStatus = 'pending' | 'settled' | 'overdue';
export type ShopType = 'retail' | 'wholesale' | 'services' | 'food' | 'other';
export type AlertType = 'low_cash' | 'high_payable' | 'overdue_receivable' | 'duplicate' | 'anomaly';
export type AlertStatus = 'active' | 'acknowledged' | 'dismissed';
export type AlertChannel = 'email' | 'sms' | 'whatsapp' | 'in_app';
export type ImportStatus = 'uploaded' | 'validating' | 'validated' | 'confirmed' | 'failed';
export type MessageRole = 'user' | 'assistant';
export type MessageType = 'text' | 'voice' | 'image';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  emailVerified: boolean;
  alertEmail: boolean;
  alertSms: boolean;
  alertWhatsapp: boolean;
  alertQuietStart: string;
  alertQuietEnd: string;
  thresholdLowCash: number;
  thresholdHighPayable: number;
  thresholdOverdueDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  type: ShopType;
  location?: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  shopId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string;
  category?: string;
  counterparty?: string;
  date: string;
  dueDate?: string;
  status: TransactionStatus;
  aiCategorized: boolean;
  importId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  shopId: string;
  lastMessageAt?: Date;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  createdAt: Date;
}

export interface Alert {
  id: string;
  userId: string;
  shopId: string;
  type: AlertType;
  status: AlertStatus;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  channel: AlertChannel;
  status: 'sent' | 'failed' | 'skipped';
  deliveredAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface ExcelImport {
  id: string;
  userId: string;
  shopId: string;
  filename: string;
  filePath?: string;
  status: ImportStatus;
  rowCount?: number;
  validRows?: number;
  errorRows?: number;
  qualityScore?: number;
  columnMapping?: Record<string, string>;
  errorLog?: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Augment Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'email'>;
    }
  }
}
