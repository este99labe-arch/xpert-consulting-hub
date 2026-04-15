import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Download, BookOpen, Copy } from "lucide-react";
import { toast } from "sonner";

const API_VERSION = "v1.0";

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
};

interface Endpoint {
  method: string;
  path: string;
  description: string;
  params?: string;
  body?: string;
  response?: string;
}

interface Section {
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const sections: Section[] = [
  {
    title: "Autenticación",
    description: "Todas las peticiones requieren una API key válida en la cabecera Authorization.",
    endpoints: [
      {
        method: "GET",
        path: "Header: Authorization",
        description: "Incluye tu API key en cada petición. Las claves se generan desde Configuración → API.",
        response: `Authorization: Bearer xpc_your_api_key_here`,
      },
    ],
  },
  {
    title: "Paginación",
    description: "Todos los listados soportan paginación con los parámetros page y limit.",
    endpoints: [
      {
        method: "GET",
        path: "?page=1&limit=50",
        description: "page (default: 1), limit (default: 50, max: 100). La respuesta incluye pagination: { page, limit, total }.",
        response: `{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 123 }
}`,
      },
    ],
  },
  {
    title: "Clientes",
    description: "Gestión completa de clientes de negocio, contactos y sus facturas asociadas.",
    endpoints: [
      { method: "GET", path: "/clients", description: "Listar clientes", params: "?status=ACTIVE|INACTIVE&search=texto" },
      { method: "GET", path: "/clients/:id", description: "Detalle de un cliente" },
      { method: "POST", path: "/clients", description: "Crear cliente", body: `{ "name": "Empresa S.L.", "tax_id": "B12345678", "email": "info@empresa.com", "phone": "+34600000000", "address": "Calle Mayor 1", "city": "Madrid", "postal_code": "28001", "country": "España" }` },
      { method: "PUT", path: "/clients/:id", description: "Actualizar cliente", body: `{ "name": "Nuevo Nombre", "email": "nuevo@email.com" }` },
      { method: "DELETE", path: "/clients/:id", description: "Eliminar cliente" },
      { method: "GET", path: "/clients/:id/contacts", description: "Listar contactos del cliente" },
      { method: "POST", path: "/clients/:id/contacts", description: "Crear contacto", body: `{ "name": "Juan Pérez", "email": "juan@empresa.com", "phone": "+34611111111", "position": "Director", "is_primary": true }` },
      { method: "PUT", path: "/clients/:id/contacts/:contactId", description: "Actualizar contacto" },
      { method: "DELETE", path: "/clients/:id/contacts/:contactId", description: "Eliminar contacto" },
      { method: "GET", path: "/clients/:id/invoices", description: "Facturas del cliente", params: "Paginado" },
    ],
  },
  {
    title: "Facturas",
    description: "CRUD completo de facturas, gastos y presupuestos. Incluye líneas, pagos, envío por email y descarga PDF.",
    endpoints: [
      { method: "GET", path: "/invoices", description: "Listar facturas", params: "?type=INVOICE|EXPENSE|QUOTE&status=DRAFT|SENT|PAID&client_id=uuid&date_from=2024-01-01&date_to=2024-12-31" },
      { method: "GET", path: "/invoices/:id", description: "Detalle con líneas, pagos y datos del cliente" },
      { method: "POST", path: "/invoices", description: "Crear factura/gasto/presupuesto", body: `{
  "type": "INVOICE",
  "client_id": "uuid",
  "concept": "Servicios de consultoría",
  "issue_date": "2024-06-15",
  "vat_percentage": 21,
  "irpf_percentage": 15,
  "lines": [
    { "description": "Desarrollo web", "quantity": 40, "unit_price": 75 },
    { "description": "Diseño UX", "quantity": 20, "unit_price": 60 }
  ],
  "special_mentions": "Factura exenta de IVA según art. 20"
}` },
      { method: "PUT", path: "/invoices/:id", description: "Actualizar factura (DRAFT: todos los campos; otros: solo status)", body: `{ "status": "PAID" }` },
      { method: "DELETE", path: "/invoices/:id", description: "Eliminar (solo DRAFT) o crear solicitud de eliminación" },
      { method: "POST", path: "/invoices/:id/send-email", description: "Enviar factura por email al cliente" },
      { method: "GET", path: "/invoices/:id/pdf", description: "Descargar PDF de la factura (binary response)" },
      { method: "POST", path: "/invoices/:id/payments", description: "Registrar pago parcial", body: `{ "amount": 500, "payment_date": "2024-06-20", "method": "TRANSFER", "notes": "Primer pago" }` },
      { method: "DELETE", path: "/invoices/:id/payments/:paymentId", description: "Eliminar pago" },
    ],
  },
  {
    title: "Facturas Recurrentes",
    description: "Plantillas de facturación automática con diferentes frecuencias.",
    endpoints: [
      { method: "GET", path: "/recurring-invoices", description: "Listar plantillas", params: "?is_active=true|false" },
      { method: "GET", path: "/recurring-invoices/:id", description: "Detalle de plantilla" },
      { method: "POST", path: "/recurring-invoices", description: "Crear plantilla", body: `{ "client_id": "uuid", "concept": "Cuota mensual", "amount_net": 500, "vat_percentage": 21, "type": "INVOICE", "frequency": "MONTHLY", "next_run_date": "2024-07-01" }` },
      { method: "PUT", path: "/recurring-invoices/:id", description: "Actualizar plantilla" },
      { method: "DELETE", path: "/recurring-invoices/:id", description: "Eliminar plantilla" },
      { method: "POST", path: "/recurring-invoices/process", description: "Ejecutar generación manual de facturas pendientes" },
    ],
  },
  {
    title: "Contabilidad — Plan de Cuentas",
    description: "Gestión del plan contable basado en el PGC español.",
    endpoints: [
      { method: "GET", path: "/accounting/chart", description: "Listar cuentas contables", params: "?type=ASSET|LIABILITY|EQUITY|INCOME|EXPENSE&is_active=true" },
      { method: "POST", path: "/accounting/chart", description: "Crear cuenta", body: `{ "code": "430", "name": "Clientes", "type": "ASSET", "parent_id": "uuid (opcional)" }` },
      { method: "PUT", path: "/accounting/chart/:id", description: "Actualizar cuenta" },
      { method: "GET", path: "/accounting/balance", description: "Saldos de todas las cuentas", params: "?date_from=2024-01-01&date_to=2024-12-31" },
    ],
  },
  {
    title: "Contabilidad — Asientos",
    description: "Gestión de asientos contables con validación de partida doble.",
    endpoints: [
      { method: "GET", path: "/accounting/entries", description: "Listar asientos", params: "?status=DRAFT|POSTED&date_from=&date_to=&search=" },
      { method: "GET", path: "/accounting/entries/:id", description: "Detalle con líneas" },
      { method: "POST", path: "/accounting/entries", description: "Crear asiento (debe == haber)", body: `{
  "date": "2024-06-15",
  "description": "Factura FAC-2024-0001",
  "lines": [
    { "chart_account_id": "uuid-430", "debit": 1210, "credit": 0 },
    { "chart_account_id": "uuid-700", "debit": 0, "credit": 1000 },
    { "chart_account_id": "uuid-477", "debit": 0, "credit": 210 }
  ]
}` },
      { method: "PUT", path: "/accounting/entries/:id", description: "Actualizar (solo DRAFT)" },
      { method: "POST", path: "/accounting/entries/:id/post", description: "Contabilizar (DRAFT → POSTED)" },
      { method: "DELETE", path: "/accounting/entries/:id", description: "Eliminar o crear solicitud según estado" },
    ],
  },
  {
    title: "Contabilidad — Informes",
    description: "Informes contables: PyG, Libro Mayor, IVA y Balance de Sumas y Saldos.",
    endpoints: [
      { method: "GET", path: "/accounting/reports/pl", description: "Cuenta de Pérdidas y Ganancias", params: "?period=month|quarter|year&year=2024&month=6&quarter=2" },
      { method: "GET", path: "/accounting/reports/ledger", description: "Libro Mayor", params: "?account_id=uuid&date_from=&date_to=" },
      { method: "GET", path: "/accounting/reports/taxes", description: "Liquidación IVA (Modelo 303)", params: "?year=2024&quarter=2" },
      { method: "GET", path: "/accounting/reports/trial-balance", description: "Balance de sumas y saldos" },
    ],
  },
  {
    title: "Conciliación Bancaria",
    description: "Gestión de movimientos bancarios y emparejamiento con facturas.",
    endpoints: [
      { method: "GET", path: "/reconciliation/movements", description: "Listar movimientos bancarios", params: "?status=matched|unmatched" },
      { method: "POST", path: "/reconciliation/match", description: "Emparejar movimiento con factura", body: `{ "movement_id": "uuid", "invoice_id": "uuid" }` },
      { method: "POST", path: "/reconciliation/unmatch", description: "Desemparejar movimiento", body: `{ "movement_id": "uuid" }` },
    ],
  },
  {
    title: "RRHH — Empleados",
    description: "Gestión de perfiles de empleados.",
    endpoints: [
      { method: "GET", path: "/hr/employees", description: "Listar empleados con perfil" },
      { method: "GET", path: "/hr/employees/:userId", description: "Detalle de empleado" },
      { method: "PUT", path: "/hr/employees/:userId", description: "Actualizar perfil", body: `{ "department": "Desarrollo", "position": "Senior Developer" }` },
      { method: "DELETE", path: "/hr/employees/:userId", description: "Desactivar empleado" },
    ],
  },
  {
    title: "RRHH — Ausencias",
    description: "Solicitudes de vacaciones y ausencias con flujo de aprobación.",
    endpoints: [
      { method: "GET", path: "/hr/leave", description: "Listar solicitudes", params: "?status=PENDING|APPROVED|REJECTED&user_id=uuid" },
      { method: "GET", path: "/hr/leave/:id", description: "Detalle de solicitud" },
      { method: "POST", path: "/hr/leave", description: "Crear solicitud", body: `{ "type": "VACATION", "start_date": "2024-08-01", "end_date": "2024-08-15", "user_id": "uuid" }` },
      { method: "PUT", path: "/hr/leave/:id/approve", description: "Aprobar solicitud (solo managers)" },
      { method: "PUT", path: "/hr/leave/:id/reject", description: "Rechazar solicitud (solo managers)" },
      { method: "DELETE", path: "/hr/leave/:id", description: "Eliminar solicitud propia (si PENDING)" },
    ],
  },
  {
    title: "Asistencia",
    description: "Control de fichaje de empleados con resúmenes por periodo.",
    endpoints: [
      { method: "GET", path: "/attendance", description: "Listar registros", params: "?user_id=uuid&date_from=&date_to=&source=APP|WHATSAPP|API" },
      { method: "GET", path: "/attendance/summary", description: "Resumen por empleado", params: "?date_from=&date_to=" },
      { method: "POST", path: "/attendance/check-in", description: "Fichar entrada", body: `{ "user_id": "uuid", "work_date": "2024-06-15", "check_in": "2024-06-15T09:00:00Z" }` },
      { method: "POST", path: "/attendance/check-out", description: "Fichar salida", body: `{ "record_id": "uuid", "check_out": "2024-06-15T18:00:00Z" }` },
      { method: "POST", path: "/attendance/manual", description: "Entrada manual completa", body: `{ "user_id": "uuid", "work_date": "2024-06-15", "check_in": "2024-06-15T09:00:00Z", "check_out": "2024-06-15T18:00:00Z" }` },
      { method: "DELETE", path: "/attendance/:id", description: "Eliminar registro" },
    ],
  },
  {
    title: "Inventario — Productos",
    description: "Gestión del catálogo de productos con control de stock.",
    endpoints: [
      { method: "GET", path: "/inventory/products", description: "Listar productos", params: "?category=&is_active=true&low_stock=true&search=" },
      { method: "GET", path: "/inventory/products/:id", description: "Detalle de producto" },
      { method: "POST", path: "/inventory/products", description: "Crear producto", body: `{ "name": "Widget Pro", "sku": "WDG-001", "category": "Componentes", "unit": "uds", "min_stock": 10, "cost_price": 5.50, "sale_price": 12.00 }` },
      { method: "PUT", path: "/inventory/products/:id", description: "Actualizar producto" },
      { method: "DELETE", path: "/inventory/products/:id", description: "Desactivar producto (is_active = false)" },
    ],
  },
  {
    title: "Inventario — Movimientos",
    description: "Registro de entradas, salidas y ajustes de stock. El stock se actualiza automáticamente.",
    endpoints: [
      { method: "GET", path: "/inventory/movements", description: "Listar movimientos", params: "?product_id=uuid&type=IN|OUT|ADJUSTMENT&date_from=&date_to=" },
      { method: "POST", path: "/inventory/movements", description: "Registrar movimiento", body: `{ "product_id": "uuid", "type": "IN", "quantity": 50, "reason": "Reposición", "notes": "Pedido #123" }` },
    ],
  },
  {
    title: "Inventario — Órdenes de Compra",
    description: "Gestión de pedidos con flujo de estado: DRAFT → PENDING → ORDERED → RECEIVED.",
    endpoints: [
      { method: "GET", path: "/inventory/orders", description: "Listar órdenes", params: "?status=DRAFT|PENDING|ORDERED|RECEIVED" },
      { method: "GET", path: "/inventory/orders/:id", description: "Detalle de orden" },
      { method: "POST", path: "/inventory/orders", description: "Crear orden", body: `{ "product_id": "uuid", "quantity": 100, "estimated_date": "2024-07-15", "notes": "Urgente" }` },
      { method: "PUT", path: "/inventory/orders/:id/status", description: "Avanzar estado (al RECEIVED crea movimiento IN automático)", body: `{ "status": "RECEIVED" }` },
      { method: "DELETE", path: "/inventory/orders/:id", description: "Eliminar orden" },
    ],
  },
  {
    title: "Documentos",
    description: "Gestión de carpetas y documentos de empleados con URLs firmadas para descarga.",
    endpoints: [
      { method: "GET", path: "/documents/folders", description: "Listar carpetas", params: "?user_id=uuid" },
      { method: "POST", path: "/documents/folders", description: "Crear carpeta", body: `{ "user_id": "uuid", "name": "Contratos 2024" }` },
      { method: "DELETE", path: "/documents/folders/:id", description: "Eliminar carpeta (solo si vacía)" },
      { method: "GET", path: "/documents", description: "Listar documentos", params: "?folder_id=uuid&user_id=uuid" },
      { method: "GET", path: "/documents/:id/download", description: "Obtener URL firmada (expira en 1h)", response: `{ "data": { "url": "https://...", "expires_in": 3600 } }` },
      { method: "DELETE", path: "/documents/:id", description: "Eliminar documento y archivo" },
    ],
  },
  {
    title: "Notificaciones",
    description: "Gestión de notificaciones del sistema.",
    endpoints: [
      { method: "GET", path: "/notifications", description: "Listar notificaciones", params: "?is_read=false" },
      { method: "PUT", path: "/notifications/:id/read", description: "Marcar como leída" },
      { method: "PUT", path: "/notifications/read-all", description: "Marcar todas como leídas" },
      { method: "DELETE", path: "/notifications/:id", description: "Eliminar notificación" },
    ],
  },
  {
    title: "Configuración",
    description: "Configuración de la cuenta: horarios, módulos y webhooks.",
    endpoints: [
      { method: "GET", path: "/settings", description: "Obtener configuración de la cuenta" },
      { method: "PUT", path: "/settings/schedule", description: "Actualizar horario laboral", body: `{ "work_start_time": "09:00", "work_end_time": "18:00", "work_days": ["MON","TUE","WED","THU","FRI"], "vacation_days_per_year": 22 }` },
      { method: "GET", path: "/settings/modules", description: "Módulos activos de la cuenta" },
      { method: "GET", path: "/settings/webhooks", description: "Listar webhooks" },
      { method: "POST", path: "/settings/webhooks", description: "Crear webhook", body: `{ "name": "Mi Webhook", "url": "https://example.com/hook", "events": ["invoice.created", "invoice.paid"] }` },
      { method: "PUT", path: "/settings/webhooks/:id", description: "Actualizar webhook" },
      { method: "DELETE", path: "/settings/webhooks/:id", description: "Eliminar webhook" },
    ],
  },
  {
    title: "Recordatorios",
    description: "Gestión de recordatorios con etiquetas y vinculación a entidades.",
    endpoints: [
      { method: "GET", path: "/reminders", description: "Listar recordatorios", params: "?is_completed=false&status=REMINDER" },
      { method: "GET", path: "/reminders/:id", description: "Detalle de recordatorio" },
      { method: "POST", path: "/reminders", description: "Crear recordatorio", body: `{ "title": "Revisar factura", "description": "Factura pendiente de aprobación", "remind_at": "2024-06-20T10:00:00Z", "entity_type": "invoice", "entity_id": "uuid", "labels": ["urgente"] }` },
      { method: "PUT", path: "/reminders/:id", description: "Actualizar recordatorio" },
      { method: "PUT", path: "/reminders/:id/complete", description: "Marcar como completado" },
      { method: "DELETE", path: "/reminders/:id", description: "Eliminar recordatorio" },
    ],
  },
];

const errorCodes = [
  { status: "401", meaning: "API key inválida o ausente", code: "AUTH_REQUIRED / INVALID_API_KEY" },
  { status: "403", meaning: "Sin permisos para esta operación", code: "FORBIDDEN" },
  { status: "404", meaning: "Recurso no encontrado", code: "NOT_FOUND" },
  { status: "405", meaning: "Método HTTP no permitido", code: "METHOD_NOT_ALLOWED" },
  { status: "422", meaning: "Error de validación (incluye details con campos)", code: "VALIDATION_ERROR" },
  { status: "500", meaning: "Error interno del servidor", code: "INTERNAL_ERROR" },
];

function MethodBadge({ method }: { method: string }) {
  return (
    <Badge className={`${methodColors[method] || "bg-muted text-muted-foreground"} font-mono text-xs px-2 py-0.5 border`}>
      {method}
    </Badge>
  );
}

function CodeBlock({ children }: { children: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    toast.success("Copiado al portapapeles");
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto border">{children}</pre>
      <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={copyToClipboard}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono font-medium text-foreground">{ep.path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{ep.description}</p>
      {ep.params && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Parámetros:</p>
          <code className="text-xs font-mono text-muted-foreground">{ep.params}</code>
        </div>
      )}
      {ep.body && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Body:</p>
          <CodeBlock>{ep.body}</CodeBlock>
        </div>
      )}
      {ep.response && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta:</p>
          <CodeBlock>{ep.response}</CodeBlock>
        </div>
      )}
    </div>
  );
}

