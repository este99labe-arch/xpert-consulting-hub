ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_status_check CHECK (
  (
    type IN ('INVOICE', 'EXPENSE')
    AND status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')
  )
  OR
  (
    type = 'QUOTE'
    AND status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'INVOICED', 'CANCELLED')
  )
);