# Bookkeeping Agent — Backend

Express + TypeScript API server.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+

## Setup

```bash
cp .env.example .env
# Fill in DATABASE_URL, JWT secrets, ANTHROPIC_API_KEY at minimum

npm install
npm run migrate   # creates all tables
npm run seed      # optional: loads demo data
```

## Running

```bash
npm run dev     # development with hot reload
npm run build   # compile TypeScript → dist/
npm start       # run compiled output
```

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report (target: >80%)
```

## Project Structure

```
src/
├── server.ts          # Express app + route wiring + startup
├── config.ts          # Env vars + PostgreSQL connection pool
├── types/
│   └── index.ts       # Shared TypeScript interfaces
├── middleware/
│   ├── auth.ts        # JWT verification
│   ├── errorHandler.ts# Global error handler + AppError class
│   └── validation.ts  # Zod schema validation wrapper
├── services/
│   ├── db.ts          # All PostgreSQL queries
│   ├── claude.ts      # Claude API integration (expanded in D5)
│   ├── email.ts       # SendGrid email delivery
│   └── storage.ts     # Local/S3 file storage
└── routes/
    ├── auth.ts         # POST /auth/signup|login|refresh|logout
    ├── shops.ts        # CRUD /shops + /shops/switch
    ├── transactions.ts # CRUD /shops/:shopId/transactions
    ├── chat.ts         # /chat/sessions + messages
    ├── reports.ts      # /reports/receipt|credit|stock|pl
    ├── alerts.ts       # /alerts + acknowledge/dismiss
    └── imports.ts      # /imports upload→preview→validate→confirm
```

## Environment Variables

See `.env.example` for all required and optional variables.