const MasterApiDocs = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public_api`;

  const handleDownloadPdf = async () => {
    setGenerating(true);
    toast.info("Generando PDF...");
    try {
      const { default: jsPDF } = await import("jspdf");

      const doc = new jsPDF("p", "mm", "a4");
      const pw = 210;
      const ph = 297;
      const m = 15;
      const cw = pw - m * 2;
      let y = 0;

      const colors = {
        dark: [15, 23, 42] as [number, number, number],
        slate: [71, 85, 105] as [number, number, number],
        muted: [148, 163, 184] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        green: [16, 185, 129] as [number, number, number],
        blue: [59, 130, 246] as [number, number, number],
        amber: [245, 158, 11] as [number, number, number],
        red: [239, 68, 68] as [number, number, number],
        bgCode: [241, 245, 249] as [number, number, number],
      };
      const methodColor: Record<string, [number, number, number]> = {
        GET: colors.green, POST: colors.blue, PUT: colors.amber, DELETE: colors.red,
      };

      const addFooter = () => {
        const pn = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text(`Página ${pn}`, pw / 2, ph - 8, { align: "center" });
        doc.text(baseUrl, pw - m, ph - 8, { align: "right" });
      };

      const checkPage = (need: number) => {
        if (y + need > ph - m - 10) {
          addFooter();
          doc.addPage();
          y = m;
        }
      };

      const wrapText = (text: string, maxW: number, fontSize: number): string[] => {
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(text, maxW);
      };

      // --- Cover ---
      doc.setFillColor(...colors.dark);
      doc.rect(0, 0, pw, ph, "F");
      doc.setTextColor(...colors.white);
      doc.setFontSize(48);
      doc.text("XC", pw / 2, 85, { align: "center" });
      doc.setFontSize(24);
      doc.text("XpertConsulting ERP", pw / 2, 105, { align: "center" });
      doc.setFontSize(18);
      doc.text("API Reference", pw / 2, 120, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(...colors.muted);
      doc.text(`Versión ${API_VERSION}`, pw / 2, 145, { align: "center" });
      doc.text(new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }), pw / 2, 155, { align: "center" });
      doc.setFontSize(10);
      doc.text(baseUrl, pw / 2, 175, { align: "center" });

      // --- TOC ---
      doc.addPage();
      y = m;
      doc.setTextColor(...colors.dark);
      doc.setFontSize(22);
      doc.text("Índice", m, y + 10);
      y += 22;
      doc.setFontSize(11);
      doc.setTextColor(...colors.slate);
      sections.forEach((s, i) => {
        doc.text(`${i + 1}. ${s.title}`, m + 4, y);
        y += 7;
      });
      doc.text(`${sections.length + 1}. Códigos de Error`, m + 4, y);
      addFooter();

      // --- Sections ---
      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        doc.addPage();
        y = m;

        // Section header
        doc.setFillColor(...colors.dark);
        doc.roundedRect(m, y, cw, 14, 2, 2, "F");
        doc.setTextColor(...colors.white);
        doc.setFontSize(14);
        doc.text(`${si + 1}. ${section.title}`, m + 5, y + 9);
        y += 20;

        // Section description
        doc.setTextColor(...colors.slate);
        doc.setFontSize(10);
        const descLines = wrapText(section.description, cw, 10);
        descLines.forEach((line) => {
          checkPage(5);
          doc.text(line, m, y);
          y += 5;
        });
        y += 4;

        // Endpoints
        for (const ep of section.endpoints) {
          checkPage(30);

          // Method + path bar
          const mc = methodColor[ep.method] || colors.slate;
          doc.setFillColor(mc[0], mc[1], mc[2]);
          doc.roundedRect(m, y, 16, 6, 1, 1, "F");
          doc.setTextColor(...colors.white);
          doc.setFontSize(8);
          doc.text(ep.method, m + 8, y + 4.2, { align: "center" });

          doc.setTextColor(...colors.dark);
          doc.setFontSize(10);
          doc.setFont("courier", "bold");
          doc.text(ep.path, m + 19, y + 4.2);
          doc.setFont("helvetica", "normal");
          y += 9;

          // Description
          doc.setTextColor(...colors.slate);
          doc.setFontSize(9);
          const dl = wrapText(ep.description, cw - 4, 9);
          dl.forEach((line) => {
            checkPage(5);
            doc.text(line, m + 2, y);
            y += 4.5;
          });

          // Params
          if (ep.params) {
            checkPage(10);
            doc.setTextColor(...colors.dark);
            doc.setFontSize(8);
            doc.text("Parámetros:", m + 2, y + 1);
            doc.setFont("courier", "normal");
            doc.setTextColor(...colors.slate);
            doc.setFontSize(8);
            const pl = wrapText(ep.params, cw - 22, 8);
            pl.forEach((line) => {
              doc.text(line, m + 22, y + 1);
              y += 4;
            });
            y += 1;
            doc.setFont("helvetica", "normal");
          }

          // Body
          if (ep.body) {
            checkPage(10);
            doc.setTextColor(...colors.dark);
            doc.setFontSize(8);
            doc.text("Body:", m + 2, y + 1);
            y += 5;

            const bodyLines = ep.body.split("\n");
            const blockH = bodyLines.length * 3.8 + 4;
            checkPage(blockH);
            doc.setFillColor(...colors.bgCode);
            doc.roundedRect(m + 2, y - 2, cw - 4, blockH, 1.5, 1.5, "F");
            doc.setFont("courier", "normal");
            doc.setTextColor(...colors.slate);
            doc.setFontSize(7);
            bodyLines.forEach((line) => {
              doc.text(line, m + 5, y + 2);
              y += 3.8;
            });
            y += 4;
            doc.setFont("helvetica", "normal");
          }

          // Response
          if (ep.response) {
            checkPage(10);
            doc.setTextColor(...colors.dark);
            doc.setFontSize(8);
            doc.text("Respuesta:", m + 2, y + 1);
            y += 5;

            const respLines = ep.response.split("\n");
            const blockH = respLines.length * 3.8 + 4;
            checkPage(blockH);
            doc.setFillColor(...colors.bgCode);
            doc.roundedRect(m + 2, y - 2, cw - 4, blockH, 1.5, 1.5, "F");
            doc.setFont("courier", "normal");
            doc.setTextColor(...colors.slate);
            doc.setFontSize(7);
            respLines.forEach((line) => {
              doc.text(line, m + 5, y + 2);
              y += 3.8;
            });
            y += 4;
            doc.setFont("helvetica", "normal");
          }

          // Separator line
          y += 2;
          checkPage(2);
          doc.setDrawColor(226, 232, 240);
          doc.line(m + 2, y, pw - m - 2, y);
          y += 5;
        }
        addFooter();
      }

      // --- Error codes table ---
      doc.addPage();
      y = m;
      doc.setFillColor(...colors.dark);
      doc.roundedRect(m, y, cw, 14, 2, 2, "F");
      doc.setTextColor(...colors.white);
      doc.setFontSize(14);
      doc.text(`${sections.length + 1}. Códigos de Error`, m + 5, y + 9);
      y += 22;

      // Table header
      doc.setFillColor(241, 245, 249);
      doc.rect(m, y, cw, 8, "F");
      doc.setTextColor(...colors.dark);
      doc.setFontSize(9);
      doc.text("Status", m + 3, y + 5.5);
      doc.text("Código", m + 25, y + 5.5);
      doc.text("Significado", m + 85, y + 5.5);
      y += 10;

      errorCodes.forEach((ec) => {
        checkPage(8);
        doc.setDrawColor(226, 232, 240);
        doc.line(m, y + 6, pw - m, y + 6);
        doc.setFont("courier", "bold");
        doc.setTextColor(...colors.dark);
        doc.setFontSize(9);
        doc.text(ec.status, m + 3, y + 4);
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        doc.text(ec.code, m + 25, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.slate);
        doc.setFontSize(9);
        doc.text(ec.meaning, m + 85, y + 4);
        y += 8;
      });

      // Error format
      y += 6;
      checkPage(30);
      doc.setTextColor(...colors.dark);
      doc.setFontSize(9);
      doc.text("Formato de respuesta de error:", m, y);
      y += 6;
      const errBody = `{
  "error": "Mensaje descriptivo",
  "code": "ERROR_CODE",
  "details": [{ "field": "name", "message": "required" }]
}`;
      const errLines = errBody.split("\n");
      const errH = errLines.length * 3.8 + 4;
      doc.setFillColor(...colors.bgCode);
      doc.roundedRect(m, y - 2, cw, errH, 1.5, 1.5, "F");
      doc.setFont("courier", "normal");
      doc.setTextColor(...colors.slate);
      doc.setFontSize(7);
      errLines.forEach((line) => {
        doc.text(line, m + 3, y + 2);
        y += 3.8;
      });
      addFooter();

      doc.save("xpert-api-reference-v1.pdf");
      toast.success("PDF descargado correctamente");
    } catch (err: any) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">API Reference</h1>
            <Badge variant="secondary" className="font-mono">{API_VERSION}</Badge>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Documentación completa de la API pública de XpertConsulting ERP. Todos los endpoints están protegidos con autenticación por API key.
          </p>
          <div className="mt-2">
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{baseUrl}</code>
          </div>
        </div>
        <Button onClick={handleDownloadPdf} disabled={generating} className="gap-2">
          <Download className="h-4 w-4" />
          {generating ? "Generando..." : "Descargar PDF"}
        </Button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="space-y-4">
        <Accordion type="multiple" className="space-y-3" defaultValue={["0", "1"]}>
          {sections.map((section, i) => (
            <AccordionItem key={i} value={String(i)} className="border rounded-lg px-1">
              <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6">{(i + 1).toString().padStart(2, "0")}</span>
                  <span className="font-semibold text-left">{section.title}</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {section.endpoints.length} endpoint{section.endpoints.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                <div className="space-y-3">
                  {section.endpoints.map((ep, j) => (
                    <EndpointCard key={j} ep={ep} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Códigos de Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Código</th>
                    <th className="text-left py-2 px-3 font-medium">Significado</th>
                  </tr>
                </thead>
                <tbody>
                  {errorCodes.map((ec, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono font-medium">{ec.status}</td>
                      <td className="py-2 px-3 font-mono text-xs">{ec.code}</td>
                      <td className="py-2 px-3 text-muted-foreground">{ec.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Formato de respuesta de error:</p>
              <CodeBlock>{`{
  "error": "Mensaje descriptivo",
  "code": "ERROR_CODE",
  "details": [{ "field": "name", "message": "required" }]
}`}</CodeBlock>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MasterApiDocs;
