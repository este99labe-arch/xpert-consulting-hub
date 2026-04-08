import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import MasterAccountSelector, { MasterAccountClearButton } from "@/components/shared/MasterAccountSelector";
import ProductsTab from "@/components/inventory/ProductsTab";
import MovementsTab from "@/components/inventory/MovementsTab";
import AlertsTab from "@/components/inventory/AlertsTab";
import PurchaseOrdersTab from "@/components/inventory/PurchaseOrdersTab";
import ProductDialog from "@/components/inventory/ProductDialog";
import MovementDialog from "@/components/inventory/MovementDialog";
import OrderDialog from "@/components/inventory/OrderDialog";
import { Product, StockMovement, PurchaseOrder } from "@/components/inventory/types";

const AppInventory = () => {
  const { user, accountId, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";
  const isMaster = role === "MASTER_ADMIN";

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const activeAccountId = isMaster ? selectedAccountId : accountId;

  // ---- Data Queries ----
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("account_id", activeAccountId!).order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!activeAccountId,
  });

  // Movements count for KPI (lightweight)
  const { data: movementCount = 0 } = useQuery({
    queryKey: ["stock-movements-count", activeAccountId],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count, error } = await supabase.from("stock_movements").select("*", { count: "exact", head: true }).eq("account_id", activeAccountId!).gte("created_at", startOfMonth);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!activeAccountId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["purchase-orders", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, products(name, sku)").eq("account_id", activeAccountId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PurchaseOrder[];
    },
    enabled: !!activeAccountId,
  });

  // ---- KPIs ----
  const lowStockProducts = products.filter(p => p.is_active && p.current_stock <= p.min_stock);
  const inventoryValue = products.reduce((s, p) => s + p.current_stock * p.cost_price, 0);

  // ---- Product Dialog ----
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pForm, setPForm] = useState({ name: "", sku: "", description: "", category: "General", unit: "uds", min_stock: "0", cost_price: "0", sale_price: "0" });

  const openNewProduct = () => { setEditingProduct(null); setPForm({ name: "", sku: "", description: "", category: "General", unit: "uds", min_stock: "0", cost_price: "0", sale_price: "0" }); setProductDialog(true); };
  const openEditProduct = (p: Product) => { setEditingProduct(p); setPForm({ name: p.name, sku: p.sku, description: p.description || "", category: p.category, unit: p.unit, min_stock: String(p.min_stock), cost_price: String(p.cost_price), sale_price: String(p.sale_price) }); setProductDialog(true); };

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = { account_id: activeAccountId!, name: pForm.name, sku: pForm.sku, description: pForm.description || null, category: pForm.category, unit: pForm.unit, min_stock: Number(pForm.min_stock), cost_price: Number(pForm.cost_price), sale_price: Number(pForm.sale_price) };
      if (editingProduct) { const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id); if (error) throw error; }
      else { const { error } = await supabase.from("products").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", activeAccountId] }); setProductDialog(false); toast({ title: editingProduct ? "Producto actualizado" : "Producto creado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleProductActive = useMutation({
    mutationFn: async (p: Product) => { const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", activeAccountId] }),
  });

  // ---- Movement Dialog ----
  const [movDialog, setMovDialog] = useState(false);
  const [movForm, setMovForm] = useState({ product_id: "", type: "IN", quantity: "", reason: "manual", notes: "" });

  const saveMovement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_movements").insert({ account_id: activeAccountId!, product_id: movForm.product_id, type: movForm.type, quantity: Number(movForm.quantity), reason: movForm.reason, notes: movForm.notes || null, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock-movements", activeAccountId] }); qc.invalidateQueries({ queryKey: ["products", activeAccountId] }); setMovDialog(false); toast({ title: "Movimiento registrado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ---- Order Dialog ----
  const [orderDialog, setOrderDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ product_id: "", quantity: "", estimated_date: "", notes: "" });

  const saveOrder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchase_orders").insert({ account_id: activeAccountId!, product_id: orderForm.product_id, quantity: Number(orderForm.quantity), estimated_date: orderForm.estimated_date || null, notes: orderForm.notes || null, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", activeAccountId] }); setOrderDialog(false); toast({ title: "Orden de compra creada" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, newStatus, productId, quantity }: { orderId: string; newStatus: string; productId: string; quantity: number }) => {
      const { error } = await supabase.from("purchase_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      if (newStatus === "RECEIVED") {
        const { error: movErr } = await supabase.from("stock_movements").insert({ account_id: activeAccountId!, product_id: productId, type: "IN", quantity, reason: "compra", notes: "Recepción de orden de compra", created_by: user!.id });
        if (movErr) throw movErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", activeAccountId] }); qc.invalidateQueries({ queryKey: ["stock-movements", activeAccountId] }); qc.invalidateQueries({ queryKey: ["products", activeAccountId] }); toast({ title: "Estado actualizado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openQuickOrder = (p: Product) => {
    setOrderForm({ product_id: p.id, quantity: String(Math.max(p.min_stock * 2 - p.current_stock, 1)), estimated_date: "", notes: `Reposición de ${p.name}` });
    setOrderDialog(true);
  };

  // ---- Render ----
  if (isMaster && !selectedAccountId) {
    return <MasterAccountSelector title="Inventario" onSelect={setSelectedAccountId} />;
  }
  if (!activeAccountId) return <p className="text-muted-foreground">Sin cuenta asignada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Inventario</h1>
        {isMaster && <MasterAccountClearButton onClear={() => setSelectedAccountId("")} />}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{products.length}</p><p className="text-xs text-muted-foreground">Productos</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{lowStockProducts.length}</p><p className="text-xs text-muted-foreground">Stock bajo</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-success" /><div><p className="text-lg sm:text-2xl font-bold">{inventoryValue.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</p><p className="text-xs text-muted-foreground">Valor inventario</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingDown className="h-8 w-8 text-muted-foreground" /><div><p className="text-2xl font-bold">{movementCount}</p><p className="text-xs text-muted-foreground">Mov. este mes</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="alerts">Alertas {lowStockProducts.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{lowStockProducts.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="orders">Órdenes</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsTab products={products} isManager={isManager} onNewProduct={openNewProduct} onEditProduct={openEditProduct} onToggleActive={(p) => toggleProductActive.mutate(p)} />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsTab accountId={activeAccountId!} products={products} isManager={isManager} onNewMovement={() => { setMovForm({ product_id: "", type: "IN", quantity: "", reason: "manual", notes: "" }); setMovDialog(true); }} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab lowStockProducts={lowStockProducts} isManager={isManager} onQuickOrder={openQuickOrder} />
        </TabsContent>
        <TabsContent value="orders">
          <PurchaseOrdersTab orders={orders} isManager={isManager} onNewOrder={() => { setOrderForm({ product_id: "", quantity: "", estimated_date: "", notes: "" }); setOrderDialog(true); }} onUpdateStatus={(o, newStatus) => updateOrderStatus.mutate({ orderId: o.id, newStatus, productId: o.product_id, quantity: o.quantity })} />
        </TabsContent>
      </Tabs>

      <ProductDialog open={productDialog} onOpenChange={setProductDialog} form={pForm} setForm={setPForm} editing={!!editingProduct} onSave={() => saveProduct.mutate()} />
      <MovementDialog open={movDialog} onOpenChange={setMovDialog} form={movForm} setForm={setMovForm} products={products} onSave={() => saveMovement.mutate()} />
      <OrderDialog open={orderDialog} onOpenChange={setOrderDialog} form={orderForm} setForm={setOrderForm} products={products} onSave={() => saveOrder.mutate()} />
    </div>
  );
};

export default AppInventory;
