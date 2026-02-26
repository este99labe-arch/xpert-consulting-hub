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

    const { company_name, manager_email, manager_password, module_ids } = await req.json();

    if (!company_name || !manager_email || !manager_password || !module_ids?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create account
    const { data: account, error: accountError } = await adminClient
      .from("accounts")
      .insert({ name: company_name, type: "CLIENT", created_by: user.id })
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
