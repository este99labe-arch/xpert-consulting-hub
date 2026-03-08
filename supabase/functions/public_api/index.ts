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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract API key from Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = authHeader.replace("Bearer ", "").trim();
    if (!apiKey) {
      return jsonRes({ error: "API key required. Use Authorization: Bearer <key>" }, 401);
    }

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: apiKeyRow } = await supabase
      .from("api_keys")
      .select("id, account_id")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (!apiKeyRow) {
      return jsonRes({ error: "Invalid or inactive API key" }, 401);
    }

    const accountId = apiKeyRow.account_id;

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyRow.id);

    // Parse URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Edge function path: /public_api/resource or /public_api/resource/id
    const resource = pathParts[1] || "";
    const resourceId = pathParts[2] || null;

    if (req.method !== "GET") {
      return jsonRes({ error: "Only GET requests are supported" }, 405);
    }

    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    switch (resource) {
      case "clients": {
        if (resourceId) {
          const { data, error } = await supabase
            .from("business_clients")
            .select("id, name, tax_id, email, status, created_at")
            .eq("account_id", accountId)
            .eq("id", resourceId)
            .single();
          if (error || !data) return jsonRes({ error: "Client not found" }, 404);
          return jsonRes({ data });
        }
        const { data, error, count } = await supabase
          .from("business_clients")
          .select("id, name, tax_id, email, status, created_at", { count: "exact" })
          .eq("account_id", accountId)
          .order("name")
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return jsonRes({ data, pagination: { page, limit, total: count } });
      }

      case "invoices": {
        if (resourceId) {
          const { data, error } = await supabase
            .from("invoices")
            .select("id, invoice_number, type, status, concept, amount_net, amount_vat, amount_total, vat_percentage, issue_date, client_id, created_at")
            .eq("account_id", accountId)
            .eq("id", resourceId)
            .single();
          if (error || !data) return jsonRes({ error: "Invoice not found" }, 404);
          return jsonRes({ data });
        }
        const status = url.searchParams.get("status");
        const type = url.searchParams.get("type");
        let query = supabase
          .from("invoices")
          .select("id, invoice_number, type, status, concept, amount_net, amount_vat, amount_total, vat_percentage, issue_date, client_id, created_at", { count: "exact" })
          .eq("account_id", accountId)
          .order("issue_date", { ascending: false })
          .range(offset, offset + limit - 1);
        if (status) query = query.eq("status", status.toUpperCase());
        if (type) query = query.eq("type", type.toUpperCase());
        const { data, error, count } = await query;
        if (error) throw error;
        return jsonRes({ data, pagination: { page, limit, total: count } });
      }

      case "products": {
        if (resourceId) {
          const { data, error } = await supabase
            .from("products")
            .select("id, name, sku, category, unit, current_stock, min_stock, cost_price, sale_price, is_active, created_at")
            .eq("account_id", accountId)
            .eq("id", resourceId)
            .single();
          if (error || !data) return jsonRes({ error: "Product not found" }, 404);
          return jsonRes({ data });
        }
        const { data, error, count } = await supabase
          .from("products")
          .select("id, name, sku, category, unit, current_stock, min_stock, cost_price, sale_price, is_active, created_at", { count: "exact" })
          .eq("account_id", accountId)
          .order("name")
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return jsonRes({ data, pagination: { page, limit, total: count } });
      }

      default:
        return jsonRes({
          error: "Unknown resource",
          available_endpoints: [
            "GET /public_api/clients",
            "GET /public_api/clients/:id",
            "GET /public_api/invoices",
            "GET /public_api/invoices/:id",
            "GET /public_api/invoices?status=PAID&type=INVOICE",
            "GET /public_api/products",
            "GET /public_api/products/:id",
          ],
          pagination: "Use ?page=1&limit=50 (max 100)",
        }, 400);
    }
  } catch (error: any) {
    return jsonRes({ error: error.message }, 500);
  }
});

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
