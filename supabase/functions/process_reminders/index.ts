import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get reminders that are due and not completed
    const now = new Date().toISOString();
    const { data: dueReminders, error: fetchErr } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_completed", false)
      .lte("remind_at", now);

    if (fetchErr) throw fetchErr;

    let created = 0;

    for (const reminder of dueReminders || []) {
      // Check if notification already exists for this reminder
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("reference_id", `reminder_${reminder.id}`)
        .eq("account_id", reminder.account_id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create notification
      const entityLabel = reminder.entity_label
        ? ` — ${reminder.entity_label}`
        : "";

      await supabase.from("notifications").insert({
        account_id: reminder.account_id,
        user_id: reminder.created_by,
        type: "REMINDER",
        title: `⏰ ${reminder.title}`,
        message: `${reminder.description || "Recordatorio programado"}${entityLabel}`,
        reference_id: `reminder_${reminder.id}`,
        link: reminder.entity_type === "CLIENT" && reminder.entity_id
          ? `/app/clients/${reminder.entity_id}`
          : reminder.entity_type === "INVOICE" || reminder.entity_type === "QUOTE" || reminder.entity_type === "EXPENSE"
          ? "/app/invoices"
          : null,
      });

      created++;
    }

    return new Response(
      JSON.stringify({ success: true, notifications_created: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
