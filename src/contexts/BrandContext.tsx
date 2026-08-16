import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Brand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  /** La marca principal ES la cuenta: desde ella se ve todo. */
  is_default: boolean;
  /** Módulos habilitados. A 0, la marca es solo identidad de facturación. */
  module_count: number;
}

interface BrandContextType {
  /** Marcas en las que se puede trabajar, con la principal la primera. */
  brands: Brand[];
  /** La cuenta principal, presentada como una marca más en el conmutador. */
  defaultBrand: Brand | null;
  /** Marca seleccionada en el conmutador. Puede ser la principal. */
  activeBrand: Brand | null;
  /**
   * Marca que ACOTA lo que se ve. Es null en la cuenta principal, porque
   * desde ella se ve todo. Refleja exactamente lo que hace `active_brand_id()`
   * en la base de datos, para que el menú no prometa algo distinto de lo que
   * las políticas van a devolver.
   */
  activeBrandId: string | null;
  setActiveBrand: (brandId: string) => Promise<void>;
  loading: boolean;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

/**
 * Marca activa de la sesión.
 *
 * Se guarda en `user_active_brand` y no en el navegador porque las políticas
 * la consultan: el aislamiento entre marcas lo aplica la base de datos, no las
 * consultas del cliente. Si viviera solo aquí, el servidor no sabría en qué
 * marca estás y devolvería los datos de todas.
 *
 * Solo se ofrecen las marcas CON módulos: una marca sin ellos no tiene nada
 * dentro y solo sirve para emitir facturas a su nombre.
 */
export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["my-brands", accountId, user?.id],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await (supabase.rpc as any)("my_brands");
      if (error) throw error;
      return ((data as any[]) || []).map((b) => ({
        id: b.id, name: b.name, color: b.color, logo_url: b.logo_url,
        is_default: !!b.is_default, module_count: Number(b.module_count ?? 0),
      }));
    },
    enabled: !!accountId && !!user,
  });

  /** Marcas en las que se puede trabajar. La principal entra siempre. */
  const workable = brands.filter((b) => b.is_default || b.module_count > 0);
  const defaultBrand = workable.find((b) => b.is_default) ?? null;

  // Recuperar la marca activa guardada
  useEffect(() => {
    if (!user || restored) return;
    (async () => {
      const { data } = await (supabase.from("user_active_brand") as any)
        .select("brand_id").eq("user_id", user.id).maybeSingle();
      if (data?.brand_id) setSelectedId(data.brand_id);
      setRestored(true);
    })();
  }, [user, restored]);

  /* Si la marca guardada deja de estar disponible —se desactivó, o le
     retiraron el acceso— se vuelve a la cuenta principal en vez de dejar al
     usuario en una marca fantasma que no puede consultar. */
  useEffect(() => {
    if (!restored || isLoading || workable.length === 0) return;
    if (!selectedId || !workable.some((b) => b.id === selectedId)) {
      setSelectedId(defaultBrand?.id ?? workable[0].id);
    }
  }, [restored, isLoading, selectedId, workable, defaultBrand]);

  const setActiveBrand = useCallback(
    async (brandId: string) => {
      setSelectedId(brandId);
      if (user) {
        await (supabase.from("user_active_brand") as any).upsert(
          { user_id: user.id, brand_id: brandId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      }
      // Los datos en pantalla son de la marca anterior y las políticas ya
      // devuelven otra cosa: se descartan, igual que al cambiar de cuenta.
      queryClient.clear();
    },
    [user, queryClient],
  );

  const activeBrand = workable.find((b) => b.id === selectedId) ?? null;

  return (
    <BrandContext.Provider
      value={{
        brands: workable,
        defaultBrand,
        activeBrand,
        // La cuenta principal no acota nada: mismo criterio que en las políticas.
        activeBrandId: activeBrand && !activeBrand.is_default ? activeBrand.id : null,
        setActiveBrand,
        loading: isLoading,
      }}
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
