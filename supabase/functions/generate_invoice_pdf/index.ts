import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", PARTIALLY_PAID: "Pago parcial", OVERDUE: "Vencida",
};

const methodLabels: Record<string, string> = {
  TRANSFER: "Transferencia", CASH: "Efectivo", CARD: "Tarjeta", CHECK: "Cheque", OTHER: "Otro",
};

const fmtMoney = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

interface InvoiceLine { description: string; quantity: number; unitPrice: number; amount: number; }

interface InvoiceData {
  typeLabel: string; invoiceNumber: string; issueDate: string; operationDate?: string;
  concept: string; description?: string; lines?: InvoiceLine[];
  amountNet: number; amountVat: number; amountTotal: number; vatPercentage: number;
  irpfPercentage?: number; irpfAmount?: number; specialMentions?: string;
  status: string; statusLabel: string;
  company: { name: string; taxId?: string; address?: string; city?: string; postalCode?: string; phone?: string; email?: string };
  client: { name: string; taxId?: string; email?: string; address?: string; city?: string; postalCode?: string; phone?: string };
  payments?: { amount: number; date: string; method: string }[];
}

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569" }, SENT: { bg: "#dbeafe", color: "#1e40af" },
  PAID: { bg: "#dcfce7", color: "#166534" }, PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e" },
  OVERDUE: { bg: "#fee2e2", color: "#991b1b" },
};

function renderLinesRows(d: InvoiceData): string {
  if (d.lines && d.lines.length > 0) {
    return d.lines.map(l => `<tr><td style="font-weight:600">${l.description||"—"}</td><td class="r">${l.quantity}</td><td class="r">€${fmtMoney(l.unitPrice)}</td><td class="r b">€${fmtMoney(l.amount)}</td></tr>`).join("");
  }
  return `<tr><td style="font-weight:600">${d.concept||"—"}</td><td class="r">1</td><td class="r">€${fmtMoney(d.amountNet)}</td><td class="r b">€${fmtMoney(d.amountNet)}</td></tr>${d.description?`<tr><td colspan="4" class="desc-cell">${d.description}</td></tr>`:""}`;
}

function renderTotalsHtml(d: InvoiceData, totalPaid: number, balance: number): string {
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  return `<div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div>
<div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>
${hasIrpf?`<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount||0)}</span></div>`:""}
<div class="t-divider"></div>
<div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>
${totalPaid>0?`<div class="t-row" style="color:#16a34a;font-weight:600"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Saldo pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>`:""}`;
}

function renderSpecialMentions(d: InvoiceData): string {
  if (!d.specialMentions) return "";
  return `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.6"><strong>Mención especial:</strong> ${d.specialMentions}</div>`;
}

