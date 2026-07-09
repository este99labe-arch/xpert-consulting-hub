// Shared invoice template definitions used by both preview (React) and PDF export (Edge Function)

export type InvoiceTemplateId =
  | "classic" | "modern" | "minimal"
  | "corporate" | "elegant" | "emerald" | "slate" | "warm";

export interface InvoiceTemplateInfo {
  id: InvoiceTemplateId;
  name: string;
  description: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplateInfo[] = [
  { id: "classic", name: "Clásico", description: "Diseño corporativo tradicional con cabecera formal y líneas separadoras" },
  { id: "modern", name: "Moderno", description: "Diseño contemporáneo con acentos azules y tabla destacada" },
  { id: "minimal", name: "Minimalista", description: "Diseño limpio en serif con máximo espacio en blanco" },
  { id: "corporate", name: "Corporativo", description: "Cabecera de banda en azul corporativo, ideal para consultoría" },
  { id: "elegant", name: "Elegante", description: "Serif con detalles dorados y franja lateral, para servicios premium" },
  { id: "emerald", name: "Esmeralda", description: "Banda verde y estilo fresco, para negocios de producto o retail" },
  { id: "slate", name: "Pizarra", description: "Franja lateral gris oscuro, sobrio y técnico" },
  { id: "warm", name: "Cálido", description: "Tonos terracota y fondos suaves, cercano y artesanal" },
];

/**
 * Opciones de personalización por cuenta (se guardan en
 * account_settings.invoice_template_options como JSON).
 */
export interface InvoiceTemplateOptions {
  /** Nombre que aparece como emisor en el documento (si difiere del nombre de la cuenta) */
  displayName?: string;
  /** Color de acento en hex (#rrggbb); sustituye el color propio de la plantilla */
  accentColor?: string;
  /** Texto del pie de página */
  footerText?: string;
  /** Mostrar la etiqueta de estado (Enviada, Pagada...) — por defecto sí */
  showStatus?: boolean;
  /** Mostrar la fecha de operación — por defecto sí */
  showOperationDate?: boolean;
  /** Mostrar los pagos registrados — por defecto sí */
  showPayments?: boolean;
  /** Mostrar las menciones especiales — por defecto sí */
  showSpecialMentions?: boolean;
  /** Incluir el QR tributario VERI*FACTU cuando esté disponible — por defecto sí (obligatorio si emites con VERI*FACTU) */
  showQr?: boolean;
}

export const DEFAULT_TEMPLATE_OPTIONS: Required<Omit<InvoiceTemplateOptions, "displayName" | "accentColor" | "footerText">> & Pick<InvoiceTemplateOptions, "displayName" | "accentColor" | "footerText"> = {
  displayName: undefined,
  accentColor: undefined,
  footerText: undefined,
  showStatus: true,
  showOperationDate: true,
  showPayments: true,
  showSpecialMentions: true,
  showQr: true,
};

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  typeLabel: string;
  invoiceNumber: string;
  issueDate: string;
  operationDate?: string;
  concept: string;
  description?: string;
  lines?: InvoiceLine[];
  amountNet: number;
  amountVat: number;
  amountTotal: number;
  vatPercentage: number;
  irpfPercentage?: number;
  irpfAmount?: number;
  specialMentions?: string;
  status: string;
  statusLabel: string;
  company: {
    name: string;
    taxId?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
  };
  client: {
    name: string;
    taxId?: string;
    email?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    phone?: string;
  };
  payments?: { amount: number; date: string; method: string }[];
  /** Data URL (PNG) del QR tributario VERI*FACTU. Si está presente se renderiza al inicio de la factura. */
  qrDataUrl?: string;
}

const fmtMoney = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// HTML-escape any user-provided string before injecting into template HTML to prevent stored XSS
const esc = (s: unknown): string => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Valida un color hex para evitar inyección CSS desde opciones guardadas
const safeHex = (c?: string): string | undefined =>
  c && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim() : undefined;

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569" },
  SENT: { bg: "#dbeafe", color: "#1e40af" },
  PAID: { bg: "#dcfce7", color: "#166534" },
  PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e" },
  OVERDUE: { bg: "#fee2e2", color: "#991b1b" },
};

