import { useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
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
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  // e.g. /app/accounting → "accounting"
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "dashboard";
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
};

export default Breadcrumbs;
