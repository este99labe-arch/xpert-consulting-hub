import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { Calculator, Plus, Trash2, TrendingUp, TrendingDown, Info } from "lucide-react";

interface Props {
  accountId: string;
}

const DEFAULT_ACCOUNTS: { key: string; label: string; types: string[] }[] = [
  { key: "acc_sales_default",   label: "Ventas / ingresos (por defecto)", types: ["INCOME"] },
  { key: "acc_expense_default", label: "Gastos (por defecto)",            types: ["EXPENSE"] },
  { key: "acc_customers",       label: "Clientes",                        types: ["ASSET"] },
  { key: "acc_suppliers",       label: "Proveedores",                     types: ["LIABILITY"] },
  { key: "acc_treasury",        label: "Tesorería (cobros/pagos)",        types: ["ASSET"] },
  { key: "acc_vat_output",      label: "IVA repercutido",                 types: ["LIABILITY"] },
  { key: "acc_vat_input",       label: "IVA soportado",                   types: ["ASSET"] },
  { key: "acc_irpf_receivable", label: "Retenciones soportadas (IRPF)",   types: ["ASSET"] },
  { key: "acc_irpf_payable",    label: "Retenciones practicadas (IRPF)",  types: ["LIABILITY"] },
];

const AccountingSettingsTab = ({ accountId }: Props) => {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["acc-settings", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("account_settings").select("*").eq("account_id", accountId).maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: chart = [] } = useQuery({
    queryKey: ["acc-chart", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts").select("id, code, name, type")
        .eq("account_id", accountId).order("code");
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["acc-categories", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounting_categories").select("*")
        .eq("account_id", accountId).order("sort_order");
      return (data || []) as any[];
    },
    enabled: !!accountId,
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase
        .from("account_settings")
        .upsert({ account_id: accountId, ...patch }, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acc-settings", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const catMutation = useMutation({
    mutationFn: async (op: { type: "add" | "update" | "delete"; row?: any }) => {
      if (op.type === "add") {
        const sameKind = categories.filter((c) => c.kind === op.row.kind);
        const firstAcc = chart.find((a: any) =>
          (op.row.kind === "INCOME" ? a.type === "INCOME" : a.type === "EXPENSE"));
        const { error } = await supabase.from("accounting_categories").insert({
          account_id: accountId, kind: op.row.kind, name: "Nueva categoría",
          account_code: firstAcc?.code || "", sort_order: sameKind.length + 1,
        });
        if (error) throw error;
      } else if (op.type === "update") {
        const { error } = await supabase
          .from("accounting_categories")
          .update({ name: op.row.name, account_code: op.row.account_code })
          .eq("id", op.row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("accounting_categories").delete().eq("id", op.row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acc-categories", accountId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const method = settings?.accounting_method ?? "ACCRUAL";
  const auto = settings?.accounting_auto_enabled ?? true;

  const incomeCats = categories.filter((c) => c.kind === "INCOME");
  const expenseCats = categories.filter((c) => c.kind === "EXPENSE");
  const incomeAccounts = chart.filter((a: any) => a.type === "INCOME");
  const expenseAccounts = chart.filter((a: any) => a.type === "EXPENSE");

  const CategoryList = ({ kind, cats, accounts }: { kind: string; cats: any[]; accounts: any[] }) => (
    <div className="space-y-2">
      {cats.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <Input
            defaultValue={c.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== c.name)
                catMutation.mutate({ type: "update", row: { ...c, name: e.target.value.trim() } });
            }}
            className="h-9 flex-1"
          />
          <Select
            value={c.account_code}
            onValueChange={(v) => catMutation.mutate({ type: "update", row: { ...c, account_code: v } })}
          >
            <SelectTrigger className="h-9 w-[170px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.code}>{a.code} · {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
            onClick={() => catMutation.mutate({ type: "delete", row: c })}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => catMutation.mutate({ type: "add", row: { kind } })}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Añadir categoría
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Método contable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" /> Método contable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Criterio</Label>
              <Select value={method} onValueChange={(v) => saveSettings.mutate({ accounting_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCRUAL">Devengo (recomendado)</SelectItem>
                  <SelectItem value="CASH">Criterio de caja</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {method === "ACCRUAL"
                  ? "Contabiliza al emitir la factura y registra el cobro/pago por separado."
                  : "Contabiliza ingresos y gastos (con su IVA) en el momento del cobro/pago."}
              </p>
            </div>
            <div className="flex items-start justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label>Asientos automáticos</Label>
                <p className="text-xs text-muted-foreground">Genera el diario al registrar facturas y cobros.</p>
              </div>
              <Switch checked={auto} onCheckedChange={(v) => saveSettings.mutate({ accounting_auto_enabled: v })} />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            El IRPF se contabiliza automáticamente (cuentas 473 / 4751) y los asientos siempre cuadran.
          </div>
        </CardContent>
      </Card>

      {/* Categorías */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categorías contables</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada factura o gasto se asigna a una categoría que determina su cuenta del PGC.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" /> Ingresos
            </div>
            <CategoryList kind="INCOME" cats={incomeCats} accounts={incomeAccounts} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="h-4 w-4 text-destructive" /> Gastos
            </div>
            <CategoryList kind="EXPENSE" cats={expenseCats} accounts={expenseAccounts} />
          </div>
        </CardContent>
      </Card>

      {/* Cuentas por defecto (avanzado) */}
      <Card>
        <CardContent className="pt-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="defaults" className="border-0">
              <AccordionTrigger className="py-0 hover:no-underline">
                <span className="text-base font-semibold">Cuentas por defecto (avanzado)</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {DEFAULT_ACCOUNTS.map((d) => {
                    const opts = chart.filter((a: any) => d.types.includes(a.type));
                    const val = settings?.[d.key] ?? "";
                    return (
                      <div key={d.key} className="space-y-1.5">
                        <Label className="text-xs">{d.label}</Label>
                        <Select value={val} onValueChange={(v) => saveSettings.mutate({ [d.key]: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {opts.map((a: any) => (
                              <SelectItem key={a.id} value={a.code}>{a.code} · {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountingSettingsTab;
