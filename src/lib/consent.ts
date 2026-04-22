import { supabase } from "@/integrations/supabase/client";

export const COOKIE_POLICY_VERSION = "1.0";
const STORAGE_KEY = "xpert_cookie_consent_v1";
const SESSION_ID_KEY = "xpert_session_id";

export type ConsentChoice = {
  necessary: true; // siempre true: técnicas imprescindibles
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
};

export const getStoredConsent = (): ConsentChoice | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentChoice;
    if (parsed.version !== COOKIE_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getOrCreateSessionId = (): string => {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
};

const hashIp = async (ip: string): Promise<string> => {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const saveConsent = async (choice: Omit<ConsentChoice, "timestamp" | "version">) => {
  const stored: ConsentChoice = {
    ...choice,
    necessary: true,
    timestamp: new Date().toISOString(),
    version: COOKIE_POLICY_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

  // Registrar en BD para auditoría legal
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = user ? null : getOrCreateSessionId();
    let ipHash: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const j = await r.json();
      if (j?.ip) ipHash = await hashIp(j.ip);
    } catch {
      /* ignore network errors */
    }

    const rows = (["necessary", "analytics", "marketing"] as const).map((type) => ({
      user_id: user?.id ?? null,
      session_id: sessionId,
      consent_type: type,
      granted: type === "necessary" ? true : (stored as any)[type],
      policy_version: COOKIE_POLICY_VERSION,
      ip_hash: ipHash,
      user_agent: navigator.userAgent,
    }));

    await supabase.from("user_consents").insert(rows);
  } catch (e) {
    console.warn("[consent] Could not record consent:", e);
  }

  return stored;
};

export const clearStoredConsent = () => {
  localStorage.removeItem(STORAGE_KEY);
};