function classicTemplate(d: InvoiceData): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;width:210mm;min-height:297mm;margin:0 auto}.page{padding:48px 56px;min-height:297mm;display:flex;flex-direction:column}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #0f172a}.company{font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}.company-detail{font-size:11px;color:#64748b;margin-top:2px;line-height:1.5}.doc-type{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;font-weight:700}.doc-number{font-size:24px;font-weight:800;color:#0f172a;margin-top:2px}.status{display:inline-block;padding:4px 16px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;background:${sc.bg};color:${sc.color}}.parties{display:flex;gap:40px;margin-bottom:32px}.party{flex:1;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}.party-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:10px}.party-name{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px}.party-info{font-size:12px;color:#64748b;line-height:1.6}.meta-row{display:flex;gap:20px;margin-bottom:28px}.meta-box{padding:14px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;flex:1}.meta-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:4px}.meta-value{font-size:14px;font-weight:600;color:#0f172a}table{width:100%;border-collapse:collapse;margin-bottom:28px}th{text-align:left;padding:12px 16px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;border-bottom:2px solid #e2e8f0;background:#f8fafc}th.r{text-align:right}td{padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}td.r{text-align:right;font-family:'SF Mono','Courier New',monospace;font-size:12px}td.b{font-weight:700}.desc-cell{color:#64748b;font-size:12px;padding:4px 16px 14px;border-bottom:1px solid #f1f5f9}.totals{display:flex;justify-content:flex-end;margin-bottom:24px}.totals-box{width:300px;background:#f8fafc;border-radius:8px;padding:20px;border:1px solid #e2e8f0}.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b}.t-row .mono{font-family:'SF Mono','Courier New',monospace;font-size:12px}.t-divider{height:2px;background:#0f172a;margin:10px 0}.t-total{display:flex;justify-content:space-between;padding:8px 0;font-size:20px;font-weight:800;color:#0f172a}.t-total .mono{font-family:'SF Mono','Courier New',monospace}.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#dc2626;font-weight:600}.payments{margin-bottom:24px}.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:12px}.pay-row{display:flex;justify-content:space-between;padding:8px 16px;background:#f0fdf4;border-radius:6px;margin-bottom:4px;font-size:12px}.footer{margin-top:auto;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}@media print{body{margin:0;width:100%}.page{box-shadow:none}}</style></head><body><div class="page">
<div class="header"><div><div class="company">${d.company.name}</div>${d.company.taxId?`<div class="company-detail">NIF/CIF: ${d.company.taxId}</div>`:""}${d.company.address?`<div class="company-detail">${d.company.address}${d.company.postalCode?`, ${d.company.postalCode}`:""}${d.company.city?` ${d.company.city}`:""}</div>`:""}${d.company.phone||d.company.email?`<div class="company-detail">${d.company.phone||""}${d.company.phone&&d.company.email?" · ":""}${d.company.email||""}</div>`:""}</div><div style="text-align:right"><div class="doc-type">${d.typeLabel}</div><div class="doc-number">${d.invoiceNumber}</div><div class="status">${d.statusLabel}</div></div></div>
<div class="parties"><div class="party"><div class="party-label">Emisor</div><div class="party-name">${d.company.name}</div><div class="party-info">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?`${d.company.email}<br>`:""}${d.company.phone?`Tel: ${d.company.phone}`:""}</div></div><div class="party"><div class="party-label">Destinatario</div><div class="party-name">${d.client.name}</div><div class="party-info">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?`${d.client.email}<br>`:""}${d.client.phone?`Tel: ${d.client.phone}`:""}</div></div></div>
<div class="meta-row"><div class="meta-box"><div class="meta-label">Nº Documento</div><div class="meta-value">${d.invoiceNumber}</div></div><div class="meta-box"><div class="meta-label">Fecha de emisión</div><div class="meta-value">${d.issueDate}</div></div>${d.operationDate?`<div class="meta-box"><div class="meta-label">Fecha de operación</div><div class="meta-value">${d.operationDate}</div></div>`:""}</div>
<table><thead><tr><th>Descripción del servicio</th><th class="r" style="width:80px">Cant.</th><th class="r" style="width:120px">Precio ud.</th><th class="r" style="width:120px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
${renderSpecialMentions(d)}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos registrados</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} — ${p.method}</span><span style="font-weight:600">€${fmtMoney(p.amount)}</span></div>`).join("")}</div>`:""}
<div class="totals"><div class="totals-box">${renderTotalsHtml(d, totalPaid, balance)}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` · NIF/CIF: ${d.company.taxId}`:""}<br>Documento generado automáticamente</div>
</div></body></html>`;
}

function modernTemplate(d: InvoiceData): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  const accent = "#2563eb";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;width:210mm;min-height:297mm;margin:0 auto}.page{min-height:297mm;display:flex;flex-direction:column}.top-bar{height:8px;background:linear-gradient(90deg,${accent},#7c3aed)}.content{padding:40px 56px;flex:1;display:flex;flex-direction:column}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}.brand{display:flex;align-items:center;gap:16px}.brand-icon{width:48px;height:48px;background:${accent};border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900}.brand-name{font-size:24px;font-weight:800;color:#0f172a}.brand-detail{font-size:11px;color:#64748b}.doc-badge{text-align:right}.doc-type{display:inline-block;padding:6px 20px;background:${accent};color:white;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px}.doc-number{font-size:20px;font-weight:800;color:#0f172a;margin-top:8px}.doc-status{display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:6px;background:${sc.bg};color:${sc.color}}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}.info-card{padding:24px;border-radius:12px;border:1px solid #e2e8f0}.info-card.accent{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border-color:#bfdbfe}.info-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${accent};font-weight:700;margin-bottom:10px}.info-name{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px}.info-text{font-size:12px;color:#64748b;line-height:1.6}.meta-strip{display:flex;gap:0;margin-bottom:28px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.meta-item{flex:1;padding:14px 20px;border-right:1px solid #e2e8f0;background:#fafbfc}.meta-item:last-child{border-right:none}.meta-item-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700}.meta-item-value{font-size:14px;font-weight:700;color:#0f172a;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:28px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}th{text-align:left;padding:14px 18px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:white;font-weight:700;background:${accent}}th.r{text-align:right}td{padding:16px 18px;font-size:13px;border-bottom:1px solid #f1f5f9}td.r{text-align:right;font-family:'SF Mono','Courier New',monospace;font-size:12px}td.b{font-weight:700}.desc-cell{color:#64748b;font-size:12px;padding:4px 18px 16px;border-bottom:1px solid #f1f5f9}.totals{display:flex;justify-content:flex-end;margin-bottom:24px}.totals-box{width:300px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.t-row{display:flex;justify-content:space-between;padding:10px 20px;font-size:13px;color:#64748b;background:#fafbfc}.t-row .mono{font-family:'SF Mono','Courier New',monospace;font-size:12px}.t-total{display:flex;justify-content:space-between;padding:14px 20px;font-size:18px;font-weight:800;color:white;background:${accent}}.t-total .mono{font-family:'SF Mono','Courier New',monospace}.t-balance{display:flex;justify-content:space-between;padding:10px 20px;font-size:13px;color:#dc2626;font-weight:600;background:#fef2f2}.payments{margin-bottom:24px}.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${accent};font-weight:700;margin-bottom:12px}.pay-row{display:flex;justify-content:space-between;padding:10px 16px;background:#f0f9ff;border-radius:8px;margin-bottom:4px;font-size:12px;border:1px solid #bfdbfe}.footer{margin-top:auto;padding-top:20px;border-top:2px solid ${accent};text-align:center;font-size:10px;color:#94a3b8}@media print{body{margin:0;width:100%}}</style></head><body><div class="page">
<div class="top-bar"></div><div class="content">
<div class="header"><div class="brand"><div class="brand-icon">${d.company.name.charAt(0)}</div><div><div class="brand-name">${d.company.name}</div>${d.company.taxId?`<div class="brand-detail">NIF/CIF: ${d.company.taxId}</div>`:""}</div></div><div class="doc-badge"><div class="doc-type">${d.typeLabel}</div><div class="doc-number">${d.invoiceNumber}</div><div class="doc-status">${d.statusLabel}</div></div></div>
<div class="grid-2"><div class="info-card accent"><div class="info-label">Emisor</div><div class="info-name">${d.company.name}</div><div class="info-text">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?d.company.email:""}${d.company.phone?` · ${d.company.phone}`:""}</div></div><div class="info-card"><div class="info-label">Destinatario</div><div class="info-name">${d.client.name}</div><div class="info-text">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?d.client.email:""}${d.client.phone?` · ${d.client.phone}`:""}</div></div></div>
<div class="meta-strip"><div class="meta-item"><div class="meta-item-label">Nº Documento</div><div class="meta-item-value">${d.invoiceNumber}</div></div><div class="meta-item"><div class="meta-item-label">Fecha emisión</div><div class="meta-item-value">${d.issueDate}</div></div>${d.operationDate?`<div class="meta-item"><div class="meta-item-label">Fecha operación</div><div class="meta-item-value">${d.operationDate}</div></div>`:""}</div>
<table><thead><tr><th>Descripción del servicio</th><th class="r" style="width:80px">Cant.</th><th class="r" style="width:120px">Precio ud.</th><th class="r" style="width:120px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
${renderSpecialMentions(d)}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos registrados</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} — ${p.method}</span><span style="font-weight:600">€${fmtMoney(p.amount)}</span></div>`).join("")}</div>`:""}
<div class="totals"><div class="totals-box"><div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div><div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>${hasIrpf?`<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount||0)}</span></div>`:""}<div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>${totalPaid>0?`<div class="t-row" style="color:#16a34a;font-weight:600;background:#f0fdf4"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Saldo pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>`:""}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` · NIF/CIF: ${d.company.taxId}`:""}<br>Documento generado automáticamente</div>
</div></div></body></html>`;
}

