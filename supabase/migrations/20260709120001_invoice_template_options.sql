-- Personalización de la plantilla de facturas por cuenta (nombre mostrado,
-- color de acento, pie, y qué datos aparecen — incluido el QR VERI*FACTU)
ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS invoice_template_options jsonb NOT NULL DEFAULT '{}'::jsonb;
