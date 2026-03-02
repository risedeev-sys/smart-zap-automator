import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("EVOLUTION_WEBHOOK_SECRET") || "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "")
  .replace(/\/+$/, "")
  .replace(/^http:\/\//i, "https://");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

// ── Trigger Engine (duplicated from src/utils/triggerEngine.ts for Deno context) ──

interface TriggerCondition {
  type: string;
  keywords: string[];
}

interface TriggerData {
  id: string;
  name: string;
  enabled: boolean;
  conditions: TriggerCondition[];
  ignore_case: boolean;
  funnel_id: string | null;
  delay_seconds: number;
  send_to_groups: boolean;
  saved_contacts_only: boolean;
}

interface ConditionMatch {
  type: string;
  keyword: string;
}

interface TriggerMatchResult {
  triggerId: string;
  triggerName: string;
  matched: boolean;
  matchedConditions: ConditionMatch[];
  funnelId: string | null;
  delaySeconds: number;
}

function evaluateCondition(
  cond: TriggerCondition,
  rawMessage: string
): { passed: boolean; matches: ConditionMatch[] } {
  const msg = rawMessage;
  const keywords = cond.keywords;
  const matches: ConditionMatch[] = [];

  switch (cond.type) {
    case "contém": {
      for (let i = 0; i < keywords.length; i++) {
        if (msg.includes(keywords[i])) {
          matches.push({ type: cond.type, keyword: keywords[i] });
        }
      }
      return { passed: matches.length > 0, matches };
    }
    case "igual a": {
      for (let i = 0; i < keywords.length; i++) {
        if (msg === keywords[i]) {
          matches.push({ type: cond.type, keyword: keywords[i] });
        }
      }
      return { passed: matches.length > 0, matches };
    }
    case "começa com": {
      for (let i = 0; i < keywords.length; i++) {
        if (msg.startsWith(keywords[i])) {
          matches.push({ type: cond.type, keyword: keywords[i] });
        }
      }
      return { passed: matches.length > 0, matches };
    }
    case "não contém": {
      const noneContained = keywords.every((kw) => !msg.includes(kw));
      if (noneContained) {
        matches.push({ type: cond.type, keyword: "(nenhuma)" });
      }
      return { passed: noneContained, matches };
    }
    default:
      return { passed: false, matches: [] };
  }
}

function evaluateTrigger(trigger: TriggerData, message: string): TriggerMatchResult {
  const allMatches: ConditionMatch[] = [];
  let allPassed = true;

  for (const cond of trigger.conditions) {
    const { passed, matches } = evaluateCondition(cond, message);
    allMatches.push(...matches);
    if (!passed) allPassed = false;
  }

  return {
    triggerId: trigger.id,
    triggerName: trigger.name,
    matched: allPassed && trigger.conditions.length > 0,
    matchedConditions: allMatches,
    funnelId: trigger.funnel_id,
    delaySeconds: trigger.delay_seconds,
  };
}

// ── Helper: Evolution API fetch ──

async function evoFetch(path: string, options: RequestInit = {}) {
  const url = `${EVOLUTION_API_URL}${path}`;
  console.log(`[evoFetch] ${options.method || "GET"} ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
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
      console.error(`[evoFetch] ${res.status}:`, JSON.stringify(data));
      throw new Error(data?.message || `Evolution API error ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Helper: Parse booleans consistently ──

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

// ── Helper: Send a single funnel item ──

async function sendFunnelItem(
  instanceName: string,
  phone: string,
  item: { type: string; asset_id: string },
  supabase: ReturnType<typeof createClient>
) {
  // Resolve the asset
  const table = item.type === "message" ? "messages"
    : item.type === "audio" ? "audios"
    : item.type === "media" ? "medias"
    : item.type === "document" ? "documents"
    : null;

  if (!table) {
    console.warn(`[sendFunnelItem] Unknown type: ${item.type}`);
    return;
  }

  if (item.type === "message") {
    const { data: msg } = await supabase
      .from("messages")
      .select("content")
      .eq("id", item.asset_id)
      .single();

    if (!msg?.content) return;

    await evoFetch(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ number: phone, text: msg.content }),
    });
  } else {
    // Audio, media, document — need signed URL
    const { data: asset } = await supabase
      .from(table)
      .select("storage_path, mime, name, metadata")
      .eq("id", item.asset_id)
      .single();

    if (!asset?.storage_path) return;

    const { data: signedData } = await supabase.storage
      .from("assets")
      .createSignedUrl(asset.storage_path, 300);

    if (!signedData?.signedUrl) return;

    const mediaType = item.type === "audio" ? "audio"
      : item.type === "document" ? "document"
      : (asset.mime?.startsWith("video") ? "video" : "image");

    const mimetypeMap: Record<string, string> = {
      image: "image/jpeg",
      video: "video/mp4",
      audio: "audio/mpeg",
      document: "application/pdf",
    };

    const metadata = (asset as any).metadata || {};
    const isViewOnce = parseBooleanFlag(metadata.singleView) || parseBooleanFlag(metadata.single_view);
    const viewOnceCompat = isViewOnce
      ? { viewOnce: true, viewonce: true, view_once: true }
      : {};

    if (mediaType === "audio") {
      const audioBody: Record<string, unknown> = {
        number: phone,
        audio: signedData.signedUrl,
        audioMessage: {
          audio: signedData.signedUrl,
          ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
        },
        options: {
          encoding: true,
          ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
        },
        ...viewOnceCompat,
      };
      await evoFetch(`/message/sendWhatsAppAudio/${instanceName}`, {
        method: "POST",
        body: JSON.stringify(audioBody),
      });
      return;
    }

    const mimetype = asset.mime || mimetypeMap[mediaType];
    const sendBody: Record<string, unknown> = {
      number: phone,
      mediatype: mediaType,
      media: signedData.signedUrl,
      mimetype,
      caption: metadata.caption || "",
      fileName: asset.name || undefined,
      mediaMessage: {
        mediaType,
        mimetype,
        caption: metadata.caption || "",
        media: signedData.signedUrl,
        fileName: asset.name || undefined,
        ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
      },
      options: {
        ...(isViewOnce ? { viewOnce: true, view_once: true } : {}),
      },
      ...viewOnceCompat,
    };

    await evoFetch(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify(sendBody),
    });
  }
}

