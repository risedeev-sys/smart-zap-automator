// Rise Zap — Content Script (barra no WhatsApp Web)
// Texto: envio via DOM (paste) | Áudio: bridge wa-js (PTT) | Mídia/Doc: drag-and-drop nativo
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
        return { ...found, resolvedType: lookup.type, table: getTableByAssetType(lookup.type) };
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
      const rows = await supaFetch(table, "id,name,content,storage_path,mime,bytes,metadata", `&id=eq.${assetId}`);
      if (!rows.length) continue;
      return { ...rows[0], resolvedType: getAssetTypeByTable(table), table };
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
  // Bridge is now used ONLY for audio PTT sending

  function injectBridge() {
    if (document.getElementById("RZBridgeReady")) {
      bridgeReady = true;
      return;
    }

    const waJsUrl = chrome.runtime.getURL("lib/wppconnect-wa.js");
    const waJsScript = document.createElement("script");
    waJsScript.src = waJsUrl;
    waJsScript.id = "rz-wajs-script";
    waJsScript.onload = function () {
      console.log("[RiseZap] wa-js library loaded");
      const bridgeUrl = chrome.runtime.getURL("injected/wpp-bridge.js");
      const loaderUrl = chrome.runtime.getURL("injected/loader.js");
      const loaderScript = document.createElement("script");
      loaderScript.src = loaderUrl;
      loaderScript.setAttribute("data-bridge-url", bridgeUrl);
      loaderScript.id = "rz-loader-script";
      document.head.appendChild(loaderScript);
    };
    document.head.appendChild(waJsScript);

    window.addEventListener("risezap:bridge-ready", function () {
      bridgeReady = true;
      console.log("[RiseZap] Bridge is ready — audio PTT enabled");
    });
  }

  // ─── Storage Bridge ──────────────────────────────────

  function setupStorageBridge() {
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

  // ─── Blob Helpers ─────────────────────────────────────

  function isBridgeReady() {
    return bridgeReady || !!document.getElementById("RZBridgeReady");
  }

  function base64ToBlob(base64Payload, mimeType) {
    const cleanBase64 = String(base64Payload || "").replace(/^data:.*;base64,/, "");
    const binary = atob(cleanBase64);
    const chunkSize = 8192;
    const chunks = [];
    for (let i = 0; i < binary.length; i += chunkSize) {
      const slice = binary.slice(i, i + chunkSize);
      const bytes = new Uint8Array(slice.length);
      for (let j = 0; j < slice.length; j++) {
        bytes[j] = slice.charCodeAt(j);
      }
      chunks.push(bytes);
    }
    return new Blob(chunks, { type: mimeType || "application/octet-stream" });
  }

  async function fetchAssetBlob(fileUrl, fallbackMime) {
    // Try content script fetch first (same-origin or CORS-enabled)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);
      try {
        const res = await fetch(fileUrl, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } finally {
        clearTimeout(timeout);
      }
    } catch (contentErr) {
      // Fallback to background script (bypasses CORS)
      const response = await chrome.runtime.sendMessage({
        type: "RISEZAP_FETCH_FILE_BUFFER",
        url: fileUrl,
      });
      if (!response?.ok || !response.base64) {
        throw new Error(response?.error || contentErr?.message || "asset fetch failed");
      }
      return base64ToBlob(response.base64, response.mime || fallbackMime || "application/octet-stream");
    }
  }

  function resolveFileName(asset, blobMime) {
    const base = String(asset?.name || "arquivo").trim() || "arquivo";
    if (/\.[a-z0-9]{2,8}$/i.test(base)) return base;

    const mime = String(asset?.mime || blobMime || "").toLowerCase();
    if (mime.includes("image/jpeg")) return `${base}.jpg`;
    if (mime.includes("image/png")) return `${base}.png`;
    if (mime.includes("image/webp")) return `${base}.webp`;
    if (mime.includes("video/mp4")) return `${base}.mp4`;
    if (mime.includes("video/webm")) return `${base}.webm`;
    if (mime.includes("audio/ogg")) return `${base}.ogg`;
    if (mime.includes("audio/mpeg")) return `${base}.mp3`;
    if (mime.includes("application/pdf")) return `${base}.pdf`;
    return `${base}.bin`;
  }

  // ─── Outgoing Message Detection ───────────────────────

  function listOutgoingMessageNodes() {
    const scope = document.querySelector("#main") || document;
    const selectors = [
      "div.message-out",
      '[data-testid="msg-out-container"]',
      '[data-testid="outgoing-message"]',
      '[data-testid="outgoing-msg"]',
    ];
    for (const selector of selectors) {
      const nodes = Array.from(scope.querySelectorAll(selector));
      if (nodes.length) return nodes;
    }
    return [];
  }

  function getMessageNodeId(node) {
    if (!node) return null;
    const holder = node.matches("[data-id]") ? node : node.querySelector("[data-id]");
    return holder?.getAttribute("data-id") || holder?.id || null;
  }

  function snapshotOutgoingState() {
    const nodes = listOutgoingMessageNodes();
    const lastNode = nodes[nodes.length - 1] || null;
    return { count: nodes.length, lastMessageId: getMessageNodeId(lastNode) };
  }

  function readOutgoingStatus(node) {
    if (!node) return { accepted: false, hasError: false, statusIcon: null };
    const statusEl = node.querySelector(
      '[data-icon="msg-time"], [data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="msg-dblcheck-ack"], [data-icon="msg-error"]'
    );
    const statusIcon = statusEl?.getAttribute("data-icon") || null;
    const hasError = statusIcon === "msg-error" || !!node.querySelector('[data-icon="msg-error"], [data-testid="msg-error"]');
    const accepted = !hasError && !!statusIcon && statusIcon !== "msg-error";
    return { accepted, hasError, statusIcon };
  }

  async function waitForOutgoingCommit(previousSnapshot, timeoutMs = 45000) {
    const baseline = previousSnapshot || { count: 0, lastMessageId: null };
    const startedAt = Date.now();
    let candidateKey = null;
    let candidateSeenAt = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const nodes = listOutgoingMessageNodes();
      const lastNode = nodes[nodes.length - 1] || null;
      const currentCount = nodes.length;
      const currentId = getMessageNodeId(lastNode);

      const hasNewMessage =
        currentCount > baseline.count ||
        (!!currentId && currentId !== baseline.lastMessageId);

      if (hasNewMessage && lastNode) {
        const key = `${currentCount}:${currentId || "no-id"}`;
        if (key !== candidateKey) {
          candidateKey = key;
          candidateSeenAt = Date.now();
        }

        const status = readOutgoingStatus(lastNode);
        if (status.hasError) return { ok: false, reason: "msg-error", statusIcon: status.statusIcon };
        if (status.accepted) return { ok: true, reason: null, statusIcon: status.statusIcon };

        // Accept if node is stable for 1.5s even without status icon
        if (Date.now() - candidateSeenAt >= 1500) {
          return { ok: true, reason: null, statusIcon: null };
        }
      }

      await sleep(250);
    }

    return { ok: false, reason: "timeout", statusIcon: null };
  }

  // ─── DOM Element Helpers ──────────────────────────────

  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function findVisibleSendButton(scope = document) {
    const root = scope || document;
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (el) => {
      if (!el) return;
      const button = el.closest("button") || el;
      if (!button || seen.has(button)) return;
      seen.add(button);
      candidates.push(button);
    };

    root.querySelectorAll('button[aria-label="Send"], button[aria-label="Enviar"]').forEach(pushCandidate);
    root.querySelectorAll('span[data-icon="send"]').forEach(pushCandidate);

    for (const candidate of candidates) {
      if (isElementVisible(candidate)) return candidate;
    }
    return null;
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`waitForElement timeout: ${selector}`)); }, timeout);
    });
  }

  // ═══════════════════════════════════════════════════════
  // ATTACH-MENU FILE INJECTION (PRIMARY METHOD)
  // ═══════════════════════════════════════════════════════
  //
  // Root-cause fix:
  // Synthetic drag-and-drop is unreliable on WA Web in embedded/browser
  // contexts. We now use the same stable path users use manually:
  //   [+] Attach menu -> existing file input -> inject File -> Send
  //
  // IMPORTANT:
  // - Never use input.click() (forbidden)
  // - We click only the Attach button/menu and inject files silently
  // ═══════════════════════════════════════════════════════

  function findAttachButton() {
    const candidates = [
      'button[title="Attach"]',
      'button[aria-label="Attach"]',
      'button[aria-label="Anexar"]',
      'span[data-icon="plus-rounded"]',
      'span[data-icon="clip"]',
    ];

    for (const selector of candidates) {
      const anchor = document.querySelector(selector);
      if (!anchor) continue;
      const btn = anchor.closest("button") || anchor;
      if (isElementVisible(btn)) return btn;
    }

    return null;
  }

  async function openAttachMenu() {
    const attachBtn = findAttachButton();
    if (!attachBtn) return false;
    attachBtn.click();
    await sleep(180);
    return true;
  }

  async function waitForAttachmentInputs(timeoutMs = 4000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled);
      if (inputs.length) return inputs;
      await sleep(120);
    }

    return [];
  }

  function pickAttachmentInput(inputs, assetType, mime = "") {
    const lowerMime = String(mime || "").toLowerCase();

    const mediaInput = inputs.find((input) => /(image|video)/i.test(input.accept || ""));
    const docInput = inputs.find((input) => {
      const accept = String(input.accept || "").toLowerCase();
      if (!accept || accept === "*/*") return true;
      return accept.includes("application") || accept.includes("audio") || accept.includes("text");
    });

    if (assetType === "media") {
      if (lowerMime.startsWith("video/")) return mediaInput || docInput || inputs[0];
      return mediaInput || docInput || inputs[0];
    }

    if (assetType === "document") {
      return docInput || mediaInput || inputs[0];
    }

    if (assetType === "audio") {
      // audio menu option can map to doc input on some WA builds
      return docInput || mediaInput || inputs[0];
    }

    return inputs[0];
  }

  function injectFileIntoInput(input, file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    try {
      input.files = dataTransfer.files;
    } catch {
      Object.defineProperty(input, "files", {
        value: dataTransfer.files,
        configurable: true,
      });
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitForComposerSendButton(preferredRoot, timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (preferredRoot) {
        const localBtn = findVisibleSendButton(preferredRoot);
        if (localBtn) return localBtn;
      }

      const globalBtn = findVisibleSendButton(document);
      if (globalBtn) return globalBtn;

      await sleep(180);
    }

    return null;
  }

  async function sendFileViaAttachMenu(asset) {
    if (!asset?.storage_path) {
      showToast("Ativo sem arquivo associado", true);
      return false;
    }

    console.log("[RiseZap] sendFileViaAttachMenu start:", {
      assetId: asset.id,
      assetName: asset.name,
      resolvedType: asset.resolvedType,
      mime: asset.mime,
    });

    const signedUrl = await getSignedUrl(asset.storage_path);
    if (!signedUrl) {
      showToast("Erro ao gerar URL do arquivo", true);
      return false;
    }

    let blob;
    try {
      blob = await fetchAssetBlob(signedUrl, asset.mime || "application/octet-stream");
    } catch (err) {
      showToast(`Erro ao baixar arquivo: ${err?.message || "desconhecido"}`, true);
      return false;
    }

    const fileName = resolveFileName(asset, blob.type);
    const fileMime = asset.mime || blob.type || "application/octet-stream";
    const file = new File([blob], fileName, { type: fileMime });
    const beforeSnapshot = snapshotOutgoingState();

    const attachOpened = await openAttachMenu();
    if (!attachOpened) {
      showToast("Botão de anexo não encontrado no WhatsApp", true);
      return false;
    }

    const inputs = await waitForAttachmentInputs(5000);
    if (!inputs.length) {
      showToast("Entrada de upload não encontrada no WhatsApp", true);
      return false;
    }

    const targetInput = pickAttachmentInput(inputs, asset.resolvedType, fileMime);
    if (!targetInput) {
      showToast("Canal de upload não disponível no WhatsApp", true);
      return false;
    }

    injectFileIntoInput(targetInput, file);

    const composerRoot =
      targetInput.closest('div[role="dialog"]') ||
      targetInput.closest('[data-animate-modal-popup="true"]') ||
      document;

    const sendBtn = await waitForComposerSendButton(composerRoot, 12000);
    if (!sendBtn) {
      showToast("WhatsApp não abriu a prévia do arquivo", true);
      console.error("[RiseZap] sendFileViaAttachMenu: composer send button not found", {
        assetId: asset.id,
        assetName: asset.name,
        inputAccept: targetInput.accept,
      });
      return false;
    }

    const sendBtnEl = sendBtn.closest("button") || sendBtn;
    sendBtnEl.click();

    const isVideo = (fileMime || "").startsWith("video/");
    const confirmTimeoutMs = isVideo ? 120000 : 45000;
    const confirmation = await waitForOutgoingCommit(beforeSnapshot, confirmTimeoutMs);

    if (!confirmation.ok) {
      showToast(`WhatsApp não confirmou envio (${confirmation.reason})`, true);
      return false;
    }

    console.log("[RiseZap] sendFileViaAttachMenu SUCCESS:", {
      assetId: asset.id,
      assetName: asset.name,
      statusIcon: confirmation.statusIcon,
    });

    return true;
  }

  // ─── Send Audio via Bridge (PTT only) ─────────────────

  async function sendAudioViaBridge(asset) {
    if (!asset.storage_path) {
      showToast("Áudio sem arquivo associado", true);
      return false;
    }

    if (!isBridgeReady()) {
      showToast("Bridge WPP não está pronto. Aguarde o WhatsApp Web carregar.", true);
      return false;
    }

    const signedUrl = await getSignedUrl(asset.storage_path);
    if (!signedUrl) {
      showToast("Erro ao gerar URL do áudio", true);
      return false;
    }

    // Prefetch in extension context to avoid CORS in page context
    const blobResult = await createBridgeBlobUrl(signedUrl);
    const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const payload = {
      requestId,
      type: "audio",
      url: signedUrl,
      blobUrl: blobResult?.blobUrl || undefined,
      isPtt: true,
      mime: asset.mime || "audio/ogg; codecs=opus",
      fileName: asset.name || "audio.ogg",
    };

    console.log("[RiseZap] sendAudioViaBridge:", { name: asset.name, usingBlobUrl: !!payload.blobUrl });

    return new Promise((resolve) => {
      const releaseBlobUrl = () => {
        if (blobResult?.blobUrl) URL.revokeObjectURL(blobResult.blobUrl);
      };

      const timeoutId = setTimeout(async () => {
        window.removeEventListener("risezap:result", handler);
        releaseBlobUrl();
        console.error("[RiseZap] Audio bridge timeout, falling back to attach menu");
        showToast("Bridge falhou, tentando envio alternativo...", false, true);
        const ok = await sendFileViaAttachMenu(asset);
        resolve(ok);
      }, 90000);

      async function handler(evt) {
        const detail = evt.detail || {};
        if (detail.requestId !== requestId) return;

        window.removeEventListener("risezap:result", handler);
        clearTimeout(timeoutId);
        releaseBlobUrl();

        if (detail.success === true) {
          resolve(true);
          return;
        }

        console.warn("[RiseZap] Audio bridge failed, trying attach-menu fallback:", detail.errorMessage);
        showToast("Bridge falhou, tentando envio alternativo...", false, true);
        const ok = await sendFileViaAttachMenu(asset);
        resolve(ok);
      }

      window.addEventListener("risezap:result", handler);
      window.dispatchEvent(new CustomEvent("risezap:send", { detail: payload }));
    });
  }

  async function createBridgeBlobUrl(fileUrl) {
    if (!fileUrl) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);
      try {
        const res = await fetch(fileUrl, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return { blobUrl: URL.createObjectURL(blob), mime: blob.type || null, source: "content" };
      } finally {
        clearTimeout(timeout);
      }
    } catch (_contentErr) {
      try {
        const response = await chrome.runtime.sendMessage({ type: "RISEZAP_FETCH_FILE_BUFFER", url: fileUrl });
        if (!response?.ok || !response.base64) throw new Error(response?.error || "background fetch failed");
        const blob = base64ToBlob(response.base64, response.mime || "application/octet-stream");
        return { blobUrl: URL.createObjectURL(blob), mime: blob.type || null, source: "background-base64" };
      } catch {
        return null;
      }
    }
  }

  // ─── Unified Send Dispatch ────────────────────────────

  async function sendFile(asset) {
    if (asset.resolvedType === "audio") {
      // Audio → bridge PTT (fallback attach-menu)
      return sendAudioViaBridge(asset);
    }

    // Images, Videos, Documents → attach-menu injection (primary)
    return sendFileViaAttachMenu(asset);
  }

  // ─── Send Text via DOM (paste) ────────────────────────

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

      const beforeSnapshot = snapshotOutgoingState();
      let sendBtn = findVisibleSendButton(document);
      if (!sendBtn) {
        try { sendBtn = await waitForElement('span[data-icon="send"]', 3000); } catch {}
      }
      if (!sendBtn) {
        showToast("Botão de enviar não encontrado", true);
        return false;
      }

      const sendBtnEl = sendBtn.closest("button") || sendBtn;
      sendBtnEl.click();

      const confirmation = await waitForOutgoingCommit(beforeSnapshot, 45000);
      if (!confirmation.ok) {
        showToast(`Texto não confirmado pelo WhatsApp (${confirmation.reason})`, true);
        return false;
      }

      return true;
    } catch (err) {
      console.error("[RiseZap] sendTextViaDom error:", err);
      showToast("Erro ao enviar texto", true);
      return false;
    }
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

      showToast(`⏳ Enviando funil "${funnelName}" (${items.length} itens)...`, false, true);

      for (let i = 0; i < items.length; i++) {
        if (activeFunnelRunId !== runId) {
          console.warn("[RiseZap] Funnel run interrupted by a newer execution");
          return false;
        }

        const item = items[i];
        const delayMs = ((item.delay_min || 0) * 60 + (item.delay_sec || 0)) * 1000;
        if (delayMs > 0) {
          console.log(`[RiseZap] Funnel delay: ${delayMs / 1000}s before item ${i + 1}`);
          await sleep(delayMs);
        }

        const asset = await resolveAsset(item.type, item.asset_id);
        if (!asset) {
          console.warn(`[RiseZap] Could not resolve asset: type=${item.type}, id=${item.asset_id}`);
          showToast(`Item ${i + 1} não encontrado, abortando funil.`, true);
          return false;
        }

        showToast(`⏳ Funil "${funnelName}" — item ${i + 1}/${items.length}: ${asset.name || asset.resolvedType}`, false, true);

        let ok = false;
        if (asset.resolvedType === "message") {
          ok = await sendTextViaDom(asset.content || asset.name);
        } else {
          ok = await sendFile(asset);
        }

        if (!ok) {
          console.error(`[RiseZap] Funnel item ${i + 1}/${items.length} FAILED: ${asset.resolvedType}`);
          if (!document.getElementById("risezap-toast")) {
            showToast(`Falha no item ${i + 1}. Funil interrompido.`, true);
          }
          return false;
        }

        console.log(`[RiseZap] Funnel item ${i + 1}/${items.length} sent: ${asset.resolvedType}`);
        if (i < items.length - 1) await sleep(800);
      }

      showToast(`Funil "${funnelName}" concluído! ✓`);
      return true;
    } finally {
      if (activeFunnelRunId === runId) activeFunnelRunId = null;
    }
  }

  // ─── Toast ─────────────────────────────────────────────

  function showToast(msg, isError = false, persistent = false) {
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
    if (!persistent) setTimeout(() => t.remove(), 4000);
  }

  function dismissToast() {
    const t = document.getElementById("risezap-toast");
    if (t) t.remove();
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
      closeModal();
      showToast("⏳ Enviando...", false, true);
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

    // Funis
    assets.funnels.forEach((f) => {
      const btn = makeBtn("🎯", f.name, "rz-funnel");
      btn.addEventListener("click", () => {
        showPreview("Disparar Funil", `🎯 ${f.name}\n\nTodos os itens serão enviados em sequência.`, async () => {
          return sendFunnelViaDom(f.id, f.name);
        });
      });
      bar.appendChild(btn);
    });

    // Mensagens
    assets.messages.forEach((m) => {
      const btn = makeBtn("💬", m.name, "rz-message");
      btn.addEventListener("click", () => {
        showPreview("Enviar Mensagem", m.content || m.name, () =>
          sendTextViaDom(m.content || m.name)
        );
      });
      bar.appendChild(btn);
    });

    // Áudios (bridge PTT + drag-drop fallback)
    assets.audios.forEach((a) => {
      const btn = makeBtn("🎙", a.name, "rz-audio");
      btn.addEventListener("click", () => {
        if (!a.storage_path) return showToast("Áudio sem arquivo", true);
        showPreview("Enviar Áudio", `🎙 ${a.name}`, async () => {
          return sendFile({ ...a, resolvedType: "audio" });
        });
      });
      bar.appendChild(btn);
    });

    // Mídias (drag-and-drop)
    assets.medias.forEach((m) => {
      const btn = makeBtn("🖼", m.name, "rz-media");
      btn.addEventListener("click", () => {
        if (!m.storage_path) return showToast("Mídia sem arquivo", true);
        const isVideo = (m.mime || "").startsWith("video");
        showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${m.name}`, async () => {
          return sendFile({ ...m, resolvedType: "media" });
        });
      });
      bar.appendChild(btn);
    });

    // Documentos (drag-and-drop)
    assets.documents.forEach((d) => {
      const btn = makeBtn("📄", d.name, "rz-document");
      btn.addEventListener("click", () => {
        if (!d.storage_path) return showToast("Documento sem arquivo", true);
        showPreview("Enviar Documento", `📄 ${d.name}`, async () => {
          return sendFile({ ...d, resolvedType: "document" });
        });
      });
      bar.appendChild(btn);
    });

    document.body.appendChild(bar);

    const barH = bar.offsetHeight || 40;
    const appEl = document.getElementById("app");
    if (appEl) {
      appEl.style.height = `calc(100vh - ${barH}px)`;
      appEl.style.overflow = "hidden";
    }

    function positionBar() {
      const sidePanel = document.getElementById("side") ||
        document.querySelector("[data-side]") ||
        document.querySelector("._pane-list") ||
        document.querySelector('[data-testid="chat-list"]');
      if (sidePanel) {
        bar.style.left = sidePanel.getBoundingClientRect().right + "px";
      } else {
        bar.style.left = "30%";
      }
    }

    positionBar();
    window.addEventListener("resize", positionBar);
  }

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
    injectBridge();      // Still needed for audio PTT
    setupStorageBridge();
    if (token) await loadAssets();
    createBar();

    window.addEventListener("risezap:bridge-ready", () => createBar());

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
