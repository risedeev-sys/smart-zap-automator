// Rise Zap — Background Service Worker (token refresh)

const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

async function refreshToken() {
  const { risezap_refresh_token } = await chrome.storage.local.get("risezap_refresh_token");
  if (!risezap_refresh_token) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: risezap_refresh_token }),
    });
    const data = await res.json();
    if (data.access_token) {
      await chrome.storage.local.set({
        risezap_access_token: data.access_token,
        risezap_refresh_token: data.refresh_token,
      });
      console.log("[Rise Zap] Token refreshed");
    }
  } catch (err) {
    console.error("[Rise Zap] Refresh failed:", err);
  }
}

chrome.alarms.create("risezap-refresh", { periodInMinutes: 50 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "risezap-refresh") refreshToken();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Rise Zap] Installed");
  refreshToken();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "RISEZAP_FETCH_FILE_BUFFER") return;

  (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(message.url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        sendResponse({ ok: false, error: `HTTP ${res.status}` });
        return;
      }

      const buffer = await res.arrayBuffer();
      const mime = res.headers.get("content-type") || null;
      sendResponse({ ok: true, buffer, mime });
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    } finally {
      clearTimeout(timeout);
    }
  })();

  return true;
});
