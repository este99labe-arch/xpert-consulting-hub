
-- Drop existing FK if it exists and recreate with CASCADE
ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_invoice_id_fkey;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
  ON DELETE CASCADE;
