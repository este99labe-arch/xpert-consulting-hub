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
