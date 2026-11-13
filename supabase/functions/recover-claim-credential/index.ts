
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashCredential(
  code: string,
  salt: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  return hex(new Uint8Array(bits));
}

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

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return respond({ error: "Authentication required" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(url, anonKey);

  const { data: authData, error: authError } =
    await authClient.auth.getUser(authorization.slice(7));

  if (authError || !authData.user) {
    return respond({ error: "Invalid session" }, 401);
  }

  let body: { claim_id?: string };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  const claimId = body.claim_id;

  if (!claimId || !/^[0-9a-f-]{36}$/i.test(claimId)) {
    return respond({ error: "Valid claim_id is required" }, 400);
  }

  const admin = createClient(url, serviceKey);

  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select("id, claimant_id, status")
    .eq("id", claimId)
    .maybeSingle();

  if (claimError) {
    console.error("Claim lookup failed:", claimError);
    return respond({ error: "Could not retrieve claim" }, 500);
  }

  if (!claim || claim.claimant_id !== authData.user.id) {
    return respond(
      { error: "Claim not found or not authorized" },
      404,
    );
  }

  if (claim.status === "rejected" || claim.status === "collected") {
    return respond(
      { error: "Credential recovery is unavailable for this claim" },
      409,
    );
  }

  // Generate a new credential; the old credential becomes invalid.
  const random = crypto.getRandomValues(new Uint8Array(12));
  const credential = `FI-${hex(random).toUpperCase()}`;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const credentialHash = await hashCredential(credential, salt);

  const { data: rotated, error: rotateError } = await admin.rpc(
    "rotate_claim_secret",
    {
      p_claim_id: claimId,
      p_credential_hash: credentialHash,
      p_credential_salt: hex(salt),
    },
  );

  if (rotateError || rotated !== true) {
    console.error("Credential rotation failed:", rotateError);
    return respond(
      { error: "Could not recover claim credential" },
      500,
    );
  }

  return respond({
    message: "New claim credential generated successfully",
    claim_id: claimId,
    credential,
    warning: "Save this credential securely. It will only be shown once.",
  });
});
