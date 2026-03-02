// Rise Zap — Content Script (barra no WhatsApp Web)
(function () {
  "use strict";

  let token = null;
  let instanceId = null;

  // --- Auth ---

  async function loadAuth() {
    const stored = await chrome.storage.local.get(["risezap_access_token", "risezap_instance_id"]);
    token = stored.risezap_access_token || null;
    instanceId = stored.risezap_instance_id || null;
  }

  // --- Bar ---

  function createBar() {
    const old = document.getElementById("risezap-bar");
    if (old) old.remove();

    const bar = document.createElement("div");
    bar.id = "risezap-bar";

    if (!token) {
      bar.innerHTML = `
        <span class="rz-logo">⚡</span>
        <span class="rz-login-msg">Rise Zap — Faça login no popup da extensão</span>
      `;
    } else {
      bar.innerHTML = `<span class="rz-logo">⚡</span>`;
    }

    document.body.appendChild(bar);
  }

  // --- Init ---

  async function init() {
    await loadAuth();
    createBar();

    // React to login/logout from popup
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.risezap_access_token || changes.risezap_instance_id) {
        await loadAuth();
        createBar();
      }
    });

    // Re-inject if WhatsApp removes it
    setInterval(() => {
      if (!document.getElementById("risezap-bar")) createBar();
    }, 3000);
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