type HeaderStyle = "classic" | "band" | "stripe";

interface Theme {
  accent: string;
  heading: string;
  text: string;
  muted: string;
  softBg: string;
  softBorder: string;
  tableHeadBg: string;
  tableHeadText: string;
  pageBg: string;
  fontFamily: string;
  headingFontFamily: string;
  totalBg: string;
  totalText: string;
  headerStyle: HeaderStyle;
}

/** Aplica el color de acento personalizado sobre la paleta base de la plantilla. */
function applyAccent(t: Theme, accentColor?: string): Theme {
  const accent = safeHex(accentColor);
  if (!accent) return t;
  return {
    ...t,
    accent,
    heading: accent,
    totalBg: accent,
    // Solo se recolorea la cabecera de tabla si ya era de color (texto blanco)
    tableHeadBg: t.tableHeadText === "#ffffff" ? accent : t.tableHeadBg,
  };
}

function renderPartyBlock(title: string, party: InvoiceData["company"] | InvoiceData["client"]) {
  return `
    <div class="party">
      <div class="party-label">${esc(title)}</div>
      <div class="party-name">${party.name ? esc(party.name) : "—"}</div>
      <div class="party-info">
        ${party.taxId ? `NIF/CIF: ${esc(party.taxId)}<br>` : ""}
        ${party.address ? `${esc(party.address)}<br>` : ""}
        ${party.postalCode || party.city ? `${esc(party.postalCode || "")} ${esc(party.city || "")}<br>` : ""}
        ${party.email ? `${esc(party.email)}<br>` : ""}
        ${party.phone ? `Tel: ${esc(party.phone)}` : ""}
      </div>
    </div>
  `;
}

