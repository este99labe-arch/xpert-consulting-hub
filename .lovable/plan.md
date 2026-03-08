

# Phase 4 — Integrations & Automation

Phase 4 covers 5 features. Here's what each entails and the implementation approach.

---

## 4.1 — Automatic Emails (Invoice sending + Payment reminders)

**What**: Send invoices to clients via email (with PDF attached) and automatic overdue payment reminders.

**How**:
- **New edge function `send_invoice_email`**: Receives `invoice_id`, generates PDF (reusing `generate_invoice_pdf` logic), sends via Resend API to the client's email. Already have `RESEND_API_KEY` configured.
- **New edge function `send_payment_reminders`**: Queries invoices with status `SENT` and `issue_date` older than X days, sends reminder emails. Designed to be called via cron or manually.
- **New DB table `email_log`**: Tracks sent emails (`invoice_id`, `recipient`, `type` [invoice/reminder], `sent_at`, `status`).
- **UI**: Add "Enviar por email" action in `InvoiceActionsMenu`. Show email history in invoice preview dialog.

---

## 4.2 — Recurring Invoices

**What**: Schedule automatic invoice generation (monthly/quarterly/yearly).

**How**:
- **New DB table `recurring_invoices`**: `account_id`, `client_id`, `concept`, `amount_net`, `vat_percentage`, `frequency` (MONTHLY/QUARTERLY/YEARLY), `next_run_date`, `is_active`, `template` fields mirroring invoice fields.
- **New edge function `process_recurring_invoices`**: Queries active recurring invoices where `next_run_date <= today`, creates invoices, advances `next_run_date`. Callable via cron.
- **UI**: New "Recurrentes" tab in AppInvoices with CRUD for recurring invoice templates, showing next run date and history.

---

## 4.3 — Bank Reconciliation (CSV Import)

**What**: Import bank statements (CSV) and match them against journal entries/invoices.

**How** (simplified — no live bank API, CSV-based):
- **New DB table `bank_transactions`**: `account_id`, `date`, `description`, `amount`, `reference`, `matched_entry_id` (nullable FK to `journal_entries`), `matched_invoice_id` (nullable), `status` (UNMATCHED/MATCHED/IGNORED).
- **UI**: New "Banco" tab in AppAccounting with CSV upload, parsed transaction list, and auto-match suggestions (by amount/date proximity). Manual match via dropdown.
- Auto-matching logic runs client-side comparing amounts and dates.

---

## 4.4 — Public API (Edge Functions)

**What**: REST-like edge functions for external integrations (read clients, invoices, products).

**How**:
- **New DB table `api_keys`**: `account_id`, `key_hash`, `name`, `is_active`, `created_at`, `last_used_at`.
- **New edge function `public_api`**: Single entry point with path-based routing (`/clients`, `/invoices`, `/products`). Validates API key from `Authorization` header. Read-only initially (GET endpoints).
- **UI**: API Keys management in AppSettings (generate, revoke, copy key).

---

## 4.5 — Webhooks

**What**: Notify external systems on events (new invoice, stock low, etc.).

**How**:
- **New DB table `webhooks`**: `account_id`, `url`, `events` (array of event types), `secret`, `is_active`.
- **New DB table `webhook_logs`**: `webhook_id`, `event`, `payload`, `response_status`, `created_at`.
- **Helper edge function `dispatch_webhooks`**: Called after key mutations, sends POST to registered webhook URLs with HMAC signature.
- **UI**: Webhook management in AppSettings (CRUD endpoints, event selection, delivery logs).

---

## Implementation Order

Given dependencies and impact, I recommend this order:

1. **4.1** Email automáticos — builds on existing Resend + PDF infrastructure
2. **4.2** Facturación recurrente — high business value, straightforward
3. **4.3** Bank reconciliation — useful for accounting users
4. **4.4** Public API — enables external integrations
5. **4.5** Webhooks — complements the API

## Database Summary

New tables: `email_log`, `recurring_invoices`, `bank_transactions`, `api_keys`, `webhooks`, `webhook_logs` — all with `account_id` and appropriate RLS policies following existing patterns.

New edge functions: `send_invoice_email`, `send_payment_reminders`, `process_recurring_invoices`, `public_api`, `dispatch_webhooks`.

Shall I proceed with implementing all 5 tasks in order, starting with 4.1?

