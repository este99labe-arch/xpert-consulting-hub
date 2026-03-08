

# Dashboard Redesign Plan

## Current State
The dashboard has 4 KPI cards (Income, Expenses, Balance, Collected), a 7-day area chart, and a list of 5 recent invoices. All data comes from the `invoices` table only. It's functional but minimal — no cross-module visibility, no actionable insights.

## Proposed Design

```text
┌─────────────────────────────────────────────────────────┐
│ Header: "Dashboard" + greeting + date range selector    │
│ (7d / 30d / 90d / year)                                 │
├────────┬────────┬────────┬────────┬────────┬────────────┤
│ Income │Expense │Balance │Pending │Overdue │ Clients    │
│ +%chg  │ +%chg  │        │invoices│invoices│ active cnt │
├────────┴────────┴────────┴────────┴────────┴────────────┤
│                                                         │
│  ┌─── Revenue vs Expenses Chart (3 cols) ──┐ ┌─ Quick ─┐│
│  │  Bar chart (monthly) OR area (weekly)   │ │ Actions ││
│  │  Toggle: 7d / 30d / 12m                 │ │ + Factura│
│  │  Shows both income & expense overlaid   │ │ + Gasto  ││
│  └─────────────────────────────────────────┘ │ + Client ││
│                                              └─────────┘│
│  ┌─── Invoices by Status (2 cols) ──┐ ┌─ Low Stock ──┐ │
│  │  Donut: Draft/Sent/Paid/Overdue  │ │ Top 5 items  │ │
│  │  with counts + total amounts     │ │ below min    │ │
│  └──────────────────────────────────┘ └──────────────┘ │
│                                                         │
│  ┌─── Recent Activity (3 cols) ──────┐ ┌─ Top Clients ┐│
│  │  Last 8 invoices with status      │ │ By revenue   ││
│  │  badges and client names          │ │ mini bar chart│
│  └───────────────────────────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────┘
```

## New Sections (6 widgets total)

1. **Enhanced KPI row** — 6 cards instead of 4: add "Facturas pendientes" (count of SENT/DRAFT), "Facturas vencidas" (SENT older than 30d), and "Clientes activos" (distinct clients with invoices). Each card shows % change vs previous period.

2. **Revenue vs Expenses chart** — Replace the single-metric area chart with a dual bar/area chart showing income AND expense together. Add period selector (7d, 30d, 12 months). Monthly view uses bars; weekly uses area.

3. **Invoice status donut** — PieChart showing distribution by status (DRAFT, SENT, PAID, OVERDUE) with counts and amounts.

4. **Low stock alerts** — Query `products` where `current_stock < min_stock`, show top 5 with deficit. Links to inventory. Only shown if inventory module is active.

5. **Top clients** — Horizontal mini bar chart of top 5 clients by revenue from invoices.

6. **Recent activity** — Expanded to 8 items, with better visual treatment and "Ver todo" link to invoices.

## Quick Actions Bar
A row of shortcut buttons below KPIs: "Nueva Factura", "Nuevo Gasto", "Nuevo Cliente" — linking to their respective pages.

## Data Sources
- `invoices` — KPIs, chart, status donut, recent activity, top clients (join `business_clients`)
- `products` — Low stock alerts (only if module enabled)
- No new tables or migrations needed

## Period Selector
Global date range filter (7d / 30d / 90d / year) that affects KPIs (with % change vs previous equivalent period) and the main chart.

## Files to Create/Modify

**Create:**
- `src/components/dashboard/KpiCards.tsx` — 6 KPI cards with % change
- `src/components/dashboard/RevenueChart.tsx` — Dual income/expense chart with period toggle
- `src/components/dashboard/InvoiceStatusChart.tsx` — Donut chart by status
- `src/components/dashboard/LowStockAlerts.tsx` — Low stock widget
- `src/components/dashboard/TopClients.tsx` — Top 5 clients bar
- `src/components/dashboard/RecentActivity.tsx` — Enhanced recent list
- `src/components/dashboard/QuickActions.tsx` — Shortcut buttons

**Modify:**
- `src/pages/app/AppDashboard.tsx` — Rewrite to compose new widgets, add period state and data queries

No database changes needed.