function renderLinesTable(d: InvoiceData) {
  const rows = d.lines && d.lines.length > 0
    ? d.lines
        .map(
          (l) => `
      <tr>
        <td style="font-weight:600">${l.description ? esc(l.description) : "—"}</td>
        <td class="r">${Number(l.quantity)}</td>
        <td class="r">€${fmtMoney(l.unitPrice)}</td>
        <td class="r b">€${fmtMoney(l.amount)}</td>
      </tr>
    `,
        )
        .join("")
    : `
      <tr>
        <td style="font-weight:600">${d.concept ? esc(d.concept) : "—"}</td>
        <td class="r">1</td>
        <td class="r">€${fmtMoney(d.amountNet)}</td>
        <td class="r b">€${fmtMoney(d.amountNet)}</td>
      </tr>
      ${d.description ? `<tr><td colspan="4" class="desc-row">${esc(d.description)}</td></tr>` : ""}
    `;

  return `
    <table>
      <thead>
        <tr>
          <th>Descripción del servicio</th>
          <th class="r" style="width:80px">Cant.</th>
          <th class="r" style="width:120px">Precio ud.</th>
          <th class="r" style="width:120px">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTotals(d: InvoiceData, t: Theme) {
  const totalPaid = d.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balance = Math.max(0, d.amountTotal - totalPaid);
  const hasIrpf = (d.irpfPercentage || 0) > 0;

  return `
    <div class="totals">
      <div class="totals-box">
        <div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div>
        <div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>
        ${hasIrpf ? `<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount || 0)}</span></div>` : ""}
        <div class="t-total" style="background:${t.totalBg};color:${t.totalText}"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>
        ${totalPaid > 0 ? `<div class="t-paid"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div>` : ""}
        ${totalPaid > 0 ? `<div class="t-balance"><span>Pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>` : ""}
      </div>
    </div>
  `;
}

function renderPayments(d: InvoiceData) {
  if (!d.payments || d.payments.length === 0) return "";
  return `
    <div class="payments">
      <h3>Pagos registrados</h3>
      ${d.payments
        .map(
          (p) => `
        <div class="pay-row">
          <span>${esc(p.date)} — ${esc(p.method)}</span>
          <span style="font-weight:600">€${fmtMoney(p.amount)}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSpecialMentions(d: InvoiceData) {
  if (!d.specialMentions) return "";
  return `
    <div class="special-mentions">
      <strong>Mención especial:</strong> ${esc(d.specialMentions)}
    </div>
  `;
}

/** CSS específico del estilo de cabecera de cada plantilla. */
function headerCss(t: Theme): string {
  if (t.headerStyle === "band") {
    return `
    .header {
      background: ${t.accent};
      margin: -44px -40px 28px;
      padding: 36px 40px 28px;
      border-bottom: none;
    }
    .brand, .doc-number { color: #ffffff; }
    .brand-details, .doc-type { color: rgba(255,255,255,0.78); }
    `;
  }
  if (t.headerStyle === "stripe") {
    return `
    .page { border-left: 5mm solid ${t.accent}; }
    .header { border-bottom: 2px solid ${t.accent}; }
    `;
  }
  return "";
}

function renderTemplate(d: InvoiceData, t: Theme, o: InvoiceTemplateOptions = {}): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  const opts = { ...DEFAULT_TEMPLATE_OPTIONS, ...o };
  const companyName = (opts.displayName || "").trim() || d.company.name;
  const footerText = (opts.footerText || "").trim() || "Documento generado automáticamente";
  const showQr = opts.showQr !== false && !!d.qrDataUrl;
  const metaCols = opts.showOperationDate !== false ? 3 : 2;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(d.typeLabel)} ${esc(d.invoiceNumber)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: ${t.pageBg}; }
    body {
      font-family: ${t.fontFamily};
      color: ${t.text};
      font-size: 13px;
      line-height: 1.6;
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      overflow-x: hidden;
    }
    .page {
      width: 100%;
      min-height: 297mm;
      padding: 44px 40px;
      display: flex;
      flex-direction: column;
      background: ${t.pageBg};
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 2px solid ${t.heading};
    }
    .brand {
      font-family: ${t.headingFontFamily};
      color: ${t.heading};
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .brand-details {
      margin-top: 6px;
      color: ${t.muted};
      font-size: 11px;
      line-height: 1.5;
    }
    .doc-meta { text-align: right; }
    .doc-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${t.muted};
      font-weight: 700;
    }
    .doc-number {
      font-family: ${t.headingFontFamily};
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: ${t.heading};
      line-height: 1.1;
      margin-top: 2px;
    }
    .status {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
      background: ${sc.bg};
      color: ${sc.color};
    }
    .parties {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 18px;
    }
    .party {
      background: ${t.softBg};
      border: 1px solid ${t.softBorder};
      border-radius: 10px;
      padding: 14px 16px;
    }
    .party-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${t.muted};
      margin-bottom: 6px;
      font-weight: 700;
    }
    .party-name {
      color: ${t.heading};
      font-size: 21px;
      font-weight: 700;
      margin-bottom: 4px;
      font-family: ${t.headingFontFamily};
      line-height: 1.2;
    }
    .party-info {
      color: ${t.muted};
      font-size: 12px;
      line-height: 1.6;
    }
    .meta-row {
      display: grid;
      grid-template-columns: repeat(${metaCols}, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .meta-box {
      border: 1px solid ${t.softBorder};
      border-radius: 10px;
      background: ${t.softBg};
      padding: 10px 12px;
    }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${t.muted};
      margin-bottom: 4px;
      font-weight: 700;
    }
    .meta-value {
      color: ${t.heading};
      font-size: 19px;
      font-weight: 700;
      font-family: ${t.headingFontFamily};
      line-height: 1.15;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th {
      text-align: left;
      padding: 10px 12px;
      background: ${t.tableHeadBg};
      color: ${t.tableHeadText};
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      border-bottom: 1px solid ${t.softBorder};
    }
    th.r, td.r { text-align: right; }
    td {
      padding: 11px 12px;
      border-bottom: 1px solid ${t.softBorder};
      font-size: 14px;
      vertical-align: top;
    }
    td.r { font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; font-size: 13px; }
    td.b { font-weight: 700; }
    .desc-row { color: ${t.muted}; font-size: 12px; font-style: italic; padding: 4px 12px 12px; }
    .special-mentions {
      margin-bottom: 14px;
      border: 1px solid #fde68a;
      background: #fffbeb;
      color: #92400e;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.6;
    }
    .payments { margin-bottom: 14px; }
    .payments h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${t.muted};
      margin-bottom: 8px;
      font-weight: 700;
    }
    .pay-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      border: 1px solid ${t.softBorder};
      background: ${t.softBg};
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      margin-bottom: 5px;
    }
    .totals { display: flex; justify-content: flex-end; margin-top: 10px; }
    .totals-box {
      width: min(100%, 320px);
      border: 1px solid ${t.softBorder};
      border-radius: 10px;
      overflow: hidden;
      background: ${t.softBg};
    }
    .t-row, .t-total, .t-paid, .t-balance {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      font-size: 13px;
    }
    .t-row { color: ${t.muted}; border-bottom: 1px solid ${t.softBorder}; }
    .t-row .mono, .t-total .mono, .t-paid .mono, .t-balance .mono {
      font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 12px;
    }
    .t-total {
      font-size: 20px;
      font-weight: 800;
      border-bottom: 1px solid ${t.softBorder};
      font-family: ${t.headingFontFamily};
      letter-spacing: -0.3px;
    }
    .t-paid { color: #166534; background: #f0fdf4; border-bottom: 1px solid ${t.softBorder}; font-weight: 700; }
    .t-balance { color: #991b1b; background: #fef2f2; font-weight: 700; }
    .footer {
      margin-top: auto;
      border-top: 1px solid ${t.softBorder};
      padding-top: 14px;
      text-align: center;
      color: ${t.muted};
      font-size: 10px;
    }
    /* ─── QR tributario VERI*FACTU ─── */
    .verifactu-qr {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px auto;
      padding: 6mm;
      background: #ffffff;
      border: 1px solid ${t.softBorder};
      border-radius: 6px;
      width: fit-content;
    }
    .verifactu-qr-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: ${t.muted};
      margin-bottom: 4px;
    }
    .verifactu-qr img {
      width: 40mm;
      height: 40mm;
      display: block;
    }
    .verifactu-qr-caption {
      margin-top: 4px;
      font-size: 8.5px;
      color: ${t.muted};
      text-align: center;
      max-width: 40mm;
      line-height: 1.3;
    }
    ${headerCss(t)}
    @media print {
      html, body { width: 210mm; max-width: 210mm; margin: 0; }
      .page { min-height: 297mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${showQr ? `
    <div class="verifactu-qr">
      <div class="verifactu-qr-label">QR tributario:</div>
      <img src="${d.qrDataUrl}" alt="QR tributario VERI*FACTU" />
      <div class="verifactu-qr-caption">Factura verificable en la sede electrónica de la AEAT</div>
    </div>` : ""}
    <div class="header">
      <div>
        <div class="brand">${esc(companyName)}</div>
        <div class="brand-details">
          ${d.company.taxId ? `NIF/CIF: ${esc(d.company.taxId)}<br>` : ""}
          ${d.company.address ? `${esc(d.company.address)}${d.company.postalCode ? `, ${esc(d.company.postalCode)}` : ""}${d.company.city ? ` ${esc(d.company.city)}` : ""}<br>` : ""}
          ${d.company.phone || d.company.email ? `${esc(d.company.phone || "")}${d.company.phone && d.company.email ? " · " : ""}${esc(d.company.email || "")}` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-type">${esc(d.typeLabel)}</div>
        <div class="doc-number">${esc(d.invoiceNumber)}</div>
        ${opts.showStatus !== false ? `<div class="status">${esc(d.statusLabel)}</div>` : ""}
      </div>
    </div>

    <div class="parties">
      ${renderPartyBlock("Emisor", { ...d.company, name: companyName })}
      ${renderPartyBlock("Destinatario", d.client)}
    </div>

    <div class="meta-row">
      <div class="meta-box"><div class="meta-label">Nº Documento</div><div class="meta-value">${esc(d.invoiceNumber)}</div></div>
      <div class="meta-box"><div class="meta-label">Fecha emisión</div><div class="meta-value">${esc(d.issueDate)}</div></div>
      ${opts.showOperationDate !== false ? `<div class="meta-box"><div class="meta-label">Fecha operación</div><div class="meta-value">${d.operationDate ? esc(d.operationDate) : "—"}</div></div>` : ""}
    </div>

    ${renderLinesTable(d)}
    ${opts.showSpecialMentions !== false ? renderSpecialMentions(d) : ""}
    ${opts.showPayments !== false ? renderPayments(d) : ""}
    ${renderTotals(d, t)}

    <div class="footer">
      ${esc(companyName)}${d.company.taxId ? ` · NIF/CIF: ${esc(d.company.taxId)}` : ""}<br>
      ${esc(footerText)}
    </div>
  </div>
</body>
</html>`;
}

// ─── PALETAS DE PLANTILLA ───────────────────────────────────
const THEMES: Record<InvoiceTemplateId, Theme> = {
  classic: {
    accent: "#0f172a", heading: "#0f172a", text: "#1e293b", muted: "#64748b",
    softBg: "#f8fafc", softBorder: "#e2e8f0", tableHeadBg: "#f1f5f9", tableHeadText: "#475569",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#0f172a", totalText: "#ffffff", headerStyle: "classic",
  },
  modern: {
    accent: "#2563eb", heading: "#1d4ed8", text: "#0f172a", muted: "#475569",
    softBg: "#f8fbff", softBorder: "#dbeafe", tableHeadBg: "#2563eb", tableHeadText: "#ffffff",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#2563eb", totalText: "#ffffff", headerStyle: "classic",
  },
  minimal: {
    accent: "#111111", heading: "#111111", text: "#222222", muted: "#666666",
    softBg: "#ffffff", softBorder: "#e5e7eb", tableHeadBg: "#fafafa", tableHeadText: "#555555",
    pageBg: "#ffffff",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    totalBg: "#111111", totalText: "#ffffff", headerStyle: "classic",
  },
  corporate: {
    accent: "#3860AA", heading: "#2d4d88", text: "#1e293b", muted: "#5a6b85",
    softBg: "#f6f8fc", softBorder: "#dbe4f0", tableHeadBg: "#3860AA", tableHeadText: "#ffffff",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#3860AA", totalText: "#ffffff", headerStyle: "band",
  },
  elegant: {
    accent: "#b45309", heading: "#78350f", text: "#292524", muted: "#78716c",
    softBg: "#fafaf9", softBorder: "#e7e5e4", tableHeadBg: "#f5f5f4", tableHeadText: "#57534e",
    pageBg: "#ffffff",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    totalBg: "#78350f", totalText: "#ffffff", headerStyle: "stripe",
  },
  emerald: {
    accent: "#047857", heading: "#065f46", text: "#1c1917", muted: "#57635c",
    softBg: "#f4faf7", softBorder: "#d1e7dd", tableHeadBg: "#047857", tableHeadText: "#ffffff",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#047857", totalText: "#ffffff", headerStyle: "band",
  },
  slate: {
    accent: "#334155", heading: "#1e293b", text: "#1e293b", muted: "#64748b",
    softBg: "#f8fafc", softBorder: "#e2e8f0", tableHeadBg: "#334155", tableHeadText: "#ffffff",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#1e293b", totalText: "#ffffff", headerStyle: "stripe",
  },
  warm: {
    accent: "#c2410c", heading: "#9a3412", text: "#292524", muted: "#78716c",
    softBg: "#fff7ed", softBorder: "#fed7aa", tableHeadBg: "#ffedd5", tableHeadText: "#9a3412",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#c2410c", totalText: "#ffffff", headerStyle: "classic",
  },
};

// ─── RENDERER ───────────────────────────────────────────────
export function renderInvoiceHtml(
  template: InvoiceTemplateId,
  data: InvoiceData,
  options: InvoiceTemplateOptions = {},
): string {
  const theme = THEMES[template] || THEMES.classic;
  return renderTemplate(data, applyAccent(theme, options.accentColor), options);
}
