import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, Pencil } from "lucide-react";
import { ChartAccount } from "./types";

const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const typeLabels: Record<string, string> = {
  ASSET: "Activo", LIABILITY: "Pasivo", EQUITY: "Patrimonio", INCOME: "Ingresos", EXPENSE: "Gastos",
};
const typeColors: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  LIABILITY: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EQUITY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  INCOME: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPENSE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

interface ChartOfAccountsTabProps {
  chartAccounts: ChartAccount[];
  isManager: boolean;
  getAccountBalance: (accountId: string) => number;
  onSave: (form: { code: string; name: string; type: string }, editingId?: string) => void;
  isSaving: boolean;
}

const ChartOfAccountsTab = ({
  chartAccounts, isManager, getAccountBalance, onSave, isSaving,
}: ChartOfAccountsTabProps) => {
  const [chartSearch, setChartSearch] = useState("");
  const [chartDialog, setChartDialog] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartAccount | null>(null);
  const [chartForm, setChartForm] = useState({ code: "", name: "", type: "EXPENSE" });

  const filteredChart = useMemo(() => {
    if (!chartSearch) return chartAccounts;
    const q = chartSearch.toLowerCase();
    return chartAccounts.filter(c => c.code.includes(q) || c.name.toLowerCase().includes(q));
  }, [chartAccounts, chartSearch]);

  const groupedChart = useMemo(() => {
    const groups: Record<string, ChartAccount[]> = { ASSET: [], LIABILITY: [], EQUITY: [], INCOME: [], EXPENSE: [] };
    filteredChart.forEach(c => { if (groups[c.type]) groups[c.type].push(c); });
    return groups;
  }, [filteredChart]);

  const handleSave = () => {
    onSave(chartForm, editingChart?.id);
    setChartDialog(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código o nombre..." className="pl-8" value={chartSearch} onChange={e => setChartSearch(e.target.value)} />
        </div>
        {isManager && (
          <Button size="sm" onClick={() => { setEditingChart(null); setChartForm({ code: "", name: "", type: "EXPENSE" }); setChartDialog(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nueva cuenta
          </Button>
        )}
      </div>

      {Object.entries(groupedChart).map(([type, accounts]) => accounts.length > 0 && (
        <Card key={type}>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Badge className={typeColors[type]}>{typeLabels[type]}</Badge>
              <span className="text-sm text-muted-foreground">{accounts.length} cuentas</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right w-36">Saldo</TableHead>
                  {isManager && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(acc => {
                  const bal = getAccountBalance(acc.id);
                  return (
                    <TableRow key={acc.id} className={!acc.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                      <TableCell>{acc.name}</TableCell>
                      <TableCell className={`text-right font-mono ${bal >= 0 ? "" : "text-destructive"}`}>
                        {EUR(Math.abs(bal))} {bal < 0 ? "(H)" : bal > 0 ? "(D)" : ""}
                      </TableCell>
                      {isManager && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingChart(acc);
                            setChartForm({ code: acc.code, name: acc.name, type: acc.type });
                            setChartDialog(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Chart Account Dialog */}
      <Dialog open={chartDialog} onOpenChange={setChartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChart ? "Editar cuenta" : "Nueva cuenta contable"}</DialogTitle>
            <DialogDescription>Introduce los datos de la cuenta del plan contable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Código</Label>
                <Input value={chartForm.code} onChange={e => setChartForm(p => ({ ...p, code: e.target.value }))} placeholder="700" />
              </div>
              <div className="col-span-2">
                <Label>Nombre</Label>
                <Input value={chartForm.name} onChange={e => setChartForm(p => ({ ...p, name: e.target.value }))} placeholder="Ventas de mercaderías" />
              </div>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={chartForm.type} onValueChange={v => setChartForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChartDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!chartForm.code || !chartForm.name || isSaving}>
              {editingChart ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChartOfAccountsTab;
