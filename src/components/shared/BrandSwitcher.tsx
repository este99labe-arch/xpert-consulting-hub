import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, Layers, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Conmutador de marca.
 *
 * Solo aparece si hay al menos una marca con módulos: con una sola identidad
 * comercial, un selector de un elemento es ruido.
 */
const BrandSwitcher = () => {
  const { brands, activeBrand, setActiveBrand } = useBrand();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (brands.length === 0) return null;

  const change = async (brandId: string | null) => {
    if (brandId === (activeBrand?.id ?? null)) return;
    setSwitching(true);
    try {
      await setActiveBrand(brandId);
      const name = brandId ? brands.find((b) => b.id === brandId)?.name : null;
      toast({ title: name ? `Ahora estás en ${name}` : "Vista de toda la cuenta" });
      // Ruta neutra: el módulo actual puede no estar habilitado en la marca nueva.
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: "No se pudo cambiar de marca", description: err.message, variant: "destructive" });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-[220px] gap-1.5" disabled={switching}>
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : activeBrand?.color ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: activeBrand.color }}
              aria-hidden
            />
          ) : (
            <Layers className="h-4 w-4" />
          )}
          <span className="hidden truncate sm:inline">{activeBrand?.name ?? "Toda la cuenta"}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Marca activa</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => change(null)} className="gap-2">
          <Check className={`h-4 w-4 shrink-0 ${!activeBrand ? "text-accent-foreground opacity-100" : "opacity-0"}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">Toda la cuenta</p>
            <p className="text-[11px] text-muted-foreground">Todo lo que puedes ver</p>
          </div>
        </DropdownMenuItem>

        {brands.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => change(b.id)} className="gap-2">
            <Check
              className={`h-4 w-4 shrink-0 ${activeBrand?.id === b.id ? "text-accent-foreground opacity-100" : "opacity-0"}`}
            />
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: b.color || "hsl(var(--faint))" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{b.name}</p>
              <p className="tnum text-[11px] text-muted-foreground">
                {b.module_count} {b.module_count === 1 ? "módulo" : "módulos"}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BrandSwitcher;
