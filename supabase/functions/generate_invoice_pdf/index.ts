import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("No autorizado");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id requerido");

    // Fetch invoice with client info
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, business_clients(name, tax_id, email)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) throw new Error("Factura no encontrada");

    // Verify user belongs to same account
    const { data: accountId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
    if (accountId !== invoice.account_id) throw new Error("Sin acceso a esta factura");

    // Fetch account info
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", invoice.account_id)
      .single();

    const client = invoice.business_clients;
    const issueDate = new Date(invoice.issue_date).toLocaleDateString("es-ES");
    const typeLabel = invoice.type === "INVOICE" ? "FACTURA" : "GASTO";

    // Generate a simple HTML-based PDF-like document
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Helvetica, Arial, sans-serif; margin: 40px; color: #1a1a1a; font-size: 14px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .title { font-size: 28px; font-weight: bold; color: #4338ca; }
  .meta { text-align: right; }
  .meta p { margin: 2px 0; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party { width: 45%; }
  .party h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
  .party p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #6b7280; }
  td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
  .totals { text-align: right; }
  .totals .row { display: flex; justify-content: flex-end; gap: 40px; margin: 4px 0; }
  .totals .total { font-size: 18px; font-weight: bold; color: #4338ca; }
  .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; }
</style></head>
<body>
  <div class="header">
    <div class="title">${typeLabel}</div>
    <div class="meta">
      <p><strong>ID:</strong> ${invoice.id.slice(0, 8).toUpperCase()}</p>
      <p><strong>Fecha:</strong> ${issueDate}</p>
      <p><strong>Estado:</strong> ${invoice.status}</p>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>Emisor</h3>
      <p><strong>${account?.name || "—"}</strong></p>
    </div>
    <div class="party">
      <h3>Cliente</h3>
      <p><strong>${client?.name || "—"}</strong></p>
      <p>NIF/CIF: ${client?.tax_id || "—"}</p>
      ${client?.email ? `<p>${client.email}</p>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Concepto</th><th style="text-align:right">Base imponible</th><th style="text-align:right">IVA (${invoice.vat_percentage}%)</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>
      <tr>
        <td>${typeLabel.toLowerCase()} ${invoice.id.slice(0, 8)}</td>
        <td style="text-align:right">€${Number(invoice.amount_net).toFixed(2)}</td>
        <td style="text-align:right">€${Number(invoice.amount_vat).toFixed(2)}</td>
        <td style="text-align:right"><strong>€${Number(invoice.amount_total).toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Base imponible:</span><span>€${Number(invoice.amount_net).toFixed(2)}</span></div>
    <div class="row"><span>IVA (${invoice.vat_percentage}%):</span><span>€${Number(invoice.amount_vat).toFixed(2)}</span></div>
    <div class="row total"><span>Total:</span><span>€${Number(invoice.amount_total).toFixed(2)}</span></div>
  </div>
  <div class="footer">Generado por XpertConsulting ERP</div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="factura-${invoice.id.slice(0, 8)}.html"`,
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
