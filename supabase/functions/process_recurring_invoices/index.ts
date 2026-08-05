import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function advanceDate(date: string, frequency: string): string {
  const d = new Date(date);
  switch (frequency) {
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Etiqueta del periodo facturado, según la frecuencia.
 * Mensual → "Agosto" · Trimestral → "T3 2026" · Anual → "2026".
 */
function periodLabel(date: string, frequency: string): string {
  const d = new Date(date);
  switch (frequency) {
    case "QUARTERLY":
      return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    case "YEARLY":
      return String(d.getFullYear());
    default:
      return MESES[d.getMonth()];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional: scope to a specific account
    let accountFilter: string | null = null;
    try {
      const body = await req.json();
      if (body.account_id) accountFilter = body.account_id;
    } catch { /* no body */ }

    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("recurring_invoices")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (accountFilter) {
      query = query.eq("account_id", accountFilter);
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ success: true, generated: 0, message: "No hay plantillas pendientes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    let errors = 0;

    for (const tpl of templates) {
      try {
        // Plantilla caducada: se desactiva y no genera nada más.
        if (tpl.end_date && tpl.next_run_date > tpl.end_date) {
          await supabase.from("recurring_invoices")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", tpl.id);
          continue;
        }

        // Líneas de la plantilla. Si no tiene, se usa el concepto e importe
        // sueltos, que es como funcionaban las plantillas antiguas.
        const { data: tplLines } = await supabase
          .from("recurring_invoice_lines")
          .select("description, quantity, unit_price, service_id, sort_order")
          .eq("recurring_id", tpl.id)
          .order("sort_order");

        const hasLines = (tplLines || []).length > 0;

        const net = hasLines
          ? +(tplLines!.reduce(
              (s: number, l: any) => s + Number(l.quantity || 1) * Number(l.unit_price || 0), 0,
            )).toFixed(2)
          : Number(tpl.amount_net || 0);

        const vat = +(net * Number(tpl.vat_percentage || 0) / 100).toFixed(2);
        const irpf = +(net * Number(tpl.irpf_percentage || 0) / 100).toFixed(2);
        const total = +(net + vat - irpf).toFixed(2);

        // Sufijo del periodo: "Suscripción Claude" → "Suscripción Claude - Agosto".
        const concept = tpl.append_period
          ? `${tpl.concept} - ${periodLabel(tpl.next_run_date, tpl.frequency)}`
          : tpl.concept;

        const { data: inv, error: insError } = await supabase.from("invoices").insert({
          account_id: tpl.account_id,
          client_id: tpl.client_id,
          concept,
          amount_net: net,
          vat_percentage: tpl.vat_percentage,
          amount_vat: vat,
          irpf_percentage: tpl.irpf_percentage || 0,
          irpf_amount: irpf,
          amount_total: total,
          category_id: tpl.category_id || null,
          type: tpl.type,
          issue_date: tpl.next_run_date,
          status: "DRAFT",
        }).select("id").single();

        if (insError) {
          console.error(`Error creating invoice for recurring ${tpl.id}:`, insError);
          errors++;
          continue;
        }

        if (hasLines && inv) {
          const lineInserts = tplLines!.map((l: any, i: number) => ({
            invoice_id: inv.id,
            account_id: tpl.account_id,
            description: l.description,
            quantity: Number(l.quantity || 1),
            unit_price: Number(l.unit_price || 0),
            amount: +(Number(l.quantity || 1) * Number(l.unit_price || 0)).toFixed(2),
            service_id: l.service_id || null,
            sort_order: i,
          }));
          const { error: linesErr } = await supabase.from("invoice_lines").insert(lineInserts);
          if (linesErr) console.error(`Error creating lines for invoice ${inv.id}:`, linesErr);
        }

        // Advance next_run_date
        const nextDate = advanceDate(tpl.next_run_date, tpl.frequency);
        await supabase.from("recurring_invoices").update({
          next_run_date: nextDate,
          last_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", tpl.id);

        generated++;
      } catch (err) {
        console.error(`Error processing recurring ${tpl.id}:`, err);
        errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, generated, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
