import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.3";

// ─── VERI*FACTU — construcción URL del QR tributario ──────
type VerifactuEnv = "sandbox" | "prod";
const VERIFACTU_ENV: VerifactuEnv = "sandbox"; // TODO: cambiar a "prod" cuando se active la integración real
const VERIFACTU_BASE_URLS: Record<VerifactuEnv, string> = {
  sandbox: "https://prepro7.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  prod: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
};
function buildVerifactuQRUrl(p: { nif: string; numserie: string; fecha: string; importe: number }): string | null {
  if (!p.nif || !p.numserie || !p.fecha || p.importe == null) return null;
  // fecha esperada en dd-mm-yyyy
  let f = p.fecha;
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { const [y, m, d] = f.split("-"); f = `${d}-${m}-${y}`; }
  const qs = new URLSearchParams();
  qs.set("nif", p.nif.trim().toUpperCase());
  qs.set("numserie", String(p.numserie).trim().slice(0, 60));
  qs.set("fecha", f);
  qs.set("importe", Number(p.importe).toFixed(2));
  return `${VERIFACTU_BASE_URLS[VERIFACTU_ENV]}?${qs.toString()}`;
}


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

// ─── MONEY FORMAT ──────────────────────────────────────────
const fmtMoney = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ─── PDF HELPERS ───────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 50; // margin
const CW = PAGE_W - 2 * M; // content width

const C = {
  dark: rgb(0.118, 0.141, 0.176),
  mid: rgb(0.392, 0.455, 0.533),
  light: rgb(0.584, 0.639, 0.69),
  accent: rgb(0.059, 0.09, 0.165),
  green: rgb(0.086, 0.392, 0.204),
  red: rgb(0.6, 0.106, 0.106),
  bg: rgb(0.973, 0.976, 0.984),
  border: rgb(0.886, 0.91, 0.937),
  white: rgb(1, 1, 1),
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function rightText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = C.dark, rightX = PAGE_W - M) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

