# XpertConsulting — Public API Reference

Base URL: `https://<project-id>.supabase.co/functions/v1/public_api`

## Authentication

All requests require a valid API key in the `Authorization` header:

```
Authorization: Bearer xpc_your_api_key_here
```

Generate API keys from **Settings → API** in the application.

---

## Endpoints

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | List all clients |
| GET | `/clients/:id` | Get client by ID |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List all invoices |
| GET | `/invoices/:id` | Get invoice by ID |

**Query parameters:**
- `status` — Filter by status (`draft`, `sent`, `paid`)
- `type` — Filter by type (`income`, `expense`)

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| GET | `/products/:id` | Get product by ID |

---

## Pagination

All list endpoints support pagination:

| Parameter | Default | Max |
|-----------|---------|-----|
| `page` | 1 | — |
| `limit` | 50 | 100 |

Example: `GET /clients?page=2&limit=25`

---

## Response Format

```json
{
  "data": [...],
  "page": 1,
  "limit": 50,
  "total": 120
}
```

Single resource:
```json
{
  "data": { "id": "...", "name": "..." }
}
```

---

## Errors

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid API key |
| 404 | Resource not found |
| 405 | Method not allowed (only GET supported) |

```json
{
  "error": "Invalid or inactive API key"
}
```

---

## Example (curl)

```bash
curl -H "Authorization: Bearer xpc_abc123..." \
  "https://<project-id>.supabase.co/functions/v1/public_api/invoices?status=paid&page=1&limit=10"
```
