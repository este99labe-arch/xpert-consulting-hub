ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check CHECK (type IN ('INVOICE', 'EXPENSE', 'QUOTE'));