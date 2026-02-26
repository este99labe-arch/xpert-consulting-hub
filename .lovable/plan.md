

## XpertConsulting ERP — Phase 1: Foundation

### 1. Database Schema Setup
Create all core tables via Supabase migrations:
- **accounts** — stores master (XpertConsulting) and client accounts with type MASTER/CLIENT
- **service_modules** — defines available modules (DASHBOARD, CLIENTS, INVOICES, ACCOUNTING, HR, ATTENDANCE, SETTINGS) with seed data
- **account_modules** — links modules to accounts with enable/disable toggle
- **roles** — stores role codes (MASTER_ADMIN, MANAGER, EMPLOYEE)
- **user_accounts** — links users to accounts with roles
- **business_clients** — internal clients per account
- **invoices** — invoices and expenses with VAT calculations
- **attendance_records** — daily check-in/check-out records
- **leave_requests** — vacation/sick/other leave tracking

Enable RLS on all multi-tenant tables with policies that restrict access based on user's account membership via `user_accounts`.

Create a `has_role()` security definer function to safely check roles without recursive RLS.

### 2. Authentication & Role-Based Routing
- **Login page** (`/login`) with email/password, loading & error states
- On login, fetch user's role from `user_accounts` + `roles`
- Redirect **MASTER_ADMIN** → `/master/dashboard`
- Redirect **MANAGER/EMPLOYEE** → `/app/dashboard`
- Protected route wrappers that check authentication and role
- Auth context provider managing session state

### 3. Master Admin Panel (`/master/*`)
- **Sidebar** with sections: Dashboard, Clients, Settings
- **Client list page** — table of all client accounts with status
- **Create client form**:
  - Company name, manager email
  - Module selection (checkbox list)
  - On submit: creates account, assigns modules, creates manager user
- **Module management** — toggle modules per client account
- Loading, empty, and error states on every view

### 4. Client Panel Shell (`/app/*`)
- **Dynamic sidebar** — only shows modules enabled for the client's account (reads from `account_modules`)
- **Dashboard placeholder** with KPI cards (populated in Phase 2)
- Layout ready for future module pages (Clients, Invoices, etc.)

### 5. Edge Function: `create_client_account`
- Validates caller is MASTER_ADMIN
- Creates account record (type: CLIENT)
- Inserts selected modules into `account_modules`
- Creates manager user via Supabase Auth admin API
- Links user to account with MANAGER role in `user_accounts`

### 6. Docker Guidance
- Provide a `docker-compose.yml` reference file for local Supabase + frontend development
- Include instructions for connecting the Lovable frontend to a local Supabase instance

---

**Phase 2 (future):** Invoicing module, accounting, attendance/leave management, KPI dashboards, PDF export, materialized views for financial summaries.

