// Configuración pública de la app de Meta (WhatsApp Embedded Signup).
//
// Estos valores NO son secretos: el App ID y el Config ID viajan en el bundle
// del frontend y se pasan al SDK de Facebook en el navegador. El App Secret
// (que sí es secreto) vive solo en los secretos de Supabase, nunca aquí.
//
// El popup de Embedded Signup solo abrirá desde los dominios dados de alta en
// Meta → "Inicio de sesión con Facebook → Configurar" (Allowed Domains del SDK).

// App ID de la app de Meta (visible en la URL del panel de developers).
export const META_APP_ID = "1514206456624236";

// Config ID de la configuración de "Inicio de sesión con Facebook".
// ⚠️ RELLENA ESTO con el Config ID que generaste (Login for Business → Configuraciones).
export const META_ES_CONFIG_ID = "1023022453811215";

// Versión de la Graph API usada por el SDK.
export const META_GRAPH_VERSION = "v21.0";

// featureType que activa el flujo de COEXISTENCIA (número que ya está en la app
// de WhatsApp Business del móvil → conexión por QR sin perder el móvil).
export const META_ES_FEATURE_TYPE = "whatsapp_business_app_onboarding";
