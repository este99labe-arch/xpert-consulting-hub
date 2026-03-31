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

function renderLinesTable(d: InvoiceData, thBg: string, thColor: string, borderColor: string): string {
  const hasLines = d.lines && d.lines.length > 0;
  const rows = hasLines
    ? d.lines!.map(l => `<tr>
        <td style="font-weight:600">${l.description || "—"}</td>
        <td class="r">${l.quantity}</td>
        <td class="r">€${fmtMoney(l.unitPrice)}</td>
        <td class="r b">€${fmtMoney(l.amount)}</td>
      </tr>`).join("")
    : `<tr>
        <td style="font-weight:600">${d.concept || "—"}</td>
        <td class="r">1</td>
        <td class="r">€${fmtMoney(d.amountNet)}</td>
        <td class="r b">€${fmtMoney(d.amountNet)}</td>
      </tr>
      ${d.description ? `<tr><td colspan="4" class="desc-cell">${d.description}</td></tr>` : ""}`;

  return `<table>
    <thead><tr>
      <th style="background:${thBg};color:${thColor};border-bottom-color:${borderColor}">Descripción del servicio</th>
      <th class="r" style="width:80px;background:${thBg};color:${thColor};border-bottom-color:${borderColor}">Cant.</th>
      <th class="r" style="width:120px;background:${thBg};color:${thColor};border-bottom-color:${borderColor}">Precio ud.</th>
      <th class="r" style="width:120px;background:${thBg};color:${thColor};border-bottom-color:${borderColor}">Importe</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTotals(d: InvoiceData): string {
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;

  return `
    <div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div>
    <div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>
    ${hasIrpf ? `<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount || 0)}</span></div>` : ""}
    <div class="t-divider"></div>
    <div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>
    ${totalPaid > 0 ? `
    <div class="t-row" style="color:#16a34a;font-weight:600"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div>
    <div class="t-balance"><span>Saldo pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>
    ` : ""}`;
}

function renderPayments(d: InvoiceData, labelColor: string, rowBg: string, rowBorder?: string): string {
  if (!d.payments || d.payments.length === 0) return "";
  return `<div class="payments">
    <h3 style="color:${labelColor}">Pagos registrados</h3>
    ${d.payments.map(p => `<div class="pay-row" style="background:${rowBg}${rowBorder ? `;border:1px solid ${rowBorder}` : ""}"><span>${p.date} — ${p.method}</span><span style="font-weight:600">€${fmtMoney(p.amount)}</span></div>`).join("")}
  </div>`;
}

function renderSpecialMentions(d: InvoiceData): string {
  if (!d.specialMentions) return "";
  return `<div class="special-mentions" style="margin-bottom:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.6">
    <strong>Mención especial:</strong> ${d.specialMentions}
  </div>`;
}

function renderMetaDates(d: InvoiceData): string {
  let html = `<div class="meta-box"><div class="meta-label">Fecha de emisión</div><div class="meta-value">${d.issueDate}</div></div>`;
  if (d.operationDate) {
    html += `<div class="meta-box"><div class="meta-label">Fecha de operación</div><div class="meta-value">${d.operationDate}</div></div>`;
  }
  return html;
}

// ─── CLASSIC TEMPLATE ───────────────────────────────────────
function classicTemplate(d: InvoiceData): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>
@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;width:210mm;min-height:297mm;padding:0;margin:0 auto}
.page{padding:48px 56px;min-height:297mm;display:flex;flex-direction:column}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #0f172a}
.company{font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}
.company-detail{font-size:11px;color:#64748b;margin-top:2px;line-height:1.5}
.doc-type{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;font-weight:700}
.doc-number{font-size:24px;font-weight:800;color:#0f172a;margin-top:2px}
.status{display:inline-block;padding:4px 16px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;background:${sc.bg};color:${sc.color}}
.parties{display:flex;gap:40px;margin-bottom:32px}
.party{flex:1;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.party-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:10px}
.party-name{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px}
.party-info{font-size:12px;color:#64748b;line-height:1.6}
.meta-row{display:flex;gap:20px;margin-bottom:28px}
.meta-box{padding:14px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;flex:1}
.meta-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:4px}
.meta-value{font-size:14px;font-weight:600;color:#0f172a}
table{width:100%;border-collapse:collapse;margin-bottom:28px}
th{text-align:left;padding:12px 16px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;border-bottom:2px solid #e2e8f0;background:#f8fafc}
th.r{text-align:right}
td{padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}
td.r{text-align:right;font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px}
td.b{font-weight:700}
.desc-cell{color:#64748b;font-size:12px;padding:4px 16px 14px;border-bottom:1px solid #f1f5f9}
.totals{display:flex;justify-content:flex-end;margin-bottom:24px}
.totals-box{width:300px;background:#f8fafc;border-radius:8px;padding:20px;border:1px solid #e2e8f0}
.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b}
.t-row .mono{font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px}
.t-divider{height:2px;background:#0f172a;margin:10px 0}
.t-total{display:flex;justify-content:space-between;padding:8px 0;font-size:20px;font-weight:800;color:#0f172a}
.t-total .mono{font-family:'SF Mono','Fira Code','Courier New',monospace}
.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#dc2626;font-weight:600}
.payments{margin-bottom:24px}
.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px}
.pay-row{display:flex;justify-content:space-between;padding:8px 16px;border-radius:6px;margin-bottom:4px;font-size:12px}
.footer{margin-top:auto;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}
@media print{body{margin:0;width:100%}.page{box-shadow:none}}
</style></head><body><div class="page">
<div class="header">
  <div>
    <div class="company">${d.company.name}</div>
    ${d.company.taxId ? `<div class="company-detail">NIF/CIF: ${d.company.taxId}</div>` : ""}
    ${d.company.address ? `<div class="company-detail">${d.company.address}${d.company.postalCode ? `, ${d.company.postalCode}` : ""}${d.company.city ? ` ${d.company.city}` : ""}</div>` : ""}
    ${d.company.phone || d.company.email ? `<div class="company-detail">${d.company.phone || ""}${d.company.phone && d.company.email ? " · " : ""}${d.company.email || ""}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div class="doc-type">${d.typeLabel}</div>
    <div class="doc-number">${d.invoiceNumber}</div>
    <div class="status">${d.statusLabel}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-label">Emisor</div>
    <div class="party-name">${d.company.name}</div>
    <div class="party-info">
      ${d.company.taxId ? `NIF/CIF: ${d.company.taxId}<br>` : ""}
      ${d.company.address ? `${d.company.address}<br>` : ""}
      ${d.company.postalCode || d.company.city ? `${d.company.postalCode || ""} ${d.company.city || ""}<br>` : ""}
      ${d.company.email ? `${d.company.email}<br>` : ""}
      ${d.company.phone ? `Tel: ${d.company.phone}` : ""}
    </div>
  </div>
  <div class="party">
    <div class="party-label">Destinatario</div>
    <div class="party-name">${d.client.name}</div>
    <div class="party-info">
      ${d.client.taxId ? `NIF/CIF: ${d.client.taxId}<br>` : ""}
      ${d.client.address ? `${d.client.address}<br>` : ""}
      ${d.client.postalCode || d.client.city ? `${d.client.postalCode || ""} ${d.client.city || ""}<br>` : ""}
      ${d.client.email ? `${d.client.email}<br>` : ""}
      ${d.client.phone ? `Tel: ${d.client.phone}` : ""}
    </div>
  </div>
</div>

<div class="meta-row">
  <div class="meta-box"><div class="meta-label">Nº Documento</div><div class="meta-value">${d.invoiceNumber}</div></div>
  ${renderMetaDates(d)}
</div>

${renderLinesTable(d, "#f8fafc", "#94a3b8", "#e2e8f0")}

${renderSpecialMentions(d)}

${renderPayments(d, "#94a3b8", "#f0fdf4")}

<div class="totals">
  <div class="totals-box">
    ${renderTotals(d)}
  </div>
</div>

<div class="footer">
  ${d.company.name} ${d.company.taxId ? `· NIF/CIF: ${d.company.taxId}` : ""}<br>
  Documento generado automáticamente
</div>
</div></body></html>`;
}

// ─── MODERN TEMPLATE ───────────────────────────────────────
function modernTemplate(d: InvoiceData): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  const accent = "#2563eb";
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>
@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;width:210mm;min-height:297mm;margin:0 auto}
.page{min-height:297mm;display:flex;flex-direction:column}
.top-bar{height:8px;background:linear-gradient(90deg,${accent},#7c3aed)}
.content{padding:40px 56px;flex:1;display:flex;flex-direction:column}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
.brand{display:flex;align-items:center;gap:16px}
.brand-icon{width:48px;height:48px;background:${accent};border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}
.brand-name{font-size:24px;font-weight:800;color:#0f172a}
.brand-detail{font-size:11px;color:#64748b}
.doc-badge{text-align:right}
.doc-type{display:inline-block;padding:6px 20px;background:${accent};color:white;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px}
.doc-number{font-size:20px;font-weight:800;color:#0f172a;margin-top:8px}
.doc-status{display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:6px;background:${sc.bg};color:${sc.color}}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
.info-card{padding:24px;border-radius:12px;border:1px solid #e2e8f0}
.info-card.accent{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border-color:#bfdbfe}
.info-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${accent};font-weight:700;margin-bottom:10px}
.info-name{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px}
.info-text{font-size:12px;color:#64748b;line-height:1.6}
.meta-strip{display:flex;gap:0;margin-bottom:28px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
.meta-item{flex:1;padding:14px 20px;border-right:1px solid #e2e8f0;background:#fafbfc}
.meta-item:last-child{border-right:none}
.meta-item-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700}
.meta-item-value{font-size:14px;font-weight:700;color:#0f172a;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:28px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
th{text-align:left;padding:14px 18px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:white;font-weight:700;background:${accent}}
th.r{text-align:right}
td{padding:16px 18px;font-size:13px;border-bottom:1px solid #f1f5f9}
td.r{text-align:right;font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px}
td.b{font-weight:700}
.desc-cell{color:#64748b;font-size:12px;padding:4px 18px 16px;border-bottom:1px solid #f1f5f9}
.totals{display:flex;justify-content:flex-end;margin-bottom:24px}
.totals-box{width:300px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
.t-row{display:flex;justify-content:space-between;padding:10px 20px;font-size:13px;color:#64748b;background:#fafbfc}
.t-row .mono{font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px}
.t-divider{height:0}
.t-total{display:flex;justify-content:space-between;padding:14px 20px;font-size:18px;font-weight:800;color:white;background:${accent}}
.t-total .mono{font-family:'SF Mono','Fira Code','Courier New',monospace}
.t-balance{display:flex;justify-content:space-between;padding:10px 20px;font-size:13px;color:#dc2626;font-weight:600;background:#fef2f2}
.payments{margin-bottom:24px}
.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px}
.pay-row{display:flex;justify-content:space-between;padding:10px 16px;border-radius:8px;margin-bottom:4px;font-size:12px}
.footer{margin-top:auto;padding-top:20px;border-top:2px solid ${accent};text-align:center;font-size:10px;color:#94a3b8}
@media print{body{margin:0;width:100%}}
</style></head><body><div class="page">
<div class="top-bar"></div>
<div class="content">
<div class="header">
  <div class="brand">
    <div class="brand-icon">${d.company.name.charAt(0)}</div>
    <div>
      <div class="brand-name">${d.company.name}</div>
      ${d.company.taxId ? `<div class="brand-detail">NIF/CIF: ${d.company.taxId}</div>` : ""}
    </div>
  </div>
  <div class="doc-badge">
    <div class="doc-type">${d.typeLabel}</div>
    <div class="doc-number">${d.invoiceNumber}</div>
    <div class="doc-status">${d.statusLabel}</div>
  </div>
</div>

<div class="grid-2">
  <div class="info-card accent">
    <div class="info-label">Emisor</div>
    <div class="info-name">${d.company.name}</div>
    <div class="info-text">
      ${d.company.taxId ? `NIF/CIF: ${d.company.taxId}<br>` : ""}
      ${d.company.address ? `${d.company.address}<br>` : ""}
      ${d.company.postalCode || d.company.city ? `${d.company.postalCode || ""} ${d.company.city || ""}<br>` : ""}
      ${d.company.email ? `${d.company.email}` : ""}${d.company.phone ? ` · ${d.company.phone}` : ""}
    </div>
  </div>
  <div class="info-card">
    <div class="info-label">Destinatario</div>
    <div class="info-name">${d.client.name}</div>
    <div class="info-text">
      ${d.client.taxId ? `NIF/CIF: ${d.client.taxId}<br>` : ""}
      ${d.client.address ? `${d.client.address}<br>` : ""}
      ${d.client.postalCode || d.client.city ? `${d.client.postalCode || ""} ${d.client.city || ""}<br>` : ""}
      ${d.client.email ? `${d.client.email}` : ""}${d.client.phone ? ` · ${d.client.phone}` : ""}
    </div>
  </div>
</div>

<div class="meta-strip">
  <div class="meta-item"><div class="meta-item-label">Nº Documento</div><div class="meta-item-value">${d.invoiceNumber}</div></div>
  <div class="meta-item"><div class="meta-item-label">Fecha emisión</div><div class="meta-item-value">${d.issueDate}</div></div>
  ${d.operationDate ? `<div class="meta-item"><div class="meta-item-label">Fecha operación</div><div class="meta-item-value">${d.operationDate}</div></div>` : ""}
</div>

${renderLinesTable(d, accent, "white", accent)}

${renderSpecialMentions(d)}

${renderPayments(d, accent, "#f0f9ff", "#bfdbfe")}

<div class="totals">
  <div class="totals-box">
    <div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div>
    <div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>
    ${hasIrpf ? `<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount || 0)}</span></div>` : ""}
    <div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>
    ${totalPaid > 0 ? `
    <div class="t-row" style="color:#16a34a;font-weight:600;background:#f0fdf4"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div>
    <div class="t-balance"><span>Saldo pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>
    ` : ""}
  </div>
</div>

<div class="footer">
  ${d.company.name} ${d.company.taxId ? `· NIF/CIF: ${d.company.taxId}` : ""}<br>
  Documento generado automáticamente
</div>
</div></div></body></html>`;
}

