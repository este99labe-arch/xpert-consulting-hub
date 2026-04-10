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

    const { employee_email, employee_name, password, company_name, from_email } = await req.json();

    if (!employee_email || !password) {
      return new Response(JSON.stringify({ error: "Missing employee_email or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = employee_name || employee_email.split("@")[0];
    const companyLabel = company_name || "la empresa";
    // TEST MODE: hardcoded sender and recipient for testing
    const TEST_RECIPIENT = "esteban@xpertconsulting.es";
    const senderEmail = "XpertConsulting <onboarding@resend.dev>";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background:#18181b;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">¡Bienvenido/a a ${companyLabel}!</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hola <strong>${displayName}</strong>,
      </p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Se ha creado tu cuenta en el sistema. A continuación encontrarás tus credenciales de acceso:
      </p>
      <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:14px;width:100px;">Email:</td>
            <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${employee_email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:14px;">Contraseña:</td>
            <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${password}</td>
          </tr>
        </table>
      </div>
      <p style="color:#71717a;font-size:13px;line-height:1.5;margin:0 0 8px;">
        ⚠️ Te recomendamos cambiar tu contraseña después del primer inicio de sesión.
      </p>
      <p style="color:#71717a;font-size:13px;line-height:1.5;margin:0;">
        Si tienes alguna duda, contacta con tu responsable.
      </p>
    </div>
    <div style="border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
      <p style="margin:0;color:#a1a1aa;font-size:12px;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
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
        from: senderEmail,
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
