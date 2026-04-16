import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { employee_email, employee_name, password, company_name, from_email, reset_url } = await req.json();

    if (!employee_email || !password) {
      return new Response(JSON.stringify({ error: "Missing employee_email or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = employee_name || employee_email.split("@")[0];
    const companyLabel = company_name || "la empresa";
    const TEST_RECIPIENT = "esteban@xpertconsulting.es";
    const passwordResetUrl = reset_url || "#";

    const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a6de3 0%,#1557b0 100%);padding:40px 48px;text-align:center;">
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">¡Bienvenido/a a ${companyLabel}!</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px;font-weight:400;">Tu cuenta ha sido creada correctamente</p>
    </div>

    <!-- Body -->
    <div style="padding:40px 48px;">
      
      <p style="color:#1c2a3a;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Hola <strong>${displayName}</strong>,<br><br>
        Se ha creado tu cuenta en el sistema de gestión de <strong>${companyLabel}</strong>. 
        A continuación encontrarás tus credenciales de acceso temporales.
      </p>

      <!-- Credentials box -->
      <div style="background:#f0f4f8;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:0 0 28px;">
        <p style="margin:0 0 16px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Credenciales de acceso</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;vertical-align:top;">Email:</td>
            <td style="padding:8px 0;color:#1c2a3a;font-size:14px;font-weight:600;word-break:break-all;">${employee_email}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top;">Contraseña:</td>
            <td style="padding:8px 0;color:#1c2a3a;font-size:14px;font-weight:600;font-family:'JetBrains Mono',monospace;letter-spacing:1px;">${password}</td>
          </tr>
        </table>
      </div>

      <!-- Security notice -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
        <p style="margin:0 0 4px;color:#92400e;font-size:14px;font-weight:600;">⚠️ Contraseña temporal</p>
        <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
          Por seguridad, te recomendamos cambiar tu contraseña de inmediato tras el primer inicio de sesión.
        </p>
      </div>

      ${passwordResetUrl !== "#" ? `
      <!-- CTA Button -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${passwordResetUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#1a6de3 0%,#1557b0 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(26,109,227,0.3);">
          Cambiar mi contraseña
        </a>
      </div>` : ""}

      <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0;">
        Si tienes alguna duda, contacta con tu responsable.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Este es un correo automático de <strong>XpertConsulting</strong>.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Por favor, no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "XpertConsulting <noreply@xpertconsulting.es>",
        to: [TEST_RECIPIENT],
        subject: `Bienvenido/a a ${companyLabel} — Tus credenciales de acceso`,
        html: htmlBody,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