function minimalTemplate(d: InvoiceData): string {
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:13px;line-height:1.7;width:210mm;min-height:297mm;margin:0 auto}.page{padding:64px 64px 48px;min-height:297mm;display:flex;flex-direction:column}.header{margin-bottom:56px}.doc-type{font-size:32px;font-weight:400;color:#111;letter-spacing:-1px;text-transform:uppercase}.doc-number{font-size:14px;color:#888;margin-top:4px;font-family:'Helvetica Neue',Helvetica,sans-serif}.rule{height:1px;background:#ddd;margin:32px 0}.rule-thick{height:2px;background:#111;margin:32px 0}.parties{display:flex;gap:80px;margin-bottom:8px}.party{flex:1}.party-label{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}.party-name{font-size:16px;font-weight:700;color:#111;margin-bottom:4px}.party-info{font-size:12px;color:#666;line-height:1.7}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#aaa;font-weight:400;border-bottom:1px solid #ddd;font-family:'Helvetica Neue',Helvetica,sans-serif}th.r{text-align:right}td{padding:16px 0;font-size:14px;border-bottom:1px solid #eee}td.r{text-align:right;font-family:'SF Mono','Courier New',monospace;font-size:13px}td.b{font-weight:700}.desc-cell{color:#888;font-size:12px;padding:4px 0 16px;border-bottom:1px solid #eee;font-style:italic}.totals{display:flex;justify-content:flex-end;margin-bottom:24px}.totals-inner{width:260px}.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#888}.t-row .mono{font-family:'SF Mono','Courier New',monospace;font-size:12px}.t-divider{height:0}.t-total{display:flex;justify-content:space-between;padding:12px 0;font-size:24px;font-weight:700;color:#111;border-top:2px solid #111;margin-top:8px}.t-total .mono{font-family:'SF Mono','Courier New',monospace}.t-paid{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#16a34a;font-weight:600}.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#dc2626;font-weight:700}.payments{margin-bottom:8px}.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}.pay-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:12px;color:#666}.footer{margin-top:auto;text-align:center;font-size:10px;color:#bbb;font-family:'Helvetica Neue',Helvetica,sans-serif;padding-top:24px;border-top:1px solid #eee}@media print{body{margin:0;width:100%}}</style></head><body><div class="page">
<div class="header"><div class="doc-type">${d.typeLabel}</div><div class="doc-number">${d.invoiceNumber} · ${d.issueDate}${d.operationDate?` · Op: ${d.operationDate}`:""}</div></div>
<div class="parties"><div class="party"><div class="party-label">De</div><div class="party-name">${d.company.name}</div><div class="party-info">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?d.company.email:""}${d.company.phone?` · ${d.company.phone}`:""}</div></div><div class="party"><div class="party-label">Para</div><div class="party-name">${d.client.name}</div><div class="party-info">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?d.client.email:""}${d.client.phone?` · ${d.client.phone}`:""}</div></div></div>
<div class="rule-thick"></div>
<table><thead><tr><th>Descripción</th><th class="r" style="width:70px">Cant.</th><th class="r" style="width:110px">Precio ud.</th><th class="r" style="width:110px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
<div class="rule"></div>
${d.specialMentions?`<div style="margin-bottom:20px;font-size:11px;color:#666;font-style:italic"><strong>Nota:</strong> ${d.specialMentions}</div>`:""}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} — ${p.method}</span><span style="font-weight:600">€${fmtMoney(p.amount)}</span></div>`).join("")}</div><div class="rule"></div>`:""}
<div class="totals"><div class="totals-inner"><div class="t-row"><span>Base imponible</span><span class="mono">€${fmtMoney(d.amountNet)}</span></div><div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">€${fmtMoney(d.amountVat)}</span></div>${hasIrpf?`<div class="t-row"><span>IRPF (−${d.irpfPercentage}%)</span><span class="mono">−€${fmtMoney(d.irpfAmount||0)}</span></div>`:""}<div class="t-total"><span>Total</span><span class="mono">€${fmtMoney(d.amountTotal)}</span></div>${totalPaid>0?`<div class="t-paid"><span>Pagado</span><span class="mono">€${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Pendiente</span><span class="mono">€${fmtMoney(balance)}</span></div>`:""}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` · ${d.company.taxId}`:""} · Documento generado automáticamente</div>
</div></body></html>`;
}

function renderTemplate(template: string, data: InvoiceData): string {
  switch (template) {
    case "modern": return modernTemplate(data);
    case "minimal": return minimalTemplate(data);
    default: return classicTemplate(data);
  }
}

// ─── MAIN HANDLER ──────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("No autorizado");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id requerido");

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, business_clients(name, tax_id, email, address, city, postal_code, phone)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) throw new Error("Factura no encontrada");

    const { data: accountId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
    if (accountId !== invoice.account_id) throw new Error("Sin acceso a esta factura");

    const [accountRes, settingsRes, paymentsRes, linesRes] = await Promise.all([
      supabase.from("accounts").select("name, tax_id, phone, email, address, city, postal_code").eq("id", invoice.account_id).single(),
      supabase.from("account_settings").select("invoice_template").eq("account_id", invoice.account_id).single(),
      supabase.from("invoice_payments").select("amount, payment_date, method").eq("invoice_id", invoice_id).order("payment_date", { ascending: true }),
      supabase.from("invoice_lines").select("description, quantity, unit_price, amount").eq("invoice_id", invoice_id).order("sort_order", { ascending: true }),
    ]);

    const account = accountRes.data;
    const template = settingsRes.data?.invoice_template || "classic";
    const payments = paymentsRes.data || [];
    const invoiceLines = linesRes.data || [];

    const client = invoice.business_clients;
    const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : invoice.type === "QUOTE" ? "PRESUPUESTO" : "GASTO";
    const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
    const issueDate = new Date(invoice.issue_date);
    const issueDateStr = issueDate.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const operationDateStr = invoice.operation_date
      ? new Date(invoice.operation_date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
      : undefined;

    const data: InvoiceData = {
      typeLabel,
      invoiceNumber,
      issueDate: issueDateStr,
      operationDate: operationDateStr,
      concept: invoice.concept,
      description: invoice.description,
      lines: invoiceLines.length > 0 ? invoiceLines.map((l: any) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        amount: l.amount,
      })) : undefined,
      amountNet: invoice.amount_net,
      amountVat: invoice.amount_vat,
      amountTotal: invoice.amount_total,
      vatPercentage: invoice.vat_percentage,
      irpfPercentage: invoice.irpf_percentage || 0,
      irpfAmount: invoice.irpf_amount || 0,
      specialMentions: invoice.special_mentions || undefined,
      status: invoice.status,
      statusLabel: statusLabels[invoice.status] || invoice.status,
      company: {
        name: account?.name || "Empresa",
        taxId: account?.tax_id || undefined,
        address: account?.address || undefined,
        city: account?.city || undefined,
        postalCode: account?.postal_code || undefined,
        phone: account?.phone || undefined,
        email: account?.email || undefined,
      },
      client: {
        name: client?.name || "—",
        taxId: client?.tax_id || undefined,
        email: client?.email || undefined,
        address: client?.address || undefined,
        city: client?.city || undefined,
        postalCode: client?.postal_code || undefined,
        phone: client?.phone || undefined,
      },
      payments: payments.map((p: any) => ({
        amount: p.amount,
        date: new Date(p.payment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
        method: methodLabels[p.method] || p.method,
      })),
    };

    const html = renderTemplate(template, data);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
