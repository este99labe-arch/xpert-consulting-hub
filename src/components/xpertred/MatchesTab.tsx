import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

interface Match {
  id: string;
  account_id_from: string;
  account_id_to: string;
  created_at: string;
  other_account_id: string;
  other_name: string;
}

const MatchesTab = () => {
  const { accountId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch matches
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["xred-matches", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_interactions")
        .select("id, account_id_from, account_id_to, created_at")
        .eq("is_match", true)
        .or(`account_id_from.eq.${accountId},account_id_to.eq.${accountId}`);

      if (!data) return [];

      // Deduplicate (A→B and B→A both exist)
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const m of data) {
        const otherId = m.account_id_from === accountId ? m.account_id_to : m.account_id_from;
        if (!seen.has(otherId)) {
          seen.add(otherId);
          unique.push({ ...m, other_account_id: otherId });
        }
      }

      // Fetch names
      const ids = unique.map((m) => m.other_account_id);
      if (ids.length === 0) return [];
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, name")
        .in("id", ids);
      const nameMap = Object.fromEntries((accounts || []).map((a) => [a.id, a.name]));

      return unique.map((m) => ({
        ...m,
        other_name: nameMap[m.other_account_id] || "Empresa",
      })) as Match[];
    },
    enabled: !!accountId,
  });

  // Fetch messages for selected match
  const { data: messages = [] } = useQuery({
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

  // Realtime subscription
  useEffect(() => {
    if (!selectedMatch) return;
    const channel = supabase
      .channel(`xred-chat-${selectedMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "xred_messages",
          filter: `interaction_id=eq.${selectedMatch.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["xred-messages", selectedMatch.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMatch?.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin matches aún"
        description="Cuando otra empresa también quiera conectar contigo, aparecerá aquí."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {/* Match list */}
      <Card className="md:col-span-1 overflow-hidden">
        <div className="p-3 border-b font-medium text-sm">
          Matches ({matches.length})
        </div>
        <ScrollArea className="h-[calc(100%-42px)]">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMatch(m)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                selectedMatch?.id === m.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {m.other_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.other_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Match · {new Date(m.created_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </ScrollArea>
      </Card>

      {/* Chat */}
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
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    ¡Envía el primer mensaje!
                  </p>
                )}
                {messages.map((msg: any) => {
                  const isMine = msg.sender_account_id === accountId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                        <div
                          className={`text-[10px] mt-1 ${
                            isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
            Selecciona un match para chatear
          </div>
        )}
      </Card>
    </div>
  );
};

export default MatchesTab;
