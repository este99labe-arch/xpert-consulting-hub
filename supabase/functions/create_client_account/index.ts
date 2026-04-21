import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateSecurePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*_+-=";
  const all = upper + lower + digits + symbols;

  // Ensure at least 1 uppercase, 1 symbol, 1 digit, rest random
  const getRandom = (charset: string) => charset[Math.floor(Math.random() * charset.length)];
  const mandatory = [getRandom(upper), getRandom(symbols), getRandom(digits)];
  const rest = Array.from({ length: 5 }, () => getRandom(all));
  // Shuffle
  const chars = [...mandatory, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function buildWelcomeEmailHtml(companyName: string, managerEmail: string, password: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a6de3 0%,#1557b0 100%);padding:40px 48px;text-align:center;">
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">¡Bienvenido/a a XpertConsulting!</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px;font-weight:400;">Tu cuenta ha sido creada correctamente</p>
    </div>

    <!-- Body -->
    <div style="padding:40px 48px;">
      
      <!-- Welcome message -->
      <p style="color:#1c2a3a;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Hola,<br><br>
        Se ha creado tu cuenta de gestión para <strong>${companyName}</strong> en la plataforma XpertConsulting. 
        A continuación encontrarás tus credenciales de acceso temporales.
      </p>

      <!-- Credentials box -->
      <div style="background:#f0f4f8;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 16px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Credenciales de acceso</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;vertical-align:top;">Email:</td>
            <td style="padding:8px 0;color:#1c2a3a;font-size:14px;font-weight:600;word-break:break-all;">${managerEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top;">Contraseña:</td>
            <td style="padding:8px 0;color:#1c2a3a;font-size:14px;font-weight:600;font-family:'JetBrains Mono',monospace;letter-spacing:1px;">${password}</td>
          </tr>
        </table>
      </div>

      <!-- Security notice + CTA -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;color:#92400e;font-size:14px;font-weight:600;">⚠️ Contraseña temporal</p>
        <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
          Por seguridad, te recomendamos cambiar tu contraseña de inmediato. 
          Haz clic en el botón de abajo para establecer una contraseña personal y segura.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${resetUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#1a6de3 0%,#1557b0 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(26,109,227,0.3);">
          Cambiar mi contraseña
        </a>
      </div>

      <!-- Next steps -->
      <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
        <p style="margin:0 0 12px;color:#1c2a3a;font-size:14px;font-weight:600;">Próximos pasos:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;color:#1a6de3;font-size:14px;width:24px;vertical-align:top;">1.</td>
            <td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.5;">Cambia tu contraseña temporal usando el botón de arriba</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#1a6de3;font-size:14px;width:24px;vertical-align:top;">2.</td>
            <td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.5;">Inicia sesión con tu nueva contraseña</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#1a6de3;font-size:14px;width:24px;vertical-align:top;">3.</td>
            <td style="padding:4px 0;color:#475569;font-size:14px;line-height:1.5;">Explora los módulos habilitados para tu empresa</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Este es un correo automático de <strong>XpertConsulting</strong>.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Si tienes alguna duda, contacta con tu responsable.</p>
    </div>
  </div>
</body>
</html>`;
}

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
    const { data: roleCheck } = await adminClient
      .from("user_accounts")
      .select("role_id, roles(code)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!roleCheck || (roleCheck as any).roles?.code !== "MASTER_ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden: MASTER_ADMIN required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_name, manager_email, module_ids, client_info, primary_contact } = await req.json();

    if (!company_name || !manager_email || !module_ids?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-generate secure password
    const manager_password = generateSecurePassword();

    // 1. Create account
    const accountInsert: Record<string, any> = {
      name: company_name, type: "CLIENT", created_by: user.id,
    };
    if (client_info) {
      if (client_info.tax_id) accountInsert.tax_id = client_info.tax_id;
      if (client_info.email) accountInsert.email = client_info.email;
      if (client_info.phone) accountInsert.phone = client_info.phone;
      if (client_info.address) accountInsert.address = client_info.address;
      if (client_info.city) accountInsert.city = client_info.city;
      if (client_info.postal_code) accountInsert.postal_code = client_info.postal_code;
    }

    const { data: account, error: accountError } = await adminClient
      .from("accounts").insert(accountInsert).select("id").single();
    if (accountError) throw accountError;

    // 2. Insert modules
    const moduleInserts = module_ids.map((module_id: string) => ({
      account_id: account.id, module_id, is_enabled: true,
    }));
    const { error: modulesError } = await adminClient.from("account_modules").insert(moduleInserts);
    if (modulesError) throw modulesError;

    // 3. Create manager user
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email: manager_email, password: manager_password, email_confirm: true,
    });
    if (authError) throw authError;

    // 4. Get MANAGER role id
    const { data: managerRole } = await adminClient
      .from("roles").select("id").eq("code", "MANAGER").single();
    if (!managerRole) throw new Error("MANAGER role not found");

    // 5. Link user to account
    const { error: linkError } = await adminClient.from("user_accounts").insert({
      user_id: newUser.user.id, account_id: account.id, role_id: managerRole.id,
    });
    if (linkError) throw linkError;

    // 6. Update synced business_client record
    if (client_info) {
      const { data: masterAccount } = await adminClient
        .from("accounts").select("id").eq("type", "MASTER").limit(1).single();

      if (masterAccount) {
        const { data: syncedClient } = await adminClient
          .from("business_clients").select("id")
          .eq("account_id", masterAccount.id).eq("name", company_name)
          .order("created_at", { ascending: false }).limit(1).single();

        if (syncedClient) {
          await adminClient.from("business_clients").update({
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
          }).eq("id", syncedClient.id);

          if (primary_contact?.name) {
            await adminClient.from("client_contacts").insert({
              client_id: syncedClient.id, account_id: masterAccount.id,
              name: primary_contact.name, email: primary_contact.email || null,
              phone: primary_contact.phone || null, position: primary_contact.position || null,
              is_primary: true,
            });
          }
        }
      }
    }

    // 7. Generate password reset link and send welcome email
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        // Generate a password reset link so the manager can set their own password
        const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: manager_email,
        });

        let resetUrl = `${supabaseUrl.replace('.supabase.co', '.supabase.co')}/auth/v1/verify?token=${resetData?.properties?.hashed_token}&type=recovery&redirect_to=${encodeURIComponent(supabaseUrl.replace('api', 'app') + '/reset-password')}`;
        
        // If we got the action_link directly, use it
        if (resetData?.properties?.action_link) {
          resetUrl = resetData.properties.action_link;
        }

        const htmlBody = buildWelcomeEmailHtml(company_name, manager_email, manager_password, resetUrl);

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "XpertConsulting <noreply@xpertconsulting.es>",
            to: [manager_email],
            subject: `Bienvenido/a a XpertConsulting — Acceso a ${company_name}`,
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
