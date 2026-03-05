import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, Search, Plus, Download,
  ArrowUpCircle, ArrowDownCircle, RotateCcw, ShoppingCart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ---- Types ----
interface Product {
  id: string;
  account_id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  unit: string;
  min_stock: number;
  current_stock: number;
  cost_price: number;
  sale_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StockMovement {
  id: string;
  account_id: string;
  product_id: string;
  type: string;
  quantity: number;
  reason: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  products?: { name: string; sku: string };
}

interface PurchaseOrder {
  id: string;
  account_id: string;
  product_id: string;
  quantity: number;
  status: string;
  estimated_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  products?: { name: string; sku: string };
}

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", PENDING: "Pendiente", ORDERED: "Pedido", RECEIVED: "Recibido",
};
const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ORDERED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};
const movementTypeLabels: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };
const movementTypeIcons: Record<string, any> = { IN: ArrowUpCircle, OUT: ArrowDownCircle, ADJUSTMENT: RotateCcw };

const AppInventory = () => {
  const { user, accountId, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMaster = role === "MASTER_ADMIN";

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const activeAccountId = isMaster ? selectedAccountId : accountId;

  // ---- Master: client accounts ----
  const { data: clientAccounts = [] } = useQuery({
    queryKey: ["client-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, name").eq("type", "CLIENT").eq("is_active", true);
      return data || [];
    },
    enabled: isMaster,
  });

  // ---- Products ----
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("account_id", activeAccountId!)
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Stock Movements ----
  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name, sku)")
        .eq("account_id", activeAccountId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as StockMovement[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Purchase Orders ----
  const { data: orders = [] } = useQuery({
    queryKey: ["purchase-orders", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, products(name, sku)")
        .eq("account_id", activeAccountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseOrder[];
    },
    enabled: !!activeAccountId,
  });

  // ---- Dashboard KPIs ----
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.is_active && p.current_stock <= p.min_stock);
  const inventoryValue = products.reduce((s, p) => s + p.current_stock * p.cost_price, 0);
  const thisMonthMovements = movements.filter(m => {
    const d = new Date(m.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ---- Product Dialog ----
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pForm, setPForm] = useState({ name: "", sku: "", description: "", category: "General", unit: "uds", min_stock: "0", cost_price: "0", sale_price: "0" });

  const openNewProduct = () => {
    setEditingProduct(null);
    setPForm({ name: "", sku: "", description: "", category: "General", unit: "uds", min_stock: "0", cost_price: "0", sale_price: "0" });
    setProductDialog(true);
  };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setPForm({ name: p.name, sku: p.sku, description: p.description || "", category: p.category, unit: p.unit, min_stock: String(p.min_stock), cost_price: String(p.cost_price), sale_price: String(p.sale_price) });
    setProductDialog(true);
  };

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        account_id: activeAccountId!,
        name: pForm.name,
        sku: pForm.sku,
        description: pForm.description || null,
        category: pForm.category,
        unit: pForm.unit,
        min_stock: Number(pForm.min_stock),
        cost_price: Number(pForm.cost_price),
        sale_price: Number(pForm.sale_price),
      };
      if (editingProduct) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", activeAccountId] });
      setProductDialog(false);
      toast({ title: editingProduct ? "Producto actualizado" : "Producto creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleProductActive = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", activeAccountId] }),
  });

  // ---- Movement Dialog ----
  const [movDialog, setMovDialog] = useState(false);
  const [movForm, setMovForm] = useState({ product_id: "", type: "IN", quantity: "", reason: "manual", notes: "" });

  const saveMovement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_movements").insert({
        account_id: activeAccountId!,
        product_id: movForm.product_id,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        reason: movForm.reason,
        notes: movForm.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-movements", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["products", activeAccountId] });
      setMovDialog(false);
      toast({ title: "Movimiento registrado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Purchase Order Dialog ----
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ product_id: "", quantity: "", estimated_date: "", notes: "" });

  const saveOrder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchase_orders").insert({
        account_id: activeAccountId!,
        product_id: orderForm.product_id,
        quantity: Number(orderForm.quantity),
        estimated_date: orderForm.estimated_date || null,
        notes: orderForm.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", activeAccountId] });
      setOrderDialog(false);
      toast({ title: "Orden de compra creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, newStatus, productId, quantity }: { orderId: string; newStatus: string; productId: string; quantity: number }) => {
      const { error } = await supabase.from("purchase_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      // When received, create an IN movement
      if (newStatus === "RECEIVED") {
        const { error: movErr } = await supabase.from("stock_movements").insert({
          account_id: activeAccountId!,
          product_id: productId,
          type: "IN",
          quantity,
          reason: "compra",
          notes: `Recepción de orden de compra`,
          created_by: user!.id,
        });
        if (movErr) throw movErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", activeAccountId] });
      qc.invalidateQueries({ queryKey: ["products", activeAccountId] });
      toast({ title: "Estado actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Filters ----
  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState("ALL");
  const [prodStatusFilter, setProdStatusFilter] = useState("ALL");
  const [movTypeFilter, setMovTypeFilter] = useState("ALL");
  const [movProductFilter, setMovProductFilter] = useState("ALL");

  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (prodSearch && !p.name.toLowerCase().includes(prodSearch.toLowerCase()) && !p.sku.toLowerCase().includes(prodSearch.toLowerCase())) return false;
      if (prodCatFilter !== "ALL" && p.category !== prodCatFilter) return false;
      if (prodStatusFilter === "ACTIVE" && !p.is_active) return false;
      if (prodStatusFilter === "INACTIVE" && p.is_active) return false;
      return true;
    });
  }, [products, prodSearch, prodCatFilter, prodStatusFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movTypeFilter !== "ALL" && m.type !== movTypeFilter) return false;
      if (movProductFilter !== "ALL" && m.product_id !== movProductFilter) return false;
      return true;
    });
  }, [movements, movTypeFilter, movProductFilter]);

  // ---- CSV Export ----
  const exportProductsCSV = () => {
    const header = "Nombre,SKU,Categoría,Unidad,Stock Actual,Stock Mínimo,Precio Coste,Precio Venta,Activo\n";
    const rows = products.map(p => `"${p.name}","${p.sku}","${p.category}","${p.unit}",${p.current_stock},${p.min_stock},${p.cost_price},${p.sale_price},${p.is_active ? "Sí" : "No"}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "productos.csv"; a.click();
  };
  const exportMovementsCSV = () => {
    const header = "Fecha,Producto,SKU,Tipo,Cantidad,Razón,Notas\n";
    const rows = movements.map(m => `"${format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}","${m.products?.name || ""}","${m.products?.sku || ""}","${movementTypeLabels[m.type]}",${m.quantity},"${m.reason}","${m.notes || ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "movimientos.csv"; a.click();
  };

  // ---- Quick order from alert ----
  const openQuickOrder = (p: Product) => {
    setOrderForm({ product_id: p.id, quantity: String(Math.max(p.min_stock * 2 - p.current_stock, 1)), estimated_date: "", notes: `Reposición de ${p.name}` });
    setOrderDialog(true);
  };

  const nextStatus: Record<string, string> = { DRAFT: "PENDING", PENDING: "ORDERED", ORDERED: "RECEIVED" };

  // ---- Render ----
  if (isMaster && !selectedAccountId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Selecciona un cliente</CardTitle></CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clientAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeAccountId) return <p className="text-muted-foreground">Sin cuenta asignada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        {isMaster && (
          <Button variant="outline" size="sm" onClick={() => setSelectedAccountId("")}>Cambiar cliente</Button>
        )}
      </div>

      {/* Dashboard KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalProducts}</p>
                <p className="text-xs text-muted-foreground">Productos totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{lowStockProducts.length}</p>
                <p className="text-xs text-muted-foreground">Stock bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{inventoryValue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</p>
                <p className="text-xs text-muted-foreground">Valor del inventario</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{thisMonthMovements.length}</p>
                <p className="text-xs text-muted-foreground">Movimientos este mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas {lowStockProducts.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{lowStockProducts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
        </TabsList>

        {/* ===== PRODUCTS TAB ===== */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o SKU..." className="pl-8" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
            </div>
            <Select value={prodCatFilter} onValueChange={setProdCatFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={prodStatusFilter} onValueChange={setProdStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            {isManager && (
              <>
                <Button size="sm" onClick={openNewProduct}><Plus className="h-4 w-4 mr-1" />Nuevo Producto</Button>
                <Button size="sm" variant="outline" onClick={exportProductsCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
              </>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mín.</TableHead>
                  <TableHead className="text-right">Coste</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead>Estado</TableHead>
                  {isManager && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No se encontraron productos</TableCell></TableRow>
                )}
                {filteredProducts.map(p => {
                  const isLow = p.is_active && p.current_stock <= p.min_stock;
                  const isWarning = p.is_active && !isLow && p.current_stock < p.min_stock * 1.5;
                  return (
                    <TableRow key={p.id} className={isLow ? "bg-destructive/5" : isWarning ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell className="text-right">
                        <span className={isLow ? "text-destructive font-bold" : isWarning ? "text-yellow-600 dark:text-yellow-400 font-semibold" : ""}>
                          {p.current_stock} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{p.min_stock} {p.unit}</TableCell>
                      <TableCell className="text-right">{p.cost_price.toFixed(2)} €</TableCell>
                      <TableCell className="text-right">{p.sale_price.toFixed(2)} €</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      {isManager && (
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditProduct(p)}>Editar</Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleProductActive.mutate(p)}>
                            {p.is_active ? "Desactivar" : "Activar"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== MOVEMENTS TAB ===== */}
        <TabsContent value="movements" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={movTypeFilter} onValueChange={setMovTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value="IN">Entrada</SelectItem>
                <SelectItem value="OUT">Salida</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
              </SelectContent>
            </Select>
            <Select value={movProductFilter} onValueChange={setMovProductFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los productos</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isManager && (
              <>
                <Button size="sm" onClick={() => { setMovForm({ product_id: "", type: "IN", quantity: "", reason: "manual", notes: "" }); setMovDialog(true); }}>
                  <Plus className="h-4 w-4 mr-1" />Registrar Movimiento
                </Button>
                <Button size="sm" variant="outline" onClick={exportMovementsCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
              </>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Razón</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
                )}
                {filteredMovements.map(m => {
                  const Icon = movementTypeIcons[m.type] || RotateCcw;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                      <TableCell>{m.products?.name} <span className="text-xs text-muted-foreground">({m.products?.sku})</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Icon className={`h-4 w-4 ${m.type === "IN" ? "text-success" : m.type === "OUT" ? "text-destructive" : "text-muted-foreground"}`} />
                          {movementTypeLabels[m.type]}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{m.type === "OUT" ? `-${m.quantity}` : m.quantity}</TableCell>
                      <TableCell className="capitalize">{m.reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== ALERTS TAB ===== */}
        <TabsContent value="alerts" className="space-y-4">
          {lowStockProducts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay productos con stock bajo 🎉</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Stock Mínimo</TableHead>
                    <TableHead className="text-right">Déficit</TableHead>
                    {isManager && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts
                    .sort((a, b) => (a.current_stock - a.min_stock) - (b.current_stock - b.min_stock))
                    .map(p => (
                      <TableRow key={p.id} className="bg-destructive/5">
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">{p.current_stock} {p.unit}</TableCell>
                        <TableCell className="text-right">{p.min_stock} {p.unit}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">{p.current_stock - p.min_stock} {p.unit}</TableCell>
                        {isManager && (
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openQuickOrder(p)}>
                              <ShoppingCart className="h-4 w-4 mr-1" />Pedir
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ===== PURCHASE ORDERS TAB ===== */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center gap-2">
            {isManager && (
              <Button size="sm" onClick={() => { setOrderForm({ product_id: "", quantity: "", estimated_date: "", notes: "" }); setOrderDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" />Nueva Orden
              </Button>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Est.</TableHead>
                  <TableHead>Notas</TableHead>
                  {isManager && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin órdenes de compra</TableCell></TableRow>
                )}
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">{format(new Date(o.created_at), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell>{o.products?.name} <span className="text-xs text-muted-foreground">({o.products?.sku})</span></TableCell>
                    <TableCell className="text-right font-mono">{o.quantity}</TableCell>
                    <TableCell><Badge className={statusColors[o.status]}>{statusLabels[o.status]}</Badge></TableCell>
                    <TableCell className="text-sm">{o.estimated_date ? format(new Date(o.estimated_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{o.notes}</TableCell>
                    {isManager && (
                      <TableCell>
                        {o.status !== "RECEIVED" && (
                          <Button size="sm" variant="outline" onClick={() => updateOrderStatus.mutate({ orderId: o.id, newStatus: nextStatus[o.status], productId: o.product_id, quantity: o.quantity })}>
                            → {statusLabels[nextStatus[o.status]]}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== PRODUCT DIALOG ===== */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            <DialogDescription>Rellena los datos del producto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>SKU</Label><Input value={pForm.sku} onChange={e => setPForm(f => ({ ...f, sku: e.target.value }))} /></div>
            </div>
            <div><Label>Descripción</Label><Textarea value={pForm.description} onChange={e => setPForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoría</Label><Input value={pForm.category} onChange={e => setPForm(f => ({ ...f, category: e.target.value }))} /></div>
              <div><Label>Unidad</Label><Input value={pForm.unit} onChange={e => setPForm(f => ({ ...f, unit: e.target.value }))} placeholder="uds, kg, litros..." /></div>
              <div><Label>Stock Mínimo</Label><Input type="number" value={pForm.min_stock} onChange={e => setPForm(f => ({ ...f, min_stock: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Precio Coste (€)</Label><Input type="number" step="0.01" value={pForm.cost_price} onChange={e => setPForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
              <div><Label>Precio Venta (€)</Label><Input type="number" step="0.01" value={pForm.sale_price} onChange={e => setPForm(f => ({ ...f, sale_price: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveProduct.mutate()} disabled={!pForm.name || !pForm.sku}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MOVEMENT DIALOG ===== */}
      <Dialog open={movDialog} onOpenChange={setMovDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
            <DialogDescription>Selecciona producto, tipo y cantidad.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Producto</Label>
              <Select value={movForm.product_id} onValueChange={v => setMovForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{products.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={movForm.type} onValueChange={v => setMovForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Salida</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cantidad</Label><Input type="number" value={movForm.quantity} onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            </div>
            <div><Label>Razón</Label><Input value={movForm.reason} onChange={e => setMovForm(f => ({ ...f, reason: e.target.value }))} placeholder="compra, venta, merma..." /></div>
            <div><Label>Notas</Label><Textarea value={movForm.notes} onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMovement.mutate()} disabled={!movForm.product_id || !movForm.quantity}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ORDER DIALOG ===== */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
            <DialogDescription>Planifica la compra de stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Producto</Label>
              <Select value={orderForm.product_id} onValueChange={v => setOrderForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{products.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" value={orderForm.quantity} onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label>Fecha estimada</Label><Input type="date" value={orderForm.estimated_date} onChange={e => setOrderForm(f => ({ ...f, estimated_date: e.target.value }))} /></div>
            </div>
            <div><Label>Notas</Label><Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveOrder.mutate()} disabled={!orderForm.product_id || !orderForm.quantity}>Crear Orden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppInventory;