// ── Webhook secret validation ──

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

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate webhook token
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!WEBHOOK_SECRET || !timingSafeEqual(token, WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const instanceName = body.instance;

    // Only process incoming messages
    if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const messageData = body.data;
    if (!messageData || !instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Skip messages sent by us (fromMe)
    const key = messageData.key;
    if (key?.fromMe) {
      console.log("[webhook] Skipping own message");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract text from message
    const text =
      messageData.message?.conversation ||
      messageData.message?.extendedTextMessage?.text ||
      "";

    if (!text) {
      console.log("[webhook] No text content, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const senderJid = key?.remoteJid || "";
    const senderPhone = senderJid.replace("@s.whatsapp.net", "").replace("@g.us", "") || "";
    const isGroup = senderJid.endsWith("@g.us") || false;
    const participantName = messageData.pushName || senderPhone;

    console.log(`[webhook] Message from ${senderPhone}: "${text}" (group: ${isGroup})`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the instance and its owner
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, user_id")
      .eq("instance_name", instanceName)
      .eq("status", "open")
      .single();

    if (!instance) {
      console.log(`[webhook] Instance ${instanceName} not found or not open`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Save incoming message for real-time display in Espaço de Teste
    try {
      await supabase.from("whatsapp_incoming_messages").insert({
        user_id: instance.user_id,
        instance_id: instance.id,
        remote_jid: senderJid,
        sender_name: participantName,
        message_text: text,
        is_group: isGroup,
      });
      console.log(`[webhook] Saved incoming message from ${participantName}`);
    } catch (err) {
      console.warn("[webhook] Failed to save incoming message:", err);
    }

    // Load user's triggers
    const { data: triggers } = await supabase
      .from("triggers")
      .select("*")
      .eq("user_id", instance.user_id)
      .eq("enabled", true);

    if (!triggers || triggers.length === 0) {
      console.log("[webhook] No active triggers for user");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter and evaluate triggers
    const activeTriggers: TriggerData[] = (triggers as TriggerData[]).filter((t) => {
      if (isGroup && !t.send_to_groups) return false;
      // Note: saved_contacts_only check would require Evolution API contact lookup
      // For now, we skip this filter in the webhook (can be enhanced later)
      return true;
    });

    const matchedTriggers = activeTriggers
      .map((t) => evaluateTrigger(t, text))
      .filter((r) => r.matched);

    if (matchedTriggers.length === 0) {
      console.log("[webhook] No triggers matched");
      return new Response(JSON.stringify({ ok: true, matched: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[webhook] ${matchedTriggers.length} trigger(s) matched!`);

    // Process each matched trigger
    for (const match of matchedTriggers) {
      const replyTo = isGroup ? key.remoteJid : senderPhone;

      // Apply trigger delay
      if (match.delaySeconds > 0) {
        console.log(`[webhook] Waiting ${match.delaySeconds}s delay for trigger "${match.triggerName}"`);
        await new Promise((r) => setTimeout(r, match.delaySeconds * 1000));
      }

      if (!match.funnelId) {
        console.log(`[webhook] Trigger "${match.triggerName}" matched but has no funnel`);
        continue;
      }

      // Load funnel items
      const { data: funnelItems } = await supabase
        .from("funnel_items")
        .select("type, asset_id, position, delay_min, delay_sec")
        .eq("funnel_id", match.funnelId)
        .eq("user_id", instance.user_id)
        .order("position", { ascending: true });

      if (!funnelItems || funnelItems.length === 0) {
        console.log(`[webhook] Funnel ${match.funnelId} has no items`);
        continue;
      }

      console.log(`[webhook] Executing funnel with ${funnelItems.length} items`);

      // Execute funnel items sequentially with delays
      for (const item of funnelItems) {
        // Item delay
        const itemDelay = (item.delay_min * 60 + item.delay_sec) * 1000;
        if (itemDelay > 0) {
          console.log(`[webhook] Waiting ${itemDelay / 1000}s item delay`);
          await new Promise((r) => setTimeout(r, itemDelay));
        }

        try {
          await sendFunnelItem(instanceName, replyTo, item, supabase);
          console.log(`[webhook] Sent item: ${item.type} (${item.asset_id})`);

          // Log success
          await supabase.from("whatsapp_message_logs").insert({
            user_id: instance.user_id,
            instance_id: instance.id,
            phone: replyTo,
            status: "sent",
          });
        } catch (err) {
          console.error(`[webhook] Failed to send item:`, err);
          await supabase.from("whatsapp_message_logs").insert({
            user_id: instance.user_id,
            instance_id: instance.id,
            phone: replyTo,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, matched: matchedTriggers.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[webhook] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
