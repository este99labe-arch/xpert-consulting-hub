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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is MASTER_ADMIN or MANAGER
    const { data: callerRole } = await adminClient
      .from("user_accounts")
      .select("role_id, roles(code), account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const callerRoleCode = (callerRole as any)?.roles?.code;
    if (!callerRoleCode || !["MASTER_ADMIN", "MANAGER"].includes(callerRoleCode)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id, new_password, email, role_code, account_id } = await req.json();

    // RESET PASSWORD
    if (action === "reset_password") {
      if (!target_user_id || !new_password) {
        return new Response(JSON.stringify({ error: "Missing target_user_id or new_password" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Managers can only reset users in their own account
      if (callerRoleCode === "MANAGER") {
        const { data: targetAccount } = await adminClient
          .from("user_accounts")
          .select("account_id")
          .eq("user_id", target_user_id)
          .eq("is_active", true)
          .single();
        if (!targetAccount || targetAccount.account_id !== callerRole.account_id) {
          return new Response(JSON.stringify({ error: "Cannot reset password for users outside your account" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: resetError } = await adminClient.auth.admin.updateUser(target_user_id, { password: new_password });
      if (resetError) throw resetError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER (for managers creating employees in their account)
    if (action === "create_user") {
      if (!email || !new_password || !role_code) {
        return new Response(JSON.stringify({ error: "Missing email, new_password, or role_code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetAccountId = callerRoleCode === "MASTER_ADMIN" ? (account_id || callerRole.account_id) : callerRole.account_id;

      // Get role id
      const { data: role } = await adminClient
        .from("roles")
        .select("id")
        .eq("code", role_code)
        .single();
      if (!role) throw new Error(`Role ${role_code} not found`);

      // Managers can only create EMPLOYEEs
      if (callerRoleCode === "MANAGER" && role_code !== "EMPLOYEE") {
        return new Response(JSON.stringify({ error: "Managers can only create EMPLOYEE users" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: new_password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const { error: linkError } = await adminClient.from("user_accounts").insert({
        user_id: newUser.user.id,
        account_id: targetAccountId,
        role_id: role.id,
      });
      if (linkError) throw linkError;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DEACTIVATE USER
    if (action === "deactivate_user") {
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (callerRoleCode === "MANAGER") {
        const { data: targetAccount } = await adminClient
          .from("user_accounts")
          .select("account_id")
          .eq("user_id", target_user_id)
          .eq("is_active", true)
          .single();
        if (!targetAccount || targetAccount.account_id !== callerRole.account_id) {
          return new Response(JSON.stringify({ error: "Cannot manage users outside your account" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: deactError } = await adminClient
        .from("user_accounts")
        .update({ is_active: false })
        .eq("user_id", target_user_id);
      if (deactError) throw deactError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST USERS (for an account)
    if (action === "list_users") {
      const targetAccountId = callerRoleCode === "MASTER_ADMIN" ? (account_id || callerRole.account_id) : callerRole.account_id;

      const { data: userAccounts, error: listError } = await adminClient
        .from("user_accounts")
        .select("user_id, is_active, role_id, roles(code), account_id, accounts(name)")
        .eq(callerRoleCode === "MASTER_ADMIN" && !account_id ? "is_active" : "account_id", callerRoleCode === "MASTER_ADMIN" && !account_id ? true : targetAccountId);

      if (listError) throw listError;

      // Get emails from auth admin
      const userIds = [...new Set((userAccounts || []).map((ua: any) => ua.user_id))];
      const usersWithEmail = [];

      for (const uid of userIds) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(uid);
        const ua = (userAccounts || []).find((u: any) => u.user_id === uid);
        if (authUser && ua) {
          usersWithEmail.push({
            user_id: uid,
            email: authUser.email,
            role: (ua as any).roles?.code,
            is_active: ua.is_active,
            account_id: ua.account_id,
            account_name: (ua as any).accounts?.name,
          });
        }
      }

      return new Response(JSON.stringify({ users: usersWithEmail }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
