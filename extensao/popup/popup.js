const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

async function supabaseAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function fetchInstances(accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/whatsapp_instances?status=eq.open&select=id,instance_name,phone_number`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return res.json();
}

function showStatus(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status " + (isError ? "error" : "success");
}

async function init() {
  const stored = await chrome.storage.local.get([
    "risezap_access_token",
    "risezap_refresh_token",
    "risezap_user_email",
    "risezap_instance_id",
  ]);

  if (stored.risezap_access_token) {
    showLoggedIn(stored.risezap_user_email, stored.risezap_access_token, stored.risezap_instance_id);
  }
}

async function showLoggedIn(email, accessToken, savedInstanceId) {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("logged-view").classList.remove("hidden");
  document.getElementById("user-email").textContent = email;

  // Load instances
  try {
    const instances = await fetchInstances(accessToken);
    const select = document.getElementById("instance-select");
    select.innerHTML = "";

    if (!instances.length) {
      select.innerHTML = '<option value="">Nenhuma instância conectada</option>';
      return;
    }

    instances.forEach((inst) => {
      const opt = document.createElement("option");
      opt.value = inst.id;
      opt.textContent = inst.instance_name + (inst.phone_number ? ` (${inst.phone_number})` : "");
      select.appendChild(opt);
    });

    if (savedInstanceId) {
      select.value = savedInstanceId;
    }

    select.addEventListener("change", () => {
      chrome.storage.local.set({ risezap_instance_id: select.value });
    });

    // Save first instance if none saved
    if (!savedInstanceId && instances.length > 0) {
      chrome.storage.local.set({ risezap_instance_id: instances[0].id });
    }
  } catch (err) {
    showStatus("status2", "Erro ao carregar instâncias", true);
  }
}

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showStatus("status", "Preencha todos os campos", true);
    return;
  }

  showStatus("status", "Entrando...", false);

  try {
    const data = await supabaseAuth(email, password);

    if (data.error || !data.access_token) {
      showStatus("status", data.error_description || "Credenciais inválidas", true);
      return;
    }

    await chrome.storage.local.set({
      risezap_access_token: data.access_token,
      risezap_refresh_token: data.refresh_token,
      risezap_user_email: data.user?.email || email,
      risezap_user_id: data.user?.id,
    });

    showStatus("status", "Login realizado!", false);
    showLoggedIn(data.user?.email || email, data.access_token, null);
  } catch (err) {
    showStatus("status", "Erro de conexão", true);
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.storage.local.remove([
    "risezap_access_token",
    "risezap_refresh_token",
    "risezap_user_email",
    "risezap_user_id",
    "risezap_instance_id",
  ]);
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("logged-view").classList.add("hidden");
  showStatus("status", "", false);
});

init();
