// Configuración del proyecto Supabase (XpertERP).
//
// Las credenciales se fijan aquí de forma explícita para que la aplicación
// apunte SIEMPRE a este proyecto, con independencia de las variables de entorno
// que pueda inyectar la plataforma de despliegue (Lovable). La anon/publishable
// key es pública por diseño (viaja en el bundle del frontend).
//
// Si en el futuro se migra a otro proyecto, basta con cambiar estos 3 valores.
export const SUPABASE_PROJECT_ID = "wgeyspfcfjmbkmwmwfyc";
export const SUPABASE_URL = "https://wgeyspfcfjmbkmwmwfyc.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXlzcGZjZmptYmttd213ZnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDQyNTAsImV4cCI6MjA5NzcyMDI1MH0.VbGIcR9Z91vuw_QF7aoyttDmpY-LO4Ar8dQ-TBd5X-o";
