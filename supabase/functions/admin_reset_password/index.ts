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

    // Check caller role
    const { data: callerRole } = await adminClient
      .from("user_accounts")
      .select("role_id, roles(code), account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const callerRoleCode = (callerRole as any)?.roles?.code;
    const body = await req.json();
    const { action } = body;

    // CHANGE OWN PASSWORD — available to ALL authenticated users
    if (action === "change_own_password") {
      const { current_password, new_password } = body;
      if (!current_password || !new_password) {
        return new Response(JSON.stringify({ error: "Missing current_password or new_password" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (typeof new_password !== "string" || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "La nueva contraseña debe tener al menos 6 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify current password using an isolated anon client (do not touch admin/user sessions)
      const verifyClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await verifyClient.auth.signInWithPassword({
        email: user.email!,
        password: current_password,
      });
      if (signInError) {
        return new Response(JSON.stringify({ error: "La contraseña actual es incorrecta" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await adminClient.auth.admin.updateUser(user.id, { password: new_password });
      if (updateError) {
        console.error("[change_own_password] updateUser error:", updateError);
        return new Response(JSON.stringify({ error: updateError.message || "No se pudo actualizar la contraseña" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All actions below require MANAGER or MASTER_ADMIN
    if (!callerRoleCode || !["MASTER_ADMIN", "MANAGER"].includes(callerRoleCode)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FORCE RESET PASSWORD (manager resets any user's password + sends email)
    if (action === "force_reset_password") {
      const { target_user_id, new_password } = body;
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

      // Get target user email & account info for email
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(target_user_id);
      if (targetUser?.email) {
        // Get account name
        const { data: targetUA } = await adminClient
          .from("user_accounts")
          .select("account_id, accounts(name)")
          .eq("user_id", target_user_id)
          .eq("is_active", true)
          .single();
        const companyName = (targetUA as any)?.accounts?.name || "la empresa";

        // Get employee profile name
        const { data: profile } = await adminClient
          .from("employee_profiles")
          .select("first_name, last_name")
          .eq("user_id", target_user_id)
          .single();
        const employeeName = profile ? `${profile.first_name} ${profile.last_name}` : undefined;

        // Fire-and-forget email
        try {
          await fetch(`${supabaseUrl}/functions/v1/send_welcome_email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              employee_email: targetUser.email,
              employee_name: employeeName,
              password: new_password,
              company_name: companyName,
            }),
          });
        } catch (_) { /* email failure should not block password reset */ }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESET PASSWORD (legacy, kept for compatibility)
    if (action === "reset_password") {
      const { target_user_id, new_password } = body;
      if (!target_user_id || !new_password) {
        return new Response(JSON.stringify({ error: "Missing target_user_id or new_password" }), {
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

    // CREATE USER
    if (action === "create_user") {
      const { email, new_password, role_code, account_id } = body;
      if (!email || !new_password || !role_code) {
        return new Response(JSON.stringify({ error: "Missing email, new_password, or role_code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const targetAccountId = callerRoleCode === "MASTER_ADMIN" ? (account_id || callerRole.account_id) : callerRole.account_id;

      const { data: role } = await adminClient.from("roles").select("id").eq("code", role_code).single();
      if (!role) throw new Error(`Role ${role_code} not found`);

      if (callerRoleCode === "MANAGER" && role_code !== "EMPLOYEE") {
        return new Response(JSON.stringify({ error: "Managers can only create EMPLOYEE users" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email, password: new_password, email_confirm: true,
      });
      if (authError) throw authError;

      const { error: linkError } = await adminClient.from("user_accounts").insert({
        user_id: newUser.user.id, account_id: targetAccountId, role_id: role.id,
      });
      if (linkError) throw linkError;

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DEACTIVATE USER
    if (action === "deactivate_user") {
      const { target_user_id } = body;
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

    // LIST USERS
    if (action === "list_users") {
      const { account_id } = body;
      const targetAccountId = callerRoleCode === "MASTER_ADMIN" ? (account_id || callerRole.account_id) : callerRole.account_id;

      const { data: userAccounts, error: listError } = await adminClient
        .from("user_accounts")
        .select("user_id, is_active, role_id, roles(code), account_id, accounts(name)")
        .eq(callerRoleCode === "MASTER_ADMIN" && !account_id ? "is_active" : "account_id", callerRoleCode === "MASTER_ADMIN" && !account_id ? true : targetAccountId);

      if (listError) throw listError;

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
    console.error("[admin_reset_password] Unhandled error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
