export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** Alerts are only emailed to a confirmed address. Absent in demo mode. */
  emailVerified?: boolean;
  /** Can open the business dashboard (set on the server). */
  isAdmin?: boolean;
}

// ── Business dashboard (admins only) ──────────────────────────
export interface AdminOverview {
  today: string;
  windowStart: string;
  users: { total: number; verified: number; newInWindow: number; activeToday: number; active7: number; active30: number };
  ai: {
    messagesToday: number; costToday: number;
    messages: number; cost: number; failed: number; costPerMessage: number | null;
    chatUsers: number; costPerChatUser: number | null;
    monthToDate: number; monthProjected: number;
    daily: { day: string; messages: number; cost: number }[];
  };
  accuracy: { recorded: number; corrected: number; rate: number | null };
  returning: { afterDays: number; eligible: number; returned: number }[];
  emails: { sent: number; failed: number };
}

export interface AdminUser {
  id: string; name: string; email: string; signedUp: string; emailVerified: boolean; isAdmin: boolean;
  shops: number; lastActive: string | null; activeDays: number;
  messages: number; cost: number; recorded: number; corrected: number;
}

export interface AlertSettings {
  emailAlerts: boolean;
  emailVerified: boolean;
  email: string;
  /** 'HH:MM' shop time; no alert emails between quietStart and quietEnd. */
  quietStart: string;
  quietEnd: string;
}

/** POST /auth/refresh — a new access token and who it belongs to. */
export interface RefreshResult {
  accessToken: string;
  user: User;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  type: 'retail' | 'wholesale' | 'services' | 'food' | 'other';
  location?: string;
  currency: string;
  isActive: boolean;
  logoUrl?: string | null;
  signatureUrl?: string | null;
}

// Matches the backend's TransactionType/TransactionStatus exactly (DB CHECK constraint
// + OpenAPI spec) — the backend is the source of truth here, not the other way round.
export type TransactionType =
  | 'sale'
  | 'expense'
  | 'receivable'
  | 'payable';

export type TransactionStatus = 'pending' | 'settled' | 'overdue';

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
  /** Paid so far — payments towards a debt, or the full amount for a cash sale/expense. */
  amountPaid: number;
  /** Still owed (0 for cash sales/expenses and paid debts). */
  balance: number;
  aiCategorized: boolean;
  /** Products sold or bought, when the transaction was recorded with them. */
  items?: TransactionItem[];
  createdAt: string;
  updatedAt: string;
}

// ── Stock ─────────────────────────────────────────────────────
export type StockMovementKind = 'opening' | 'restock' | 'sale' | 'count' | 'adjustment';

export interface Product {
  id: string;
  shopId: string;
  name: string;
  /** What one of it is called: bag, carton, piece, litre… */
  unit: string;
  /** On hand, according to the records. Below 0 means sales outran recorded stock. */
  quantity: number;
  /** Warn at or below this; null = never warn. */
  lowStockLevel: number | null;
  costPrice: number | null;
  sellingPrice: number | null;
  isLow: boolean;
  lastCountedOn: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  kind: StockMovementKind;
  /** + into stock, − out of stock. */
  change: number;
  counted: number | null;
  transactionId: string | null;
  note: string | null;
  occurredOn: string;
  createdAt: string;
}

/** One product's result in a shelf count. */
export interface CountLine {
  product: Product;
  counted: number;
  expected: number;
  /** Negative: missing. Positive: more than recorded. */
  difference: number;
}

/** A product line on a sale (stock out) or purchase (stock in). */
export interface TransactionItemInput {
  productId: string;
  quantity: number;
}

export interface TransactionItem extends TransactionItemInput {
  name: string;
  unit: string;
}

/** One payment towards a credit sale (receivable) or bill on credit (payable). */
export interface DebtPayment {
  id: string;
  transactionId: string;
  amount: number;
  paidOn: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  shopId: string;
  /** Null until the first message is sent. */
  lastMessageAt?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  type: 'text' | 'voice' | 'image';
  content: string;
  mediaUrl?: string;
  receiptTransactionId?: string;
  createdAt: string;
}

export type AlertType =
  | 'low_cash'
  | 'high_payable'
  | 'overdue_receivable'
  | 'unusual_expense'
  | 'budget_exceeded'
  | 'duplicate'
  | 'anomaly'
  | 'low_stock'
  | 'bill_due';

/** 'resolved' is set by the app itself, e.g. when a low product is restocked. */
export type AlertStatus = 'active' | 'acknowledged' | 'dismissed' | 'resolved';

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