async function generatePdf(d: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const hel = await doc.embedFont(StandardFonts.Helvetica);
  const helB = await doc.embedFont(StandardFonts.HelveticaBold);
  const cour = await doc.embedFont(StandardFonts.Courier);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  function ensureSpace(need: number) {
    if (y - need < M + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  }

  function txt(text: string, x: number, yy: number, font: PDFFont, size: number, color = C.dark) {
    try { page.drawText(text, { x, y: yy, size, font, color }); } catch { /* skip unsupported chars */ }
  }

  function line(x1: number, y1: number, x2: number, y2: number, thickness = 1, color = C.border) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  }

  function rect(x: number, yy: number, w: number, h: number, color = C.bg) {
    page.drawRectangle({ x, y: yy, width: w, height: h, color });
  }

  // ─── QR TRIBUTARIO VERI*FACTU ───────────────────
  // Ubicación: PRIMERA página, esquina superior izquierda, antes del contenido.
  // Tamaño: 40×40 mm con margen blanco de 6 mm. Solo aparece una vez.
  const qrUrl = buildVerifactuQRUrl({
    nif: d.company.taxId || "",
    numserie: d.invoiceNumber,
    fecha: (d as any)._issueDateRaw || d.issueDate,
    importe: d.amountTotal,
  });
  if (qrUrl && d.typeLabel === "FACTURA") {
    try {
      const MM = 2.83465; // 1 mm = 2.83465 pt
      const QR_SIZE = 40 * MM;   // 40 mm
      const QR_MARGIN = 6 * MM;  // 6 mm de margen interior blanco
      const BOX = QR_SIZE + QR_MARGIN * 2;
      const qrX = M;             // esquina superior izquierda
      const qrY = y - BOX;       // arriba del todo
      // Caja blanca con borde fino
      page.drawRectangle({ x: qrX, y: qrY, width: BOX, height: BOX, color: C.white, borderColor: C.border, borderWidth: 0.5 });
      // Etiqueta superior
      txt("QR tributario:", qrX, qrY + BOX + 5, helB, 7.5, C.mid);
      const qrPngDataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 0, width: 512 });
      const qrBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const qrImg = await doc.embedPng(qrBytes);
      page.drawImage(qrImg, { x: qrX + QR_MARGIN, y: qrY + QR_MARGIN, width: QR_SIZE, height: QR_SIZE });
      // Pie del QR
      const cap1 = "Factura verificable en la sede";
      const cap2 = "electronica de la AEAT";
      const cw1 = hel.widthOfTextAtSize(cap1, 6.5);
      const cw2 = hel.widthOfTextAtSize(cap2, 6.5);
      txt(cap1, qrX + (BOX - cw1) / 2, qrY - 8, hel, 6.5, C.mid);
      txt(cap2, qrX + (BOX - cw2) / 2, qrY - 16, hel, 6.5, C.mid);
      // Avanzar y para que el header empiece debajo del QR
      y = qrY - 24;
    } catch (err) {
      console.error("[VERI*FACTU] Error generando QR:", err);
    }
  }

  // ─── HEADER ─────────────────────────────────────
  txt(d.company.name, M, y, helB, 20, C.dark);

  // Doc type label (right, small caps)
  const typeW = helB.widthOfTextAtSize(d.typeLabel, 9);
  txt(d.typeLabel, PAGE_W - M - typeW, y + 2, helB, 9, C.light);
  y -= 16;

  // Doc number (right)
  rightText(page, d.invoiceNumber, y, helB, 16, C.dark);

  // Company details (left)
  const compDetails: string[] = [];
  if (d.company.taxId) compDetails.push(`NIF/CIF: ${d.company.taxId}`);
  if (d.company.address) compDetails.push(d.company.address);
  const cityLine = [d.company.postalCode, d.company.city].filter(Boolean).join(" ");
  if (cityLine) compDetails.push(cityLine);
  const contactLine = [d.company.phone, d.company.email].filter(Boolean).join(" - ");
  if (contactLine) compDetails.push(contactLine);

  for (const detail of compDetails) {
    txt(detail, M, y, hel, 8, C.mid);
    y -= 11;
  }

  // Status badge (right)
  const statusText = d.statusLabel;
  const stW = helB.widthOfTextAtSize(statusText, 8);
  const badgeX = PAGE_W - M - stW - 12;
  rect(badgeX, y - 2, stW + 12, 14, C.bg);
  txt(statusText, badgeX + 6, y + 1, helB, 8, C.mid);

  y -= 10;

  // Divider
  line(M, y, PAGE_W - M, y, 2, C.dark);
  y -= 24;

  // ─── PARTIES ────────────────────────────────────
  const halfW = (CW - 24) / 2;

  // Emisor box
  rect(M, y - 90, halfW, 92, C.bg);
  page.drawRectangle({ x: M, y: y - 90, width: halfW, height: 92, borderColor: C.border, borderWidth: 0.5, color: C.bg });
  txt("EMISOR", M + 12, y - 10, helB, 7, C.light);
  txt(d.company.name, M + 12, y - 24, helB, 11, C.dark);

  let ey = y - 38;
  const emLines: string[] = [];
  if (d.company.taxId) emLines.push(`NIF/CIF: ${d.company.taxId}`);
  if (d.company.address) emLines.push(d.company.address);
  const emCity = [d.company.postalCode, d.company.city].filter(Boolean).join(" ");
  if (emCity) emLines.push(emCity);
  if (d.company.email) emLines.push(d.company.email);
  if (d.company.phone) emLines.push(`Tel: ${d.company.phone}`);
  for (const l of emLines.slice(0, 4)) {
    txt(l, M + 12, ey, hel, 8, C.mid);
    ey -= 11;
  }

  // Destinatario box
  const rx = M + halfW + 24;
  page.drawRectangle({ x: rx, y: y - 90, width: halfW, height: 92, borderColor: C.border, borderWidth: 0.5, color: C.white });
  txt("DESTINATARIO", rx + 12, y - 10, helB, 7, C.light);
  txt(d.client.name, rx + 12, y - 24, helB, 11, C.dark);

  let cy = y - 38;
  const clLines: string[] = [];
  if (d.client.taxId) clLines.push(`NIF/CIF: ${d.client.taxId}`);
  if (d.client.address) clLines.push(d.client.address);
  const clCity = [d.client.postalCode, d.client.city].filter(Boolean).join(" ");
  if (clCity) clLines.push(clCity);
  if (d.client.email) clLines.push(d.client.email);
  if (d.client.phone) clLines.push(`Tel: ${d.client.phone}`);
  for (const l of clLines.slice(0, 4)) {
    txt(l, rx + 12, cy, hel, 8, C.mid);
    cy -= 11;
  }

  y -= 106;

  // ─── META ROW ───────────────────────────────────
  const metaItems: { label: string; value: string }[] = [
    { label: "N. DOCUMENTO", value: d.invoiceNumber },
    { label: "FECHA EMISION", value: d.issueDate },
  ];
  if (d.operationDate) metaItems.push({ label: "FECHA OPERACION", value: d.operationDate });

  const metaW = CW / metaItems.length;
  rect(M, y - 36, CW, 38, C.bg);
  page.drawRectangle({ x: M, y: y - 36, width: CW, height: 38, borderColor: C.border, borderWidth: 0.5, color: C.bg });

  metaItems.forEach((mi, i) => {
    const mx = M + i * metaW + 12;
    txt(mi.label, mx, y - 10, helB, 7, C.light);
    txt(mi.value, mx, y - 24, helB, 10, C.dark);
    if (i < metaItems.length - 1) {
      line(M + (i + 1) * metaW, y - 36, M + (i + 1) * metaW, y + 2, 0.5, C.border);
    }
  });

  y -= 52;

  // ─── TABLE ──────────────────────────────────────
  const colWidths = [CW - 210, 60, 80, 70]; // Desc, Cant, PU, Importe
  const colX = [M];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  // Table header
  rect(M, y - 18, CW, 20, C.dark);
  const headers = ["Descripcion del servicio", "Cant.", "Precio ud.", "Importe"];
  headers.forEach((h, i) => {
    const hx = i === 0 ? colX[i] + 8 : colX[i] + colWidths[i] - hel.widthOfTextAtSize(h, 7) - 8;
    txt(h, hx, y - 12, helB, 7, C.white);
  });
  y -= 22;

  // Table rows
  const rows: InvoiceLine[] = d.lines && d.lines.length > 0
    ? d.lines
    : [{ description: d.concept || "-", quantity: 1, unitPrice: d.amountNet, amount: d.amountNet }];

  for (const row of rows) {
    ensureSpace(30);
    const descLines = wrapText(row.description || "-", hel, 9, colWidths[0] - 16);
    const rowH = Math.max(20, descLines.length * 12 + 8);

    // Row background alternating
    line(M, y - rowH + 2, PAGE_W - M, y - rowH + 2, 0.5, C.border);

    // Description
    descLines.forEach((dl, di) => {
      txt(dl, colX[0] + 8, y - 10 - di * 12, di === 0 ? helB : hel, 9, C.dark);
    });

    // Quantity
    const qText = String(row.quantity);
    rightText(page, qText, y - 10, cour, 9, C.dark, colX[1] + colWidths[1] - 8);

    // Unit price
    rightText(page, `${fmtMoney(row.unitPrice)} EUR`, y - 10, cour, 9, C.dark, colX[2] + colWidths[2] - 8);

    // Amount
    rightText(page, `${fmtMoney(row.amount)} EUR`, y - 10, helB, 9, C.dark, colX[3] + colWidths[3] - 8);

    y -= rowH;
  }

  // Description note (if single concept with description)
  if ((!d.lines || d.lines.length === 0) && d.description) {
    ensureSpace(30);
    const descNoteLines = wrapText(d.description, hel, 8, CW - 24);
    for (const dl of descNoteLines) {
      txt(dl, M + 8, y - 8, hel, 8, C.mid);
      y -= 11;
    }
    y -= 4;
  }

  y -= 12;

  // ─── SPECIAL MENTIONS ──────────────────────────
  if (d.specialMentions) {
    ensureSpace(40);
    rect(M, y - 30, CW, 32, rgb(1, 0.984, 0.929));
    page.drawRectangle({ x: M, y: y - 30, width: CW, height: 32, borderColor: rgb(0.992, 0.902, 0.545), borderWidth: 0.5, color: rgb(1, 0.984, 0.929) });
    txt("Mencion especial:", M + 10, y - 10, helB, 8, rgb(0.573, 0.251, 0.055));
    const mentionLines = wrapText(d.specialMentions, hel, 8, CW - 24);
    let my = y - 22;
    for (const ml of mentionLines.slice(0, 2)) {
      txt(ml, M + 10, my, hel, 8, rgb(0.573, 0.251, 0.055));
      my -= 11;
    }
    y -= 40;
  }

  // ─── PAYMENTS ───────────────────────────────────
  if (d.payments && d.payments.length > 0) {
    ensureSpace(20 + d.payments.length * 18);
    txt("PAGOS REGISTRADOS", M, y, helB, 7, C.light);
    y -= 14;
    for (const p of d.payments) {
      rect(M, y - 12, CW, 16, rgb(0.941, 0.988, 0.953));
      txt(`${p.date} - ${p.method}`, M + 8, y - 8, hel, 9, C.dark);
      rightText(page, `${fmtMoney(p.amount)} EUR`, y - 8, helB, 9, C.green, PAGE_W - M - 8);
      y -= 18;
    }
    y -= 8;
  }

  // ─── TOTALS ─────────────────────────────────────
  ensureSpace(100);
  const totW = 240;
  const totX = PAGE_W - M - totW;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;

  // Background box
  let totH = 70 + (hasIrpf ? 18 : 0) + (totalPaid > 0 ? 36 : 0);
  rect(totX, y - totH, totW, totH, C.bg);
  page.drawRectangle({ x: totX, y: y - totH, width: totW, height: totH, borderColor: C.border, borderWidth: 0.5, color: C.bg });

  let ty = y - 14;

  // Base imponible
  txt("Base imponible", totX + 12, ty, hel, 9, C.mid);
  rightText(page, `${fmtMoney(d.amountNet)} EUR`, ty, cour, 9, C.dark, PAGE_W - M - 12);
  ty -= 18;

  // IVA
  txt(`IVA (${d.vatPercentage}%)`, totX + 12, ty, hel, 9, C.mid);
  rightText(page, `${fmtMoney(d.amountVat)} EUR`, ty, cour, 9, C.dark, PAGE_W - M - 12);
  ty -= 18;

  // IRPF
  if (hasIrpf) {
    txt(`IRPF (-${d.irpfPercentage}%)`, totX + 12, ty, hel, 9, C.mid);
    rightText(page, `-${fmtMoney(d.irpfAmount || 0)} EUR`, ty, cour, 9, C.red, PAGE_W - M - 12);
    ty -= 18;
  }

  // Divider
  line(totX + 8, ty + 6, PAGE_W - M - 8, ty + 6, 1.5, C.dark);
  ty -= 4;

  // Total
  txt("TOTAL", totX + 12, ty, helB, 13, C.dark);
  rightText(page, `${fmtMoney(d.amountTotal)} EUR`, ty, helB, 13, C.dark, PAGE_W - M - 12);
  ty -= 20;

  // Paid & balance
  if (totalPaid > 0) {
    txt("Pagado", totX + 12, ty, helB, 9, C.green);
    rightText(page, `${fmtMoney(totalPaid)} EUR`, ty, helB, 9, C.green, PAGE_W - M - 12);
    ty -= 16;
    txt("Saldo pendiente", totX + 12, ty, helB, 9, C.red);
    rightText(page, `${fmtMoney(balance)} EUR`, ty, helB, 9, C.red, PAGE_W - M - 12);
  }

  // ─── FOOTER ─────────────────────────────────────
  const footerY = M + 10;
  line(M, footerY + 12, PAGE_W - M, footerY + 12, 0.5, C.border);
  const footerText = `${d.company.name}${d.company.taxId ? ` - NIF/CIF: ${d.company.taxId}` : ""} - Documento generado automaticamente`;
  const ftW = hel.widthOfTextAtSize(footerText, 7);
  txt(footerText, (PAGE_W - ftW) / 2, footerY, hel, 7, C.light);

  return doc.save();
}

