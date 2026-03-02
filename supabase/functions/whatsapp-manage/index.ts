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

// --- Evolution API Client ---
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
      console.error(`[evoFetch] ${res.status} response:`, JSON.stringify(data));
      throw new Error(data?.message || `Evolution API error ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function setMessageWebhook(name: string, messageWebhookUrl: string) {
  await evoFetch(`/webhook/set/${name}`, {
    method: "POST",
    body: JSON.stringify({
      url: messageWebhookUrl,
      webhook_by_events: true,
      webhook_base64: true,
      events: ["MESSAGES_UPSERT", "messages.upsert"],
    }),
  });
}

async function createInstance(name: string, statusWebhookUrl: string, messageWebhookUrl: string) {
  // Create instance with status webhook
  const result = await evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: name,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: statusWebhookUrl,
        byEvents: false,
        base64: true,
        events: ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"],
      },
    }),
  });

  // Also set the message webhook via the webhook/set endpoint
  try {
    await setMessageWebhook(name, messageWebhookUrl);
    console.log(`[createInstance] Message webhook set for ${name}`);
  } catch (err) {
    console.warn(`[createInstance] Failed to set message webhook:`, err);
  }

  return result;
}

async function getConnectionState(name: string) {
  return evoFetch(`/instance/connectionState/${name}`);
}

async function connectInstance(name: string) {
  return evoFetch(`/instance/connect/${name}`);
}

async function deleteInstance(name: string) {
  // Logout first, then delete
  try { await evoFetch(`/instance/logout/${name}`, { method: "DELETE" }); } catch { /* ok */ }
  return evoFetch(`/instance/delete/${name}`, { method: "DELETE" });
}

// --- Auth helper ---
async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { userId: user.id, supabase };
}

// --- Handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, supabase } = auth;
    const { action, instance_name, instance_id } = await req.json();

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const webhookSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET") || "";
    const statusWebhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-status-webhook?token=${webhookSecret}`;
    const messageWebhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-message-webhook?token=${webhookSecret}`;

    let result: unknown;

    switch (action) {
      case "instance-create": {
        if (!instance_name) throw new Error("instance_name is required");
        const evoResult = await createInstance(instance_name, statusWebhookUrl, messageWebhookUrl);
        const qrBase64 = evoResult?.qrcode?.base64 || null;

        const { data, error } = await serviceClient
          .from("whatsapp_instances")
          .insert({
            user_id: userId,
            instance_name,
            status: qrBase64 ? "connecting" : "disconnected",
            qr_code: qrBase64,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "instance-connect": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        const evoResult = await connectInstance(inst.instance_name);
        const qrBase64 = evoResult?.base64 || null;

        try {
          await setMessageWebhook(inst.instance_name, messageWebhookUrl);
          console.log(`[instance-connect] Message webhook ensured for ${inst.instance_name}`);
        } catch (err) {
          console.warn(`[instance-connect] Failed to ensure message webhook:`, err);
        }

        if (qrBase64) {
          await serviceClient
            .from("whatsapp_instances")
            .update({ qr_code: qrBase64, status: "connecting", updated_at: new Date().toISOString() })
            .eq("id", instance_id);
        }

        result = { qr_code: qrBase64, status: "connecting" };
        break;
      }

      case "instance-disconnect": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        try { await evoFetch(`/instance/logout/${inst.instance_name}`, { method: "DELETE" }); } catch { /* ok */ }

        await serviceClient
          .from("whatsapp_instances")
          .update({ status: "disconnected", qr_code: null, phone_number: null, updated_at: new Date().toISOString() })
          .eq("id", instance_id);

        result = { status: "disconnected" };
        break;
      }

      case "instance-delete": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        try { await deleteInstance(inst.instance_name); } catch { /* ok */ }

        await serviceClient
          .from("whatsapp_instances")
          .delete()
          .eq("id", instance_id);

        result = { deleted: true };
        break;
      }

      case "instance-status": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        const state = await getConnectionState(inst.instance_name);
        const status = state?.instance?.state || "disconnected";

        await serviceClient
          .from("whatsapp_instances")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", instance_id);

        result = { status };
        break;
      }

      case "instance-ensure-webhooks": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        await setMessageWebhook(inst.instance_name, messageWebhookUrl);
        result = { ok: true };
        break;
      }

      case "instance-list": {
        const { data, error } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_name, status, phone_number, qr_code, created_at, updated_at")
          .order("created_at", { ascending: true });
        if (error) throw error;
        result = data;
        break;
      }

      case "fetch-chats": {
        if (!instance_id) throw new Error("instance_id is required");
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .single();
        if (!inst) throw new Error("Instance not found");

        // Fetch chats AND contacts in parallel for best data
        const [chats, contactsRaw] = await Promise.all([
          evoFetch(`/chat/findChats/${inst.instance_name}`, {
            method: "POST",
            body: JSON.stringify({ where: {} }),
          }),
          evoFetch(`/chat/findContacts/${inst.instance_name}`, {
            method: "POST",
            body: JSON.stringify({ where: {} }),
          }).catch(() => []),
        ]);

        const chatArray = Array.isArray(chats) ? chats : [];
        const contactArray = Array.isArray(contactsRaw) ? contactsRaw : [];

        // Log raw structure for debugging
        if (chatArray.length > 0) {
          console.log("[fetch-chats] Chat keys:", Object.keys(chatArray[0]));
          console.log("[fetch-chats] Chat sample:", JSON.stringify(chatArray[0]).slice(0, 800));
        }
        if (contactArray.length > 0) {
          console.log("[fetch-chats] Contact keys:", Object.keys(contactArray[0]));
          console.log("[fetch-chats] Contact sample:", JSON.stringify(contactArray[0]).slice(0, 500));
        }

        // Build name lookup from contacts endpoint (remoteJid -> name)
        const nameMap: Record<string, string> = {};
        for (const ct of contactArray) {
          const jid = ct.remoteJid || "";
          const name = ct.pushName || ct.name || "";
          if (jid && name) nameMap[jid] = name;
        }
        console.log(`[fetch-chats] Name map: ${Object.keys(nameMap).length} entries`);

        // Extract WhatsApp JID from chat object
        const getJid = (c: any): string => {
          for (const val of [c.remoteJid, c.jid, c.chatId, c.id]) {
            if (typeof val === "string" && (val.endsWith("@s.whatsapp.net") || val.endsWith("@g.us"))) {
              return val;
            }
          }
          if (c.contact?.remoteJid) return c.contact.remoteJid;
          return "";
        };

        const sorted = chatArray
          .map((c: any) => ({ ...c, _jid: getJid(c) }))
          .filter((c: any) => c._jid && !c._jid.endsWith("@newsletter"))
          .sort((a: any, b: any) => {
            const ta = a.lastMsgTimestamp || a.conversationTimestamp || a.updatedAt || 0;
            const tb = b.lastMsgTimestamp || b.conversationTimestamp || b.updatedAt || 0;
            return (typeof tb === "number" ? tb : 0) - (typeof ta === "number" ? ta : 0);
          })
          .slice(0, 20);

        console.log(`[fetch-chats] ${chatArray.length} chats total, ${sorted.length} with valid JIDs`);

        result = sorted.map((c: any) => {
          const jid = c._jid;
          const phone = jid.split("@")[0];
          const isGroup = jid.endsWith("@g.us");
          const displayName = isGroup
            ? (c.subject || c.name || nameMap[jid] || phone)
            : (nameMap[jid] || c.name || c.pushName || c.contact?.pushName || phone || "Desconhecido");

          // Extract last message with sender prefix for groups
          let lastMsg = c.lastMessage?.message?.conversation
            || c.lastMessage?.message?.extendedTextMessage?.text
            || c.lastMessage?.body || "";
          if (isGroup && lastMsg && c.lastMessage?.key?.participant) {
            const senderJid = c.lastMessage.key.participant;
            const senderName = nameMap[senderJid] || senderJid.split("@")[0];
            const shortName = senderName.split(" ")[0];
            lastMsg = `${shortName}: ${lastMsg}`;
          }

          return {
            remoteJid: jid,
            name: displayName,
            lastMessage: lastMsg,
            timestamp: c.lastMsgTimestamp || c.conversationTimestamp || 0,
            isGroup,
            unreadCount: c.unreadCount ?? c.unreadMessages ?? 0,
            profilePicUrl: c.profilePictureUrl || c.profilePicUrl || "",
          };
        });
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-manage error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
