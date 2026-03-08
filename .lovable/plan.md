

# WhatsApp Attendance Integration Plan

## Overview

Create a WhatsApp-based clock-in/clock-out system using Meta's WhatsApp Business API. Users send messages like "entrada" or "salida" to a dedicated company number, and the system registers attendance automatically — same as doing it from the app.

## Architecture

```text
┌──────────────┐     webhook POST      ┌─────────────────────┐
│  WhatsApp    │ ──────────────────────>│  Edge Function      │
│  Business    │                        │  whatsapp_webhook   │
│  (Meta API)  │ <──────────────────────│                     │
│              │   reply confirmation   │  1. Verify webhook  │
└──────────────┘                        │  2. Parse message   │
                                        │  3. Match phone→user│
                                        │  4. Insert/update   │
                                        │     attendance      │
                                        │  5. Reply via API   │
                                        └─────────────────────┘
```

## What's Needed

### 1. Database Changes

- **Add `phone` column to `employee_profiles`** (already exists — confirmed in schema). Good, it's already there.
- **New table `whatsapp_config`**: stores per-account WhatsApp settings (phone number ID, verify token, enabled flag). One row per account.
  - `id`, `account_id`, `phone_number_id`, `verify_token`, `is_enabled`, `created_at`, `updated_at`
  - RLS: managers can manage own account config

### 2. Edge Function: `whatsapp_webhook`

Single edge function handling two things:

- **GET** — Meta webhook verification (responds with `hub.challenge`)
- **POST** — Incoming messages. Flow:
  1. Extract sender phone number and message text
  2. Normalize phone (strip +, spaces)
  3. Look up `employee_profiles` by phone → get `user_id` and `account_id`
  4. Check `whatsapp_config` is enabled for that account
  5. Parse command: `entrada`/`salida` (case-insensitive, with common variants)
  6. Insert/update `attendance_records` (same logic as app)
  7. Optionally extract location if WhatsApp sends it
  8. Reply to user via WhatsApp API confirming the action
  
  Uses `verify_jwt = false` in config.toml since Meta calls it directly.

### 3. Secrets Required

- **`WHATSAPP_ACCESS_TOKEN`** — Meta permanent token for WhatsApp Business API
- **`WHATSAPP_VERIFY_TOKEN`** — Custom string for webhook verification

### 4. UI: WhatsApp Config in Settings

New section in `AppSettings.tsx` (inside Schedule or a new "Integraciones" tab):
- Toggle to enable/disable WhatsApp attendance
- Field for WhatsApp Phone Number ID (from Meta Business dashboard)
- Display the webhook URL to configure in Meta
- Info text explaining setup steps

### 5. Attendance Records Enhancement

Add optional columns to `attendance_records`:
- **`source`** (`text`, default `'APP'`) — tracks whether entry came from `APP` or `WHATSAPP`
- **`location_lat`** / **`location_lng`** (`numeric`, nullable) — GPS from WhatsApp location messages
- **`phone_number`** (`text`, nullable) — the phone that sent the message

This lets the UI show how each record was created (badge: "App" vs "WhatsApp") and optionally display location.

## Implementation Order

1. **DB migration**: add `source`, `location_lat`, `location_lng`, `phone_number` to `attendance_records`; create `whatsapp_config` table
2. **Edge function**: `whatsapp_webhook` with GET verification + POST message handling
3. **UI config**: WhatsApp settings panel for managers
4. **UI display**: Show source badges in attendance views

## Files to Create/Modify

**Create:**
- `supabase/functions/whatsapp_webhook/index.ts`
- `src/components/settings/WhatsAppConfigTab.tsx`

**Modify:**
- `supabase/config.toml` — add `[functions.whatsapp_webhook]` with `verify_jwt = false`
- `src/pages/app/AppSettings.tsx` — add WhatsApp config tab
- `src/components/attendance/MyAttendanceView.tsx` — show source badge
- `src/components/attendance/TeamAttendanceView.tsx` — show source in team view
- DB migration for new columns and table

## Meta WhatsApp Setup (User Steps)

The user will need to:
1. Create a Meta Business App at developers.facebook.com
2. Enable WhatsApp product
3. Get Phone Number ID and permanent access token
4. Configure the webhook URL pointing to the edge function
5. Subscribe to `messages` webhook field

We'll provide the webhook URL and verify token in the settings UI.

