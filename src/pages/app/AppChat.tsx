import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import {
  MessageCircle, Send, Search, Bot, UserRound, Hand, Building2, Loader2, ShieldAlert, CheckCheck, Bell, BellOff, Clock3,
  Paperclip, ListTodo, X, CheckSquare,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import ChatMedia from "@/components/chat/ChatMedia";
import CreateTaskFromChatDialog from "@/components/chat/CreateTaskFromChatDialog";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_META: Record<string, { label: string; className: string }> = {
  BOT:     { label: "Bot", className: "bg-primary/10 text-primary" },
  PENDING: { label: "Pendiente", className: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]" },
  HUMAN:   { label: "Atendido", className: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]" },
  CLOSED:  { label: "Cerrado", className: "bg-muted text-muted-foreground" },
};

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const timeLabel = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ayer";
  return format(d, "d MMM", { locale: es });
};

const AppChat = () => {
  const { accountId, user, role } = useAuth();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Selección de mensajes del cliente para generar tarea
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [taskOpen, setTaskOpen] = useState(false);
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Notificaciones de mensajes nuevos (con sonido), configurable
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("chat-notify") !== "off"; } catch { return true; }
  });
  const soundRef = useRef(soundEnabled);
  useEffect(() => {
    soundRef.current = soundEnabled;
    try { localStorage.setItem("chat-notify", soundEnabled ? "on" : "off"); } catch { /* ignore */ }
  }, [soundEnabled]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playBeep = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  };

  // WhatsApp configurado?
  const { data: waConfig } = useQuery({
    queryKey: ["chat-wa-config", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_config").select("is_enabled, phone_number_id, display_phone, reopen_template_name, reopen_template_lang")
        .eq("account_id", accountId).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["chat-conversations", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("id, contact_phone, contact_name, status, assigned_to, bot_paused, last_message_at, last_message_preview, last_direction, unread_count, client_id, business_clients(name), client_contacts(name, position)")
        .eq("account_id", accountId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, direction, author_type, body, status, created_at, message_type, media_url, media_mime, media_transcription")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedId,
  });

  // Realtime
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`chat-${accountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `account_id=eq.${accountId}` }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["chat-conversations", accountId] });
        if (payload?.new?.conversation_id) qc.invalidateQueries({ queryKey: ["chat-messages", payload.new.conversation_id] });
        // Notificar mensajes entrantes nuevos
        if (payload?.eventType === "INSERT" && payload?.new?.direction === "IN") {
          if (soundRef.current) playBeep();
          toast({ title: "Nuevo mensaje de WhatsApp", description: (payload.new.body || "").slice(0, 80) });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `account_id=eq.${accountId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-conversations", accountId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accountId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, selectedId]);

  const selected = useMemo(() => conversations.find((c: any) => c.id === selectedId), [conversations, selectedId]);

  const filtered = conversations.filter((c: any) => {
    const name = c.business_clients?.name || c.contact_name || c.contact_phone || "";
    return name.toLowerCase().includes(search.toLowerCase()) || (c.contact_phone || "").includes(search);
  });

  const send = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp_send", {
        body: { conversation_id: selectedId, body: text },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => { setDraft(""); qc.invalidateQueries({ queryKey: ["chat-messages", selectedId] }); },
    onError: (e: any) => toast({ title: "No se pudo enviar", description: e.message, variant: "destructive" }),
  });

  // Envío de imagen: sube al bucket privado y la manda por la Cloud API
  const sendImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedId || !accountId) throw new Error("Sin conversación");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${accountId}/${selectedId}/${crypto.randomUUID()}.${ext}`;
      const upl = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upl.error) throw upl.error;
      const { data, error } = await supabase.functions.invoke("whatsapp_send", {
        body: { conversation_id: selectedId, media_path: path, caption: draft.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => { setDraft(""); qc.invalidateQueries({ queryKey: ["chat-messages", selectedId] }); },
    onError: (e: any) => toast({ title: "No se pudo enviar la imagen", description: e.message, variant: "destructive" }),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast({ title: "Solo se admiten imágenes", variant: "destructive" }); return; }
    if (f.size > 5 * 1024 * 1024) { toast({ title: "La imagen supera 5 MB", variant: "destructive" }); return; }
    sendImage.mutate(f);
  };

  // Ventana de 24h de WhatsApp: solo se puede responder libremente si el
  // contacto ha escrito en las últimas 24 horas; fuera de ella, plantillas.
  const lastInAt = useMemo(() => {
    const ins = (messages as any[]).filter((m) => m.direction === "IN");
    return ins.length ? new Date(ins[ins.length - 1].created_at) : null;
  }, [messages]);
  const windowOpen = !!lastInAt && Date.now() - lastInAt.getTime() < 24 * 60 * 60 * 1000;

  const sendReopenTemplate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp_send", {
        body: { conversation_id: selectedId, use_template: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: "Plantilla enviada", description: "Cuando el contacto responda se reabrirá la ventana de 24 h." });
      qc.invalidateQueries({ queryKey: ["chat-messages", selectedId] });
    },
    onError: (e: any) => toast({ title: "No se pudo enviar la plantilla", description: e.message, variant: "destructive" }),
  });

  const intervene = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ bot_paused: true, status: "HUMAN", assigned_to: user!.id })
        .eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-conversations", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setSelectMode(false);
    setPicked(new Set());
    const conv = conversations.find((c: any) => c.id === id);
    if (conv?.unread_count > 0) {
      await supabase.from("chat_conversations").update({ unread_count: 0 }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["chat-conversations", accountId] });
    }
  };

  const displayName = (c: any) => c?.business_clients?.name || c?.contact_name || c?.contact_phone || "Contacto";

  return (
    <div className="flex h-[calc(100vh-8.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* ─── Lista de conversaciones ─── */}
      <aside className="flex w-full max-w-xs flex-col border-r border-border">
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Chat</h1>
            <div className="ml-auto flex items-center gap-1.5">
              {waConfig?.display_phone && (
                <span className="text-xs text-muted-foreground">{waConfig.display_phone}</span>
              )}
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? "Silenciar avisos de mensajes" : "Activar avisos con sonido"}
              >
                {soundEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversación..." className="h-9 pl-8" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {conversations.length === 0 ? "Aún no hay conversaciones." : "Sin resultados."}
            </div>
          ) : (
            filtered.map((c: any) => {
              const st = STATUS_META[c.status] || STATUS_META.BOT;
              return (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-border/60 p-3 text-left transition-colors hover:bg-muted/50 ${selectedId === c.id ? "bg-muted" : ""}`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials(displayName(c))}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{displayName(c)}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_direction === "OUT" ? "Tú: " : ""}{c.last_message_preview || "—"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.className}`}>{st.label}</span>
                      {c.business_clients?.name && <Building2 className="h-3 w-3 text-muted-foreground" />}
                      {c.unread_count > 0 && (
                        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--success))] px-1 text-[10px] font-bold text-white">{c.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── Hilo ─── */}
      <section className="flex flex-1 flex-col bg-muted/20">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">Selecciona una conversación</p>
            {!waConfig?.is_enabled && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs text-[hsl(var(--warning))]">
                <ShieldAlert className="h-4 w-4" />
                WhatsApp no está configurado.
                {isManager && <button className="underline" onClick={() => navigate("/app/settings")}>Configurar</button>}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Cabecera del hilo */}
            <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials(displayName(selected))}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName(selected)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.contact_phone}
                  {selected.client_contacts?.name && ` · ${selected.client_contacts.name}`}
                  {selected.client_contacts?.position && ` (${selected.client_contacts.position})`}
                </p>
              </div>
              {selected.client_id && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(`/app/clients/${selected.client_id}`)}>
                  <Building2 className="h-4 w-4" /> Ver cliente
                </Button>
              )}
              <Button
                variant={selectMode ? "default" : "ghost"} size="sm" className="gap-1.5"
                onClick={() => { setSelectMode((v) => !v); setPicked(new Set()); }}
              >
                <CheckSquare className="h-4 w-4" /> {selectMode ? "Cancelar" : "Tarea"}
              </Button>
              {selected.status !== "HUMAN" && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => intervene.mutate()} disabled={intervene.isPending}>
                  <Hand className="h-4 w-4" /> Intervenir
                </Button>
              )}
              {selected.bot_paused && (
                <Badge variant="outline" className="gap-1"><UserRound className="h-3 w-3" /> Humano</Badge>
              )}
            </header>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4 scrollbar-hide">
              {messages.map((m: any) => {
                const out = m.direction === "OUT";
                const selectable = selectMode && !out;
                const isImage = m.message_type === "image" && m.media_url;
                const isAudio = m.message_type === "audio" && m.media_url;
                const isDoc = m.message_type === "document" && m.media_url;
                return (
                  <div key={m.id} className={`flex items-center gap-2 ${out ? "justify-end" : "justify-start"}`}>
                    {selectable && (
                      <Checkbox
                        checked={picked.has(m.id)}
                        onCheckedChange={() => togglePick(m.id)}
                        className="shrink-0"
                        aria-label="Seleccionar mensaje"
                      />
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-2xs ${out ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card"} ${selectable ? "cursor-pointer" : ""} ${picked.has(m.id) ? "ring-2 ring-primary" : ""}`}
                      onClick={selectable ? () => togglePick(m.id) : undefined}
                    >
                      {out && m.author_type === "BOT" && (
                        <span className="mb-0.5 flex items-center gap-1 text-[11px] opacity-80"><Bot className="h-3 w-3" /> Bot</span>
                      )}
                      {out && m.author_type === "SYSTEM" && (
                        <span className="mb-0.5 flex items-center gap-1 text-[11px] opacity-80"><CheckCheck className="h-3 w-3" /> Automático</span>
                      )}
                      {(isImage || isAudio || isDoc) && (
                        <div className="mb-1">
                          <ChatMedia
                            path={m.media_url}
                            type={isImage ? "image" : isAudio ? "audio" : "document"}
                            mime={m.media_mime}
                            transcription={m.media_transcription}
                          />
                        </div>
                      )}
                      {m.body && !isAudio && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      <span className={`mt-0.5 block text-right text-[10px] ${out ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {format(new Date(m.created_at), "HH:mm")}{m.status === "FAILED" ? " · error" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
              )}
            </div>

            {/* Ventana de 24h cerrada: solo plantillas aprobadas */}
            {!windowOpen && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border bg-[hsl(var(--warning))]/10 px-4 py-2.5 text-sm">
                <Clock3 className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
                <span className="flex-1 text-muted-foreground">
                  Han pasado más de 24 h desde el último mensaje del contacto. WhatsApp solo permite reabrir con una plantilla aprobada.
                </span>
                {(waConfig as any)?.reopen_template_name ? (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendReopenTemplate.mutate()} disabled={sendReopenTemplate.isPending}>
                    {sendReopenTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Reabrir con plantilla
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Configura la plantilla en Configuración → WhatsApp</span>
                )}
              </div>
            )}

            {/* Barra de selección para crear tarea */}
            {selectMode && (
              <div className="flex items-center gap-2 border-t border-border bg-primary/5 px-4 py-2.5 text-sm">
                <ListTodo className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-muted-foreground">
                  {picked.size > 0 ? `${picked.size} mensaje${picked.size > 1 ? "s" : ""} seleccionado${picked.size > 1 ? "s" : ""}` : "Marca los mensajes del cliente para generar una tarea"}
                </span>
                <Button size="sm" className="gap-1.5" onClick={() => setTaskOpen(true)} disabled={picked.size === 0}>
                  <ListTodo className="h-3.5 w-3.5" /> Crear tarea
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelectMode(false); setPicked(new Set()); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Compositor */}
            <form
              onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !send.isPending) send.mutate(draft.trim()); }}
              className="flex items-center gap-2 border-t border-border bg-background px-4 py-3"
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <Button
                type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0"
                onClick={() => fileRef.current?.click()}
                disabled={!waConfig?.is_enabled || sendImage.isPending || !windowOpen}
                title="Adjuntar imagen" aria-label="Adjuntar imagen"
              >
                {sendImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={!waConfig?.is_enabled ? "Configura WhatsApp para responder" : windowOpen ? "Escribe un mensaje..." : "Ventana de 24 h cerrada — usa la plantilla"}
                disabled={!waConfig?.is_enabled || send.isPending || !windowOpen}
                className="h-11"
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!draft.trim() || send.isPending || !waConfig?.is_enabled || !windowOpen} aria-label="Enviar mensaje">
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </section>

      <CreateTaskFromChatDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        conversation={selected ? { id: selected.id, client_id: selected.client_id, display_name: displayName(selected) } : null}
        messages={(messages as any[]).filter((m) => picked.has(m.id)).map((m) => ({ body: m.body, created_at: m.created_at }))}
        onCreated={() => { setSelectMode(false); setPicked(new Set()); }}
      />
    </div>
  );
};

export default AppChat;