// ─── HTML TEMPLATES (for preview) ──────────────────────────

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f1f5f9", color: "#475569" }, SENT: { bg: "#dbeafe", color: "#1e40af" },
  PAID: { bg: "#dcfce7", color: "#166534" }, PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e" },
  OVERDUE: { bg: "#fee2e2", color: "#991b1b" },
};

function renderLinesRows(d: InvoiceData): string {
  if (d.lines && d.lines.length > 0) {
    return d.lines.map(l => `<tr><td style="font-weight:600">${l.description||"-"}</td><td class="r">${l.quantity}</td><td class="r">EUR ${fmtMoney(l.unitPrice)}</td><td class="r b">EUR ${fmtMoney(l.amount)}</td></tr>`).join("");
  }
  return `<tr><td style="font-weight:600">${d.concept||"-"}</td><td class="r">1</td><td class="r">EUR ${fmtMoney(d.amountNet)}</td><td class="r b">EUR ${fmtMoney(d.amountNet)}</td></tr>${d.description?`<tr><td colspan="4" class="desc-cell">${d.description}</td></tr>`:""}`;
}

function renderTotalsHtml(d: InvoiceData, totalPaid: number, balance: number): string {
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  return `<div class="t-row"><span>Base imponible</span><span class="mono">EUR ${fmtMoney(d.amountNet)}</span></div>
<div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">EUR ${fmtMoney(d.amountVat)}</span></div>
${hasIrpf?`<div class="t-row"><span>IRPF (-${d.irpfPercentage}%)</span><span class="mono">-EUR ${fmtMoney(d.irpfAmount||0)}</span></div>`:""}
<div class="t-divider"></div>
<div class="t-total"><span>Total</span><span class="mono">EUR ${fmtMoney(d.amountTotal)}</span></div>
${totalPaid>0?`<div class="t-row" style="color:#16a34a;font-weight:600"><span>Pagado</span><span class="mono">EUR ${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Saldo pendiente</span><span class="mono">EUR ${fmtMoney(balance)}</span></div>`:""}`;
}

function renderSpecialMentions(d: InvoiceData): string {
  if (!d.specialMentions) return "";
  return `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.6"><strong>Mencion especial:</strong> ${d.specialMentions}</div>`;
}

function classicTemplate(d: InvoiceData): string {
  const sc = statusColors[d.status] || statusColors.DRAFT;
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;width:210mm;min-height:297mm;margin:0 auto}.page{padding:48px 56px;min-height:297mm;display:flex;flex-direction:column}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #0f172a}.company{font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}.company-detail{font-size:11px;color:#64748b;margin-top:2px;line-height:1.5}.doc-type{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;font-weight:700}.doc-number{font-size:24px;font-weight:800;color:#0f172a;margin-top:2px}.status{display:inline-block;padding:4px 16px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;background:${sc.bg};color:${sc.color}}.parties{display:flex;gap:40px;margin-bottom:32px}.party{flex:1;padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}.party-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:10px}.party-name{font-weight:700;font-size:15px;color:#0f172a;margin-bottom:4px}.party-info{font-size:12px;color:#64748b;line-height:1.6}.meta-row{display:flex;gap:20px;margin-bottom:28px}.meta-box{padding:14px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;flex:1}.meta-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:4px}.meta-value{font-size:14px;font-weight:600;color:#0f172a}table{width:100%;border-collapse:collapse;margin-bottom:28px}th{text-align:left;padding:12px 16px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;border-bottom:2px solid #e2e8f0;background:#f8fafc}th.r{text-align:right}td{padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}td.r{text-align:right;font-family:'SF Mono','Courier New',monospace;font-size:12px}td.b{font-weight:700}.desc-cell{color:#64748b;font-size:12px;padding:4px 16px 14px;border-bottom:1px solid #f1f5f9}.totals{display:flex;justify-content:flex-end;margin-bottom:24px}.totals-box{width:300px;background:#f8fafc;border-radius:8px;padding:20px;border:1px solid #e2e8f0}.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#64748b}.t-row .mono{font-family:'SF Mono','Courier New',monospace;font-size:12px}.t-divider{height:2px;background:#0f172a;margin:10px 0}.t-total{display:flex;justify-content:space-between;padding:8px 0;font-size:20px;font-weight:800;color:#0f172a}.t-total .mono{font-family:'SF Mono','Courier New',monospace}.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#dc2626;font-weight:600}.payments{margin-bottom:24px}.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;font-weight:700;margin-bottom:12px}.pay-row{display:flex;justify-content:space-between;padding:8px 16px;background:#f0fdf4;border-radius:6px;margin-bottom:4px;font-size:12px}.footer{margin-top:auto;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}@media print{body{margin:0;width:100%}.page{box-shadow:none}}</style></head><body><div class="page">
<div class="header"><div><div class="company">${d.company.name}</div>${d.company.taxId?`<div class="company-detail">NIF/CIF: ${d.company.taxId}</div>`:""}${d.company.address?`<div class="company-detail">${d.company.address}${d.company.postalCode?`, ${d.company.postalCode}`:""}${d.company.city?` ${d.company.city}`:""}</div>`:""}${d.company.phone||d.company.email?`<div class="company-detail">${d.company.phone||""}${d.company.phone&&d.company.email?" - ":""}${d.company.email||""}</div>`:""}</div><div style="text-align:right"><div class="doc-type">${d.typeLabel}</div><div class="doc-number">${d.invoiceNumber}</div><div class="status">${d.statusLabel}</div></div></div>
<div class="parties"><div class="party"><div class="party-label">Emisor</div><div class="party-name">${d.company.name}</div><div class="party-info">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?`${d.company.email}<br>`:""}${d.company.phone?`Tel: ${d.company.phone}`:""}</div></div><div class="party"><div class="party-label">Destinatario</div><div class="party-name">${d.client.name}</div><div class="party-info">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?`${d.client.email}<br>`:""}${d.client.phone?`Tel: ${d.client.phone}`:""}</div></div></div>
<div class="meta-row"><div class="meta-box"><div class="meta-label">N. Documento</div><div class="meta-value">${d.invoiceNumber}</div></div><div class="meta-box"><div class="meta-label">Fecha de emision</div><div class="meta-value">${d.issueDate}</div></div>${d.operationDate?`<div class="meta-box"><div class="meta-label">Fecha de operacion</div><div class="meta-value">${d.operationDate}</div></div>`:""}</div>
<table><thead><tr><th>Descripcion del servicio</th><th class="r" style="width:80px">Cant.</th><th class="r" style="width:120px">Precio ud.</th><th class="r" style="width:120px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
${renderSpecialMentions(d)}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos registrados</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} - ${p.method}</span><span style="font-weight:600">EUR ${fmtMoney(p.amount)}</span></div>`).join("")}</div>`:""}
<div class="totals"><div class="totals-box">${renderTotalsHtml(d, totalPaid, balance)}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` - NIF/CIF: ${d.company.taxId}`:""}<br>Documento generado automaticamente</div>
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
<div class="grid-2"><div class="info-card accent"><div class="info-label">Emisor</div><div class="info-name">${d.company.name}</div><div class="info-text">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?d.company.email:""}${d.company.phone?` - ${d.company.phone}`:""}</div></div><div class="info-card"><div class="info-label">Destinatario</div><div class="info-name">${d.client.name}</div><div class="info-text">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?d.client.email:""}${d.client.phone?` - ${d.client.phone}`:""}</div></div></div>
<div class="meta-strip"><div class="meta-item"><div class="meta-item-label">N. Documento</div><div class="meta-item-value">${d.invoiceNumber}</div></div><div class="meta-item"><div class="meta-item-label">Fecha emision</div><div class="meta-item-value">${d.issueDate}</div></div>${d.operationDate?`<div class="meta-item"><div class="meta-item-label">Fecha operacion</div><div class="meta-item-value">${d.operationDate}</div></div>`:""}</div>
<table><thead><tr><th>Descripcion del servicio</th><th class="r" style="width:80px">Cant.</th><th class="r" style="width:120px">Precio ud.</th><th class="r" style="width:120px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
${renderSpecialMentions(d)}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos registrados</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} - ${p.method}</span><span style="font-weight:600">EUR ${fmtMoney(p.amount)}</span></div>`).join("")}</div>`:""}
<div class="totals"><div class="totals-box"><div class="t-row"><span>Base imponible</span><span class="mono">EUR ${fmtMoney(d.amountNet)}</span></div><div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">EUR ${fmtMoney(d.amountVat)}</span></div>${hasIrpf?`<div class="t-row"><span>IRPF (-${d.irpfPercentage}%)</span><span class="mono">-EUR ${fmtMoney(d.irpfAmount||0)}</span></div>`:""}<div class="t-total"><span>Total</span><span class="mono">EUR ${fmtMoney(d.amountTotal)}</span></div>${totalPaid>0?`<div class="t-row" style="color:#16a34a;font-weight:600;background:#f0fdf4"><span>Pagado</span><span class="mono">EUR ${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Saldo pendiente</span><span class="mono">EUR ${fmtMoney(balance)}</span></div>`:""}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` - NIF/CIF: ${d.company.taxId}`:""}<br>Documento generado automaticamente</div>
</div></div></body></html>`;
}

function minimalTemplate(d: InvoiceData): string {
  const totalPaid = d.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const balance = d.amountTotal - totalPaid;
  const hasIrpf = (d.irpfPercentage || 0) > 0;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${d.typeLabel} ${d.invoiceNumber}</title>
<style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#111;font-size:13px;line-height:1.7;width:210mm;min-height:297mm;margin:0 auto}.page{padding:64px 64px 48px;min-height:297mm;display:flex;flex-direction:column}.header{margin-bottom:56px}.doc-type{font-size:32px;font-weight:400;color:#111;letter-spacing:-1px;text-transform:uppercase}.doc-number{font-size:14px;color:#888;margin-top:4px;font-family:'Helvetica Neue',Helvetica,sans-serif}.rule{height:1px;background:#ddd;margin:32px 0}.rule-thick{height:2px;background:#111;margin:32px 0}.parties{display:flex;gap:80px;margin-bottom:8px}.party{flex:1}.party-label{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}.party-name{font-size:16px;font-weight:700;color:#111;margin-bottom:4px}.party-info{font-size:12px;color:#666;line-height:1.7}table{width:100%;border-collapse:collapse}th{text-align:left;padding:12px 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#aaa;font-weight:400;border-bottom:1px solid #ddd;font-family:'Helvetica Neue',Helvetica,sans-serif}th.r{text-align:right}td{padding:16px 0;font-size:14px;border-bottom:1px solid #eee}td.r{text-align:right;font-family:'SF Mono','Courier New',monospace;font-size:13px}td.b{font-weight:700}.desc-cell{color:#888;font-size:12px;padding:4px 0 16px;border-bottom:1px solid #eee;font-style:italic}.totals{display:flex;justify-content:flex-end;margin-bottom:24px}.totals-inner{width:260px}.t-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#888}.t-row .mono{font-family:'SF Mono','Courier New',monospace;font-size:12px}.t-divider{height:0}.t-total{display:flex;justify-content:space-between;padding:12px 0;font-size:24px;font-weight:700;color:#111;border-top:2px solid #111;margin-top:8px}.t-total .mono{font-family:'SF Mono','Courier New',monospace}.t-paid{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#16a34a;font-weight:600}.t-balance{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#dc2626;font-weight:700}.payments{margin-bottom:8px}.payments h3{font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#aaa;font-family:'Helvetica Neue',Helvetica,sans-serif;font-weight:400;margin-bottom:12px}.pay-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:12px;color:#666}.footer{margin-top:auto;text-align:center;font-size:10px;color:#bbb;font-family:'Helvetica Neue',Helvetica,sans-serif;padding-top:24px;border-top:1px solid #eee}@media print{body{margin:0;width:100%}}</style></head><body><div class="page">
<div class="header"><div class="doc-type">${d.typeLabel}</div><div class="doc-number">${d.invoiceNumber} - ${d.issueDate}${d.operationDate?` - Op: ${d.operationDate}`:""}</div></div>
<div class="parties"><div class="party"><div class="party-label">De</div><div class="party-name">${d.company.name}</div><div class="party-info">${d.company.taxId?`NIF/CIF: ${d.company.taxId}<br>`:""}${d.company.address?`${d.company.address}<br>`:""}${d.company.postalCode||d.company.city?`${d.company.postalCode||""} ${d.company.city||""}<br>`:""}${d.company.email?d.company.email:""}${d.company.phone?` - ${d.company.phone}`:""}</div></div><div class="party"><div class="party-label">Para</div><div class="party-name">${d.client.name}</div><div class="party-info">${d.client.taxId?`NIF/CIF: ${d.client.taxId}<br>`:""}${d.client.address?`${d.client.address}<br>`:""}${d.client.postalCode||d.client.city?`${d.client.postalCode||""} ${d.client.city||""}<br>`:""}${d.client.email?d.client.email:""}${d.client.phone?` - ${d.client.phone}`:""}</div></div></div>
<div class="rule-thick"></div>
<table><thead><tr><th>Descripcion</th><th class="r" style="width:70px">Cant.</th><th class="r" style="width:110px">Precio ud.</th><th class="r" style="width:110px">Importe</th></tr></thead><tbody>${renderLinesRows(d)}</tbody></table>
<div class="rule"></div>
${d.specialMentions?`<div style="margin-bottom:20px;font-size:11px;color:#666;font-style:italic"><strong>Nota:</strong> ${d.specialMentions}</div>`:""}
${d.payments&&d.payments.length>0?`<div class="payments"><h3>Pagos</h3>${d.payments.map(p=>`<div class="pay-row"><span>${p.date} - ${p.method}</span><span style="font-weight:600">EUR ${fmtMoney(p.amount)}</span></div>`).join("")}</div><div class="rule"></div>`:""}
<div class="totals"><div class="totals-inner"><div class="t-row"><span>Base imponible</span><span class="mono">EUR ${fmtMoney(d.amountNet)}</span></div><div class="t-row"><span>IVA (${d.vatPercentage}%)</span><span class="mono">EUR ${fmtMoney(d.amountVat)}</span></div>${hasIrpf?`<div class="t-row"><span>IRPF (-${d.irpfPercentage}%)</span><span class="mono">-EUR ${fmtMoney(d.irpfAmount||0)}</span></div>`:""}<div class="t-total"><span>Total</span><span class="mono">EUR ${fmtMoney(d.amountTotal)}</span></div>${totalPaid>0?`<div class="t-paid"><span>Pagado</span><span class="mono">EUR ${fmtMoney(totalPaid)}</span></div><div class="t-balance"><span>Pendiente</span><span class="mono">EUR ${fmtMoney(balance)}</span></div>`:""}</div></div>
<div class="footer">${d.company.name}${d.company.taxId?` - ${d.company.taxId}`:""} - Documento generado automaticamente</div>
</div></body></html>`;
}

function renderHtmlTemplate(template: string, data: InvoiceData): string {
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

    const body = await req.json();
    const { invoice_id, format = "html" } = body;
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
        name: client?.name || "-",
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

    // Return PDF or HTML based on format
    if (format === "pdf") {
      const pdfBytes = await generatePdf(data);
      const filename = `${typeLabel}-${invoiceNumber}.pdf`.replace(/\s+/g, "_");
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: return HTML for preview
    const html = renderHtmlTemplate(template, data);
    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
