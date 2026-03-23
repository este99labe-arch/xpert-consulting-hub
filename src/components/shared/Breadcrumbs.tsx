import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clientes",
  invoices: "Facturas",
  accounting: "Contabilidad",
  hr: "Recursos Humanos",
  attendance: "Asistencia",
  inventory: "Inventario",
  reports: "Informes",
  settings: "Configuración",
  tasks: "Tareas",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const useResourceName = (parentSegment: string | undefined, idSegment: string | undefined) => {
  const isUuid = idSegment && UUID_REGEX.test(idSegment);

  return useQuery({
    queryKey: ["breadcrumb-name", parentSegment, idSegment],
    queryFn: async () => {
      if (!idSegment) return null;
      if (parentSegment === "clients") {
        const { data } = await supabase
          .from("business_clients")
          .select("name")
          .eq("id", idSegment)
          .single();
        return data?.name || idSegment;
      }
      return idSegment;
    },
    enabled: !!isUuid,
    staleTime: 5 * 60 * 1000,
  });
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  // segments: ["app", "clients", "<uuid>"]

  const appSegments = segments.slice(1); // remove "app" or "master"
  const parentSegment = appSegments.length >= 2 ? appSegments[0] : undefined;
  const lastSegment = appSegments[appSegments.length - 1] || "dashboard";
  const isDetailView = lastSegment && UUID_REGEX.test(lastSegment);

  const { data: resourceName } = useResourceName(parentSegment, isDetailView ? lastSegment : undefined);

  if (!isDetailView) {
    const label = routeLabels[lastSegment] || lastSegment;
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const parentLabel = parentSegment ? routeLabels[parentSegment] || parentSegment : "";
  const detailLabel = resourceName || "Cargando…";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-muted-foreground">{parentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{detailLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumbs;
