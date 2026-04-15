# XpertConsulting — Public API Reference (v1.0)

Base URL: `https://<project-id>.supabase.co/functions/v1/public_api`

## Authentication

All requests require a valid API key in the `Authorization` header:

```
Authorization: Bearer xpc_your_api_key_here
```

Generate API keys from **Settings → API** in the application.

## Pagination

All list endpoints support: `?page=1&limit=50` (max 100)

Response format:
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 123 }
}
```

---

## Endpoints

### Clients (`/clients`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | List clients (?status=, ?search=) |
| GET | `/clients/:id` | Get client details |
| POST | `/clients` | Create client |
| PUT | `/clients/:id` | Update client |
| DELETE | `/clients/:id` | Delete client |
| GET | `/clients/:id/contacts` | List client contacts |
| POST | `/clients/:id/contacts` | Create contact |
| PUT | `/clients/:id/contacts/:contactId` | Update contact |
| DELETE | `/clients/:id/contacts/:contactId` | Delete contact |
| GET | `/clients/:id/invoices` | List client invoices |

### Invoices (`/invoices`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices (?type=, ?status=, ?client_id=, ?date_from=, ?date_to=) |
| GET | `/invoices/:id` | Get invoice with lines & payments |
| POST | `/invoices` | Create invoice/expense/quote |
| PUT | `/invoices/:id` | Update invoice |
| DELETE | `/invoices/:id` | Delete (DRAFT) or request deletion |
| POST | `/invoices/:id/send-email` | Send invoice email |
| GET | `/invoices/:id/pdf` | Download PDF |
| POST | `/invoices/:id/payments` | Register payment |
| DELETE | `/invoices/:id/payments/:paymentId` | Delete payment |

### Recurring Invoices (`/recurring-invoices`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recurring-invoices` | List templates (?is_active=) |
| GET | `/recurring-invoices/:id` | Get template details |
| POST | `/recurring-invoices` | Create template |
| PUT | `/recurring-invoices/:id` | Update template |
| DELETE | `/recurring-invoices/:id` | Delete template |
| POST | `/recurring-invoices/process` | Process pending invoices |

### Accounting — Chart of Accounts (`/accounting/chart`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounting/chart` | List accounts (?type=, ?is_active=) |
| POST | `/accounting/chart` | Create account |
| PUT | `/accounting/chart/:id` | Update account |
| GET | `/accounting/balance` | Account balances (?date_from=, ?date_to=) |

### Accounting — Journal Entries (`/accounting/entries`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounting/entries` | List entries (?status=, ?date_from=, ?date_to=, ?search=) |
| GET | `/accounting/entries/:id` | Get entry with lines |
| POST | `/accounting/entries` | Create entry (debit must equal credit) |
| PUT | `/accounting/entries/:id` | Update (DRAFT only) |
| POST | `/accounting/entries/:id/post` | Post entry (DRAFT → POSTED) |
| DELETE | `/accounting/entries/:id` | Delete or request deletion |

### Accounting — Reports (`/accounting/reports`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounting/reports/pl` | P&L (?period=, ?year=, ?month=, ?quarter=) |
| GET | `/accounting/reports/ledger` | General ledger (?account_id=, ?date_from=, ?date_to=) |
| GET | `/accounting/reports/taxes` | VAT report (?year=, ?quarter=) |
| GET | `/accounting/reports/trial-balance` | Trial balance |

### Reconciliation (`/reconciliation`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reconciliation/movements` | List bank movements (?status=matched|unmatched) |
| POST | `/reconciliation/match` | Match movement to invoice |
| POST | `/reconciliation/unmatch` | Unmatch movement |

### HR — Employees (`/hr/employees`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hr/employees` | List employees |
| GET | `/hr/employees/:userId` | Get employee profile |
| PUT | `/hr/employees/:userId` | Update profile |
| DELETE | `/hr/employees/:userId` | Deactivate employee |

