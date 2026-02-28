import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("EVOLUTION_WEBHOOK_SECRET") || "";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate token
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!WEBHOOK_SECRET || !timingSafeEqual(token, WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const instanceName = body.instance;

    if (!instanceName) {
      return new Response("Missing instance", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = body.data?.state || body.data?.status || "disconnected";
      
      const updateData: Record<string, unknown> = {
        status: state,
        updated_at: new Date().toISOString(),
      };

      // If connected (open), clear QR code
      if (state === "open") {
        updateData.qr_code = null;
        // Try to extract phone number
        const phone = body.data?.phoneNumber || body.data?.wuid?.replace("@s.whatsapp.net", "") || null;
        if (phone) updateData.phone_number = phone;
      }

      // If disconnected, clear QR and phone
      if (state === "close" || state === "disconnected") {
        updateData.qr_code = null;
      }

      await supabase
        .from("whatsapp_instances")
        .update(updateData)
        .eq("instance_name", instanceName);

      console.log(`[webhook] CONNECTION_UPDATE: ${instanceName} → ${state}`);
    }

    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const base64 = body.data?.qrcode?.base64 || body.data?.base64 || null;

      if (base64) {
        await supabase
          .from("whatsapp_instances")
          .update({
            qr_code: base64,
            status: "connecting",
            updated_at: new Date().toISOString(),
          })
          .eq("instance_name", instanceName);

        console.log(`[webhook] QRCODE_UPDATED: ${instanceName}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
