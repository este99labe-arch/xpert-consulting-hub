-- Sembrar los módulos que la aplicación soporta (rutas /app/inventory y /app/reports,
-- iconos y paths definidos en ClientLayout) pero que no estaban en service_modules.
-- Sin estas filas, el menú no los muestra (para MASTER_ADMIN se listan todos los
-- service_modules) y no se pueden habilitar por cuenta.
INSERT INTO public.service_modules (code, name, description) VALUES
  ('INVENTORY', 'Inventario', 'Gestión de productos, stock y pedidos'),
  ('REPORTS', 'Informes', 'Informes y analíticas')
ON CONFLICT (code) DO NOTHING;
