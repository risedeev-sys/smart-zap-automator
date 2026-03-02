// Rise Zap - Content Script for WhatsApp Web
(function () {
  "use strict";

  const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

  let cachedToken = null;
  let cachedInstanceId = null;
  let cachedAssets = { messages: [], audios: [], medias: [], documents: [], funnels: [] };

  // ─── Supabase Helpers ────────────────────────────────────

  async function getAuth() {
    const stored = await chrome.storage.local.get([
      "risezap_access_token",
      "risezap_instance_id",
    ]);
    cachedToken = stored.risezap_access_token || null;
    cachedInstanceId = stored.risezap_instance_id || null;
    return { token: cachedToken, instanceId: cachedInstanceId };
  }

  async function supabaseFetch(table, select = "*") {
    if (!cachedToken) return [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${cachedToken}`,
          },
        }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async function loadAssets() {
    const [messages, audios, medias, documents, funnels] = await Promise.all([
      supabaseFetch("messages", "id,name,content"),
      supabaseFetch("audios", "id,name,storage_path,mime"),
      supabaseFetch("medias", "id,name,storage_path,mime,metadata"),
      supabaseFetch("documents", "id,name,storage_path,mime"),
      supabaseFetch("funnels", "id,name,favorite"),
    ]);
    cachedAssets = { messages, audios, medias, documents, funnels };
    return cachedAssets;
  }

  // ─── Phone Extraction ───────────────────────────────────

  function getCurrentPhone() {
    // Try to get phone from the chat header
    const header = document.querySelector("#main header");
    if (!header) return null;

    const titleSpan = header.querySelector("span[dir='auto']");
    if (!titleSpan) return null;

    const text = titleSpan.textContent.trim();
    // Match phone patterns like +55 11 96455-8771
    const digits = text.replace(/\D/g, "");
    if (digits.length >= 10) return digits;
    return null;
  }

  // ─── Send via Edge Function ─────────────────────────────

  async function sendMessage(opts) {
    if (!cachedToken || !cachedInstanceId) {
      showToast("Configure a instância no popup da extensão", true);
      return false;
    }

    const phone = getCurrentPhone();
    if (!phone) {
      showToast("Abra um chat para enviar", true);
      return false;
    }

    try {
      const body = { instance_id: cachedInstanceId, phone, ...opts };
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cachedToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || "Erro ao enviar", true);
        return false;
      }
      showToast("Mensagem enviada! ✓");
      return true;
    } catch (err) {
      showToast("Erro de conexão", true);
      return false;
    }
  }

  function getPublicUrl(storagePath) {
    return `${SUPABASE_URL}/storage/v1/object/public/assets/${storagePath}`;
  }

  // ─── Toast ──────────────────────────────────────────────

  function showToast(msg, isError = false) {
    const existing = document.getElementById("risezap-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "risezap-toast";
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "52px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "8px 20px",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "600",
      zIndex: "100001",
      background: isError ? "#dc2626" : "#00a884",
      color: "white",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      fontFamily: "'Segoe UI', sans-serif",
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── Modal ──────────────────────────────────────────────

  function closeModal() {
    const overlay = document.getElementById("risezap-overlay");
    if (overlay) overlay.remove();
  }

  function openModal(title, bodyHTML) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.id = "risezap-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    overlay.innerHTML = `
      <div id="risezap-modal">
        <div class="rz-modal-header">
          <h3>${title}</h3>
          <button class="rz-modal-close">&times;</button>
        </div>
        <div class="rz-modal-body">${bodyHTML}</div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector(".rz-modal-close").addEventListener("click", closeModal);
    return overlay;
  }

  // ─── Preview & Send Flows ───────────────────────────────

  function showPreview(title, content, onSend) {
    const html = `
      <div class="rz-preview">
        <div class="rz-bubble">${escapeHtml(content)}</div>
        <div class="rz-actions">
          <button class="rz-btn-cancel">Cancelar</button>
          <button class="rz-btn-send">Enviar ✓</button>
        </div>
      </div>
    `;
    const overlay = openModal(title, html);
    overlay.querySelector(".rz-btn-cancel").addEventListener("click", closeModal);
    overlay.querySelector(".rz-btn-send").addEventListener("click", async () => {
      const btn = overlay.querySelector(".rz-btn-send");
      btn.textContent = "Enviando...";
      btn.disabled = true;
      const ok = await onSend();
      if (ok) closeModal();
      else {
        btn.textContent = "Enviar ✓";
        btn.disabled = false;
      }
    });
  }

  function showAssetList(title, items, onSelect) {
    if (!items.length) {
      openModal(title, '<div class="rz-empty">Nenhum item cadastrado no painel</div>');
      return;
    }

    const listHTML = items
      .map(
        (item) => `
        <div class="rz-list-item" data-id="${item.id}" style="
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 1px solid #2a3942;
          color: #e9edef;
          font-size: 14px;
          transition: background 0.15s;
        " onmouseover="this.style.background='#2a3942'" onmouseout="this.style.background='transparent'">
          ${escapeHtml(item.name)}
        </div>
      `
      )
      .join("");

    const overlay = openModal(title, listHTML);
    overlay.querySelectorAll(".rz-list-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const item = items.find((i) => i.id === id);
        if (item) onSelect(item);
      });
    });
  }

  // ─── Button Handlers ───────────────────────────────────

  function handleMessageClick() {
    const msgs = cachedAssets.messages;
    showAssetList("📩 Mensagens", msgs, (msg) => {
      showPreview("Enviar Mensagem", msg.content || msg.name, () =>
        sendMessage({ text: msg.content || msg.name })
      );
    });
  }

  function handleAudioClick() {
    const items = cachedAssets.audios;
    showAssetList("🎵 Áudios", items, (audio) => {
      if (!audio.storage_path) {
        showToast("Áudio sem arquivo", true);
        return;
      }
      const url = getPublicUrl(audio.storage_path);
      showPreview("Enviar Áudio", `🎵 ${audio.name}`, () =>
        sendMessage({ media_url: url, media_type: "audio", mime: audio.mime })
      );
    });
  }

  function handleMediaClick() {
    const items = cachedAssets.medias;
    showAssetList("🖼 Mídias", items, (media) => {
      if (!media.storage_path) {
        showToast("Mídia sem arquivo", true);
        return;
      }
      const url = getPublicUrl(media.storage_path);
      const isVideo = (media.mime || "").startsWith("video");
      showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${media.name}`, () =>
        sendMessage({
          media_url: url,
          media_type: isVideo ? "video" : "image",
          mime: media.mime,
        })
      );
    });
  }

  function handleDocumentClick() {
    const items = cachedAssets.documents;
    showAssetList("📄 Documentos", items, (doc) => {
      if (!doc.storage_path) {
        showToast("Documento sem arquivo", true);
        return;
      }
      const url = getPublicUrl(doc.storage_path);
      showPreview("Enviar Documento", `📄 ${doc.name}`, () =>
        sendMessage({
          media_url: url,
          media_type: "document",
          mime: doc.mime,
          file_name: doc.name,
        })
      );
    });
  }

  function handleFunnelClick(funnel) {
    showPreview("Disparar Funil", `🎯 ${funnel.name}\n\nTodos os itens do funil serão enviados em sequência.`, async () => {
      // Load funnel items
      const items = await supabaseFetch(
        "funnel_items",
        "id,type,asset_id,delay_min,delay_sec,position"
      );
      const funnelItems = items
        .filter((i) => i.funnel_id === funnel.id)
        .sort((a, b) => a.position - b.position);

      // For now just indicate it would send
      showToast(`Funil "${funnel.name}" com ${funnelItems.length} itens`);
      return true;
    });
  }

  // ─── Utility ────────────────────────────────────────────

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  // ─── Build Bar ──────────────────────────────────────────

  function createBar() {
    const existing = document.getElementById("risezap-bar");
    if (existing) existing.remove();

    const bar = document.createElement("div");
    bar.id = "risezap-bar";

    if (!cachedToken) {
      bar.innerHTML = `
        <span class="rz-logo">⚡</span>
        <span class="rz-login-msg">Rise Zap — <a href="#" id="rz-open-popup">Faça login no popup da extensão</a></span>
      `;
      document.body.appendChild(bar);
      return;
    }

    // Logo
    bar.innerHTML = `<span class="rz-logo">⚡</span>`;

    // Funnel buttons (like ZapVoice)
    cachedAssets.funnels.forEach((funnel) => {
      const btn = document.createElement("button");
      btn.className = "rz-btn rz-funnel";
      btn.innerHTML = `<span class="rz-icon">🎯</span>${funnel.name}`;
      btn.addEventListener("click", () => handleFunnelClick(funnel));
      bar.appendChild(btn);
    });

    // Individual asset buttons
    cachedAssets.messages.forEach((msg) => {
      const btn = document.createElement("button");
      btn.className = "rz-btn rz-message";
      btn.innerHTML = `<span class="rz-icon">📩</span>${msg.name}`;
      btn.addEventListener("click", () => {
        showPreview("Enviar Mensagem", msg.content || msg.name, () =>
          sendMessage({ text: msg.content || msg.name })
        );
      });
      bar.appendChild(btn);
    });

    cachedAssets.audios.forEach((audio) => {
      const btn = document.createElement("button");
      btn.className = "rz-btn rz-audio";
      btn.innerHTML = `<span class="rz-icon">🎵</span>${audio.name}`;
      btn.addEventListener("click", () => {
        if (!audio.storage_path) return showToast("Áudio sem arquivo", true);
        const url = getPublicUrl(audio.storage_path);
        showPreview("Enviar Áudio", `🎵 ${audio.name}`, () =>
          sendMessage({ media_url: url, media_type: "audio", mime: audio.mime })
        );
      });
      bar.appendChild(btn);
    });

    cachedAssets.medias.forEach((media) => {
      const btn = document.createElement("button");
      btn.className = "rz-btn rz-media";
      btn.innerHTML = `<span class="rz-icon">🖼</span>${media.name}`;
      btn.addEventListener("click", () => {
        if (!media.storage_path) return showToast("Mídia sem arquivo", true);
        const url = getPublicUrl(media.storage_path);
        const isVideo = (media.mime || "").startsWith("video");
        showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${media.name}`, () =>
          sendMessage({ media_url: url, media_type: isVideo ? "video" : "image", mime: media.mime })
        );
      });
      bar.appendChild(btn);
    });

    cachedAssets.documents.forEach((doc) => {
      const btn = document.createElement("button");
      btn.className = "rz-btn rz-document";
      btn.innerHTML = `<span class="rz-icon">📄</span>${doc.name}`;
      btn.addEventListener("click", () => {
        if (!doc.storage_path) return showToast("Documento sem arquivo", true);
        const url = getPublicUrl(doc.storage_path);
        showPreview("Enviar Documento", `📄 ${doc.name}`, () =>
          sendMessage({ media_url: url, media_type: "document", mime: doc.mime, file_name: doc.name })
        );
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);
  }

  // ─── Init ───────────────────────────────────────────────

  async function init() {
    await getAuth();
    if (cachedToken) {
      await loadAssets();
    }
    createBar();

    // Listen for storage changes (login/logout from popup)
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.risezap_access_token || changes.risezap_instance_id) {
        await getAuth();
        if (cachedToken) await loadAssets();
        createBar();
      }
    });

    // Re-inject bar if WhatsApp removes it
    setInterval(() => {
      if (!document.getElementById("risezap-bar")) {
        createBar();
      }
    }, 3000);
  }

  // Wait for WhatsApp to load
  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }
})();
