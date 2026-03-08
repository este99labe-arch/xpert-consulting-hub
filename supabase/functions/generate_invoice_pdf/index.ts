import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", SENT: "Enviada", PAID: "Pagada", OVERDUE: "Vencida",
};

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
      .select("*, business_clients(name, tax_id, email)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) throw new Error("Factura no encontrada");

    const { data: accountId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
    if (accountId !== invoice.account_id) throw new Error("Sin acceso a esta factura");

    const { data: account } = await supabase
      .from("accounts").select("name, tax_id, phone, email, address, city, postal_code").eq("id", invoice.account_id).single();

    const client = invoice.business_clients;
    const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : "GASTO";
    const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
    const issueDate = new Date(invoice.issue_date);
    const issueDateStr = issueDate.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const fmt = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const statusLabel = statusLabels[invoice.status] || invoice.status;
    const statusBg = invoice.status === "PAID" ? "#dcfce7" : invoice.status === "OVERDUE" ? "#fee2e2" : "#f1f5f9";
    const statusColor = invoice.status === "PAID" ? "#166534" : invoice.status === "OVERDUE" ? "#991b1b" : "#475569";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${typeLabel} ${invoiceNumber}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1a1a2e;
    font-size: 13px;
    line-height: 1.5;
    width: 210mm;
    min-height: 297mm;
    padding: 40px 50px;
    margin: 0 auto;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .company-name { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; }
  .invoice-type { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 600; }
  .invoice-number { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 36px; gap: 40px; }
  .party { flex: 1; }
  .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; }
  .party-name { font-weight: 600; font-size: 15px; }
  .party-detail { color: #64748b; font-size: 13px; }
  .divider { height: 2px; background: linear-gradient(90deg, #0f172a, #e2e8f0); margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  th { text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  th.right { text-align: right; }
  td { padding: 16px; border-bottom: 1px solid #f1f5f9; }
  td.right { text-align: right; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; }
  td.bold { font-weight: 700; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; }
  .totals-row .mono { font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; }
  .totals-divider { height: 2px; background: #0f172a; margin: 8px 0; }
  .totals-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 18px; font-weight: 800; color: #0f172a; }
  .status-badge { display: inline-block; padding: 8px 24px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
  .status-center { text-align: center; margin-bottom: 40px; }
  .footer { padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print {
    body { margin: 0; width: 100%; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${account?.name || "Empresa"}</div>
      ${account?.tax_id ? `<div class="party-detail">NIF/CIF: ${account.tax_id}</div>` : ""}
      ${account?.address ? `<div class="party-detail">${account.address}${account?.postal_code ? `, ${account.postal_code}` : ""}${account?.city ? ` ${account.city}` : ""}</div>` : ""}
      ${account?.phone || account?.email ? `<div class="party-detail">${account?.phone || ""}${account?.phone && account?.email ? " · " : ""}${account?.email || ""}</div>` : ""}
    </div>
    <div style="text-align: right;">
      <div class="invoice-type">${typeLabel}</div>
      <div class="invoice-number">${invoiceNumber}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">De</div>
      <div class="party-name">${account?.name || "—"}</div>
      ${account?.tax_id ? `<div class="party-detail">NIF/CIF: ${account.tax_id}</div>` : ""}
      ${account?.address ? `<div class="party-detail">${account.address}${account?.postal_code ? `, ${account.postal_code}` : ""}${account?.city ? ` ${account.city}` : ""}</div>` : ""}
      ${account?.email ? `<div class="party-detail">${account.email}</div>` : ""}
    </div>
    <div class="party">
      <div class="party-label">Para</div>
      <div class="party-name">${client?.name || "—"}</div>
      <div class="party-detail">NIF/CIF: ${client?.tax_id || "—"}</div>
      ${client?.email ? `<div class="party-detail">${client.email}</div>` : ""}
    </div>
    <div style="text-align: right;">
      <div class="party-label">Fecha</div>
      <div style="font-weight: 600;">${issueDateStr}</div>
    </div>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th class="right" style="width:140px">Base imponible</th>
        <th class="right" style="width:120px">IVA (${invoice.vat_percentage}%)</th>
        <th class="right" style="width:130px">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:500">${invoice.concept || "—"}</td>
        <td class="right">€${fmt(invoice.amount_net)}</td>
        <td class="right">€${fmt(invoice.amount_vat)}</td>
        <td class="right bold">€${fmt(invoice.amount_total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Base imponible</span><span class="mono">€${fmt(invoice.amount_net)}</span></div>
      <div class="totals-row"><span>IVA (${invoice.vat_percentage}%)</span><span class="mono">€${fmt(invoice.amount_vat)}</span></div>
      <div class="totals-divider"></div>
      <div class="totals-total"><span>Total</span><span class="mono">€${fmt(invoice.amount_total)}</span></div>
    </div>
  </div>

  <div class="status-center">
    <span class="status-badge" style="background:${statusBg};color:${statusColor};">
      ${statusLabel}
    </span>
  </div>

  <div class="footer">
    ${account?.name || "Empresa"} · Documento generado automáticamente
  </div>
</body>
</html>`;

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
