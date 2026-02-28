import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// --- Evolution API Client ---
async function evoFetch(path: string, options: RequestInit = {}) {
  const url = `${EVOLUTION_API_URL}${path}`;
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
    if (!res.ok) throw new Error(data?.message || `Evolution API error ${res.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function createInstance(name: string, webhookUrl: string) {
  return evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: name,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: ["CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    }),
  });
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

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return { userId: data.claims.sub as string, supabase };
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
    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-status-webhook?token=${webhookSecret}`;

    let result: unknown;

    switch (action) {
      case "instance-create": {
        if (!instance_name) throw new Error("instance_name is required");
        const evoResult = await createInstance(instance_name, webhookUrl);
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

      case "instance-list": {
        const { data, error } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_name, status, phone_number, qr_code, created_at, updated_at")
          .order("created_at", { ascending: true });
        if (error) throw error;
        result = data;
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
