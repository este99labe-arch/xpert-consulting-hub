import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageCircle, Loader2, Check, X, UserPlus, Clock } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/shared/EmptyState";

interface Match {
  id: string;
  account_id_from: string;
  account_id_to: string;
  created_at: string;
  other_account_id: string;
  other_name: string;
  other_email?: string | null;
  other_phone?: string | null;
}

interface PendingRequest {
  id: string;
  account_id_from: string;
  created_at: string;
  from_name: string;
}

const MatchesTab = () => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState("");
  const [subTab, setSubTab] = useState("connections");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch confirmed matches
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["xred-matches", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_interactions")
        .select("id, account_id_from, account_id_to, created_at")
        .eq("is_match", true)
        .or(`account_id_from.eq.${accountId},account_id_to.eq.${accountId}`);

      if (!data) return [];

      const seen = new Set<string>();
      const unique: any[] = [];
      for (const m of data) {
        const otherId = m.account_id_from === accountId ? m.account_id_to : m.account_id_from;
        if (!seen.has(otherId)) {
          seen.add(otherId);
          unique.push({ ...m, other_account_id: otherId });
        }
      }

      const ids = unique.map((m) => m.other_account_id);
      if (ids.length === 0) return [];
      const { data: accounts } = await supabase.from("accounts").select("id, name").in("id", ids);
      const nameMap = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]));

      return unique.map((m) => ({
        ...m,
        other_name: nameMap[m.other_account_id] || "Empresa",
      })) as Match[];
    },
    enabled: !!accountId,
  });

  // Fetch pending incoming requests (someone liked me, I haven't responded)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["xred-pending-requests", accountId],
    queryFn: async () => {
      // Get likes directed to me
      const { data: incomingLikes } = await supabase
        .from("xred_interactions")
        .select("id, account_id_from, created_at")
        .eq("account_id_to", accountId!)
        .eq("type", "like")
        .eq("is_match", false);

      if (!incomingLikes || incomingLikes.length === 0) return [];

      // Check which ones I've already responded to (accept/skip/block)
      const fromIds = incomingLikes.map((l) => l.account_id_from);
      const { data: myResponses } = await supabase
        .from("xred_interactions")
        .select("account_id_to")
        .eq("account_id_from", accountId!)
        .in("account_id_to", fromIds);

      const respondedTo = new Set((myResponses || []).map((r) => r.account_id_to));
      const pending = incomingLikes.filter((l) => !respondedTo.has(l.account_id_from));

      if (pending.length === 0) return [];

      const ids = pending.map((p) => p.account_id_from);
      const { data: accounts } = await supabase.from("accounts").select("id, name").in("id", ids);
      const nameMap = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]));

      return pending.map((p) => ({
        ...p,
        from_name: nameMap[p.account_id_from] || "Empresa",
      })) as PendingRequest[];
    },
    enabled: !!accountId,
  });

  // Fetch sent pending requests
  const { data: sentRequests = [] } = useQuery({
    queryKey: ["xred-sent-requests", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_interactions")
        .select("id, account_id_to, created_at")
        .eq("account_id_from", accountId!)
        .eq("type", "like")
        .eq("is_match", false);

      if (!data || data.length === 0) return [];

      const ids = data.map((d) => d.account_id_to);
      const { data: accounts } = await supabase.from("accounts").select("id, name").in("id", ids);
      const nameMap = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]));

      return data.map((d) => ({
        ...d,
        to_name: nameMap[d.account_id_to] || "Empresa",
      }));
    },
    enabled: !!accountId,
  });

  // Accept request mutation
  const acceptMutation = useMutation({
    mutationFn: async (fromAccountId: string) => {
      const { error } = await supabase.from("xred_interactions").insert({
        account_id_from: accountId!,
        account_id_to: fromAccountId,
        type: "accept",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Conexión aceptada! Ya puedes chatear.");
      queryClient.invalidateQueries({ queryKey: ["xred-pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["xred-matches"] });
      queryClient.invalidateQueries({ queryKey: ["xred-sent-requests"] });
    },
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async (fromAccountId: string) => {
      const { error } = await supabase.from("xred_interactions").insert({
        account_id_from: accountId!,
        account_id_to: fromAccountId,
        type: "skip",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("Solicitud rechazada");
      queryClient.invalidateQueries({ queryKey: ["xred-pending-requests"] });
    },
  });

  // Messages
  const { data: chatMessages = [] } = useQuery({
    queryKey: ["xred-messages", selectedMatch?.id],
    queryFn: async () => {
      if (!selectedMatch) return [];
      const { data } = await supabase
        .from("xred_messages")
        .select("*")
        .eq("interaction_id", selectedMatch.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedMatch,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!selectedMatch) return;
    const channel = supabase
      .channel(`xred-chat-${selectedMatch.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "xred_messages",
        filter: `interaction_id=eq.${selectedMatch.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["xred-messages", selectedMatch.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMatch?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("xred_messages").insert({
        interaction_id: selectedMatch!.id,
        sender_account_id: accountId!,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["xred-messages", selectedMatch?.id] });
    },
  });

  const handleSend = () => {
    if (!message.trim() || !selectedMatch) return;
    sendMutation.mutate(message.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="connections" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Conexiones
            {matches.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{matches.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Solicitudes
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Enviadas
          </TabsTrigger>
        </TabsList>

        {/* CONNECTIONS + CHAT */}
        <TabsContent value="connections">
          {matches.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Sin conexiones aún"
              description="Cuando otra empresa acepte tu solicitud (o tú aceptes la suya), aparecerá aquí con opción de chat."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[550px]">
              <Card className="md:col-span-1 overflow-hidden">
                <div className="p-3 border-b font-medium text-sm">Conexiones ({matches.length})</div>
                <ScrollArea className="h-[calc(100%-42px)]">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMatch(m)}
                      className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selectedMatch?.id === m.id ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {m.other_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.other_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Conectado · {new Date(m.created_at).toLocaleDateString("es-ES")}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              </Card>

              <Card className="md:col-span-2 flex flex-col overflow-hidden">
                {selectedMatch ? (
                  <>
                    <div className="p-3 border-b flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {selectedMatch.other_name.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{selectedMatch.other_name}</span>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-3">
                        {chatMessages.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-8">¡Envía el primer mensaje!</p>
                        )}
                        {chatMessages.map((msg: any) => {
                          const isMine = msg.sender_account_id === accountId;
                          return (
                            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                                {msg.content}
                                <div className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                  {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    <div className="p-3 border-t flex gap-2">
                      <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      />
                      <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Selecciona una conexión para chatear
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* PENDING REQUESTS */}
        <TabsContent value="requests">
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Sin solicitudes pendientes"
              description="Cuando otra empresa quiera conectar contigo, verás su solicitud aquí."
            />
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <Card key={req.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                        {req.from_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{req.from_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Solicitud recibida · {new Date(req.created_at).toLocaleDateString("es-ES")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rejectMutation.mutate(req.account_id_from)}
                        disabled={rejectMutation.isPending || acceptMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(req.account_id_from)}
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aceptar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SENT REQUESTS */}
        <TabsContent value="sent">
          {sentRequests.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin solicitudes enviadas"
              description="Cuando envíes solicitudes de conexión desde Descubrir, aparecerán aquí."
            />
          ) : (
            <div className="space-y-3">
              {sentRequests.map((req: any) => (
                <Card key={req.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {req.to_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{req.to_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Enviada · {new Date(req.created_at).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendiente
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MatchesTab;
