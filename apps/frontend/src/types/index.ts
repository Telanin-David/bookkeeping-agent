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

/** Messages to the assistant today; limit and remaining are null when there's no limit. */
export interface DailyUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
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
  limit: { daily: number; ownerDays: number; owners: number } | null;
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
export type CostKind = 'stock' | 'running';

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
  /** Expenses and bills: goods bought to resell, or a running cost (rent, salaries, fuel…). */
  costKind?: CostKind;
  /** A salary payment: who it was for. */
  staffId?: string;
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
  | 'bill_due'
  | 'salary_due';

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

export type ImportStatus = 'uploaded' | 'validating' | 'validated' | 'confirmed' | 'failed' | 'undone';

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
  importedRows?: number;
  skippedRows?: number;
  createdAt: string;
  updatedAt: string;
}

export type ImportField = 'date' | 'amount' | 'moneyIn' | 'moneyOut' | 'description' | 'type' | 'counterparty' | 'category' | 'dueDate' | 'paid';

/** Which spreadsheet column holds each field, and what the rows are when no column says. */
export type ImportMapping = Partial<Record<ImportField, string>> & {
  defaultType?: 'sale' | 'expense' | 'receivable' | 'payable' | 'sign';
};

export interface ImportPreview {
  importId: string;
  filename: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  truncated: boolean;
  suggestedMapping: ImportMapping;
}

export interface ImportCheck {
  importId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  emptyRows: number;
  qualityScore: number;
  problems: { row: number; field: string; message: string }[];
  duplicates: { row: number; date: string; amount: number; description?: string }[];
  counts: Record<TransactionType, number>;
  moneyIn: number;
  moneyOut: number;
  dateRange: { from: string; to: string } | null;
  truncated: boolean;
}

export interface ImportResult {
  importId: string;
  imported: number;
  skipped: number;
  counts: Record<TransactionType, number>;
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

// ── Profit and staff ──────────────────────────────────────────
export interface CostLine { category: string; total: number; count: number }
export interface Insight { kind: string; tone: 'good' | 'bad' | 'neutral'; text: string }

/** One month's profit. 'sold': sales − cost of the goods sold − running costs; 'spent': sales − all spending. */
export interface MonthlyProfit {
  month: string;
  from: string;
  to: string;
  inProgress: boolean;
  sales: number;
  salesCount: number;
  coverage: number | null;
  costOfGoodsSold: number | null;
  stockBought: number;
  runningCosts: number;
  running: CostLine[];
  method: 'sold' | 'spent';
  profit: number;
  previous: { month: string; from: string; to: string; profit: number; sales: number; runningCosts: number } | null;
  salariesDue: { total: number; people: { name: string; amount: number; payDate: string }[] } | null;
  insights: Insight[];
  methodNote: string | null;
}

export interface StaffMember {
  id: string;
  shopId: string;
  name: string;
  role: string | null;
  monthlyPay: number | null;
  /** Day of the month they're paid; 29–31 mean the last day in shorter months. */
  payDay: number | null;
  /** The pay date that matters now; null without a pay day. */
  payDate: string | null;
  paid: boolean;
  /** Pay date is tomorrow, today or past, and not paid. */
  due: boolean;
  lastPaidOn: string | null;
}

export type StaffFields = { name: string; role?: string | null; monthlyPay?: number | null; payDay?: number | null };
