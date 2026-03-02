// Rise Zap — Content Script (barra no WhatsApp Web) — Envio 100% DOM
(function () {
  "use strict";

  const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

  let token = null;
  let assets = { messages: [], audios: [], medias: [], documents: [], funnels: [] };

  // ─── Auth ──────────────────────────────────────────────

  async function loadAuth() {
    const stored = await chrome.storage.local.get(["risezap_access_token"]);
    token = stored.risezap_access_token || null;
  }

  // ─── Supabase Fetch ────────────────────────────────────

  async function supaFetch(table, select) {
    if (!token) return [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=created_at.desc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async function loadAssets() {
    const [messages, audios, medias, documents, funnels] = await Promise.all([
      supaFetch("messages", "id,name,content"),
      supaFetch("audios", "id,name,storage_path,mime"),
      supaFetch("medias", "id,name,storage_path,mime"),
      supaFetch("documents", "id,name,storage_path,mime"),
      supaFetch("funnels", "id,name,favorite"),
    ]);
    assets = { messages, audios, medias, documents, funnels };
  }

  // ─── Signed URL ───────────────────────────────────────

  async function getSignedUrl(path) {
    if (!token) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/assets/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
    } catch {
      return null;
    }
  }

  // ─── DOM Helpers ──────────────────────────────────────

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`waitForElement timeout: ${selector}`));
      }, timeout);
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ─── Send Text via DOM ────────────────────────────────

  async function sendTextViaDom(text) {
    try {
      // Find the message input field (multiple fallback selectors)
      const input =
        document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
        document.querySelector('#main div[contenteditable="true"][role="textbox"]') ||
        document.querySelector('#main footer div[contenteditable="true"]') ||
        document.querySelector('footer div[contenteditable="true"]');
      if (!input) {
        showToast("Abra um chat para enviar", true);
        return false;
      }

      // Focus and clear existing content
      input.focus();
      await sleep(100);
      input.textContent = '';
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(100);

      // Inject text via ClipboardEvent (paste) — works with React/Lexical
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(pasteEvent);

      // Wait for WhatsApp to process the paste and show send button
      await sleep(500);

      // Click send button (multiple fallback selectors)
      let sendBtn =
        document.querySelector('span[data-icon="send"]') ||
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('button[aria-label="Enviar"]');

      // If not found, wait a bit more
      if (!sendBtn) {
        try {
          await waitForElement('span[data-icon="send"]', 3000);
          sendBtn = document.querySelector('span[data-icon="send"]');
        } catch {}
      }

      if (!sendBtn) {
        showToast("Botão de enviar não encontrado", true);
        return false;
      }
      const sendBtnEl = sendBtn.closest("button") || sendBtn;
      sendBtnEl.click();

      return true;
    } catch (err) {
      console.error("[RiseZap] sendTextViaDom error:", err);
      showToast("Erro ao enviar texto", true);
      return false;
    }
  }

  // ─── Download Blob ────────────────────────────────────

  async function downloadAsBlob(signedUrl) {
    console.log("[RiseZap] Downloading blob from:", signedUrl.substring(0, 80) + "...");
    const res = await fetch(signedUrl);
    if (!res.ok) throw new Error(`Download falhou (HTTP ${res.status})`);
    const blob = await res.blob();
    console.log("[RiseZap] Blob downloaded:", blob.size, "bytes, type:", blob.type);
    return blob;
  }

  // ─── Send File via DOM ────────────────────────────────

  async function sendFileViaDom(blob, fileName, mimeType) {
    try {
      console.log("[RiseZap] sendFileViaDom:", fileName, mimeType, blob.size, "bytes");
      // Determine if it's a media (image/video) or document
      const isMedia = /^(image|video)\//.test(mimeType);

      // Click the attach button (the "+" or clip icon)
      const attachBtn =
        document.querySelector('#main span[data-icon="plus"]') ||
        document.querySelector('#main span[data-icon="attach-menu-plus"]') ||
        document.querySelector('#main span[data-icon="clip"]') ||
        document.querySelector('span[data-icon="plus"]') ||
        document.querySelector('span[data-icon="attach-menu-plus"]');
      if (!attachBtn) {
        showToast("Botão de anexo não encontrado", true);
        return false;
      }
      const attachBtnEl = attachBtn.closest("button") || attachBtn;
      attachBtnEl.click();
      // Wait for the attach menu to fully open
      await sleep(800);

      // Find the correct file input
      // WhatsApp Web has multiple hidden inputs — media vs document
      // After clicking attach, we need to click the right sub-option first
      const isAudio = /^audio\//.test(mimeType);
      
      // Try to click the correct attach sub-menu item
      if (!isMedia && !isAudio) {
        // For documents, click the document option in attach menu
        const docOption = document.querySelector('span[data-icon="attach-document"]') ||
          document.querySelector('li[data-animate-dropdown-item="3"] button') ||
          document.querySelector('[aria-label*="Documento"]') ||
          document.querySelector('[aria-label*="Document"]');
        if (docOption) {
          const docBtn = docOption.closest("button") || docOption;
          docBtn.click();
          await sleep(500);
        }
      } else {
        // For media/audio, click the photos/videos option
        const mediaOption = document.querySelector('span[data-icon="attach-image"]') ||
          document.querySelector('li[data-animate-dropdown-item="1"] button') ||
          document.querySelector('[aria-label*="Fotos"]') ||
          document.querySelector('[aria-label*="Photos"]');
        if (mediaOption) {
          const mediaBtn = mediaOption.closest("button") || mediaOption;
          mediaBtn.click();
          await sleep(500);
        }
      }

      const inputs = document.querySelectorAll('input[type="file"]');
      let targetInput = null;

      // Just use the last visible/available file input (WhatsApp shows the right one based on what we clicked)
      for (const inp of inputs) {
        if (inp.offsetParent !== null || inp.closest('[style*="display: none"]') === null) {
          targetInput = inp;
        }
      }

      // Fallback: just use the last available input
      if (!targetInput && inputs.length > 0) {
        targetInput = inputs[inputs.length - 1];
      }

      if (!targetInput) {
        showToast("Input de arquivo não encontrado", true);
        return false;
      }

      // Create File and inject via DataTransfer
      const file = new File([blob], fileName, { type: mimeType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      targetInput.files = dataTransfer.files;

      // Dispatch change event
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Wait for WhatsApp preview modal to load
      await sleep(1500);

      // Click the send button in the preview modal
      try {
        const previewSend = await waitForElement(
          'span[data-icon="send"], div[role="button"][aria-label*="Enviar"], div[role="button"][aria-label*="Send"]',
          5000
        );
        // Find the send button that's in the modal (not in the footer)
        const modalSendBtns = document.querySelectorAll('span[data-icon="send"]');
        const lastSendBtn = modalSendBtns[modalSendBtns.length - 1];
        if (lastSendBtn) {
          const el1 = lastSendBtn.closest("button") || lastSendBtn;
          el1.click();
        } else if (previewSend) {
          const el2 = previewSend.closest("button") || previewSend;
          el2.click();
        }
      } catch {
        showToast("Timeout aguardando preview", true);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[RiseZap] sendFileViaDom error:", err);
      showToast("Erro ao enviar arquivo", true);
      return false;
    }
  }

  // ─── Toast ─────────────────────────────────────────────

  function showToast(msg, isError = false) {
    const old = document.getElementById("risezap-toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "risezap-toast";
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", bottom: "52px", left: "50%",
      transform: "translateX(-50%)", padding: "8px 20px",
      borderRadius: "8px", fontSize: "13px", fontWeight: "600",
      zIndex: "100001", color: "white", fontFamily: "'Segoe UI', sans-serif",
      background: isError ? "#dc2626" : "#00a884",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ─── Modal ─────────────────────────────────────────────

  function closeModal() {
    const o = document.getElementById("risezap-overlay");
    if (o) o.remove();
  }

  function openModal(title, bodyHTML) {
    closeModal();
    const overlay = document.createElement("div");
    overlay.id = "risezap-overlay";
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
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
      closeModal(); // Close our modal BEFORE interacting with WhatsApp DOM
      await sleep(300);
      try {
        const ok = await onSend();
        if (ok) showToast("Mensagem enviada! ✓");
        else showToast("Falha ao enviar", true);
      } catch (err) {
        console.error("[RiseZap] Erro no envio:", err);
        showToast("Erro: " + (err.message || "falha desconhecida"), true);
      }
    });
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text || "";
    return d.innerHTML;
  }

  // ─── Build Bar ─────────────────────────────────────────

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
      document.body.appendChild(bar);
      return;
    }

    // Logo
    bar.innerHTML = `<span class="rz-logo">⚡</span>`;

    // Funis — roxo
    assets.funnels.forEach((f) => {
      const btn = makeBtn("🎯", f.name, "rz-funnel");
      btn.addEventListener("click", () => {
        showPreview("Disparar Funil", `🎯 ${f.name}\n\nTodos os itens serão enviados em sequência.`, async () => {
          showToast(`Funil "${f.name}" disparado`);
          return true;
        });
      });
      bar.appendChild(btn);
    });

    // Mensagens — verde
    assets.messages.forEach((m) => {
      const btn = makeBtn("💬", m.name, "rz-message");
      btn.addEventListener("click", () => {
        showPreview("Enviar Mensagem", m.content || m.name, () =>
          sendTextViaDom(m.content || m.name)
        );
      });
      bar.appendChild(btn);
    });

    // Áudios — ciano
    assets.audios.forEach((a) => {
      const btn = makeBtn("🎙", a.name, "rz-audio");
      btn.addEventListener("click", async () => {
        if (!a.storage_path) return showToast("Áudio sem arquivo", true);
        const url = await getSignedUrl(a.storage_path);
        if (!url) return showToast("Erro ao gerar URL do áudio", true);
        showPreview("Enviar Áudio", `🎙 ${a.name}`, async () => {
          const blob = await downloadAsBlob(url);
          return sendFileViaDom(blob, a.name, a.mime || "audio/ogg");
        });
      });
      bar.appendChild(btn);
    });

    // Mídias — amarelo
    assets.medias.forEach((m) => {
      const btn = makeBtn("🖼", m.name, "rz-media");
      btn.addEventListener("click", async () => {
        if (!m.storage_path) return showToast("Mídia sem arquivo", true);
        const url = await getSignedUrl(m.storage_path);
        if (!url) return showToast("Erro ao gerar URL da mídia", true);
        const isVideo = (m.mime || "").startsWith("video");
        showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${m.name}`, async () => {
          const blob = await downloadAsBlob(url);
          return sendFileViaDom(blob, m.name, m.mime || "image/jpeg");
        });
      });
      bar.appendChild(btn);
    });

    // Documentos — rosa/magenta
    assets.documents.forEach((d) => {
      const btn = makeBtn("📄", d.name, "rz-document");
      btn.addEventListener("click", async () => {
        if (!d.storage_path) return showToast("Documento sem arquivo", true);
        const url = await getSignedUrl(d.storage_path);
        if (!url) return showToast("Erro ao gerar URL do documento", true);
        showPreview("Enviar Documento", `📄 ${d.name}`, async () => {
          const blob = await downloadAsBlob(url);
          return sendFileViaDom(blob, d.name, d.mime || "application/pdf");
        });
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);
  }

  function makeBtn(icon, label, cls) {
    const btn = document.createElement("button");
    btn.className = `rz-btn ${cls}`;
    btn.innerHTML = `<span class="rz-icon">${icon}</span>${escapeHtml(label)}`;
    return btn;
  }

  // ─── Init ──────────────────────────────────────────────

  async function init() {
    await loadAuth();
    if (token) await loadAssets();
    createBar();

    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.risezap_access_token) {
        await loadAuth();
        if (token) await loadAssets();
        createBar();
      }
    });

    setInterval(() => {
      if (!document.getElementById("risezap-bar")) createBar();
    }, 3000);
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
