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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY no configurada");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional: validate caller (cron or authenticated user)
    const authHeader = req.headers.get("Authorization");
    let callerAccountId: string | null = null;

    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: accId } = await supabase.rpc("get_user_account_id", { _user_id: user.id });
        callerAccountId = accId;
      }
    }

    // Parse optional params
    let overdueDays = 30;
    try {
      const body = await req.json();
      if (body.overdue_days) overdueDays = Number(body.overdue_days);
      if (body.account_id) callerAccountId = body.account_id;
    } catch { /* no body is fine */ }

    // Query overdue invoices: status SENT or OVERDUE, older than X days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overdueDays);

    let query = supabase
      .from("invoices")
      .select("*, business_clients(name, email), accounts!invoices_account_id_fkey(name, email, phone)")
      .in("status", ["SENT", "OVERDUE"])
      .eq("type", "INVOICE")
      .lte("issue_date", cutoffDate.toISOString().split("T")[0]);

    if (callerAccountId) {
      query = query.eq("account_id", callerAccountId);
    }

    const { data: overdueInvoices, error } = await query;
    if (error) throw error;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(JSON.stringify({ success: true, reminders_sent: 0, message: "No hay facturas vencidas" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmt = (n: number) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    let sent = 0;
    let failed = 0;

    for (const inv of overdueInvoices) {
      const client = inv.business_clients;
      const account = inv.accounts;
      if (!client?.email) continue;

      // Check if we already sent a reminder in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: recentReminders } = await supabase
        .from("email_log")
        .select("id")
        .eq("invoice_id", inv.id)
        .eq("type", "reminder")
        .eq("status", "sent")
        .gte("sent_at", sevenDaysAgo.toISOString())
        .limit(1);

      if (recentReminders && recentReminders.length > 0) continue;

      const invoiceNumber = inv.invoice_number || inv.id.slice(0, 8).toUpperCase();
      const companyName = account?.name || "Empresa";
      const issueDate = new Date(inv.issue_date).toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric",
      });

      const daysSinceIssue = Math.floor(
        (Date.now() - new Date(inv.issue_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="background: #991b1b; padding: 32px 40px; color: white;">
        <div style="font-size: 24px; font-weight: 700;">${companyName}</div>
        <div style="font-size: 13px; color: #fca5a5; margin-top: 4px;">Recordatorio de pago</div>
      </div>
      <div style="padding: 40px;">
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
          Estimado/a <strong>${client.name}</strong>,
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px;">
          Le recordamos que la factura <strong>${invoiceNumber}</strong> emitida el ${issueDate} 
          por un importe de <strong>€${fmt(inv.amount_total)}</strong> se encuentra pendiente de pago 
          desde hace <strong>${daysSinceIssue} días</strong>.
        </p>
        <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #991b1b;">
          <div style="font-size: 13px; color: #64748b;">Importe pendiente</div>
          <div style="font-size: 24px; font-weight: 800; color: #991b1b; font-family: monospace;">€${fmt(inv.amount_total)}</div>
        </div>
        <p style="font-size: 14px; color: #64748b; margin: 0;">
          Si ya ha realizado el pago, por favor ignore este mensaje. En caso contrario, le rogamos proceda al abono a la mayor brevedad posible.
        </p>
      </div>
      <div style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
        <div style="font-size: 12px; color: #94a3b8;">
          ${companyName}${account?.email ? ` · ${account.email}` : ""}${account?.phone ? ` · ${account.phone}` : ""}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

      const senderEmail = account?.email || "noreply@resend.dev";
      try {
        const resRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${companyName} <${senderEmail}>`,
            to: [client.email],
            subject: `Recordatorio de pago — Factura ${invoiceNumber}`,
            html: htmlBody,
          }),
        });

        const resData = await resRes.json();
        const status = resRes.ok ? "sent" : "failed";

        await supabase.from("email_log").insert({
          account_id: inv.account_id,
          invoice_id: inv.id,
          recipient: client.email,
          type: "reminder",
          status,
          error_message: status === "failed" ? (resData?.message || "Error") : null,
        });

        // Mark as OVERDUE if still SENT
        if (inv.status === "SENT") {
          await supabase.from("invoices").update({ status: "OVERDUE" }).eq("id", inv.id);
        }

        if (status === "sent") sent++;
        else failed++;
      } catch (err) {
        failed++;
        await supabase.from("email_log").insert({
          account_id: inv.account_id,
          invoice_id: inv.id,
          recipient: client.email,
          type: "reminder",
          status: "failed",
          error_message: String(err),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: sent, reminders_failed: failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