// ─── MINIMAL TEMPLATE ───────────────────────────────────────
function minimalTemplate(d: InvoiceData): string {
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  const hasLines = d.lines && d.lines.length > 0;

  const rows = hasLines
    ? d.lines!.map(l => `<tr>
        <td style="font-weight:600">${l.description || "—"}</td>
        <td class="r">${l.quantity}</td>
        <td class="r">€${fmtMoney(l.unitPrice)}</td>
        <td class="r b">€${fmtMoney(l.amount)}</td>
      </tr>`).join("")
    : `<tr>
        <td style="font-weight:600">${d.concept || "—"}</td>
        <td class="r">1</td>
        <td class="r">€${fmtMoney(d.amountNet)}</td>
        <td class="r b">€${fmtMoney(d.amountNet)}</td>
      </tr>
      ${d.description ? `<tr><td colspan="4" class="desc-row">${d.description}</td></tr>` : ""}`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>
@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:13px;line-height:1.7;width:210mm;min-height:297mm;margin:0 auto}
.page{padding:64px 64px 48px;min-height:297mm;display:flex;flex-direction:column}
.header{margin-bottom:56px}
.doc-type{font-size:32px;font-weight:400;color:#111;letter-spacing:-1px;text-transform:uppercase}
.doc-number{font-size:14px;color:#888;margin-top:4px;font-family:'Helvetica Neue',Helvetica,sans-serif}
.rule{height:1px;background:#ddd;margin:32px 0}
.rule-thick{height:2px;background:#111;margin:32px 0}
.parties{display:flex;gap:80px;margin-bottom:8px}
.party{flex:1}
.party-label{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}
.party-name{font-size:16px;font-weight:700;color:#111;margin-bottom:4px}
.party-info{font-size:12px;color:#666;line-height:1.7}
.meta{display:flex;gap:48px;margin-bottom:8px}
.meta-item .label{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif}
.meta-item .value{font-size:14px;font-weight:600;color:#111;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:0}
th{text-align:left;padding:12px 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#aaa;font-weight:400;border-bottom:1px solid #ddd;font-family:'Helvetica Neue',Helvetica,sans-serif}
th.r{text-align:right}
td{padding:16px 0;font-size:14px;border-bottom:1px solid #eee}
td.r{text-align:right;font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:13px}
td.b{font-weight:700}
.desc-row{color:#888;font-size:12px;padding:0 0 16px;border-bottom:1px solid #eee;font-style:italic}
.totals{display:flex;justify-content:flex-end;margin-bottom:24px}
.totals-inner{width:260px}
.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#888}
.t-row .mono{font-family:'SF Mono','Fira Code','Courier New',monospace;font-size:12px}
.t-divider{height:0}
.t-total{display:flex;justify-content:space-between;padding:12px 0;font-size:24px;font-weight:700;color:#111;border-top:2px solid #111;margin-top:8px}
.t-total .mono{font-family:'SF Mono','Fira Code','Courier New',monospace}
.t-paid{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#16a34a;font-weight:600}
.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#dc2626;font-weight:700}
.payments{margin-bottom:8px}
.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}
.pay-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:12px;color:#666}
.footer{margin-top:auto;text-align:center;font-size:10px;color:#bbb;font-family:'Helvetica Neue',Helvetica,sans-serif;padding-top:24px;border-top:1px solid #eee}
@media print{body{margin:0;width:100%}}
</style></head><body><div class="page">
<div class="header">
  <div class="doc-type">${d.typeLabel}</div>
  <div class="doc-number">${d.invoiceNumber} · ${d.issueDate}${d.operationDate ? ` · Op: ${d.operationDate}` : ""}</div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-label">De</div>
    <div class="party-name">${d.company.name}</div>
    <div class="party-info">
      ${d.company.taxId ? `NIF/CIF: ${d.company.taxId}<br>` : ""}
      ${d.company.address ? `${d.company.address}<br>` : ""}
      ${d.company.postalCode || d.company.city ? `${d.company.postalCode || ""} ${d.company.city || ""}<br>` : ""}
      ${d.company.email ? `${d.company.email}` : ""}${d.company.phone ? ` · ${d.company.phone}` : ""}
    </div>
  </div>
  <div class="party">
    <div class="party-label">Para</div>
    <div class="party-name">${d.client.name}</div>
    <div class="party-info">
      ${d.client.taxId ? `NIF/CIF: ${d.client.taxId}<br>` : ""}
      ${d.client.address ? `${d.client.address}<br>` : ""}
      ${d.client.postalCode || d.client.city ? `${d.client.postalCode || ""} ${d.client.city || ""}<br>` : ""}
      ${d.client.email ? `${d.client.email}` : ""}${d.client.phone ? ` · ${d.client.phone}` : ""}
    </div>
  </div>
</div>

<div class="rule-thick"></div>

<table>
  <thead><tr>
    <th>Descripción</th>
    <th class="r" style="width:70px">Cant.</th>
    <th class="r" style="width:110px">Precio ud.</th>
    <th class="r" style="width:110px">Importe</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="rule"></div>

${d.specialMentions ? `<div style="margin-bottom:20px;font-size:11px;color:#666;font-style:italic"><strong>Nota:</strong> ${d.specialMentions}</div>` : ""}

${d.payments && d.payments.length > 0 ? `
<div class="payments">
  <h3>Pagos</h3>
  ${d.payments.map(p => `<div class="pay-row"><span>${p.date} — ${p.method}</span><span style="font-weight:600">€${fmtMoney(p.amount)}</span></div>`).join("")}
</div>
<div class="rule"></div>
` : ""}

<div class="totals">
  <div class="totals-inner">
    <div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div>
    <div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>
    ${hasIrpf ? `<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount || 0)}</span></div>` : ""}
    <div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>
    ${totalPaid > 0 ? `
    <div class="t-paid"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div>
    <div class="t-balance"><span>Pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>
    ` : ""}
  </div>
</div>

<div class="footer">
  ${d.company.name} ${d.company.taxId ? `· ${d.company.taxId}` : ""} · Documento generado automáticamente
</div>
</div></body></html>`;
}

// ─── RENDERER ───────────────────────────────────────────────
export function renderInvoiceHtml(template: InvoiceTemplateId, data: InvoiceData): string {
  switch (template) {
    case "modern": return modernTemplate(data);
    case "minimal": return minimalTemplate(data);
    case "classic":
    default: return classicTemplate(data);
  }
}
