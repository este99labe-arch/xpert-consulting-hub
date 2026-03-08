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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY no configurada");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("No autorizado");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id requerido");

    // Fetch invoice with client
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, business_clients(name, tax_id, email)")
      .eq("id", invoice_id)
      .single();
    if (invError || !invoice) throw new Error("Factura no encontrada");

    // Verify access
    const { data: accountId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
    if (accountId !== invoice.account_id) throw new Error("Sin acceso a esta factura");

    const client = invoice.business_clients;
    if (!client?.email) throw new Error("El cliente no tiene email configurado");

    // Fetch account info
    const { data: account } = await supabase
      .from("accounts")
      .select("name, tax_id, phone, email, address, city, postal_code")
      .eq("id", invoice.account_id)
      .single();

    const typeLabel = invoice.type === "INVOICE" ? "Factura" : "Gasto";
    const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();
    const fmt = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const issueDate = new Date(invoice.issue_date).toLocaleDateString("es-ES", {
      day: "2-digit", month: "long", year: "numeric",
    });

    const companyName = account?.name || "Empresa";
    const subject = `${typeLabel} ${invoiceNumber} de ${companyName}`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <!-- Header -->
      <div style="background: #0f172a; padding: 32px 40px; color: white;">
        <div style="font-size: 24px; font-weight: 700;">${companyName}</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${typeLabel} ${invoiceNumber}</div>
      </div>
      
      <!-- Body -->
      <div style="padding: 40px;">
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
          Estimado/a <strong>${client.name}</strong>,
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px;">
          Le adjuntamos la ${typeLabel.toLowerCase()} <strong>${invoiceNumber}</strong> con fecha ${issueDate}.
        </p>
        
        <!-- Summary card -->
        <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Concepto</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; font-size: 13px;">${invoice.concept || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Base imponible</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">€${fmt(invoice.amount_net)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">IVA (${invoice.vat_percentage}%)</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">€${fmt(invoice.amount_vat)}</td>
            </tr>
            <tr style="border-top: 2px solid #e2e8f0;">
              <td style="padding: 12px 0 0; font-weight: 800; font-size: 16px; color: #0f172a;">Total</td>
              <td style="padding: 12px 0 0; text-align: right; font-weight: 800; font-size: 16px; font-family: monospace; color: #0f172a;">€${fmt(invoice.amount_total)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
          Estado: <strong style="color: #334155;">${statusLabels[invoice.status] || invoice.status}</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
        <div style="font-size: 12px; color: #94a3b8;">
          ${companyName}${account?.email ? ` · ${account.email}` : ""}${account?.phone ? ` · ${account.phone}` : ""}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Send email via Resend
    const senderEmail = account?.email || "noreply@resend.dev";
    const resRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${companyName} <${senderEmail}>`,
        to: [client.email],
        subject,
        html: htmlBody,
      }),
    });

    const resData = await resRes.json();
    let emailStatus = "sent";
    let errorMessage: string | null = null;

    if (!resRes.ok) {
      emailStatus = "failed";
      errorMessage = resData?.message || resData?.error || "Error enviando email";
    }

    // Log the email
    await supabase.from("email_log").insert({
      account_id: invoice.account_id,
      invoice_id: invoice.id,
      recipient: client.email,
      type: "invoice",
      status: emailStatus,
      error_message: errorMessage,
    });

    // If sending invoice, update status to SENT if currently DRAFT
    if (emailStatus === "sent" && invoice.status === "DRAFT") {
      await supabase.from("invoices").update({ status: "SENT" }).eq("id", invoice.id);
    }

    if (emailStatus === "failed") {
      throw new Error(errorMessage || "Error enviando email");
    }

    return new Response(JSON.stringify({ success: true, email_id: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
