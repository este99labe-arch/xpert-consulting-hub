import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Users, FileText, Package, UserCog } from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  path: string;
}

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<SearchResult[]>([]);
  const [invoices, setInvoices] = useState<SearchResult[]>([]);
  const [products, setProducts] = useState<SearchResult[]>([]);
  const [employees, setEmployees] = useState<SearchResult[]>([]);
  const { accountId } = useAuth();
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!accountId || q.length < 2) {
        setClients([]);
        setInvoices([]);
        setProducts([]);
        setEmployees([]);
        return;
      }
      const pattern = `%${q}%`;

      const [cRes, iRes, pRes, eRes] = await Promise.all([
        supabase
          .from("business_clients")
          .select("id, name, tax_id")
          .eq("account_id", accountId)
          .ilike("name", pattern)
          .limit(5),
        supabase
          .from("invoices")
          .select("id, invoice_number, concept")
          .eq("account_id", accountId)
          .or(`invoice_number.ilike.${pattern},concept.ilike.${pattern}`)
          .limit(5),
        supabase
          .from("products")
          .select("id, name, sku")
          .eq("account_id", accountId)
          .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
          .limit(5),
        supabase
          .from("employee_profiles")
          .select("id, first_name, last_name")
          .eq("account_id", accountId)
          .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
          .limit(5),
      ]);

      setClients(
        (cRes.data || []).map((c) => ({
          id: c.id,
          label: c.name,
          sublabel: c.tax_id,
          path: "/app/clients",
        }))
      );
      setInvoices(
        (iRes.data || []).map((i) => ({
          id: i.id,
          label: i.invoice_number || "Sin número",
          sublabel: i.concept,
          path: "/app/invoices",
        }))
      );
      setProducts(
        (pRes.data || []).map((p) => ({
          id: p.id,
          label: p.name,
          sublabel: p.sku,
          path: "/app/inventory",
        }))
      );
      setEmployees(
        (eRes.data || []).map((e) => ({
          id: e.id,
          label: `${e.first_name} ${e.last_name}`,
          path: "/app/hr",
        }))
      );
    },
    [accountId]
  );

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const hasResults = clients.length + invoices.length + products.length + employees.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar clientes, facturas, productos, empleados..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2 ? "Escribe al menos 2 caracteres..." : "Sin resultados."}
        </CommandEmpty>

        {clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.map((r) => (
              <CommandItem key={r.id} onSelect={() => handleSelect(r.path)}>
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{r.label}</span>
                {r.sublabel && (
                  <span className="ml-2 text-xs text-muted-foreground">{r.sublabel}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {invoices.length > 0 && (
          <>
            {clients.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Facturas">
              {invoices.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.path)}>
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{r.label}</span>
                  {r.sublabel && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">{r.sublabel}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {products.length > 0 && (
          <>
            {(clients.length > 0 || invoices.length > 0) && <CommandSeparator />}
            <CommandGroup heading="Productos">
              {products.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.path)}>
                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{r.label}</span>
                  {r.sublabel && (
                    <span className="ml-2 text-xs text-muted-foreground">{r.sublabel}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {employees.length > 0 && (
          <>
            {hasResults && <CommandSeparator />}
            <CommandGroup heading="Empleados">
              {employees.map((r) => (
                <CommandItem key={r.id} onSelect={() => handleSelect(r.path)}>
                  <UserCog className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
