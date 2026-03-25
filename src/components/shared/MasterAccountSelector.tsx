import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface MasterAccountSelectorProps {
  title: string;
  onSelect: (accountId: string) => void;
  selectedAccountId?: string;
  onClear?: () => void;
  variant?: "page" | "inline";
}

const MasterAccountSelector = ({
  title,
  onSelect,
  selectedAccountId,
  onClear,
  variant = "page",
}: MasterAccountSelectorProps) => {
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("type", "CLIENT")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  if (variant === "inline") {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <Select
              value={selectedAccountId || ""}
              onValueChange={(v) => onSelect(v)}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {clientAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Page variant - full page selector
  if (!selectedAccountId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Selecciona una cuenta</CardTitle></CardHeader>
          <CardContent>
            <Select onValueChange={onSelect}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent>
                {clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  // When selected, show the "change" button (rendered by the parent via onClear)
  return null;
};

export const MasterAccountClearButton = ({ onClear }: { onClear: () => void }) => (
  <Button variant="outline" size="sm" onClick={onClear}>Cambiar cuenta</Button>
);

export default MasterAccountSelector;
