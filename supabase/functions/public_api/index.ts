import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashKey(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorRes(message: string, code: string, status: number, details?: any[]) {
  const body: any = { error: message, code };
  if (details) body.details = details;
  return jsonRes(body, status);
}

function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50")), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

interface ApiContext {
  supabase: any;
  accountId: string;
  apiKeyId: string;
  method: string;
  url: URL;
  req: Request;
}

async function logAudit(ctx: ApiContext, action: string, entityType: string, entityId: string, details?: any) {
  try {
    await ctx.supabase.from("audit_logs").insert({
      account_id: ctx.accountId,
      user_id: "00000000-0000-0000-0000-000000000000",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: { ...details, source: "public_api", api_key_id: ctx.apiKeyId },
    });
  } catch (_) { /* fire-and-forget */ }
}

// ─── CLIENTS ───
async function handleClients(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const clientId = parts[0] || null;
  const sub = parts[1] || null;
  const subId = parts[2] || null;

  // /clients/:id/contacts
  if (clientId && sub === "contacts") {
    return handleClientContacts(ctx, clientId, subId);
  }
  // /clients/:id/invoices
  if (clientId && sub === "invoices") {
    if (method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    const { page, limit, offset } = parsePagination(url);
    const { data, error, count } = await supabase.from("invoices")
      .select("id, invoice_number, type, status, concept, amount_total, issue_date, created_at", { count: "exact" })
      .eq("account_id", accountId).eq("client_id", clientId)
      .order("issue_date", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return jsonRes({ data, pagination: { page, limit, total: count } });
  }

  if (clientId && sub) return errorRes("Unknown sub-resource", "NOT_FOUND", 404);

  switch (method) {
    case "GET": {
      if (clientId) {
        const { data, error } = await supabase.from("business_clients")
          .select("*").eq("account_id", accountId).eq("id", clientId).single();
        if (error || !data) return errorRes("Client not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("business_clients").select("*", { count: "exact" })
        .eq("account_id", accountId).order("name").range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const search = url.searchParams.get("search");
      if (search) q = q.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.name || !body.tax_id) return errorRes("name and tax_id are required", "VALIDATION_ERROR", 422, [{ field: "name", message: "required" }, { field: "tax_id", message: "required" }]);
      const { data, error } = await supabase.from("business_clients").insert({ account_id: accountId, ...body }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "business_client", data.id, { name: body.name });
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!clientId) return errorRes("Client ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("business_clients").update(body)
        .eq("id", clientId).eq("account_id", accountId).select().single();
      if (error) return errorRes("Client not found or update failed", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "business_client", clientId, body);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!clientId) return errorRes("Client ID required", "VALIDATION_ERROR", 422);
      const { error } = await supabase.from("business_clients").delete()
        .eq("id", clientId).eq("account_id", accountId);
      if (error) return errorRes(error.message, "DELETE_FAILED", 400);
      await logAudit(ctx, "DELETE", "business_client", clientId);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleClientContacts(ctx: ApiContext, clientId: string, contactId: string | null) {
  const { supabase, accountId, method } = ctx;
  switch (method) {
    case "GET": {
      if (contactId) {
        const { data, error } = await supabase.from("client_contacts").select("*")
          .eq("account_id", accountId).eq("client_id", clientId).eq("id", contactId).single();
        if (error || !data) return errorRes("Contact not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { data, error } = await supabase.from("client_contacts").select("*")
        .eq("account_id", accountId).eq("client_id", clientId).order("is_primary", { ascending: false });
      if (error) throw error;
      return jsonRes({ data });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.name) return errorRes("name is required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("client_contacts").insert({
        account_id: accountId, client_id: clientId, ...body
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "client_contact", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!contactId) return errorRes("Contact ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("client_contacts").update(body)
        .eq("id", contactId).eq("account_id", accountId).eq("client_id", clientId).select().single();
      if (error) return errorRes("Contact not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "client_contact", contactId);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!contactId) return errorRes("Contact ID required", "VALIDATION_ERROR", 422);
      const { error } = await supabase.from("client_contacts").delete()
        .eq("id", contactId).eq("account_id", accountId).eq("client_id", clientId);
      if (error) return errorRes(error.message, "DELETE_FAILED", 400);
      await logAudit(ctx, "DELETE", "client_contact", contactId);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── INVOICES ───
async function handleInvoices(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const invoiceId = parts[0] || null;
  const sub = parts[1] || null;
  const subId = parts[2] || null;

  // Sub-routes
  if (invoiceId && sub === "payments") return handleInvoicePayments(ctx, invoiceId, subId);
  if (invoiceId && sub === "send-email") {
    if (method !== "POST") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const { data: inv } = await supabase.from("invoices").select("*, business_clients(email, name)")
      .eq("id", invoiceId).eq("account_id", accountId).single();
    if (!inv) return errorRes("Invoice not found", "NOT_FOUND", 404);
    // Call send_invoice_email function
    const resp = await fetch(`${supabaseUrl}/functions/v1/send_invoice_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ invoice_id: invoiceId, account_id: accountId }),
    });
    const result = await resp.json();
    await logAudit(ctx, "CREATE", "invoice_email", invoiceId);
    return jsonRes({ data: result });
  }
  if (invoiceId && sub === "pdf") {
    if (method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate_invoice_pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    if (!resp.ok) return errorRes("PDF generation failed", "INTERNAL_ERROR", 500);
    return new Response(await resp.arrayBuffer(), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="invoice-${invoiceId}.pdf"` },
    });
  }

  switch (method) {
    case "GET": {
      if (invoiceId) {
        const { data, error } = await supabase.from("invoices")
          .select("*, invoice_lines(*), invoice_payments(*), business_clients(id, name, tax_id, email)")
          .eq("account_id", accountId).eq("id", invoiceId).single();
        if (error || !data) return errorRes("Invoice not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("invoices").select("*, business_clients(id, name, tax_id)", { count: "exact" })
        .eq("account_id", accountId).order("issue_date", { ascending: false }).range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const type = url.searchParams.get("type");
      if (type) q = q.eq("type", type.toUpperCase());
      const clientIdFilter = url.searchParams.get("client_id");
      if (clientIdFilter) q = q.eq("client_id", clientIdFilter);
      const dateFrom = url.searchParams.get("date_from");
      if (dateFrom) q = q.gte("issue_date", dateFrom);
      const dateTo = url.searchParams.get("date_to");
      if (dateTo) q = q.lte("issue_date", dateTo);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.type || !body.client_id || !body.issue_date) {
        return errorRes("type, client_id, and issue_date are required", "VALIDATION_ERROR", 422);
      }
      const lines = body.lines || [];
      delete body.lines;
      const amountNet = lines.reduce((s: number, l: any) => s + (l.quantity || 1) * (l.unit_price || 0), 0);
      const vatPct = body.vat_percentage || 21;
      const irpfPct = body.irpf_percentage || 0;
      const amountVat = amountNet * vatPct / 100;
      const irpfAmount = amountNet * irpfPct / 100;
      const amountTotal = amountNet + amountVat - irpfAmount;
      const insertData = {
        account_id: accountId,
        type: body.type.toUpperCase(),
        client_id: body.client_id,
        concept: body.concept || "",
        issue_date: body.issue_date,
        operation_date: body.operation_date || null,
        vat_percentage: vatPct,
        irpf_percentage: irpfPct,
        irpf_amount: irpfAmount,
        amount_net: amountNet,
        amount_vat: amountVat,
        amount_total: amountTotal,
        special_mentions: body.special_mentions || null,
        description: body.description || null,
        status: body.status || "DRAFT",
      };
      const { data: invoice, error } = await supabase.from("invoices").insert(insertData).select().single();
      if (error) throw error;
      if (lines.length > 0) {
        const lineInserts = lines.map((l: any, i: number) => ({
          account_id: accountId,
          invoice_id: invoice.id,
          description: l.description || "",
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          amount: (l.quantity || 1) * (l.unit_price || 0),
          sort_order: i,
        }));
        await supabase.from("invoice_lines").insert(lineInserts);
      }
      await logAudit(ctx, "CREATE", "invoice", invoice.id);
      return jsonRes({ data: invoice }, 201);
    }
    case "PUT": {
      if (!invoiceId) return errorRes("Invoice ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      // Recalculate totals if lines are provided
      if (body.lines) {
        const lines = body.lines;
        delete body.lines;
        await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId).eq("account_id", accountId);
        const lineInserts = lines.map((l: any, i: number) => ({
          account_id: accountId,
          invoice_id: invoiceId,
          description: l.description || "",
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          amount: (l.quantity || 1) * (l.unit_price || 0),
          sort_order: i,
        }));
        if (lineInserts.length) await supabase.from("invoice_lines").insert(lineInserts);
        const amountNet = lineInserts.reduce((s: number, l: any) => s + l.amount, 0);
        const vatPct = body.vat_percentage ?? 21;
        body.amount_net = amountNet;
        body.amount_vat = amountNet * vatPct / 100;
        body.irpf_amount = amountNet * (body.irpf_percentage || 0) / 100;
        body.amount_total = body.amount_net + body.amount_vat - body.irpf_amount;
      }
      if (body.status === "PAID" && !body.paid_at) body.paid_at = new Date().toISOString();
      const { data, error } = await supabase.from("invoices").update(body)
        .eq("id", invoiceId).eq("account_id", accountId).select().single();
      if (error) return errorRes("Invoice not found or update failed", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "invoice", invoiceId, body);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!invoiceId) return errorRes("Invoice ID required", "VALIDATION_ERROR", 422);
      const { data: inv } = await supabase.from("invoices").select("status")
        .eq("id", invoiceId).eq("account_id", accountId).single();
      if (!inv) return errorRes("Invoice not found", "NOT_FOUND", 404);
      if (inv.status === "DRAFT") {
        await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
        await supabase.from("invoices").delete().eq("id", invoiceId).eq("account_id", accountId);
        await logAudit(ctx, "DELETE", "invoice", invoiceId);
        return jsonRes({ data: { deleted: true } });
      }
      // Create delete request
      const { data: dr, error } = await supabase.from("invoice_delete_requests").insert({
        account_id: accountId, invoice_id: invoiceId, requested_by: "00000000-0000-0000-0000-000000000000", reason: "API request"
      }).select().single();
      if (error) throw error;
      return jsonRes({ data: { delete_request_created: true, request_id: dr.id } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleInvoicePayments(ctx: ApiContext, invoiceId: string, paymentId: string | null) {
  const { supabase, accountId, method } = ctx;
  switch (method) {
    case "GET": {
      const { data, error } = await supabase.from("invoice_payments").select("*")
        .eq("account_id", accountId).eq("invoice_id", invoiceId).order("payment_date");
      if (error) throw error;
      return jsonRes({ data });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.amount) return errorRes("amount is required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("invoice_payments").insert({
        account_id: accountId, invoice_id: invoiceId,
        amount: body.amount, payment_date: body.payment_date || new Date().toISOString().split("T")[0],
        method: body.method || "TRANSFER", notes: body.notes || "",
        created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      // Check if fully paid
      const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId);
      const { data: inv } = await supabase.from("invoices").select("amount_total").eq("id", invoiceId).single();
      if (payments && inv) {
        const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        if (totalPaid >= Number(inv.amount_total)) {
          await supabase.from("invoices").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", invoiceId);
        } else {
          await supabase.from("invoices").update({ status: "PARTIALLY_PAID" }).eq("id", invoiceId);
        }
      }
      await logAudit(ctx, "CREATE", "invoice_payment", data.id);
      return jsonRes({ data }, 201);
    }
    case "DELETE": {
      if (!paymentId) return errorRes("Payment ID required", "VALIDATION_ERROR", 422);
      await supabase.from("invoice_payments").delete().eq("id", paymentId).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "invoice_payment", paymentId);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── RECURRING INVOICES ───
async function handleRecurringInvoices(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;

  if (id === "process" && method === "POST") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/process_recurring_invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ account_id: accountId }),
    });
    const result = await resp.json();
    return jsonRes({ data: result });
  }

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("recurring_invoices").select("*, business_clients(id, name)")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Recurring invoice not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("recurring_invoices").select("*, business_clients(id, name)", { count: "exact" })
        .eq("account_id", accountId).order("next_run_date").range(offset, offset + limit - 1);
      const isActive = url.searchParams.get("is_active");
      if (isActive !== null) q = q.eq("is_active", isActive === "true");
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.client_id || !body.next_run_date) return errorRes("client_id and next_run_date required", "VALIDATION_ERROR", 422);
      const amountNet = body.amount_net || 0;
      const vatPct = body.vat_percentage || 21;
      const amountVat = amountNet * vatPct / 100;
      const { data, error } = await supabase.from("recurring_invoices").insert({
        account_id: accountId, client_id: body.client_id, concept: body.concept || "",
        amount_net: amountNet, amount_vat: amountVat, amount_total: amountNet + amountVat,
        vat_percentage: vatPct, type: (body.type || "INVOICE").toUpperCase(),
        frequency: (body.frequency || "MONTHLY").toUpperCase(), next_run_date: body.next_run_date,
        created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "recurring_invoice", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      if (body.amount_net !== undefined) {
        const vatPct = body.vat_percentage || 21;
        body.amount_vat = body.amount_net * vatPct / 100;
        body.amount_total = body.amount_net + body.amount_vat;
      }
      const { data, error } = await supabase.from("recurring_invoices").update(body)
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "recurring_invoice", id);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("recurring_invoices").delete().eq("id", id).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "recurring_invoice", id);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── ACCOUNTING ───
async function handleAccounting(ctx: ApiContext, parts: string[]) {
  const section = parts[0] || "";
  const rest = parts.slice(1);

  switch (section) {
    case "chart": return handleChartOfAccounts(ctx, rest);
    case "entries": return handleJournalEntries(ctx, rest);
    case "reports": return handleAccountingReports(ctx, rest);
    case "balance": return handleAccountBalance(ctx);
    default: return errorRes("Unknown accounting endpoint", "NOT_FOUND", 404);
  }
}

async function handleChartOfAccounts(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("chart_of_accounts").select("*")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Account not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      let q = supabase.from("chart_of_accounts").select("*").eq("account_id", accountId).order("code");
      const type = url.searchParams.get("type");
      if (type) q = q.eq("type", type.toUpperCase());
      const isActive = url.searchParams.get("is_active");
      if (isActive !== null) q = q.eq("is_active", isActive === "true");
      const { data, error } = await q;
      if (error) throw error;
      return jsonRes({ data });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.code || !body.name || !body.type) return errorRes("code, name, type required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("chart_of_accounts").insert({
        account_id: accountId, code: body.code, name: body.name, type: body.type.toUpperCase(), parent_id: body.parent_id || null
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "chart_of_accounts", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("chart_of_accounts").update(body)
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "chart_of_accounts", id);
      return jsonRes({ data });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleJournalEntries(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;
  const action = parts[1] || null;

  if (id && action === "post" && method === "POST") {
    const { data, error } = await supabase.from("journal_entries").update({ status: "POSTED" })
      .eq("id", id).eq("account_id", accountId).eq("status", "DRAFT").select().single();
    if (error || !data) return errorRes("Entry not found or already posted", "NOT_FOUND", 404);
    await logAudit(ctx, "UPDATE", "journal_entry", id, { action: "post" });
    return jsonRes({ data });
  }

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("journal_entries")
          .select("*, journal_entry_lines(*, chart_of_accounts(code, name))")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Entry not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("journal_entries").select("*, journal_entry_lines(id, debit, credit)", { count: "exact" })
        .eq("account_id", accountId).order("date", { ascending: false }).range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const dateFrom = url.searchParams.get("date_from");
      if (dateFrom) q = q.gte("date", dateFrom);
      const dateTo = url.searchParams.get("date_to");
      if (dateTo) q = q.lte("date", dateTo);
      const search = url.searchParams.get("search");
      if (search) q = q.or(`description.ilike.%${search}%,entry_number.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.date || !body.lines?.length) return errorRes("date and lines required", "VALIDATION_ERROR", 422);
      const totalDebit = body.lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
      const totalCredit = body.lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return errorRes("Debit and credit must be equal", "VALIDATION_ERROR", 422, [
          { field: "lines", message: `Debit (${totalDebit}) != Credit (${totalCredit})` }
        ]);
      }
      const { data: entry, error } = await supabase.from("journal_entries").insert({
        account_id: accountId, date: body.date, description: body.description || "",
        status: "DRAFT", created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      const lineInserts = body.lines.map((l: any) => ({
        entry_id: entry.id, chart_account_id: l.chart_account_id,
        debit: l.debit || 0, credit: l.credit || 0, description: l.description || "",
      }));
      await supabase.from("journal_entry_lines").insert(lineInserts);
      await logAudit(ctx, "CREATE", "journal_entry", entry.id);
      return jsonRes({ data: entry }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      if (body.lines) {
        const lines = body.lines;
        delete body.lines;
        await supabase.from("journal_entry_lines").delete().eq("entry_id", id);
        const lineInserts = lines.map((l: any) => ({
          entry_id: id, chart_account_id: l.chart_account_id,
          debit: l.debit || 0, credit: l.credit || 0, description: l.description || "",
        }));
        await supabase.from("journal_entry_lines").insert(lineInserts);
      }
      const { data, error } = await supabase.from("journal_entries").update(body)
        .eq("id", id).eq("account_id", accountId).eq("status", "DRAFT").select().single();
      if (error) return errorRes("Not found or not editable", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "journal_entry", id);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const { data: entry } = await supabase.from("journal_entries").select("status")
        .eq("id", id).eq("account_id", accountId).single();
      if (!entry) return errorRes("Not found", "NOT_FOUND", 404);
      if (entry.status === "DRAFT") {
        await supabase.from("journal_entry_lines").delete().eq("entry_id", id);
        await supabase.from("journal_entries").delete().eq("id", id);
        await logAudit(ctx, "DELETE", "journal_entry", id);
        return jsonRes({ data: { deleted: true } });
      }
      const { data: dr } = await supabase.from("journal_entry_delete_requests").insert({
        account_id: accountId, entry_id: id, requested_by: "00000000-0000-0000-0000-000000000000", reason: "API request"
      }).select().single();
      return jsonRes({ data: { delete_request_created: true, request_id: dr?.id } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleAccountBalance(ctx: ApiContext) {
  if (ctx.method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  const { supabase, accountId, url } = ctx;
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  
  let q = supabase.from("journal_entry_lines")
    .select("chart_account_id, debit, credit, journal_entries!inner(account_id, date, status)")
    .eq("journal_entries.account_id", accountId).eq("journal_entries.status", "POSTED");
  if (dateFrom) q = q.gte("journal_entries.date", dateFrom);
  if (dateTo) q = q.lte("journal_entries.date", dateTo);
  const { data, error } = await q;
  if (error) throw error;

  const balances: Record<string, { debit: number; credit: number; balance: number }> = {};
  for (const line of data || []) {
    if (!balances[line.chart_account_id]) balances[line.chart_account_id] = { debit: 0, credit: 0, balance: 0 };
    balances[line.chart_account_id].debit += Number(line.debit);
    balances[line.chart_account_id].credit += Number(line.credit);
    balances[line.chart_account_id].balance = balances[line.chart_account_id].debit - balances[line.chart_account_id].credit;
  }

  const { data: accounts } = await supabase.from("chart_of_accounts").select("id, code, name, type")
    .eq("account_id", accountId).order("code");
  
  const result = (accounts || []).filter((a: any) => balances[a.id]).map((a: any) => ({
    ...a, ...balances[a.id]
  }));

  return jsonRes({ data: result });
}

async function handleAccountingReports(ctx: ApiContext, parts: string[]) {
  const report = parts[0] || "";
  const { supabase, accountId, url, method } = ctx;
  if (method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);

  switch (report) {
    case "pl": {
      const year = parseInt(url.searchParams.get("year") || new Date().getFullYear().toString());
      const period = url.searchParams.get("period") || "year";
      let dateFrom = `${year}-01-01`, dateTo = `${year}-12-31`;
      if (period === "month") {
        const month = (url.searchParams.get("month") || "1").padStart(2, "0");
        dateFrom = `${year}-${month}-01`;
        const d = new Date(year, parseInt(month), 0);
        dateTo = `${year}-${month}-${d.getDate().toString().padStart(2, "0")}`;
      } else if (period === "quarter") {
        const q = parseInt(url.searchParams.get("quarter") || "1");
        const sm = ((q - 1) * 3 + 1).toString().padStart(2, "0");
        const em = (q * 3).toString().padStart(2, "0");
        dateFrom = `${year}-${sm}-01`;
        const d = new Date(year, q * 3, 0);
        dateTo = `${year}-${em}-${d.getDate().toString().padStart(2, "0")}`;
      }
      const { data: lines } = await supabase.from("journal_entry_lines")
        .select("debit, credit, chart_of_accounts!inner(code, name, type), journal_entries!inner(date, status, account_id)")
        .eq("journal_entries.account_id", accountId).eq("journal_entries.status", "POSTED")
        .gte("journal_entries.date", dateFrom).lte("journal_entries.date", dateTo);
      
      let income = 0, expenses = 0;
      const incomeAccounts: any[] = [], expenseAccounts: any[] = [];
      for (const l of lines || []) {
        const acct = (l as any).chart_of_accounts;
        if (acct.type === "INCOME") {
          const amount = Number(l.credit) - Number(l.debit);
          income += amount;
          incomeAccounts.push({ code: acct.code, name: acct.name, amount });
        } else if (acct.type === "EXPENSE") {
          const amount = Number(l.debit) - Number(l.credit);
          expenses += amount;
          expenseAccounts.push({ code: acct.code, name: acct.name, amount });
        }
      }
      return jsonRes({ data: { period: { from: dateFrom, to: dateTo }, income, expenses, net_profit: income - expenses, income_accounts: incomeAccounts, expense_accounts: expenseAccounts } });
    }
    case "ledger": {
      const accountFilterId = url.searchParams.get("account_id");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      let q = supabase.from("journal_entry_lines")
        .select("debit, credit, description, chart_account_id, chart_of_accounts(code, name), journal_entries!inner(date, entry_number, description, status, account_id)")
        .eq("journal_entries.account_id", accountId).eq("journal_entries.status", "POSTED")
        .order("journal_entries(date)");
      if (accountFilterId) q = q.eq("chart_account_id", accountFilterId);
      if (dateFrom) q = q.gte("journal_entries.date", dateFrom);
      if (dateTo) q = q.lte("journal_entries.date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return jsonRes({ data });
    }
    case "taxes": {
      const year = parseInt(url.searchParams.get("year") || new Date().getFullYear().toString());
      const quarter = parseInt(url.searchParams.get("quarter") || Math.ceil((new Date().getMonth() + 1) / 3).toString());
      const sm = ((quarter - 1) * 3 + 1).toString().padStart(2, "0");
      const em = (quarter * 3).toString().padStart(2, "0");
      const dateFrom = `${year}-${sm}-01`;
      const d = new Date(year, quarter * 3, 0);
      const dateTo = `${year}-${em}-${d.getDate().toString().padStart(2, "0")}`;

      const { data: invoices } = await supabase.from("invoices").select("type, amount_net, amount_vat, status")
        .eq("account_id", accountId).gte("issue_date", dateFrom).lte("issue_date", dateTo)
        .in("status", ["PAID", "SENT", "PARTIALLY_PAID"]);

      let vatCollected = 0, vatDeductible = 0, baseImponibleVentas = 0, baseImponibleCompras = 0;
      for (const inv of invoices || []) {
        if (inv.type === "INVOICE" || inv.type === "QUOTE") {
          vatCollected += Number(inv.amount_vat);
          baseImponibleVentas += Number(inv.amount_net);
        } else {
          vatDeductible += Number(inv.amount_vat);
          baseImponibleCompras += Number(inv.amount_net);
        }
      }
      return jsonRes({ data: { period: { year, quarter, from: dateFrom, to: dateTo }, base_imponible_ventas: baseImponibleVentas, iva_repercutido: vatCollected, base_imponible_compras: baseImponibleCompras, iva_soportado: vatDeductible, resultado: vatCollected - vatDeductible } });
    }
    case "trial-balance": {
      return handleAccountBalance(ctx);
    }
    default: return errorRes("Unknown report", "NOT_FOUND", 404);
  }
}

// ─── RECONCILIATION ───
async function handleReconciliation(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const action = parts[0] || "";

  switch (action) {
    case "movements": {
      if (method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("bank_transactions").select("*, reconciliation_matches(id, invoice_id)", { count: "exact" })
        .eq("account_id", accountId).order("transaction_date", { ascending: false }).range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status === "matched") q = q.eq("is_reconciled", true);
      if (status === "unmatched") q = q.eq("is_reconciled", false);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "match": {
      if (method !== "POST") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
      const body = await ctx.req.json();
      if (!body.movement_id || !body.invoice_id) return errorRes("movement_id and invoice_id required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("reconciliation_matches").insert({
        account_id: accountId, bank_transaction_id: body.movement_id, invoice_id: body.invoice_id,
        match_type: "MANUAL", matched_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await supabase.from("bank_transactions").update({ is_reconciled: true }).eq("id", body.movement_id);
      await logAudit(ctx, "CREATE", "reconciliation_match", data.id);
      return jsonRes({ data }, 201);
    }
    case "unmatch": {
      if (method !== "POST") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
      const body = await ctx.req.json();
      if (!body.movement_id) return errorRes("movement_id required", "VALIDATION_ERROR", 422);
      await supabase.from("reconciliation_matches").delete().eq("bank_transaction_id", body.movement_id).eq("account_id", accountId);
      await supabase.from("bank_transactions").update({ is_reconciled: false }).eq("id", body.movement_id);
      await logAudit(ctx, "DELETE", "reconciliation_match", body.movement_id);
      return jsonRes({ data: { unmatched: true } });
    }
    default: return errorRes("Unknown reconciliation endpoint. Use: movements, match, unmatch", "NOT_FOUND", 404);
  }
}

// ─── HR ───
async function handleHR(ctx: ApiContext, parts: string[]) {
  const section = parts[0] || "";
  const rest = parts.slice(1);
  switch (section) {
    case "employees": return handleEmployees(ctx, rest);
    case "leave": return handleLeave(ctx, rest);
    default: return errorRes("Unknown HR endpoint", "NOT_FOUND", 404);
  }
}

async function handleEmployees(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const userId = parts[0] || null;

  switch (method) {
    case "GET": {
      if (userId) {
        const { data, error } = await supabase.from("employee_profiles").select("*")
          .eq("account_id", accountId).eq("user_id", userId).single();
        if (error || !data) return errorRes("Employee not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      const { data, error, count } = await supabase.from("employee_profiles")
        .select("*", { count: "exact" }).eq("account_id", accountId)
        .order("last_name").range(offset, offset + limit - 1);
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "PUT": {
      if (!userId) return errorRes("User ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("employee_profiles").update(body)
        .eq("user_id", userId).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "employee", userId);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!userId) return errorRes("User ID required", "VALIDATION_ERROR", 422);
      await supabase.from("user_accounts").update({ is_active: false })
        .eq("user_id", userId).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "employee", userId);
      return jsonRes({ data: { deactivated: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleLeave(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;
  const action = parts[1] || null;

  if (id && action === "approve" && method === "PUT") {
    const { data, error } = await supabase.from("leave_requests").update({ status: "APPROVED" })
      .eq("id", id).eq("account_id", accountId).select().single();
    if (error) return errorRes("Not found", "NOT_FOUND", 404);
    await logAudit(ctx, "UPDATE", "leave_request", id, { action: "approve" });
    return jsonRes({ data });
  }
  if (id && action === "reject" && method === "PUT") {
    const { data, error } = await supabase.from("leave_requests").update({ status: "REJECTED" })
      .eq("id", id).eq("account_id", accountId).select().single();
    if (error) return errorRes("Not found", "NOT_FOUND", 404);
    await logAudit(ctx, "UPDATE", "leave_request", id, { action: "reject" });
    return jsonRes({ data });
  }

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("leave_requests").select("*")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("leave_requests").select("*", { count: "exact" })
        .eq("account_id", accountId).order("start_date", { ascending: false }).range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const uid = url.searchParams.get("user_id");
      if (uid) q = q.eq("user_id", uid);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.type || !body.start_date || !body.end_date) return errorRes("type, start_date, end_date required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("leave_requests").insert({
        account_id: accountId, user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
        type: body.type, start_date: body.start_date, end_date: body.end_date,
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "leave_request", data.id);
      return jsonRes({ data }, 201);
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("leave_requests").delete().eq("id", id).eq("account_id", accountId).eq("status", "PENDING");
      await logAudit(ctx, "DELETE", "leave_request", id);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── ATTENDANCE ───
async function handleAttendance(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const action = parts[0] || "";

  if (action === "summary" && method === "GET") {
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    let q = supabase.from("attendance_records").select("user_id, check_in, check_out, work_date")
      .eq("account_id", accountId);
    if (dateFrom) q = q.gte("work_date", dateFrom);
    if (dateTo) q = q.lte("work_date", dateTo);
    const { data, error } = await q;
    if (error) throw error;
    const summary: Record<string, { days: number; total_hours: number }> = {};
    for (const r of data || []) {
      if (!summary[r.user_id]) summary[r.user_id] = { days: 0, total_hours: 0 };
      summary[r.user_id].days++;
      if (r.check_in && r.check_out) {
        const hours = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
        summary[r.user_id].total_hours += Math.max(0, hours);
      }
    }
    return jsonRes({ data: Object.entries(summary).map(([user_id, s]) => ({ user_id, ...s })) });
  }

  if (action === "check-in" && method === "POST") {
    const body = await ctx.req.json();
    const { data, error } = await supabase.from("attendance_records").insert({
      account_id: accountId, user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
      work_date: body.work_date || new Date().toISOString().split("T")[0],
      check_in: body.check_in || new Date().toISOString(), source: "API",
    }).select().single();
    if (error) throw error;
    await logAudit(ctx, "CREATE", "attendance", data.id);
    return jsonRes({ data }, 201);
  }

  if (action === "check-out" && method === "POST") {
    const body = await ctx.req.json();
    if (!body.record_id) return errorRes("record_id required", "VALIDATION_ERROR", 422);
    const { data, error } = await supabase.from("attendance_records").update({
      check_out: body.check_out || new Date().toISOString()
    }).eq("id", body.record_id).eq("account_id", accountId).select().single();
    if (error) return errorRes("Record not found", "NOT_FOUND", 404);
    await logAudit(ctx, "UPDATE", "attendance", body.record_id);
    return jsonRes({ data });
  }

  if (action === "manual" && method === "POST") {
    const body = await ctx.req.json();
    if (!body.work_date || !body.check_in || !body.check_out) return errorRes("work_date, check_in, check_out required", "VALIDATION_ERROR", 422);
    const { data, error } = await supabase.from("attendance_records").insert({
      account_id: accountId, user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
      work_date: body.work_date, check_in: body.check_in, check_out: body.check_out, source: "API",
    }).select().single();
    if (error) throw error;
    await logAudit(ctx, "CREATE", "attendance", data.id);
    return jsonRes({ data }, 201);
  }

  // DELETE /attendance/:id
  if (action && method === "DELETE") {
    const { data: rec } = await supabase.from("attendance_records").select("id")
      .eq("id", action).eq("account_id", accountId).single();
    if (!rec) return errorRes("Not found", "NOT_FOUND", 404);
    await supabase.from("attendance_records").delete().eq("id", action).eq("account_id", accountId);
    await logAudit(ctx, "DELETE", "attendance", action);
    return jsonRes({ data: { deleted: true } });
  }

  // GET /attendance
  if (method === "GET") {
    const { page, limit, offset } = parsePagination(url);
    let q = supabase.from("attendance_records").select("*", { count: "exact" })
      .eq("account_id", accountId).order("work_date", { ascending: false }).range(offset, offset + limit - 1);
    const uid = url.searchParams.get("user_id");
    if (uid) q = q.eq("user_id", uid);
    const dateFrom = url.searchParams.get("date_from");
    if (dateFrom) q = q.gte("work_date", dateFrom);
    const dateTo = url.searchParams.get("date_to");
    if (dateTo) q = q.lte("work_date", dateTo);
    const source = url.searchParams.get("source");
    if (source) q = q.eq("source", source.toUpperCase());
    const { data, error, count } = await q;
    if (error) throw error;
    return jsonRes({ data, pagination: { page, limit, total: count } });
  }

  return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

// ─── INVENTORY ───
async function handleInventory(ctx: ApiContext, parts: string[]) {
  const section = parts[0] || "";
  const rest = parts.slice(1);
  switch (section) {
    case "products": return handleProducts(ctx, rest);
    case "movements": return handleStockMovements(ctx, rest);
    case "orders": return handlePurchaseOrders(ctx, rest);
    default: return errorRes("Unknown inventory endpoint", "NOT_FOUND", 404);
  }
}

async function handleProducts(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("products").select("*")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Product not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("products").select("*", { count: "exact" })
        .eq("account_id", accountId).order("name").range(offset, offset + limit - 1);
      const category = url.searchParams.get("category");
      if (category) q = q.eq("category", category);
      const isActive = url.searchParams.get("is_active");
      if (isActive !== null) q = q.eq("is_active", isActive === "true");
      const lowStock = url.searchParams.get("low_stock");
      if (lowStock === "true") q = q.filter("current_stock", "lte", "min_stock");
      const search = url.searchParams.get("search");
      if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.name || !body.sku) return errorRes("name and sku required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("products").insert({
        account_id: accountId, ...body
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "product", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("products").update(body)
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "product", id);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("products").update({ is_active: false })
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "product", id, { action: "deactivate" });
      return jsonRes({ data });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handleStockMovements(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;

  switch (method) {
    case "GET": {
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("stock_movements").select("*, products(id, name, sku)", { count: "exact" })
        .eq("account_id", accountId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const productId = url.searchParams.get("product_id");
      if (productId) q = q.eq("product_id", productId);
      const type = url.searchParams.get("type");
      if (type) q = q.eq("type", type.toUpperCase());
      const dateFrom = url.searchParams.get("date_from");
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      const dateTo = url.searchParams.get("date_to");
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.product_id || !body.type || body.quantity === undefined) {
        return errorRes("product_id, type, quantity required", "VALIDATION_ERROR", 422);
      }
      const { data, error } = await supabase.from("stock_movements").insert({
        account_id: accountId, product_id: body.product_id, type: body.type.toUpperCase(),
        quantity: body.quantity, reason: body.reason || "", notes: body.notes || null,
        created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "stock_movement", data.id);
      return jsonRes({ data }, 201);
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

async function handlePurchaseOrders(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;
  const action = parts[1] || null;

  if (id && action === "status" && method === "PUT") {
    const body = await ctx.req.json();
    const statusFlow: Record<string, string> = { DRAFT: "PENDING", PENDING: "ORDERED", ORDERED: "RECEIVED" };
    const { data: order } = await supabase.from("purchase_orders").select("status, product_id, quantity")
      .eq("id", id).eq("account_id", accountId).single();
    if (!order) return errorRes("Not found", "NOT_FOUND", 404);
    const nextStatus = body.status || statusFlow[order.status];
    if (!nextStatus) return errorRes("Cannot advance status", "VALIDATION_ERROR", 422);

    const { data, error } = await supabase.from("purchase_orders").update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", id).eq("account_id", accountId).select().single();
    if (error) throw error;

    if (nextStatus === "RECEIVED") {
      await supabase.from("stock_movements").insert({
        account_id: accountId, product_id: order.product_id, type: "IN",
        quantity: order.quantity, reason: `Order ${id} received`,
        created_by: "00000000-0000-0000-0000-000000000000",
      });
    }
    await logAudit(ctx, "UPDATE", "purchase_order", id, { status: nextStatus });
    return jsonRes({ data });
  }

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("purchase_orders").select("*, products(id, name, sku)")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("purchase_orders").select("*, products(id, name, sku)", { count: "exact" })
        .eq("account_id", accountId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.product_id || !body.quantity) return errorRes("product_id and quantity required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("purchase_orders").insert({
        account_id: accountId, product_id: body.product_id, quantity: body.quantity,
        estimated_date: body.estimated_date || null, notes: body.notes || null,
        created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "purchase_order", data.id);
      return jsonRes({ data }, 201);
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("purchase_orders").delete().eq("id", id).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "purchase_order", id);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── DOCUMENTS ───
async function handleDocuments(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const section = parts[0] || "";

  if (section === "folders") {
    const folderId = parts[1] || null;
    switch (method) {
      case "GET": {
        let q = supabase.from("document_folders").select("*").eq("account_id", accountId);
        const uid = url.searchParams.get("user_id");
        if (uid) q = q.eq("user_id", uid);
        const { data, error } = await q;
        if (error) throw error;
        return jsonRes({ data });
      }
      case "POST": {
        const body = await ctx.req.json();
        if (!body.user_id || !body.name) return errorRes("user_id and name required", "VALIDATION_ERROR", 422);
        const { data, error } = await supabase.from("document_folders").insert({
          account_id: accountId, user_id: body.user_id, name: body.name,
          created_by: "00000000-0000-0000-0000-000000000000",
        }).select().single();
        if (error) throw error;
        return jsonRes({ data }, 201);
      }
      case "DELETE": {
        if (!folderId) return errorRes("Folder ID required", "VALIDATION_ERROR", 422);
        const { data: docs } = await supabase.from("employee_documents").select("id").eq("folder_id", folderId).limit(1);
        if (docs?.length) return errorRes("Folder not empty", "VALIDATION_ERROR", 422);
        await supabase.from("document_folders").delete().eq("id", folderId).eq("account_id", accountId);
        return jsonRes({ data: { deleted: true } });
      }
      default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    }
  }

  // GET /documents/:id/download
  if (section && parts[1] === "download" && method === "GET") {
    const { data: doc } = await supabase.from("employee_documents").select("file_path")
      .eq("id", section).eq("account_id", accountId).single();
    if (!doc) return errorRes("Not found", "NOT_FOUND", 404);
    const { data: signedUrl } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 3600);
    if (!signedUrl) return errorRes("Could not generate URL", "INTERNAL_ERROR", 500);
    return jsonRes({ data: { url: signedUrl.signedUrl, expires_in: 3600 } });
  }

  // DELETE /documents/:id
  if (section && method === "DELETE") {
    const { data: doc } = await supabase.from("employee_documents").select("file_path")
      .eq("id", section).eq("account_id", accountId).single();
    if (!doc) return errorRes("Not found", "NOT_FOUND", 404);
    await supabase.storage.from("employee-documents").remove([doc.file_path]);
    await supabase.from("employee_documents").delete().eq("id", section);
    await logAudit(ctx, "DELETE", "employee_document", section);
    return jsonRes({ data: { deleted: true } });
  }

  // GET /documents
  if (method === "GET") {
    const { page, limit, offset } = parsePagination(url);
    let q = supabase.from("employee_documents").select("*", { count: "exact" })
      .eq("account_id", accountId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    const folderId = url.searchParams.get("folder_id");
    if (folderId) q = q.eq("folder_id", folderId);
    const uid = url.searchParams.get("user_id");
    if (uid) q = q.eq("user_id", uid);
    const { data, error, count } = await q;
    if (error) throw error;
    return jsonRes({ data, pagination: { page, limit, total: count } });
  }

  return errorRes("Method not allowed or unknown endpoint", "METHOD_NOT_ALLOWED", 405);
}

// ─── NOTIFICATIONS ───
async function handleNotifications(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;
  const action = parts[1] || null;

  if (id === "read-all" && method === "PUT") {
    await supabase.from("notifications").update({ is_read: true }).eq("account_id", accountId).eq("is_read", false);
    return jsonRes({ data: { updated: true } });
  }

  if (id && action === "read" && method === "PUT") {
    const { data, error } = await supabase.from("notifications").update({ is_read: true })
      .eq("id", id).eq("account_id", accountId).select().single();
    if (error) return errorRes("Not found", "NOT_FOUND", 404);
    return jsonRes({ data });
  }

  switch (method) {
    case "GET": {
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("notifications").select("*", { count: "exact" })
        .eq("account_id", accountId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const isRead = url.searchParams.get("is_read");
      if (isRead !== null) q = q.eq("is_read", isRead === "true");
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("notifications").delete().eq("id", id).eq("account_id", accountId);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── SETTINGS ───
async function handleSettings(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const section = parts[0] || "";

  if (section === "schedule") {
    if (method === "PUT") {
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("account_settings").update(body)
        .eq("account_id", accountId).select().single();
      if (error) return errorRes("Settings not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "account_settings", accountId);
      return jsonRes({ data });
    }
    return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  if (section === "modules") {
    if (method !== "GET") return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
    const { data, error } = await supabase.from("account_modules")
      .select("*, service_modules(code, name, description)").eq("account_id", accountId);
    if (error) throw error;
    return jsonRes({ data });
  }

  if (section === "webhooks") {
    return handleWebhooks(ctx, parts.slice(1));
  }

  // GET /settings
  if (method === "GET" && !section) {
    const { data, error } = await supabase.from("account_settings").select("*").eq("account_id", accountId).single();
    if (error) return errorRes("Settings not found", "NOT_FOUND", 404);
    return jsonRes({ data });
  }

  return errorRes("Unknown settings endpoint", "NOT_FOUND", 404);
}

async function handleWebhooks(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method } = ctx;
  const id = parts[0] || null;

  switch (method) {
    case "GET": {
      const { data, error } = await supabase.from("webhooks").select("*").eq("account_id", accountId);
      if (error) throw error;
      return jsonRes({ data });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.url) return errorRes("url is required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("webhooks").insert({
        account_id: accountId, url: body.url, name: body.name || "", events: body.events || [],
        secret: body.secret || crypto.randomUUID(), created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "webhook", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("webhooks").update(body)
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "webhook", id);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("webhooks").delete().eq("id", id).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "webhook", id);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── REMINDERS ───
async function handleReminders(ctx: ApiContext, parts: string[]) {
  const { supabase, accountId, method, url } = ctx;
  const id = parts[0] || null;
  const action = parts[1] || null;

  if (id && action === "complete" && method === "PUT") {
    const { data, error } = await supabase.from("reminders").update({
      is_completed: true, completed_at: new Date().toISOString(), status: "COMPLETED"
    }).eq("id", id).eq("account_id", accountId).select().single();
    if (error) return errorRes("Not found", "NOT_FOUND", 404);
    await logAudit(ctx, "UPDATE", "reminder", id, { action: "complete" });
    return jsonRes({ data });
  }

  switch (method) {
    case "GET": {
      if (id) {
        const { data, error } = await supabase.from("reminders").select("*")
          .eq("account_id", accountId).eq("id", id).single();
        if (error || !data) return errorRes("Not found", "NOT_FOUND", 404);
        return jsonRes({ data });
      }
      const { page, limit, offset } = parsePagination(url);
      let q = supabase.from("reminders").select("*", { count: "exact" })
        .eq("account_id", accountId).order("remind_at").range(offset, offset + limit - 1);
      const isCompleted = url.searchParams.get("is_completed");
      if (isCompleted !== null) q = q.eq("is_completed", isCompleted === "true");
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status.toUpperCase());
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonRes({ data, pagination: { page, limit, total: count } });
    }
    case "POST": {
      const body = await ctx.req.json();
      if (!body.title || !body.remind_at) return errorRes("title and remind_at required", "VALIDATION_ERROR", 422);
      const { data, error } = await supabase.from("reminders").insert({
        account_id: accountId, title: body.title, description: body.description || null,
        remind_at: body.remind_at, entity_type: body.entity_type || null,
        entity_id: body.entity_id || null, entity_label: body.entity_label || null,
        labels: body.labels || [], created_by: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;
      await logAudit(ctx, "CREATE", "reminder", data.id);
      return jsonRes({ data }, 201);
    }
    case "PUT": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      const body = await ctx.req.json();
      const { data, error } = await supabase.from("reminders").update(body)
        .eq("id", id).eq("account_id", accountId).select().single();
      if (error) return errorRes("Not found", "NOT_FOUND", 404);
      await logAudit(ctx, "UPDATE", "reminder", id);
      return jsonRes({ data });
    }
    case "DELETE": {
      if (!id) return errorRes("ID required", "VALIDATION_ERROR", 422);
      await supabase.from("reminders").delete().eq("id", id).eq("account_id", accountId);
      await logAudit(ctx, "DELETE", "reminder", id);
      return jsonRes({ data: { deleted: true } });
    }
    default: return errorRes("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }
}

// ─── MAIN ROUTER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract and validate API key
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = authHeader.replace("Bearer ", "").trim();
    if (!apiKey) return errorRes("API key required. Use Authorization: Bearer <key>", "AUTH_REQUIRED", 401);

    const keyHash = await hashKey(apiKey);
    const { data: apiKeyRow } = await supabase
      .from("api_keys").select("id, account_id").eq("key_hash", keyHash).eq("is_active", true).single();
    if (!apiKeyRow) return errorRes("Invalid or inactive API key", "INVALID_API_KEY", 401);

    const accountId = apiKeyRow.account_id;

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyRow.id);

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts[0] = "public_api", rest = resource segments
    const resource = pathParts[1] || "";
    const rest = pathParts.slice(2);

    const ctx: ApiContext = { supabase, accountId, apiKeyId: apiKeyRow.id, method: req.method, url, req };

    switch (resource) {
      case "clients": return handleClients(ctx, rest);
      case "invoices": return handleInvoices(ctx, rest);
      case "recurring-invoices": return handleRecurringInvoices(ctx, rest);
      case "accounting": return handleAccounting(ctx, rest);
      case "reconciliation": return handleReconciliation(ctx, rest);
      case "hr": return handleHR(ctx, rest);
      case "attendance": return handleAttendance(ctx, rest);
      case "inventory": return handleInventory(ctx, rest);
      case "documents": return handleDocuments(ctx, rest);
      case "notifications": return handleNotifications(ctx, rest);
      case "settings": return handleSettings(ctx, rest);
      case "reminders": return handleReminders(ctx, rest);
      default:
        return jsonRes({
          error: "Unknown resource",
          available_endpoints: [
            "clients", "invoices", "recurring-invoices", "accounting", "reconciliation",
            "hr", "attendance", "inventory", "documents", "notifications", "settings", "reminders"
          ],
          docs: "See /master/api-docs for full documentation",
          pagination: "Use ?page=1&limit=50 (max 100)",
        }, 400);
    }
  } catch (error: any) {
    return errorRes(error.message || "Internal server error", "INTERNAL_ERROR", 500);
  }
});
