# Bookkeeping Agent — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS.

## Prerequisites

- Node.js 20+
- Backend running on `http://localhost:3001` (or set `NEXT_PUBLIC_API_URL`)

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Type check

```bash
npm run type-check
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx             # Root layout + Providers (React Query)
│   ├── providers.tsx          # QueryClientProvider
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx         # Auth guard + Sidebar + Header
│       ├── page.tsx           # Dashboard overview
│       ├── transactions/
│       ├── chat/
│       ├── reports/
│       ├── alerts/
│       ├── imports/
│       └── shops/
├── components/
│   ├── ui/                    # Button, Input, Modal, Badge, Spinner, Table
│   ├── layout/                # Sidebar, Header, PageWrapper
│   ├── transactions/          # TransactionTable, TransactionForm, TransactionFilters
│   ├── chat/                  # ChatWindow, MessageList, MessageInput
│   ├── alerts/                # AlertCard
│   ├── reports/               # ReportForm
│   └── imports/               # FileUpload, ColumnMapper, ValidationSummary
├── hooks/                     # useAuth, useShops, useTransactions
├── lib/
│   ├── api.ts                 # Axios client + all API calls
│   └── utils.ts               # formatCurrency, formatDate, cn
├── store/
│   ├── auth.ts                # Zustand: user + access token
│   ├── shops.ts               # Zustand: shops list + activeShopId (persisted)
│   └── alerts.ts              # Zustand: active alert count for badge
└── types/index.ts             # All TypeScript types (mirrors backend)
```

## Environment Variables

| Variable              | Default                   | Description            |
|-----------------------|---------------------------|------------------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`   | Backend base URL       |
