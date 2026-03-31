// Shared invoice template definitions used by both preview (React) and PDF export (Edge Function)

export type InvoiceTemplateId = "classic" | "modern" | "minimal";

export interface InvoiceTemplateInfo {
  id: InvoiceTemplateId;
  name: string;
  description: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplateInfo[] = [
  { id: "classic", name: "Clásico", description: "Diseño corporativo tradicional con cabecera formal y líneas separadoras" },
  { id: "modern", name: "Moderno", description: "Diseño contemporáneo con acentos de color y tipografía bold" },
  { id: "minimal", name: "Minimalista", description: "Diseño limpio y elegante con máximo espacio en blanco" },
];

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
}

const fmtMoney = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569" },
  SENT: { bg: "#dbeafe", color: "#1e40af" },
  PAID: { bg: "#dcfce7", color: "#166534" },
  PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e" },
  OVERDUE: { bg: "#fee2e2", color: "#991b1b" },
};

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
}

function renderPartyBlock(title: string, party: InvoiceData["company"] | InvoiceData["client"]) {
  return `
    <div class="party">
      <div class="party-label">${title}</div>
      <div class="party-name">${party.name || "—"}</div>
      <div class="party-info">
        ${party.taxId ? `NIF/CIF: ${party.taxId}<br>` : ""}
        ${party.address ? `${party.address}<br>` : ""}
        ${party.postalCode || party.city ? `${party.postalCode || ""} ${party.city || ""}<br>` : ""}
        ${party.email ? `${party.email}<br>` : ""}
        ${party.phone ? `Tel: ${party.phone}` : ""}
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
        <td style="font-weight:600">${l.description || "—"}</td>
        <td class="r">${l.quantity}</td>
        <td class="r">€${fmtMoney(l.unitPrice)}</td>
        <td class="r b">€${fmtMoney(l.amount)}</td>
      </tr>
    `,
        )
        .join("")
    : `
      <tr>
        <td style="font-weight:600">${d.concept || "—"}</td>
        <td class="r">1</td>
        <td class="r">€${fmtMoney(d.amountNet)}</td>
        <td class="r b">€${fmtMoney(d.amountNet)}</td>
      </tr>
      ${d.description ? `<tr><td colspan="4" class="desc-row">${d.description}</td></tr>` : ""}
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
          <span>${p.date} — ${p.method}</span>
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
      <strong>Mención especial:</strong> ${d.specialMentions}
    </div>
  `;
}

function renderTemplate(d: InvoiceData, t: Theme): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${d.typeLabel} ${d.invoiceNumber}</title>
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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
    @media print {
      html, body { width: 210mm; max-width: 210mm; margin: 0; }
      .page { min-height: 297mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">${d.company.name}</div>
        <div class="brand-details">
          ${d.company.taxId ? `NIF/CIF: ${d.company.taxId}<br>` : ""}
          ${d.company.address ? `${d.company.address}${d.company.postalCode ? `, ${d.company.postalCode}` : ""}${d.company.city ? ` ${d.company.city}` : ""}<br>` : ""}
          ${d.company.phone || d.company.email ? `${d.company.phone || ""}${d.company.phone && d.company.email ? " · " : ""}${d.company.email || ""}` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-type">${d.typeLabel}</div>
        <div class="doc-number">${d.invoiceNumber}</div>
        <div class="status">${d.statusLabel}</div>
      </div>
    </div>

    <div class="parties">
      ${renderPartyBlock("Emisor", d.company)}
      ${renderPartyBlock("Destinatario", d.client)}
    </div>

    <div class="meta-row">
      <div class="meta-box"><div class="meta-label">Nº Documento</div><div class="meta-value">${d.invoiceNumber}</div></div>
      <div class="meta-box"><div class="meta-label">Fecha emisión</div><div class="meta-value">${d.issueDate}</div></div>
      <div class="meta-box"><div class="meta-label">Fecha operación</div><div class="meta-value">${d.operationDate || "—"}</div></div>
    </div>

    ${renderLinesTable(d)}
    ${renderSpecialMentions(d)}
    ${renderPayments(d)}
    ${renderTotals(d, t)}

    <div class="footer">
      ${d.company.name}${d.company.taxId ? ` · NIF/CIF: ${d.company.taxId}` : ""}<br>
      Documento generado automáticamente
    </div>
  </div>
</body>
</html>`;
}

function classicTemplate(d: InvoiceData): string {
  return renderTemplate(d, {
    accent: "#0f172a",
    heading: "#0f172a",
    text: "#1e293b",
    muted: "#64748b",
    softBg: "#f8fafc",
    softBorder: "#e2e8f0",
    tableHeadBg: "#f1f5f9",
    tableHeadText: "#475569",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#0f172a",
    totalText: "#ffffff",
  });
}

function modernTemplate(d: InvoiceData): string {
  return renderTemplate(d, {
    accent: "#2563eb",
    heading: "#1d4ed8",
    text: "#0f172a",
    muted: "#475569",
    softBg: "#f8fbff",
    softBorder: "#dbeafe",
    tableHeadBg: "#2563eb",
    tableHeadText: "#ffffff",
    pageBg: "#ffffff",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    headingFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    totalBg: "#2563eb",
    totalText: "#ffffff",
  });
}

function minimalTemplate(d: InvoiceData): string {
  return renderTemplate(d, {
    accent: "#111111",
    heading: "#111111",
    text: "#222222",
    muted: "#666666",
    softBg: "#ffffff",
    softBorder: "#e5e7eb",
    tableHeadBg: "#fafafa",
    tableHeadText: "#555555",
    pageBg: "#ffffff",
    fontFamily: "Georgia, 'Times New Roman', serif",
    headingFontFamily: "Georgia, 'Times New Roman', serif",
    totalBg: "#111111",
    totalText: "#ffffff",
  });
}

// ─── RENDERER ───────────────────────────────────────────────
export function renderInvoiceHtml(template: InvoiceTemplateId, data: InvoiceData): string {
  switch (template) {
    case "modern":
      return modernTemplate(data);
    case "minimal":
      return minimalTemplate(data);
    case "classic":
    default:
      return classicTemplate(data);
  }
}
