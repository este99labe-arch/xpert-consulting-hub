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
        // Create invoice
        const { error: insError } = await supabase.from("invoices").insert({
          account_id: tpl.account_id,
          client_id: tpl.client_id,
          concept: tpl.concept,
          amount_net: tpl.amount_net,
          vat_percentage: tpl.vat_percentage,
          amount_vat: tpl.amount_vat,
          amount_total: tpl.amount_total,
          type: tpl.type,
          issue_date: tpl.next_run_date,
          status: "DRAFT",
        });

        if (insError) {
          console.error(`Error creating invoice for recurring ${tpl.id}:`, insError);
          errors++;
          continue;
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
