import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { import_id } = await req.json();
    if (!import_id) throw new Error("import_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the import record
    const { data: importRecord, error: fetchErr } = await supabase
      .from("invoice_imports")
      .select("*")
      .eq("id", import_id)
      .single();

    if (fetchErr || !importRecord) throw new Error("Import record not found");

    // Download the file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("import-files")
      .download(importRecord.file_path);

    if (dlErr || !fileData) {
      await supabase.from("invoice_imports").update({
        status: "ERROR",
        error_message: "No se pudo descargar el archivo",
      }).eq("id", import_id);
      throw new Error("Could not download file");
    }

    // Convert file to base64 for AI vision
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = importRecord.file_type || "application/octet-stream";

    // Determine if it's an image or PDF
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      await supabase.from("invoice_imports").update({
        status: "ERROR",
        error_message: "Formato de archivo no soportado para extracción automática. Suba una imagen o PDF.",
      }).eq("id", import_id);
      return new Response(JSON.stringify({ success: false, error: "Unsupported format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI request with vision
    const systemPrompt = `Eres un asistente experto en extraer datos de facturas y gastos de documentos escaneados.
Analiza el documento proporcionado y extrae los siguientes campos. Si no puedes identificar un campo, déjalo como null.
Responde ÚNICAMENTE con el JSON estructurado, sin texto adicional.

Los campos a extraer son:
- type: "INVOICE" (si es una factura de ingreso/venta) o "EXPENSE" (si es un gasto/compra)
- concept: Descripción o concepto principal del documento
- client_name: Nombre del proveedor o cliente
- client_tax_id: NIF/CIF del proveedor o cliente  
- amount_net: Importe neto (base imponible) como número
- vat_percentage: Porcentaje de IVA aplicado como número
- amount_vat: Importe del IVA como número
- irpf_percentage: Porcentaje de IRPF (retención) como número, 0 si no aplica
- irpf_amount: Importe del IRPF como número, 0 si no aplica
- amount_total: Importe total como número
- issue_date: Fecha de emisión en formato YYYY-MM-DD
- invoice_number_original: Número de factura original del documento
- lines: Array de líneas con {description, quantity, unit_price, amount}
- confidence: Un número del 0 al 100 indicando tu confianza en la extracción

Responde con un JSON válido.`;

    const userContent: any[] = [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
        },
      },
      {
        type: "text",
        text: "Extrae todos los datos de esta factura o gasto. Responde solo con JSON.",
      },
    ];

    console.log(`Processing import ${import_id}, file: ${importRecord.file_name}, type: ${mimeType}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      const errorMsg = aiResponse.status === 429
        ? "Límite de peticiones excedido. Intente de nuevo en unos minutos."
        : aiResponse.status === 402
        ? "Créditos de IA agotados."
        : "Error al procesar con IA";

      await supabase.from("invoice_imports").update({
        status: "ERROR",
        error_message: errorMsg,
      }).eq("id", import_id);

      return new Response(JSON.stringify({ success: false, error: errorMsg }), {
        status: aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (may be wrapped in ```json ... ```)
    let extracted: any = null;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      await supabase.from("invoice_imports").update({
        status: "ERROR",
        error_message: "No se pudieron extraer los datos automáticamente. Revise manualmente.",
      }).eq("id", import_id);

      return new Response(JSON.stringify({ success: false, error: "Parse error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine status based on confidence
    const confidence = extracted.confidence ?? 0;
    const newStatus = confidence >= 60 ? "READY" : "ERROR";
    const errorMsg = confidence < 60
      ? "Confianza baja en la extracción. Revise los datos manualmente."
      : null;

    await supabase.from("invoice_imports").update({
      status: newStatus,
      extracted_data: extracted,
      error_message: errorMsg,
    }).eq("id", import_id);

    console.log(`Import ${import_id} processed: status=${newStatus}, confidence=${confidence}`);

    return new Response(JSON.stringify({ success: true, status: newStatus, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract_invoice_data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
