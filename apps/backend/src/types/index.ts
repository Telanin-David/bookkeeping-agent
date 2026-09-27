export type TransactionType = 'sale' | 'expense' | 'receivable' | 'payable';
export type TransactionStatus = 'pending' | 'settled' | 'overdue';
export type ShopType = 'retail' | 'wholesale' | 'services' | 'food' | 'other';
export type AlertType = 'low_cash' | 'high_payable' | 'overdue_receivable' | 'duplicate' | 'anomaly' | 'low_stock' | 'bill_due';
/** 'resolved' is set by the app itself, e.g. when a low product is restocked. */
export type AlertStatus = 'active' | 'acknowledged' | 'dismissed' | 'resolved';
export type AlertChannel = 'email' | 'sms' | 'whatsapp' | 'in_app';
export type ImportStatus = 'uploaded' | 'validating' | 'validated' | 'confirmed' | 'failed' | 'undone';
export type MessageRole = 'user' | 'assistant';
export type MessageType = 'text' | 'voice' | 'image';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  emailVerified: boolean;
  /** Can open the business dashboard. Set on the server only (npm run make-admin). */
  isAdmin: boolean;
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
  /** Receipt branding images, as URLs the browser can load (null when not set). */
  logoUrl: string | null;
  signatureUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BrandingKind = 'logo' | 'signature';

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
  /** Paid so far: sum of payments for a debt; the full amount for a settled cash sale/expense. */
  amountPaid: number;
  /** amount − amountPaid: what is still owed (0 for cash sales/expenses). */
  balance: number;
  aiCategorized: boolean;
  importId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Stock ─────────────────────────────────────────────────────
export type StockMovementKind = 'opening' | 'restock' | 'sale' | 'count' | 'adjustment';

export interface Product {
  id: string;
  shopId: string;
  name: string;
  /** What one of it is called: bag, carton, piece, litre… */
  unit: string;
  /** On hand now, according to the records. Can go below 0 if sales outrun recorded stock. */
  quantity: number;
  /** Warn when the quantity falls to this or below; null = never warn. */
  lowStockLevel: number | null;
  costPrice: number | null;
  sellingPrice: number | null;
  /** At or below its low-stock level (or out). */
  isLow: boolean;
  /** Date of the last shelf count, if any. */
  lastCountedOn: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  kind: StockMovementKind;
  /** + into stock, − out of stock. */
  change: number;
  /** For a shelf count: what was actually on the shelf. */
  counted: number | null;
  transactionId: string | null;
  note: string | null;
  occurredOn: string;
  createdAt: Date;
}

/** A product line on a sale (stock out) or a purchase (stock in). */
export interface TransactionItem {
  productId: string;
  quantity: number;
}

/** One payment towards a receivable (customer paying the shop) or payable (shop paying a supplier). */
export interface DebtPayment {
  id: string;
  transactionId: string;
  amount: number;
  paidOn: string;
  createdAt: Date;
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
  /** Transactions Claude created while producing this message (assistant messages only). */
  extractedTransactionIds: string[];
  /** Set when this message presents a receipt/invoice for an existing transaction. */
  receiptTransactionId?: string;
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
  importedRows?: number;
  skippedRows?: number;
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
