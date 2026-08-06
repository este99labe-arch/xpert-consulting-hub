import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";

/**
 * Conmutador de cuenta para usuarios que pertenecen a MÁS de una cuenta
 * (p. ej. un manager que gestiona dos empresas con el mismo email).
 *
 * Solo se muestra con 2+ pertenencias y fuera de una sesión de soporte (el
 * soporte tiene su propio flujo y su banner). Al cambiar, la selección queda
 * persistida en BD, de modo que RLS y frontend resuelven la misma cuenta.
 */
const AccountSwitcher = () => {
  const { memberships, realAccountId, supportSession, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (memberships.length < 2 || supportSession) return null;

  const current = memberships.find((m) => m.accountId === realAccountId);

  const handleSwitch = async (accountId: string) => {
    if (accountId === realAccountId) return;
    setSwitching(true);
    try {
      await switchAccount(accountId);
      const name = memberships.find((m) => m.accountId === accountId)?.accountName ?? "la cuenta";
      toast({ title: `Ahora estás en ${name}` });
      // Ruta neutra: el módulo actual puede no existir en la cuenta nueva.
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: "No se pudo cambiar de cuenta", description: err.message, variant: "destructive" });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 max-w-[220px]" disabled={switching}>
          {switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="hidden truncate sm:inline">{current?.accountName ?? "Cuenta"}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Tus cuentas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.accountId}
            onClick={() => handleSwitch(m.accountId)}
            className="gap-2"
          >
            <Check
              className={`h-4 w-4 shrink-0 ${
                m.accountId === realAccountId ? "opacity-100 text-accent-foreground" : "opacity-0"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{m.accountName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountSwitcher;
