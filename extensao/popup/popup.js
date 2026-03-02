const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

// --- Helpers ---

function showStatus(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status " + (isError ? "error" : "success");
}

async function supabaseLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

// --- Views ---

function showLoggedIn(email) {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("logged-view").classList.remove("hidden");
  document.getElementById("user-email").textContent = email;
}

// --- Events ---

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) return showStatus("status", "Preencha todos os campos", true);

  showStatus("status", "Entrando...", false);

  try {
    const data = await supabaseLogin(email, password);
    if (data.error || !data.access_token) {
      return showStatus("status", data.error_description || "Credenciais inválidas", true);
    }

    await chrome.storage.local.set({
      risezap_access_token: data.access_token,
      risezap_refresh_token: data.refresh_token,
      risezap_user_email: data.user?.email || email,
      risezap_user_id: data.user?.id,
    });

    showStatus("status", "Login realizado!", false);
    showLoggedIn(data.user?.email || email);
  } catch {
    showStatus("status", "Erro de conexão", true);
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.storage.local.remove([
    "risezap_access_token", "risezap_refresh_token",
    "risezap_user_email", "risezap_user_id",
  ]);
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("logged-view").classList.add("hidden");
  showStatus("status", "", false);
});

// --- Init ---

(async () => {
  const stored = await chrome.storage.local.get([
    "risezap_access_token", "risezap_user_email",
  ]);
  if (stored.risezap_access_token) {
    showLoggedIn(stored.risezap_user_email);
  }
})();
