
CREATE OR REPLACE FUNCTION public.invoice_kpis(_account_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'total_income', COALESCE(SUM(CASE WHEN type = 'INVOICE' THEN amount_total ELSE 0 END), 0),
    'total_expenses', COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_total ELSE 0 END), 0),
    'total_paid', COALESCE(SUM(CASE WHEN type = 'INVOICE' AND status = 'PAID' THEN amount_total ELSE 0 END), 0),
    'total_pending', COALESCE(SUM(CASE WHEN type = 'INVOICE' AND status != 'PAID' THEN amount_total ELSE 0 END), 0),
    'total_quotes', COALESCE(SUM(CASE WHEN type = 'QUOTE' THEN amount_total ELSE 0 END), 0),
    'accepted_quotes', COALESCE(SUM(CASE WHEN type = 'QUOTE' AND status IN ('ACCEPTED', 'INVOICED') THEN amount_total ELSE 0 END), 0),
    'pending_quotes', COALESCE(SUM(CASE WHEN type = 'QUOTE' AND status IN ('DRAFT', 'SENT') THEN amount_total ELSE 0 END), 0)
  )
  FROM public.invoices
  WHERE account_id = _account_id
$$;
