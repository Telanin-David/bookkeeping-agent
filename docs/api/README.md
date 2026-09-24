# Bookkeeping Agent — API Reference

Full spec: `openapi.yaml` (OpenAPI 3.0, Postman-compatible).

## Base URL

| Environment | URL |
|---|---|
| Production | `https://api.yourdomain.com/api/v1` |
| Local | `http://localhost:4000/api/v1` |

## Authentication

All endpoints except `/health`, `/auth/signup`, `/auth/login`, and `/auth/refresh` require:

```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use `POST /auth/refresh` (reads the HttpOnly `refresh_token` cookie) to get a new one. Refresh tokens expire in **7 days**.

---

## Rate Limits

| Endpoint group | Limit |
|---|---|
| `POST /auth/login` | 5 per 15 min per IP; 15-min lockout |
| `POST /auth/signup` | 10 per hour per IP |
| `POST /imports/upload` | 10 per hour |
| `POST /imports/{id}/confirm` | 5 per hour |
| Report generation | 10 per minute |
| Everything else | 60–300 per minute |

Exceeded limits return `429` with a `Retry-After` header.

---

## Curl Examples

### Health

```bash
curl https://api.yourdomain.com/api/v1/health
```

### Sign Up

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amara Osei",
    "email": "amara@example.com",
    "phone": "+2348012345678",
    "password": "S3cur3P@ss!"
  }'
```

### Log In

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "amara@example.com", "password": "S3cur3P@ss!"}'
# Saves refresh_token cookie to cookies.txt
# Response includes accessToken
```

### Refresh Token

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/refresh \
  -b cookies.txt
```

### Logout

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt
```

---

### Create a Shop

```bash
curl -X POST https://api.yourdomain.com/api/v1/shops \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amara Provisions",
    "type": "retail",
    "location": "Lagos, Nigeria",
    "currency": "NGN"
  }'
```

### List Shops

```bash
curl https://api.yourdomain.com/api/v1/shops \
  -H "Authorization: Bearer $TOKEN"
```

### Switch Active Shop

```bash
curl -X POST https://api.yourdomain.com/api/v1/shops/switch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"}'
```

---

### Create a Transaction

```bash
curl -X POST "https://api.yourdomain.com/api/v1/shops/$SHOP_ID/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sale",
    "amount": 5000,
    "currency": "NGN",
    "description": "Sold 10 bags of rice",
    "date": "2024-01-15",
    "counterparty": "Chukwu Market"
  }'
```

### List Transactions (filtered)

```bash
curl "https://api.yourdomain.com/api/v1/shops/$SHOP_ID/transactions?type=sale&dateFrom=2024-01-01&dateTo=2024-01-31&limit=50&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Update a Transaction

```bash
curl -X PATCH "https://api.yourdomain.com/api/v1/shops/$SHOP_ID/transactions/$TX_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "settled", "category": "Food & Beverages"}'
```

### Delete a Transaction

```bash
curl -X DELETE "https://api.yourdomain.com/api/v1/shops/$SHOP_ID/transactions/$TX_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Start a Chat Session

```bash
curl -X POST https://api.yourdomain.com/api/v1/chat/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopId": "'$SHOP_ID'"}'
```

### Send a Message

```bash
curl -X POST "https://api.yourdomain.com/api/v1/chat/sessions/$SESSION_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "I sold 20 bags of rice for 8000 naira today", "type": "text"}'
# Claude categorizes, responds, and auto-saves any detected transactions
```

### Get Message History

```bash
curl "https://api.yourdomain.com/api/v1/chat/sessions/$SESSION_ID/messages?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Generate a Receipt PDF

```bash
curl -X POST https://api.yourdomain.com/api/v1/reports/receipt \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "'$TX_ID'", "shopId": "'$SHOP_ID'"}' \
  --output receipt.pdf
```

### Generate P&L Statement

```bash
curl -X POST https://api.yourdomain.com/api/v1/reports/pl \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "'$SHOP_ID'",
    "dateFrom": "2024-01-01",
    "dateTo": "2024-01-31",
    "sendEmail": false
  }' \
  --output pl-january.pdf
```

---

### List Alerts

```bash
curl "https://api.yourdomain.com/api/v1/alerts?status=active" \
  -H "Authorization: Bearer $TOKEN"
```

### Acknowledge an Alert

```bash
curl -X PATCH "https://api.yourdomain.com/api/v1/alerts/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Upload an Excel File

```bash
curl -X POST https://api.yourdomain.com/api/v1/imports/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@transactions.xlsx" \
  -F "shopId=$SHOP_ID"
# Returns importId
```

### Preview Detected Schema

```bash
curl "https://api.yourdomain.com/api/v1/imports/$IMPORT_ID/preview" \
  -H "Authorization: Bearer $TOKEN"
```

### Validate with Column Mapping

```bash
curl -X POST "https://api.yourdomain.com/api/v1/imports/$IMPORT_ID/validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "Date",
    "amount": "Amount (NGN)",
    "description": "Note",
    "type": "Type",
    "counterparty": "Customer"
  }'
```

### Confirm Ingestion

```bash
curl -X POST "https://api.yourdomain.com/api/v1/imports/$IMPORT_ID/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skipErrors": true}'
```

---

## Standard Error Format

```json
{
  "error": "BAD_REQUEST",
  "message": "amount must be a positive number",
  "details": [
    { "field": "amount", "message": "must be > 0" }
  ]
}
```

| HTTP Code | `error` constant | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid input |
| 401 | `UNAUTHORIZED` | Token missing/expired |
| 404 | `NOT_FOUND` | Resource doesn't exist or doesn't belong to user |
| 409 | `CONFLICT` | Duplicate (e.g., email already registered) |
| 413 | `PAYLOAD_TOO_LARGE` | File over 10 MB |
| 422 | `UNPROCESSABLE_ENTITY` | Valid input, processing failed (e.g., Claude API error) |
| 429 | `TOO_MANY_REQUESTS` | Rate limited |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
