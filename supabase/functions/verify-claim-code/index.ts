st:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/verify-claim-code' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"
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

function fromHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error("Invalid stored credential data");
  }

  return new Uint8Array(
    value.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
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

  let body: {
    claim_id?: string;
    credential?: string;
  };

  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  const claimId = body.claim_id;
  const credential = body.credential?.trim().toUpperCase();

  if (!claimId || !/^[0-9a-f-]{36}$/i.test(claimId)) {
    return respond({ error: "Valid claim_id is required" }, 400);
  }

  if (!credential || !/^FI-[0-9A-F]{24}$/.test(credential)) {
    return respond({ error: "Invalid credential format" }, 400);
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

  if (!claim) {
    return respond({ error: "Claim not found" }, 404);
  }

  const role = authData.user.app_metadata?.role;
  const isStaff = role === "officer" || role === "admin";

  if (claim.claimant_id !== authData.user.id && !isStaff) {
    return respond(
      { error: "Not authorized to verify this claim" },
      403,
    );
  }

  if (claim.status !== "verified") {
    return respond(
      { error: "Claim must be approved before collection" },
      409,
    );
  }

  const { data: secrets, error: secretError } = await admin.rpc(
    "get_claim_secret",
    { p_claim_id: claimId },
  );

  if (secretError) {
    console.error("Secret retrieval failed:", secretError);
    return respond(
      { error: "Could not retrieve claim credentials" },
      500,
    );
  }

  const secret = secrets?.[0];

  if (!secret) {
    return respond({ error: "Claim credential not found" }, 404);
  }

  if (secret.locked_at || secret.failed_attempts >= 5) {
    return respond({ error: "Claim credential is locked" }, 423);
  }

  let valid: boolean;

  try {
    const calculatedHash = await hashCredential(
      credential,
      fromHex(secret.credential_salt),
    );

    valid = safeEqual(calculatedHash, secret.credential_hash);
  } catch (error) {
    console.error("Credential comparison failed:", error);
    return respond(
      { error: "Credential verification failed" },
      500,
    );
  }

  // Record the attempt and update the lock counter securely.
  const { data: attemptResult, error: attemptError } =
    await admin.rpc("record_claim_attempt", {
      p_claim_id: claimId,
      p_success: valid,
    });

  if (attemptError) {
    console.error("Attempt recording failed:", attemptError);

    if (attemptError.message?.toLowerCase().includes("locked")) {
      return respond({ error: "Claim credential is locked" }, 423);
    }

    return respond(
      { error: "Could not record verification attempt" },
      500,
    );
  }

  const attempt = attemptResult?.[0];

  if (!valid) {
    return respond(
      {
        valid: false,
        attempts_remaining: Math.max(
          0,
          5 - (attempt?.failed_attempts ?? 5),
        ),
        locked: attempt?.locked ?? false,
      },
      attempt?.locked ? 423 : 401,
    );
  }

  return respond({
    valid: true,
    message: "Claim credential verified successfully",
  });
});
name":"Functions"}'

*/
