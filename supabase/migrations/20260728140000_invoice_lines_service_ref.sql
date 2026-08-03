-- Permite facturar SERVICIOS del catálogo además de productos de inventario.
--
-- Doble propósito: la línea queda vinculada al servicio (precio de catálogo y
-- trazabilidad) y, a través de él, a su vertical. Eso es lo que permitirá
-- analizar ingresos por línea de negocio sin ambigüedad cuando un cliente
-- tenga varias verticales contratadas.
--
-- Aditivo y nullable: las líneas existentes (productos o texto libre) siguen
-- igual. RESTRICT para no perder la referencia de un servicio ya facturado.
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.invoice_lines.service_id IS
  'Servicio del catálogo facturado en esta línea. Da la vertical para el análisis de ingresos.';

CREATE INDEX IF NOT EXISTS idx_invoice_lines_service ON public.invoice_lines(service_id);
