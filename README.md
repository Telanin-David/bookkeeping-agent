# Bookkeeping Agent

AI-powered bookkeeping for small shop owners. Record transactions by voice or text, get instant reports, and receive smart financial alerts — all through a chat interface.

## Monorepo Structure

```
bookkeeping-agent/
├── apps/
│   ├── frontend/      # Next.js 14 (TypeScript)
│   └── backend/       # Express + TypeScript
├── packages/
│   └── shared-types/  # Shared TypeScript types
├── docs/
│   ├── api/           # OpenAPI spec + curl examples
│   └── PROGRESS.md    # Deliverable tracker
└── infra/             # Nginx, PM2, GitHub Actions
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| AI | Claude API (Anthropic) |
| Auth | JWT (access + refresh tokens) |
| Notifications | SendGrid (email), Twilio (SMS) |
| Process mgmt | PM2 |

## Getting Started

> Each app has its own `README.md`. See `apps/backend/README.md` and `apps/frontend/README.md` once those deliverables are complete.

## Development Progress

See [docs/PROGRESS.md](docs/PROGRESS.md) for current deliverable status.

## API Documentation

See [docs/api/README.md](docs/api/README.md) for the full API reference and curl examples.  
The OpenAPI 3.0 spec lives at [docs/api/openapi.yaml](docs/api/openapi.yaml) — import directly into Postman or Insomnia.
