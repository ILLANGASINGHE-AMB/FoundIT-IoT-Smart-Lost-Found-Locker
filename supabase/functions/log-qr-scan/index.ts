
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: object, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  let body: { qr_slug?: string };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  const slug = body.qr_slug?.trim();

  if (!slug || !/^[a-zA-Z0-9-]{6,100}$/.test(slug)) {
    return respond({ error: "Invalid QR slug" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(url, serviceKey);

  const { data: point, error: pointError } = await admin
    .from("collection_points")
    .select("id, name, address, qr_active, is_active")
    .eq("qr_slug", slug)
    .maybeSingle();

  if (pointError) {
    console.error("QR lookup failed:", pointError);
    return respond({ error: "Could not check QR code" }, 500);
  }

  if (!point || !point.qr_active || !point.is_active) {
    return respond(
      { error: "This QR code is invalid or inactive" },
      404,
    );
  }

  const { error: scanError } = await admin
    .from("qr_scans")
    .insert({
      collection_point_id: point.id,
      scanned_at: new Date().toISOString(),
    });

  if (scanError) {
    console.error("QR scan logging failed:", scanError);
    return respond({ error: "Could not record QR scan" }, 500);
  }

  return respond({
    success: true,
    message: "QR scan recorded successfully",
    collection_point: {
      id: point.id,
      name: point.name,
      address: point.address,
    },
  });
});
