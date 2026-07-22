import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ANON_KEY } from "@/integrations/supabase/config";
import {
  META_APP_ID, META_ES_CONFIG_ID, META_GRAPH_VERSION, META_ES_FEATURE_TYPE,
} from "@/integrations/meta/config";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;

// Carga e inicializa el SDK de Facebook una sola vez.
function loadFacebookSdk(): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: META_GRAPH_VERSION,
      });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de Facebook"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

interface Props {
  accountId: string;
  onConnected?: () => void;
}

/**
 * Botón de conexión por Embedded Signup (coexistencia).
 * El usuario pulsa → se abre el popup de Meta → escanea el QR desde la app de
 * WhatsApp Business del móvil → el backend canjea el `code`, suscribe la WABA al
 * webhook y guarda phone_number_id / waba_id / access_token en whatsapp_config.
 */
const WhatsAppEmbeddedSignup = ({ accountId, onConnected }: Props) => {
  const [loading, setLoading] = useState(false);
  // Datos que llegan por el evento message del popup (antes que el code).
  const sessionInfo = useRef<{ phone_number_id?: string; waba_id?: string }>({});

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          if (data.data.phone_number_id) sessionInfo.current.phone_number_id = data.data.phone_number_id;
          if (data.data.waba_id) sessionInfo.current.waba_id = data.data.waba_id;
        }
      } catch {
        // mensaje no relacionado con el Embedded Signup
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const finish = useCallback(
    async (code: string) => {
      const { phone_number_id, waba_id } = sessionInfo.current;
      // Enviamos el token de sesión explícitamente: la función corre con
      // verify_jwt=false y valida la sesión por su cuenta con getUser().
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.");
      const { data, error } = await supabase.functions.invoke("whatsapp_embedded_signup", {
        body: {
          account_id: accountId, code, phone_number_id, waba_id,
          // El SDK de JS emite el code contra la URL de esta página; el backend
          // la necesita para canjear el token con el redirect_uri idéntico.
          redirect_uri: window.location.origin + window.location.pathname,
        },
        // Al pasar headers propios se sobrescriben los de invoke, así que hay
        // que reponer el apikey que exige el gateway de Supabase, además del
        // Authorization con el token de sesión (que valida getUser en la función).
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error || error?.message || "Error al conectar";
        // supabase-js expone el cuerpo de la respuesta de error en error.context
        // (un Response). Ahí viene el detalle real del backend ({ error: "..." }).
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* la respuesta no traía JSON */ }
        throw new Error(msg);
      }
      toast({ title: "WhatsApp conectado", description: "Número vinculado y guardado correctamente." });
      onConnected?.();
    },
    [accountId, onConnected],
  );

  const handleConnect = useCallback(async () => {
    if (!META_ES_CONFIG_ID || META_ES_CONFIG_ID === "PON_AQUI_TU_CONFIG_ID") {
      toast({
        title: "Falta el Config ID",
        description: "Configura META_ES_CONFIG_ID en src/integrations/meta/config.ts.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    sessionInfo.current = {};
    try {
      await loadFacebookSdk();
      // Ojo: FB.login NO admite un callback async (lanza "Expression is of type
      // asyncfunction, not function"). El callback debe ser síncrono; el trabajo
      // asíncrono se hace dentro con .then()/.catch().
      window.FB.login(
        (response: any) => {
          const code = response?.authResponse?.code;
          if (!code) {
            setLoading(false);
            if (response?.status !== "connected" && !response?.authResponse) {
              toast({ title: "Conexión cancelada", variant: "destructive" });
            }
            return;
          }
          finish(code)
            .catch((err: any) =>
              toast({ title: "Error al conectar", description: err.message, variant: "destructive" }),
            )
            .finally(() => setLoading(false));
        },
        {
          config_id: META_ES_CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            // Solo se incluye featureType si hay uno (coexistencia). Vacío =
            // onboarding estándar del número (verificar + registrar).
            ...(META_ES_FEATURE_TYPE ? { featureType: META_ES_FEATURE_TYPE } : {}),
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  }, [finish]);

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
        {loading ? "Conectando..." : "Conectar WhatsApp (escanear QR)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Abre el asistente de Meta y, en tu móvil, escanea el QR desde <strong>WhatsApp Business →
        Dispositivos vinculados</strong>. Al terminar, el número queda conectado y guardado
        automáticamente (sin pegar credenciales).
      </p>
    </div>
  );
};

export default WhatsAppEmbeddedSignup;
