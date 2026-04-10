import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check MASTER_ADMIN role using admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_accounts")
      .select("role_id, roles(code)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!roleCheck || (roleCheck as any).roles?.code !== "MASTER_ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden: MASTER_ADMIN required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_name, manager_email, manager_password, module_ids, client_info, primary_contact } = await req.json();

    if (!company_name || !manager_email || !manager_password || !module_ids?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create account with extended info
    const accountInsert: Record<string, any> = {
      name: company_name,
      type: "CLIENT",
      created_by: user.id,
    };
    // Copy relevant fields from client_info to the account
    if (client_info) {
      if (client_info.tax_id) accountInsert.tax_id = client_info.tax_id;
      if (client_info.email) accountInsert.email = client_info.email;
      if (client_info.phone) accountInsert.phone = client_info.phone;
      if (client_info.address) accountInsert.address = client_info.address;
      if (client_info.city) accountInsert.city = client_info.city;
      if (client_info.postal_code) accountInsert.postal_code = client_info.postal_code;
    }

    const { data: account, error: accountError } = await adminClient
      .from("accounts")
      .insert(accountInsert)
      .select("id")
      .single();

    if (accountError) throw accountError;

    // 2. Insert modules
    const moduleInserts = module_ids.map((module_id: string) => ({
      account_id: account.id,
      module_id,
      is_enabled: true,
    }));
    const { error: modulesError } = await adminClient
      .from("account_modules")
      .insert(moduleInserts);
    if (modulesError) throw modulesError;

    // 3. Create manager user via Auth admin API
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email: manager_email,
      password: manager_password,
      email_confirm: true,
    });
    if (authError) throw authError;

    // 4. Get MANAGER role id
    const { data: managerRole } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "MANAGER")
      .single();

    if (!managerRole) throw new Error("MANAGER role not found");

    // 5. Link user to account
    const { error: linkError } = await adminClient.from("user_accounts").insert({
      user_id: newUser.user.id,
      account_id: account.id,
      role_id: managerRole.id,
    });
    if (linkError) throw linkError;

    // 6. Update the synced business_client record in the MASTER account with extended info
    if (client_info) {
      // The sync trigger creates a business_client in the MASTER account with name = company_name
      // Find and update it with the extra fields
      const { data: masterAccount } = await adminClient
        .from("accounts")
        .select("id")
        .eq("type", "MASTER")
        .limit(1)
        .single();

      if (masterAccount) {
        const { data: syncedClient } = await adminClient
          .from("business_clients")
          .select("id")
          .eq("account_id", masterAccount.id)
          .eq("name", company_name)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (syncedClient) {
          // Update with extended info
          await adminClient
            .from("business_clients")
            .update({
              tax_id: client_info.tax_id || "PENDIENTE",
              email: client_info.email || null,
              phone: client_info.phone || null,
              website: client_info.website || null,
              address: client_info.address || null,
              city: client_info.city || null,
              postal_code: client_info.postal_code || null,
              country: client_info.country || null,
              billing_address: client_info.billing_address || null,
              billing_city: client_info.billing_city || null,
              billing_postal_code: client_info.billing_postal_code || null,
              billing_country: client_info.billing_country || null,
              notes: client_info.notes || null,
            })
            .eq("id", syncedClient.id);

          // Add primary contact to the synced business client
          if (primary_contact?.name) {
            await adminClient
              .from("client_contacts")
              .insert({
                client_id: syncedClient.id,
                account_id: masterAccount.id,
                name: primary_contact.name,
                email: primary_contact.email || null,
                phone: primary_contact.phone || null,
                position: primary_contact.position || null,
                is_primary: true,
              });
          }
        }
      }
    }

    // 7. Send welcome email with credentials (hardcoded to test email for now)
    const TEST_EMAIL = "esteban@xpertconsulting.es";
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (RESEND_API_KEY && LOVABLE_API_KEY) {
        const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
        const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#18181b;padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">Nueva cuenta — ${company_name}</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 20px;">Se ha creado la cuenta <strong>${company_name}</strong>. Credenciales del Manager:</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#71717a;font-size:14px;width:120px;">Email:</td><td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${manager_email}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a;font-size:14px;">Contraseña:</td><td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${manager_password}</td></tr>
        </table>
      </div>
      <p style="color:#71717a;font-size:13px;margin:0;">⚠️ Se recomienda cambiar la contraseña tras el primer inicio de sesión.</p>
    </div>
    <div style="border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
      <p style="margin:0;color:#a1a1aa;font-size:12px;">Correo automático — no responder.</p>
    </div>
  </div>
</body></html>`;

        const emailRes = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "XpertConsulting <onboarding@resend.dev>",
            to: [TEST_EMAIL],
            subject: `Nueva cuenta creada — ${company_name}`,
            html: htmlBody,
          }),
        });
        console.log("Welcome email response:", await emailRes.json());
      }
    } catch (emailErr: any) {
      console.error("Welcome email failed (non-blocking):", emailErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, account_id: account.id, user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
