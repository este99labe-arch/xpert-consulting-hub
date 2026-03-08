ALTER TABLE public.invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY['DRAFT'::text, 'SENT'::text, 'PAID'::text, 'OVERDUE'::text, 'CANCELLED'::text]));
-- Update any existing rows with old status values
UPDATE public.invoices SET status = 'SENT' WHERE status = 'ISSUED';