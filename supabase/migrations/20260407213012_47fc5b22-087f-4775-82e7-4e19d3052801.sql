
-- Drop all existing FKs first, then recreate with proper ON DELETE behavior
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- Now add all FKs with correct ON DELETE behavior

-- account_modules
ALTER TABLE public.account_modules
  ADD CONSTRAINT account_modules_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT account_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.service_modules(id) ON DELETE CASCADE;

-- account_settings
ALTER TABLE public.account_settings
  ADD CONSTRAINT account_settings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- api_keys
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- attendance_delete_requests
ALTER TABLE public.attendance_delete_requests
  ADD CONSTRAINT attendance_delete_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT attendance_delete_requests_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE;

-- attendance_records
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- audit_logs
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- business_clients
ALTER TABLE public.business_clients
  ADD CONSTRAINT business_clients_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT business_clients_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.client_plans(id) ON DELETE SET NULL;

-- chart_of_accounts
ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT chart_of_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

-- client_contacts
ALTER TABLE public.client_contacts
  ADD CONSTRAINT client_contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.business_clients(id) ON DELETE CASCADE;

-- client_plans
ALTER TABLE public.client_plans
  ADD CONSTRAINT client_plans_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- document_folders
ALTER TABLE public.document_folders
  ADD CONSTRAINT document_folders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- email_log
ALTER TABLE public.email_log
  ADD CONSTRAINT email_log_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT email_log_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- employee_documents
ALTER TABLE public.employee_documents
  ADD CONSTRAINT employee_documents_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT employee_documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE SET NULL;

-- employee_profiles
ALTER TABLE public.employee_profiles
  ADD CONSTRAINT employee_profiles_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- invoice_delete_requests
ALTER TABLE public.invoice_delete_requests
  ADD CONSTRAINT invoice_delete_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoice_delete_requests_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- invoice_lines
ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- invoice_payments
ALTER TABLE public.invoice_payments
  ADD CONSTRAINT invoice_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- invoices
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.business_clients(id) ON DELETE RESTRICT;

-- journal_entries
ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT journal_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- journal_entry_delete_requests
ALTER TABLE public.journal_entry_delete_requests
  ADD CONSTRAINT journal_entry_delete_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT journal_entry_delete_requests_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;

-- journal_entry_lines
ALTER TABLE public.journal_entry_lines
  ADD CONSTRAINT journal_entry_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ADD CONSTRAINT journal_entry_lines_chart_account_id_fkey FOREIGN KEY (chart_account_id) REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT;

-- leave_requests
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- products
ALTER TABLE public.products
  ADD CONSTRAINT products_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- profile_change_requests
ALTER TABLE public.profile_change_requests
  ADD CONSTRAINT profile_change_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- purchase_orders
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT purchase_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- recurring_invoices
ALTER TABLE public.recurring_invoices
  ADD CONSTRAINT recurring_invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT recurring_invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.business_clients(id) ON DELETE RESTRICT;

-- reminders
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- stock_movements
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- user_accounts
ALTER TABLE public.user_accounts
  ADD CONSTRAINT user_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_accounts_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;

-- webhook_logs
ALTER TABLE public.webhook_logs
  ADD CONSTRAINT webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;

-- webhooks
ALTER TABLE public.webhooks
  ADD CONSTRAINT webhooks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- whatsapp_config
ALTER TABLE public.whatsapp_config
  ADD CONSTRAINT whatsapp_config_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