### HR — Leave (`/hr/leave`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hr/leave` | List requests (?status=, ?user_id=) |
| GET | `/hr/leave/:id` | Get request details |
| POST | `/hr/leave` | Create request |
| PUT | `/hr/leave/:id/approve` | Approve request |
| PUT | `/hr/leave/:id/reject` | Reject request |
| DELETE | `/hr/leave/:id` | Delete (PENDING only) |

### Attendance (`/attendance`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/attendance` | List records (?user_id=, ?date_from=, ?date_to=, ?source=) |
| GET | `/attendance/summary` | Summary by employee (?date_from=, ?date_to=) |
| POST | `/attendance/check-in` | Clock in |
| POST | `/attendance/check-out` | Clock out |
| POST | `/attendance/manual` | Manual entry |
| DELETE | `/attendance/:id` | Delete record |

### Inventory — Products (`/inventory/products`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/products` | List products (?category=, ?is_active=, ?low_stock=, ?search=) |
| GET | `/inventory/products/:id` | Get product details |
| POST | `/inventory/products` | Create product |
| PUT | `/inventory/products/:id` | Update product |
| DELETE | `/inventory/products/:id` | Deactivate product |

### Inventory — Movements (`/inventory/movements`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/movements` | List movements (?product_id=, ?type=, ?date_from=, ?date_to=) |
| POST | `/inventory/movements` | Register movement |

### Inventory — Orders (`/inventory/orders`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/orders` | List orders (?status=) |
| GET | `/inventory/orders/:id` | Get order details |
| POST | `/inventory/orders` | Create order |
| PUT | `/inventory/orders/:id/status` | Advance status |
| DELETE | `/inventory/orders/:id` | Delete order |

### Documents (`/documents`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents/folders` | List folders (?user_id=) |
| POST | `/documents/folders` | Create folder |
| DELETE | `/documents/folders/:id` | Delete empty folder |
| GET | `/documents` | List documents (?folder_id=, ?user_id=) |
| GET | `/documents/:id/download` | Get signed download URL (1h) |
| DELETE | `/documents/:id` | Delete document and file |

### Notifications (`/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List (?is_read=) |
| PUT | `/notifications/:id/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete notification |

### Settings (`/settings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get account settings |
| PUT | `/settings/schedule` | Update work schedule |
| GET | `/settings/modules` | List active modules |
| GET | `/settings/webhooks` | List webhooks |
| POST | `/settings/webhooks` | Create webhook |
| PUT | `/settings/webhooks/:id` | Update webhook |
| DELETE | `/settings/webhooks/:id` | Delete webhook |

### Reminders (`/reminders`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reminders` | List (?is_completed=, ?status=) |
| GET | `/reminders/:id` | Get reminder details |
| POST | `/reminders` | Create reminder |
| PUT | `/reminders/:id` | Update reminder |
| PUT | `/reminders/:id/complete` | Mark as completed |
| DELETE | `/reminders/:id` | Delete reminder |

---

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 401 | AUTH_REQUIRED / INVALID_API_KEY | Missing or invalid API key |
| 403 | FORBIDDEN | No permissions |
| 404 | NOT_FOUND | Resource not found |
| 405 | METHOD_NOT_ALLOWED | HTTP method not supported |
| 422 | VALIDATION_ERROR | Validation failed (includes details) |
| 500 | INTERNAL_ERROR | Internal server error |

```json
{
  "error": "Descriptive message",
  "code": "ERROR_CODE",
  "details": [{ "field": "name", "message": "required" }]
}
```

---

## Example (curl)

```bash
# List clients
curl -H "Authorization: Bearer xpc_abc123..." \
  "https://<project-id>.supabase.co/functions/v1/public_api/clients?page=1&limit=10"

# Create invoice
curl -X POST \
  -H "Authorization: Bearer xpc_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"type":"INVOICE","client_id":"uuid","concept":"Servicios","issue_date":"2024-06-15","vat_percentage":21,"lines":[{"description":"Desarrollo","quantity":40,"unit_price":75}]}' \
  "https://<project-id>.supabase.co/functions/v1/public_api/invoices"
```
