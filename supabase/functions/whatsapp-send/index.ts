import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "")
  .replace(/\/+$/, "")
  .replace(/^http:\/\//i, "https://");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function evoFetch(path: string, options: RequestInit = {}) {
  const url = `${EVOLUTION_API_URL}${path}`;
  console.log(`[evoFetch] ${options.method || "GET"} ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
        ...(options.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[evoFetch] ${res.status} response:`, JSON.stringify(data));
      throw new Error(data?.message || `Evolution API error ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function extractAssetIdFromMediaUrl(mediaUrl: string): string | null {
  const match = mediaUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}

async function inferViewOnceFromAssetMetadata(
  supabase: ReturnType<typeof createClient>,
  mediaUrl?: string,
): Promise<boolean> {
  if (!mediaUrl) return false;

  const assetId = extractAssetIdFromMediaUrl(mediaUrl);
  if (!assetId) return false;

  const tables: Array<"medias" | "audios"> = ["medias", "audios"];

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select("metadata")
      .eq("id", assetId)
      .maybeSingle();

    const metadata = (data as any)?.metadata ?? {};
    if (parseBooleanFlag(metadata?.singleView) || parseBooleanFlag(metadata?.single_view)) {
      return true;
    }
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      instance_id,
      phone,
      text,
      media_url,
      media_type,
      caption,
      view_once,
      viewOnce,
      viewonce,
    } = body;

    if (!instance_id || !phone) {
      throw new Error("instance_id and phone are required");
    }

    // Get instance (RLS ensures user owns it)
    const { data: inst, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, status")
      .eq("id", instance_id)
      .single();

    if (instError || !inst) throw new Error("Instance not found");
    if (inst.status !== "open") throw new Error("Instance is not connected");

    // Service role client for logging (bypasses RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result;

    if (media_url) {
      const validMediaTypes = ["image", "video", "audio", "document"];
      const mediatype = validMediaTypes.includes(media_type) ? media_type : "image";
      const mimetypeMap: Record<string, string> = {
        image: "image/jpeg",
        video: "video/mp4",
        audio: "audio/mpeg",
        document: "application/pdf",
      };

      let isViewOnce =
        parseBooleanFlag(view_once) ||
        parseBooleanFlag(viewOnce) ||
        parseBooleanFlag(viewonce);

      if (!isViewOnce) {
        isViewOnce = await inferViewOnceFromAssetMetadata(supabase, media_url);
      }

      const viewOnceCompat = isViewOnce
        ? { viewOnce: true, viewonce: true, view_once: true }
        : {};

      if (mediatype === "audio") {
        const audioBody: Record<string, unknown> = {
          number: phone,
          audio: media_url,
          audioMessage: {
            audio: media_url,
            ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
          },
          options: {
            encoding: true,
            ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
          },
          ...viewOnceCompat,
        };

        console.log(`[whatsapp-send] media_type=${mediatype} view_once=${isViewOnce}`);

        result = await evoFetch(`/message/sendWhatsAppAudio/${inst.instance_name}`, {
          method: "POST",
          body: JSON.stringify(audioBody),
        });
      } else {
        const mimetype = mimetypeMap[mediatype];
        const sendBody: Record<string, unknown> = {
          number: phone,
          mediatype,
          media: media_url,
          mimetype,
          caption: caption || "",
          mediaMessage: {
            mediaType: mediatype,
            mimetype,
            caption: caption || "",
            media: media_url,
            ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
          },
          options: {
            ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
          },
          ...viewOnceCompat,
        };

        console.log(`[whatsapp-send] media_type=${mediatype} view_once=${isViewOnce}`);

        result = await evoFetch(`/message/sendMedia/${inst.instance_name}`, {
          method: "POST",
          body: JSON.stringify(sendBody),
        });
      }
    } else {
      result = await evoFetch(`/message/sendText/${inst.instance_name}`, {
        method: "POST",
        body: JSON.stringify({
          number: phone,
          text: text || "",
        }),
      });
    }

    // Log success
    await supabaseAdmin.from("whatsapp_message_logs").insert({
      user_id: user.id,
      instance_id,
      phone,
      status: "sent",
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-send error:", err);

    // Log failure (best-effort)
    try {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabaseAdmin.from("whatsapp_message_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        instance_id: "00000000-0000-0000-0000-000000000000",
        phone: "unknown",
        status: "failed",
        error: err instanceof Error ? err.message : "Internal error",
      });
    } catch (_logErr) {
      console.error("Failed to log message error:", _logErr);
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
