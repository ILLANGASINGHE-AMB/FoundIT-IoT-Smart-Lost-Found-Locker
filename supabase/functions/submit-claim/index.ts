import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function hashCredential(credential: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(credential),
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

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Sign in is required." },
        { status: 401, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !userData.user) {
      return Response.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await req.json();
    const matchId = body.match_id;

    if (
      typeof matchId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)
    ) {
      return Response.json(
        { error: "A valid match_id is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const credential = `FI-${hex(randomBytes(12)).toUpperCase()}`;
    const salt = randomBytes(16);
    const credentialHash = await hashCredential(credential, salt);

    const { data: claim, error: insertError } = await admin
      .from("claims")
      .insert({
        match_id: matchId,
        claimant_id: userData.user.id,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();

    if (insertError || !claim) {
      console.error("Claim creation failed:", insertError?.message);
      return Response.json(
        { error: "Could not submit your claim." },
        { status: 500, headers: corsHeaders },
      );
    }

    const { error: secretError } = await admin
      .schema("private")
      .from("claim_secrets")
      .insert({
        claim_id: claim.id,
        credential_hash: credentialHash,
        credential_salt: hex(salt),
      });

    if (secretError) {
      await admin.from("claims").delete().eq("id", claim.id);
      console.error("Credential storage failed:", secretError.message);
      return Response.json(
        { error: "Could not securely create claim credentials." },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json(
      {
        message: "Claim submitted successfully.",
        claim,
        claim_credential: credential,
        warning: "Save this credential securely. It will only be shown once.",
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Unexpected submit-claim error:", error);
    return Response.json(
      { error: "Unexpected server error." },
      { status: 500, headers: corsHeaders },
    );
  }
});
