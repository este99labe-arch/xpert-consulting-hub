-- F6: plantilla aprobada de Meta para reabrir conversaciones fuera de la ventana de 24h
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS reopen_template_name text,
  ADD COLUMN IF NOT EXISTS reopen_template_lang text NOT NULL DEFAULT 'es';

-- Las columnas nuevas no estaban en el GRANT selectivo (los tokens siguen siendo ilegibles)
GRANT SELECT (reopen_template_name, reopen_template_lang) ON public.whatsapp_config TO authenticated;
