import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify caller is MASTER_ADMIN
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check MASTER_ADMIN role
    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "MASTER_ADMIN",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Sin permisos" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { account_id, delete_all } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify account is CLIENT type
    const { data: account } = await adminClient
      .from("accounts")
      .select("id, type, name")
      .eq("id", account_id)
      .single();

    if (!account || account.type !== "CLIENT") {
      return new Response(JSON.stringify({ error: "Cuenta no encontrada o no es tipo CLIENT" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (delete_all) {
      // Delete ALL related data in correct order to respect FK constraints

      // 1. Journal entry lines (via entries)
      const { data: entries } = await adminClient
        .from("journal_entries")
        .select("id")
        .eq("account_id", account_id);
      if (entries && entries.length > 0) {
        const entryIds = entries.map((e: any) => e.id);
        await adminClient.from("journal_entry_lines").delete().in("entry_id", entryIds);
      }

      // 2. Journal entry delete requests
      await adminClient.from("journal_entry_delete_requests").delete().eq("account_id", account_id);

      // 3. Journal entries
      await adminClient.from("journal_entries").delete().eq("account_id", account_id);

      // 4. Invoice delete requests
      await adminClient.from("invoice_delete_requests").delete().eq("account_id", account_id);

      // 5. Email logs
      await adminClient.from("email_log").delete().eq("account_id", account_id);

      // 6. Invoices
      await adminClient.from("invoices").delete().eq("account_id", account_id);

      // 7. Recurring invoices
      await adminClient.from("recurring_invoices").delete().eq("account_id", account_id);

      // 8. Client contacts
      await adminClient.from("client_contacts").delete().eq("account_id", account_id);

      // 9. Business clients
      await adminClient.from("business_clients").delete().eq("account_id", account_id);

      // 10. Client plans
      await adminClient.from("client_plans").delete().eq("account_id", account_id);

      // 11. Chart of accounts
      await adminClient.from("chart_of_accounts").delete().eq("account_id", account_id);

      // 12. Stock movements
      await adminClient.from("stock_movements").delete().eq("account_id", account_id);

      // 13. Purchase orders
      await adminClient.from("purchase_orders").delete().eq("account_id", account_id);

      // 14. Products
      await adminClient.from("products").delete().eq("account_id", account_id);

      // 15. Employee documents
      await adminClient.from("employee_documents").delete().eq("account_id", account_id);

      // 16. Document folders
      await adminClient.from("document_folders").delete().eq("account_id", account_id);

      // 17. Leave requests
      await adminClient.from("leave_requests").delete().eq("account_id", account_id);

      // 18. Attendance records
      await adminClient.from("attendance_records").delete().eq("account_id", account_id);

      // 19. Employee profiles
      await adminClient.from("employee_profiles").delete().eq("account_id", account_id);

      // 20. Reminders
      await adminClient.from("reminders").delete().eq("account_id", account_id);

      // 21. Notifications
      await adminClient.from("notifications").delete().eq("account_id", account_id);

      // 22. Profile change requests
      await adminClient.from("profile_change_requests").delete().eq("account_id", account_id);

      // 23. Webhook logs (via webhooks)
      const { data: webhooks } = await adminClient
        .from("webhooks")
        .select("id")
        .eq("account_id", account_id);
      if (webhooks && webhooks.length > 0) {
        const webhookIds = webhooks.map((w: any) => w.id);
        await adminClient.from("webhook_logs").delete().in("webhook_id", webhookIds);
      }

      // 24. Webhooks
      await adminClient.from("webhooks").delete().eq("account_id", account_id);

      // 25. API keys
      await adminClient.from("api_keys").delete().eq("account_id", account_id);

      // 26. Audit logs
      await adminClient.from("audit_logs").delete().eq("account_id", account_id);

      // 27. WhatsApp config
      await adminClient.from("whatsapp_config").delete().eq("account_id", account_id);

      // 28. Account settings
      await adminClient.from("account_settings").delete().eq("account_id", account_id);

      // 29. Account modules
      await adminClient.from("account_modules").delete().eq("account_id", account_id);

      // 30. Deactivate and delete users linked to this account
      const { data: userAccounts } = await adminClient
        .from("user_accounts")
        .select("user_id")
        .eq("account_id", account_id);

      await adminClient.from("user_accounts").delete().eq("account_id", account_id);

      // Delete auth users that were only in this account
      if (userAccounts && userAccounts.length > 0) {
        for (const ua of userAccounts) {
          // Check if user belongs to other accounts
          const { data: otherAccounts } = await adminClient
            .from("user_accounts")
            .select("id")
            .eq("user_id", ua.user_id)
            .limit(1);
          if (!otherAccounts || otherAccounts.length === 0) {
            await adminClient.auth.admin.deleteUser(ua.user_id);
          }
        }
      }
    } else {
      // Only delete the account record + modules + user_accounts link
      await adminClient.from("account_modules").delete().eq("account_id", account_id);
      await adminClient.from("account_settings").delete().eq("account_id", account_id);

      const { data: userAccounts } = await adminClient
        .from("user_accounts")
        .select("user_id")
        .eq("account_id", account_id);
      await adminClient.from("user_accounts").delete().eq("account_id", account_id);

      if (userAccounts && userAccounts.length > 0) {
        for (const ua of userAccounts) {
          const { data: otherAccounts } = await adminClient
            .from("user_accounts")
            .select("id")
            .eq("user_id", ua.user_id)
            .limit(1);
          if (!otherAccounts || otherAccounts.length === 0) {
            await adminClient.auth.admin.deleteUser(ua.user_id);
          }
        }
      }
    }

    // Also remove the synced business_client from the master account
    const { data: masterAccount } = await adminClient
      .from("accounts")
      .select("id")
      .eq("type", "MASTER")
      .limit(1)
      .single();

    if (masterAccount) {
      await adminClient
        .from("business_clients")
        .delete()
        .eq("account_id", masterAccount.id)
        .eq("name", account.name);
    }

    // Finally delete the account itself
    await adminClient.from("accounts").delete().eq("id", account_id);

    return new Response(
      JSON.stringify({ success: true, message: `Cuenta "${account.name}" eliminada correctamente` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
