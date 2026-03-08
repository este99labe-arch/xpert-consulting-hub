import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all active client accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("type", "CLIENT")
      .eq("is_active", true);

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ message: "No accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreated = 0;

    for (const account of accounts) {
      const accountId = account.id;
      const notifications: Array<{
        account_id: string;
        user_id: string | null;
        type: string;
        title: string;
        message: string;
        link: string | null;
        reference_id: string | null;
      }> = [];

      // 1. STOCK_LOW: products where current_stock < min_stock
      const { data: lowStock } = await supabase
        .from("products")
        .select("id, name, current_stock, min_stock")
        .eq("account_id", accountId)
        .eq("is_active", true);

      for (const p of lowStock || []) {
        if (Number(p.current_stock) < Number(p.min_stock)) {
          // Check if notification already exists for this product (not read, same day)
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("account_id", accountId)
            .eq("type", "STOCK_LOW")
            .eq("reference_id", p.id)
            .eq("is_read", false)
            .limit(1);

          if (!existing || existing.length === 0) {
            notifications.push({
              account_id: accountId,
              user_id: null, // visible to managers
              type: "STOCK_LOW",
              title: `Stock bajo: ${p.name}`,
              message: `Stock actual: ${p.current_stock} (mínimo: ${p.min_stock})`,
              link: "/app/inventory",
              reference_id: p.id,
            });
          }
        }
      }

      // 2. LEAVE_PENDING: pending leave requests
      const { data: pendingLeaves } = await supabase
        .from("leave_requests")
        .select("id, user_id, type, start_date")
        .eq("account_id", accountId)
        .eq("status", "PENDING");

      for (const lr of pendingLeaves || []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("account_id", accountId)
          .eq("type", "LEAVE_PENDING")
          .eq("reference_id", lr.id)
          .eq("is_read", false)
          .limit(1);

        if (!existing || existing.length === 0) {
          notifications.push({
            account_id: accountId,
            user_id: null,
            type: "LEAVE_PENDING",
            title: `Solicitud de ${lr.type === "VACATION" ? "vacaciones" : "ausencia"} pendiente`,
            message: `Desde ${lr.start_date}`,
            link: "/app/hr",
            reference_id: lr.id,
          });
        }
      }

      // 3. INVOICE_OVERDUE: invoices with status SENT and issue_date > 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: overdueInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, amount_total")
        .eq("account_id", accountId)
        .eq("status", "SENT")
        .lt("issue_date", thirtyDaysAgo.toISOString().split("T")[0]);

      for (const inv of overdueInvoices || []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("account_id", accountId)
          .eq("type", "INVOICE_OVERDUE")
          .eq("reference_id", inv.id)
          .eq("is_read", false)
          .limit(1);

        if (!existing || existing.length === 0) {
          notifications.push({
            account_id: accountId,
            user_id: null,
            type: "INVOICE_OVERDUE",
            title: `Factura vencida: ${inv.invoice_number || "Sin nº"}`,
            message: `${inv.amount_total}€ — emitida el ${inv.issue_date}`,
            link: "/app/invoices",
            reference_id: inv.id,
          });
        }
      }

      // 4. DELETE_REQUEST: pending delete requests for invoices and journal entries
      const { data: invDelReqs } = await supabase
        .from("invoice_delete_requests")
        .select("id")
        .eq("account_id", accountId)
        .eq("status", "PENDING");

      for (const dr of invDelReqs || []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("account_id", accountId)
          .eq("type", "DELETE_REQUEST")
          .eq("reference_id", dr.id)
          .eq("is_read", false)
          .limit(1);

        if (!existing || existing.length === 0) {
          notifications.push({
            account_id: accountId,
            user_id: null,
            type: "DELETE_REQUEST",
            title: "Solicitud de eliminación de factura",
            message: "Pendiente de revisión",
            link: "/app/invoices",
            reference_id: dr.id,
          });
        }
      }

      const { data: entryDelReqs } = await supabase
        .from("journal_entry_delete_requests")
        .select("id")
        .eq("account_id", accountId)
        .eq("status", "PENDING");

      for (const dr of entryDelReqs || []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("account_id", accountId)
          .eq("type", "DELETE_REQUEST")
          .eq("reference_id", dr.id)
          .eq("is_read", false)
          .limit(1);

        if (!existing || existing.length === 0) {
          notifications.push({
            account_id: accountId,
            user_id: null,
            type: "DELETE_REQUEST",
            title: "Solicitud de eliminación de asiento",
            message: "Pendiente de revisión",
            link: "/app/accounting",
            reference_id: dr.id,
          });
        }
      }

      // Insert all notifications
      if (notifications.length > 0) {
        const { error } = await supabase.from("notifications").insert(notifications);
        if (error) console.error("Insert error for account", accountId, error);
        else totalCreated += notifications.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, notifications_created: totalCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
