// Rise Zap — Content Script (barra no WhatsApp Web)
// Texto: envio via DOM (paste) | Arquivos: envio nativo via wa-js bridge
(function () {
  "use strict";

  const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

  let token = null;
  let assets = { messages: [], audios: [], medias: [], documents: [], funnels: [] };
  let activeFunnelRunId = null;
  let globalSending = false;
  let bridgeReady = false;

  // ─── Auth ──────────────────────────────────────────────

  async function loadAuth() {
    const stored = await chrome.storage.local.get(["risezap_access_token"]);
    token = stored.risezap_access_token || null;
  }

  // ─── Supabase Fetch ────────────────────────────────────

  async function supaFetch(table, select, extraParams = "") {
    if (!token) return [];
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${extraParams}&order=created_at.desc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async function loadAssets() {
    const [messages, audios, medias, documents, funnels] = await Promise.all([
      supaFetch("messages", "id,name,content"),
      supaFetch("audios", "id,name,storage_path,mime,bytes"),
      supaFetch("medias", "id,name,storage_path,mime,bytes,metadata"),
      supaFetch("documents", "id,name,storage_path,mime,bytes"),
      supaFetch("funnels", "id,name,favorite"),
    ]);
    assets = { messages, audios, medias, documents, funnels };
  }

  // ─── Funnel Items Loader ──────────────────────────────

  async function loadFunnelItems(funnelId) {
    return supaFetch(
      "funnel_items",
      "id,type,asset_id,position,delay_min,delay_sec",
      `&funnel_id=eq.${funnelId}&order=position.asc`
    );
  }

  function normalizeAssetType(rawType) {
    const key = normalizeLabel(rawType).replace(/\s+/g, "");
    if (["mensagem", "message", "texto", "text"].includes(key)) return "message";
    if (["audio", "áudio", "voz", "voice", "ptt"].includes(key)) return "audio";
    if (["midia", "mídia", "media", "imagem", "image", "video", "vídeo"].includes(key)) return "media";
    if (["documento", "document", "doc", "arquivo", "file"].includes(key)) return "document";
    return null;
  }

  function getTableByAssetType(normalizedType) {
    if (normalizedType === "message") return "messages";
    if (normalizedType === "audio") return "audios";
    if (normalizedType === "media") return "medias";
    if (normalizedType === "document") return "documents";
    return null;
  }

  function getAssetTypeByTable(table) {
    if (table === "messages") return "message";
    if (table === "audios") return "audio";
    if (table === "medias") return "media";
    if (table === "documents") return "document";
    return null;
  }

  function getCachedAsset(type, assetId) {
    const lookups = type
      ? [{ type, rows: type === "message" ? assets.messages : type === "audio" ? assets.audios : type === "media" ? assets.medias : assets.documents }]
      : [
          { type: "message", rows: assets.messages },
          { type: "audio", rows: assets.audios },
          { type: "media", rows: assets.medias },
          { type: "document", rows: assets.documents },
        ];

    for (const lookup of lookups) {
      const found = (lookup.rows || []).find((row) => row.id === assetId);
      if (found) {
        return {
          ...found,
          resolvedType: lookup.type,
          table: getTableByAssetType(lookup.type),
        };
      }
    }

    return null;
  }

  async function resolveAsset(type, assetId) {
    const normalizedType = normalizeAssetType(type);

    const cached = getCachedAsset(normalizedType, assetId);
    if (cached) return cached;

    const primaryTable = getTableByAssetType(normalizedType);
    const tablePlan = primaryTable
      ? [primaryTable, "messages", "audios", "medias", "documents"].filter((t, i, a) => t && a.indexOf(t) === i)
      : ["messages", "audios", "medias", "documents"];

    for (const table of tablePlan) {
      const rows = await supaFetch(table, "id,name,content,storage_path,mime,bytes", `&id=eq.${assetId}`);
      if (!rows.length) continue;

      const resolvedType = getAssetTypeByTable(table);
      return { ...rows[0], resolvedType, table };
    }

    return null;
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

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const normalizeLabel = (value) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // ─── WPP Bridge Injection ─────────────────────────────
  // Injects wa-js library + bridge into the page context

  function injectBridge() {
    if (document.getElementById("RZBridgeReady")) {
      bridgeReady = true;
      return;
    }

    // 1. Inject wa-js library as a classic script (sets window.WPP)
    const waJsUrl = chrome.runtime.getURL("lib/wppconnect-wa.js");
    const waJsScript = document.createElement("script");
    waJsScript.src = waJsUrl;
    waJsScript.id = "rz-wajs-script";
    waJsScript.onload = function () {
      console.log("[RiseZap] wa-js library loaded");

      // 2. After wa-js is loaded, inject the bridge
      const bridgeUrl = chrome.runtime.getURL("injected/wpp-bridge.js");
      const loaderUrl = chrome.runtime.getURL("injected/loader.js");
      const loaderScript = document.createElement("script");
      loaderScript.src = loaderUrl;
      loaderScript.setAttribute("data-bridge-url", bridgeUrl);
      loaderScript.id = "rz-loader-script";
      document.head.appendChild(loaderScript);
    };
    document.head.appendChild(waJsScript);

    // Listen for bridge readiness
    window.addEventListener("risezap:bridge-ready", function () {
      bridgeReady = true;
      console.log("[RiseZap] Bridge is ready — native sending enabled");
    });
  }

  // ─── Storage Bridge (chrome.storage proxy for page context) ──

  function setupStorageBridge() {
    // GET request from injected script
    window.addEventListener("REQ_RISEZAP_STORE_GET", async function (evt) {
      const { requestCode, key } = evt.detail || {};
      if (!requestCode || !key) return;

      try {
        const result = await chrome.storage.local.get([key]);
        window.dispatchEvent(
          new CustomEvent("RES_RISEZAP_STORE_GET_" + requestCode, {
            detail: { value: result[key] ?? null },
          })
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent("RES_RISEZAP_STORE_GET_" + requestCode, {
            detail: { value: null },
          })
        );
      }
    });

    // SET request from injected script
    window.addEventListener("REQ_RISEZAP_STORE_SET", async function (evt) {
      const { key, value } = evt.detail || {};
      if (!key) return;
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (err) {
        console.warn("[RiseZap] Storage bridge SET error:", err);
      }
    });
  }

  // ─── Send File via WPP Bridge ─────────────────────────

  function isBridgeReady() {
    return bridgeReady || !!document.getElementById("RZBridgeReady");
  }

  async function sendFileViaBridge(asset) {
    if (!asset.storage_path) {
      showToast("Ativo sem arquivo associado", true);
      return false;
    }

    if (!isBridgeReady()) {
      showToast("Bridge WPP não está pronto. Aguarde o WhatsApp Web carregar.", true);
      return false;
    }

    // Get signed URL for the file
    const signedUrl = await getSignedUrl(asset.storage_path);
    if (!signedUrl) {
      showToast("Erro ao gerar URL do arquivo", true);
      return false;
    }

    // Determine send type
    let sendType;
    const resolvedType = asset.resolvedType;
    if (resolvedType === "audio") {
      sendType = "audio";
    } else if (resolvedType === "media") {
      sendType = (asset.mime || "").startsWith("video") ? "video" : "image";
    } else if (resolvedType === "document") {
      sendType = "document";
    } else {
      sendType = "auto-detect";
    }

    const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // Build payload
    const payload = {
      requestId,
      type: sendType,
      url: signedUrl,
      isPtt: resolvedType === "audio", // audio always as PTT
      caption: undefined,
      fileName: asset.name || undefined,
      asViewOnce: !!(asset.metadata?.singleView || asset.metadata?.single_view),
    };

    console.log("[RiseZap] sendFileViaBridge:", {
      type: sendType,
      isPtt: payload.isPtt,
      name: asset.name,
    });

    // Send event and wait for response
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("risezap:result", handler);
        showToast("Timeout: bridge não respondeu em 30s", true);
        resolve(false);
      }, 30000);

      function handler(evt) {
        const detail = evt.detail || {};
        if (detail.requestId !== requestId) return;

        window.removeEventListener("risezap:result", handler);
        clearTimeout(timeout);

        if (detail.success) {
          resolve(true);
        } else {
          console.error("[RiseZap] Bridge send failed:", detail.error);
          showToast("Erro no envio: " + (detail.error || "falha desconhecida"), true);
          resolve(false);
        }
      }

      window.addEventListener("risezap:result", handler);
      window.dispatchEvent(new CustomEvent("risezap:send", { detail: payload }));
    });
  }

  // ─── Send Text via DOM (only text stays DOM-based) ────

  async function sendTextViaDom(text) {
    try {
      const input =
        document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
        document.querySelector('#main div[contenteditable="true"][role="textbox"]') ||
        document.querySelector('#main footer div[contenteditable="true"]') ||
        document.querySelector('footer div[contenteditable="true"]');
      if (!input) {
        showToast("Abra um chat para enviar", true);
        return false;
      }

      input.focus();
      await sleep(100);
      input.textContent = '';
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(100);

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(pasteEvent);

      await sleep(500);

      let sendBtn =
        document.querySelector('span[data-icon="send"]') ||
        document.querySelector('button[aria-label="Send"]') ||
        document.querySelector('button[aria-label="Enviar"]');

      if (!sendBtn) {
        try {
          sendBtn = await waitForElement('span[data-icon="send"]', 3000);
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

  // ─── Send Funnel (sequential) ─────────────────────────

  async function sendFunnelViaDom(funnelId, funnelName) {
    if (activeFunnelRunId) {
      showToast("Já existe um funil em execução. Aguarde terminar.", true);
      return false;
    }

    const runId = `${funnelId}:${Date.now()}`;
    activeFunnelRunId = runId;

    try {
      await loadAssets();

      const rawItems = await loadFunnelItems(funnelId);
      if (!rawItems || rawItems.length === 0) {
        showToast(`Funil "${funnelName}" está vazio`, true);
        return false;
      }

      const seenItems = new Set();
      const items = rawItems
        .slice()
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .filter((item) => {
          const signature = item.id || `${item.position}|${item.type}|${item.asset_id}`;
          if (seenItems.has(signature)) return false;
          seenItems.add(signature);
          return true;
        });

      showToast(`Enviando funil "${funnelName}" (${items.length} itens)...`);

      for (let i = 0; i < items.length; i++) {
        if (activeFunnelRunId !== runId) {
          console.warn("[RiseZap] Funnel run interrupted by a newer execution");
          return false;
        }

        const item = items[i];

        const delayMs = ((item.delay_min || 0) * 60 + (item.delay_sec || 0)) * 1000;
        if (delayMs > 0 && i > 0) {
          console.log(`[RiseZap] Funnel delay: ${delayMs / 1000}s before item ${i + 1}`);
          await sleep(delayMs);
        }

        const asset = await resolveAsset(item.type, item.asset_id);
        if (!asset) {
          console.warn(`[RiseZap] Could not resolve asset: type=${item.type}, id=${item.asset_id}`);
          showToast(`Item ${i + 1} não encontrado, abortando funil.`, true);
          return false;
        }

        let ok = false;

        if (asset.resolvedType === "message") {
          // Text stays DOM-based
          ok = await sendTextViaDom(asset.content || asset.name);
        } else {
          // Audio, Media, Document → WPP Bridge (native)
          ok = await sendFileViaBridge(asset);
        }

        if (!ok) {
          console.error(`[RiseZap] Funnel item ${i + 1}/${items.length} FAILED: ${asset.resolvedType}`);
          showToast(`Falha no item ${i + 1}. Funil interrompido.`, true);
          return false;
        }

        console.log(`[RiseZap] Funnel item ${i + 1}/${items.length} sent: ${asset.resolvedType}`);

        if (i < items.length - 1) {
          await sleep(800);
        }
      }

      showToast(`Funil "${funnelName}" concluído! ✓`);
      return true;
    } finally {
      if (activeFunnelRunId === runId) {
        activeFunnelRunId = null;
      }
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
      position: "fixed", top: "20px", left: "50%",
      transform: "translateX(-50%)", padding: "8px 20px",
      borderRadius: "8px", fontSize: "13px", fontWeight: "600",
      zIndex: "100001", color: "white", fontFamily: "'Segoe UI', sans-serif",
      background: isError ? "#dc2626" : "#00a884",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
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
      if (globalSending) return;
      globalSending = true;

      // Instant feedback: close modal + show toast immediately
      closeModal();
      showToast("⏳ Enviando...");

      try {
        const ok = await onSend();
        if (ok) {
          showToast("Enviado com sucesso! ✓");
        } else if (!document.getElementById("risezap-toast")) {
          showToast("Falha ao enviar", true);
        }
      } catch (err) {
        console.error("[RiseZap] Erro no envio:", err);
        showToast("Erro: " + (err.message || "falha desconhecida"), true);
      } finally {
        globalSending = false;
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

    bar.innerHTML = ``;

    // Funis — roxo
    assets.funnels.forEach((f) => {
      const btn = makeBtn("🎯", f.name, "rz-funnel");
      btn.addEventListener("click", () => {
        showPreview("Disparar Funil", `🎯 ${f.name}\n\nTodos os itens serão enviados em sequência.`, async () => {
          return sendFunnelViaDom(f.id, f.name);
        });
      });
      bar.appendChild(btn);
    });

    // Mensagens — verde (DOM)
    assets.messages.forEach((m) => {
      const btn = makeBtn("💬", m.name, "rz-message");
      btn.addEventListener("click", () => {
        showPreview("Enviar Mensagem", m.content || m.name, () =>
          sendTextViaDom(m.content || m.name)
        );
      });
      bar.appendChild(btn);
    });

    // Áudios — ciano (WPP Bridge — PTT nativo)
    assets.audios.forEach((a) => {
      const btn = makeBtn("🎙", a.name, "rz-audio");
      btn.addEventListener("click", () => {
        if (!a.storage_path) return showToast("Áudio sem arquivo", true);
        showPreview("Enviar Áudio", `🎙 ${a.name}`, async () => {
          return sendFileViaBridge({
            ...a,
            resolvedType: "audio",
          });
        });
      });
      bar.appendChild(btn);
    });

    // Mídias — amarelo (WPP Bridge — nativo)
    assets.medias.forEach((m) => {
      const btn = makeBtn("🖼", m.name, "rz-media");
      btn.addEventListener("click", () => {
        if (!m.storage_path) return showToast("Mídia sem arquivo", true);
        const isVideo = (m.mime || "").startsWith("video");
        showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${m.name}`, async () => {
          return sendFileViaBridge({
            ...m,
            resolvedType: "media",
          });
        });
      });
      bar.appendChild(btn);
    });

    // Documentos — rosa/magenta (WPP Bridge — nativo)
    assets.documents.forEach((d) => {
      const btn = makeBtn("📄", d.name, "rz-document");
      btn.addEventListener("click", () => {
        if (!d.storage_path) return showToast("Documento sem arquivo", true);
        showPreview("Enviar Documento", `📄 ${d.name}`, async () => {
          return sendFileViaBridge({
            ...d,
            resolvedType: "document",
          });
        });
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);

    // Push WhatsApp UI up so bar doesn't cover the chat
    const barH = bar.offsetHeight || 40;
    const appEl = document.getElementById("app");
    if (appEl) {
      appEl.style.height = `calc(100vh - ${barH}px)`;
      appEl.style.overflow = "hidden";
    }

    // Position bar starting from the chat panel divider (right of conversation list)
    function positionBar() {
      const sidePanel = document.getElementById("side") ||
        document.querySelector("[data-side]") ||
        document.querySelector("._pane-list") ||
        document.querySelector('[data-testid="chat-list"]');
      
      if (sidePanel) {
        const sidePanelRight = sidePanel.getBoundingClientRect().right;
        bar.style.left = sidePanelRight + "px";
      } else {
        bar.style.left = "30%";
      }
    }

    positionBar();
    window.addEventListener("resize", positionBar);
  }

  // Map CSS class to emblem image filename
  const EMBLEM_MAP = {
    "rz-audio": "emblem-audio.png",
    "rz-media": "emblem-media.png",
    "rz-funnel": "emblem-funnel.png",
    "rz-message": "emblem-message.png",
    "rz-document": "emblem-document.png",
  };

  function makeBtn(icon, label, cls) {
    const btn = document.createElement("button");
    btn.className = `rz-btn ${cls}`;
    
    const emblemFile = EMBLEM_MAP[cls];
    if (emblemFile) {
      const imgUrl = chrome.runtime.getURL(`icons/${emblemFile}`);
      btn.innerHTML = `<img src="${imgUrl}" class="rz-emblem" alt="" />${escapeHtml(label)}`;
    } else {
      btn.innerHTML = `<span class="rz-icon">${icon}</span>${escapeHtml(label)}`;
    }
    return btn;
  }

  // ─── Init ──────────────────────────────────────────────

  async function init() {
    await loadAuth();

    // Inject wa-js bridge into page context
    injectBridge();
    setupStorageBridge();

    if (token) {
      await loadAssets();
    }
    createBar();

    // Update bridge status indicator when bridge becomes ready
    window.addEventListener("risezap:bridge-ready", () => {
      createBar(); // Rebuild bar to show green status
    });

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
