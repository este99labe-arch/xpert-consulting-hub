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
 * La cuenta principal encabeza la lista y las marcas van sangradas debajo,
 * para que se lea de un vistazo quién cuelga de quién. No hay opción de "toda
 * la cuenta" aparte: estar en la cuenta principal ES verlo todo, y tenerlas
 * como dos entradas distintas obligaba a explicar la diferencia.
 *
 * Con una sola marca el conmutador no aparece: no hay nada entre lo que elegir.
 */
const BrandSwitcher = () => {
  const { brands, activeBrand, setActiveBrand } = useBrand();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (brands.length < 2) return null;

  const change = async (brandId: string) => {
    if (brandId === activeBrand?.id) return;
    setSwitching(true);
    try {
      await setActiveBrand(brandId);
      const brand = brands.find((b) => b.id === brandId);
      toast({
        title: brand?.is_default
          ? `Vista completa de ${brand.name}`
          : `Ahora estás en ${brand?.name}`,
      });
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
          <span className="hidden truncate sm:inline">{activeBrand?.name ?? "Cargando…"}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Cuenta y marcas</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {brands.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => change(b.id)}
            /* El sangrado es la jerarquía: la cuenta arriba, sus marcas debajo. */
            className={b.is_default ? "gap-2" : "gap-2 pl-7"}
          >
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
                {b.is_default
                  ? "Cuenta principal · lo ves todo"
                  : `${b.module_count} ${b.module_count === 1 ? "módulo" : "módulos"}`}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BrandSwitcher;
