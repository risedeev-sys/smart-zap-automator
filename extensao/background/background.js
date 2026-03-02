// Rise Zap - Background Service Worker
// Handles token refresh

const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

async function refreshToken() {
  const stored = await chrome.storage.local.get(["risezap_refresh_token"]);
  if (!stored.risezap_refresh_token) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: stored.risezap_refresh_token }),
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
    console.error("[Rise Zap] Token refresh failed:", err);
  }
}

// Refresh every 50 minutes
chrome.alarms.create("risezap-refresh", { periodInMinutes: 50 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "risezap-refresh") refreshToken();
});

// Initial refresh on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Rise Zap] Extension installed");
  refreshToken();
});
