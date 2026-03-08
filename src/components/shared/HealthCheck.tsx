import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const HealthCheck = () => {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    const check = async () => {
      try {
        const { error } = await supabase.from("roles").select("id").limit(1);
        setStatus(error ? "error" : "ok");
      } catch {
        setStatus("error");
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "ok" && "bg-green-500",
          status === "error" && "bg-red-500",
          status === "checking" && "bg-yellow-500 animate-pulse"
        )}
      />
      <span>
        {status === "ok" ? "Conectado" : status === "error" ? "Sin conexión" : "Verificando…"}
      </span>
    </div>
  );
};

export default HealthCheck;
