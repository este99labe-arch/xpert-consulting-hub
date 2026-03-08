

# Plan: Refactor Monolithic Files + MasterAccountSelector

## Overview

Extract repeated patterns into shared components and split 4 large page files (~3,800 lines total) into focused sub-components. This improves maintainability without changing any functionality.

---

## 1. Shared Component: `MasterAccountSelector`

**File:** `src/components/shared/MasterAccountSelector.tsx`

Replaces the identical pattern found in AppAccounting, AppInventory, and AppAttendance (3 modules use a full-page selector; Attendance uses an inline variant).

Props:
- `title: string` — page title (e.g. "Contabilidad")
- `onSelect: (accountId: string) => void`
- `selectedAccountId?: string`
- `onClear?: () => void` — for the "Cambiar cliente" button
- `variant?: "page" | "inline"` — full-page card (Accounting/Inventory) vs inline row (Attendance)

Internally fetches `accounts` with the same query all modules use. Returns the selector UI.

---

## 2. AppAccounting Refactor (1,386 lines → ~6 files)

**New files under `src/components/accounting/`:**

| File | Content | ~Lines |
|------|---------|--------|
| `AccountingDashboard.tsx` | KPI cards + bar chart + pie chart (lines 682-772) | ~100 |
| `ChartOfAccountsTab.tsx` | Search + grouped table + edit dialog (lines 774-835, 1230-1265) | ~150 |
| `JournalEntriesTab.tsx` | Delete requests panel + entries table + dropdown actions (lines 838-981) | ~160 |
| `JournalEntryDialog.tsx` | Create/edit entry form with lines (lines 1267-1326) | ~70 |
| `LedgerTab.tsx` | Account selector + date range + table + CSV (lines 983-1035) | ~60 |
| `PLTab.tsx` | Period selectors + income/expense cards + result (lines 1037-1120) | ~90 |
| `TaxesTab.tsx` | Quarter selector + collected/paid tables + result (lines 1122-1225) | ~110 |
| `DeleteEntryDialogs.tsx` | AlertDialog (manager) + Request Dialog (employee) (lines 1328-1381) | ~60 |

**`AppAccounting.tsx`** becomes the orchestrator (~200 lines): types, constants, data fetching, mutations, state, and the `<Tabs>` shell that renders each sub-component, passing data + callbacks as props.

---

## 3. AppInventory Refactor (774 lines → ~4 files)

**New files under `src/components/inventory/`:**

| File | Content | ~Lines |
|------|---------|--------|
| `ProductsTab.tsx` | Products table + search + filter + CSV | ~150 |
| `MovementsTab.tsx` | Movements table + filter + CSV | ~100 |
| `AlertsTab.tsx` | Low stock alerts table | ~60 |
| `PurchaseOrdersTab.tsx` | Orders table + status progression | ~120 |
| `ProductDialog.tsx` | Create/edit product form | ~80 |
| `MovementDialog.tsx` | Create movement form | ~50 |
| `OrderDialog.tsx` | Create/edit order form | ~60 |

**`AppInventory.tsx`** becomes ~180 lines.

---

## 4. AppHR Refactor (981 lines → ~5 files)

Already partially split into internal components (`EmployeesTab`, `LeaveTab`, etc.) but all in one file.

**Move each to its own file under `src/components/hr/`:**

| File | Content |
|------|---------|
| `EmployeesTab.tsx` | Employee list + search + CreateEmployeeDialog |
| `LeaveTab.tsx` | Leave requests + CreateLeaveDialog |
| `VacationCalendarTab.tsx` | Month grid calendar |
| `DocumentsTab.tsx` | Documents list + upload + UploadDocumentDialog |

**`AppHR.tsx`** becomes ~40 lines (just the tabs shell with imports).

---

## 5. AppAttendance Refactor (670 lines → ~3 files)

**New files under `src/components/attendance/`:**

| File | Content |
|------|---------|
| `MyAttendanceView.tsx` | Summary cards, weekly chart, check-in/out, weekly table |
| `TeamAttendanceView.tsx` | Client selector, export, per-user summary table |

**`AppAttendance.tsx`** becomes ~120 lines (data fetching + tab toggle + renders the two views).

---

## 6. Implementation Approach

- All refactors are purely structural — no logic changes, no DB changes
- Props will pass data + mutation callbacks down; no new context needed
- Types/interfaces/constants stay in the parent page file (or a shared `types.ts` per module if needed)
- Each sub-component receives only the data it needs
- Estimated: ~15 files created, 4 files heavily modified

