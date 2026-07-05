import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarOff, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  accountId: string;
  isManager: boolean;
}

const HolidaysCard = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["company-holidays", accountId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_holidays")
        .select("*")
        .eq("account_id", accountId)
        .gte("holiday_date", `${year}-01-01`)
        .lte("holiday_date", `${year}-12-31`)
        .order("holiday_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!newDate || !newName.trim()) throw new Error("Indica fecha y nombre del festivo");
      const { error } = await supabase.from("company_holidays").insert({
        account_id: accountId, holiday_date: newDate, name: newName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewDate(""); setNewName("");
      qc.invalidateQueries({ queryKey: ["company-holidays", accountId] });
      toast({ title: "Festivo añadido" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-holidays", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" /> Calendario de festivos</CardTitle>
          <CardDescription>Los festivos no computan como horas esperadas en los balances de jornada.</CardDescription>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isManager && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Fecha</span>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-[160px]" />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Nombre</span>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Fiesta Nacional de España" />
            </div>
            <Button size="sm" onClick={() => addMut.mutate()} disabled={addMut.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Añadir
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : holidays.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin festivos registrados en {year}. Añade los festivos nacionales, autonómicos y locales de tu empresa.
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {holidays.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {format(parseISO(h.holiday_date), "dd MMM", { locale: es })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
                {isManager && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => delMut.mutate(h.id)} aria-label="Eliminar festivo">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HolidaysCard;
