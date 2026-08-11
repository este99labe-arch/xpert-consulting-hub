import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Brand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  /** Módulos habilitados. A 0, la marca es solo identidad de facturación. */
  module_count: number;
}

interface BrandContextType {
  /** Marcas que el usuario puede ver, con al menos un módulo. */
  brands: Brand[];
  /** Marca activa. null = vista de toda la cuenta. */
  activeBrand: Brand | null;
  activeBrandId: string | null;
  setActiveBrand: (brandId: string | null) => Promise<void>;
  loading: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

/**
 * Marca activa de la sesión.
 *
 * Se guarda en `user_active_brand` y no solo en el navegador porque en la
 * Fase 5 las RLS podrán consultarla: si viviera únicamente en el cliente, el
 * servidor no tendría forma de saber en qué marca estás.
 *
 * Solo se ofrecen las marcas CON módulos: una marca sin ellos no tiene nada
 * que enseñar y solo sirve para emitir facturas a su nombre.
 */
export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["my-brands", accountId, user?.id],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await (supabase.rpc as any)("my_brands");
      if (error) throw error;
      return ((data as any[]) || []).map((b) => ({
        id: b.id, name: b.name, color: b.color, logo_url: b.logo_url,
        module_count: Number(b.module_count ?? 0),
      }));
    },
    enabled: !!accountId && !!user,
  });

  /** Marcas en las que se puede trabajar. Las de 0 módulos no entran. */
  const workable = brands.filter((b) => b.module_count > 0);

  // Recuperar la marca activa guardada
  useEffect(() => {
    if (!user || restored) return;
    (async () => {
      const { data } = await (supabase.from("user_active_brand") as any)
        .select("brand_id").eq("user_id", user.id).maybeSingle();
      if (data?.brand_id) setActiveBrandId(data.brand_id);
      setRestored(true);
    })();
  }, [user, restored]);

  /* Si la marca guardada deja de estar disponible —se desactivó, o le
     retiraron el acceso— se vuelve a la vista de cuenta en vez de dejar al
     usuario en una marca fantasma que no puede consultar. */
  useEffect(() => {
    if (!restored || isLoading || !activeBrandId) return;
    if (!workable.some((b) => b.id === activeBrandId)) setActiveBrandId(null);
  }, [restored, isLoading, activeBrandId, workable]);

  const setActiveBrand = useCallback(
    async (brandId: string | null) => {
      setActiveBrandId(brandId);
      if (user) {
        await (supabase.from("user_active_brand") as any).upsert(
          { user_id: user.id, brand_id: brandId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      }
      // Los datos en pantalla son de la marca anterior: se descartan, igual
      // que al cambiar de cuenta.
      queryClient.clear();
    },
    [user, queryClient],
  );

  const activeBrand = workable.find((b) => b.id === activeBrandId) ?? null;

  return (
    <BrandContext.Provider
      value={{ brands: workable, activeBrand, activeBrandId: activeBrand?.id ?? null, setActiveBrand, loading: isLoading }}
    >
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand debe usarse dentro de BrandProvider");
  return ctx;
};
