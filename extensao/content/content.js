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

  function isVideoMediaAsset(asset) {
    if (!asset || asset.resolvedType !== "media") return false;

    const mime = String(asset.mime || "").toLowerCase();
    const storagePath = String(asset.storage_path || "").toLowerCase();
    const name = String(asset.name || "").toLowerCase();
    const mediaType = String(asset.metadata?.mediaType || "").toLowerCase();
    const videoExtPattern = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

    return (
      mime.startsWith("video/") ||
      videoExtPattern.test(storagePath) ||
      videoExtPattern.test(name) ||
      mediaType === "video"
    );
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
      const rows = await supaFetch(table, "id,name,content,storage_path,mime,bytes,metadata", `&id=eq.${assetId}`);
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

  async function createBridgeBlobUrl(fileUrl) {
    if (!fileUrl) return null;

    const fetchInContent = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);
      try {
        const res = await fetch(fileUrl, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return {
          blobUrl: URL.createObjectURL(blob),
          mime: blob.type || null,
          bytes: typeof blob.size === "number" ? blob.size : null,
          source: "content",
        };
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      return await fetchInContent();
    } catch (contentErr) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "RISEZAP_FETCH_FILE_BUFFER",
          url: fileUrl,
        });

        if (!response?.ok || !response.base64) {
          throw new Error(response?.error || "background fetch failed");
        }

        const blob = base64ToBlob(response.base64, response.mime || "application/octet-stream");

        return {
          blobUrl: URL.createObjectURL(blob),
          mime: blob.type || null,
          bytes: typeof blob.size === "number" ? blob.size : null,
          source: "background-base64",
        };
      } catch (backgroundErr) {
        console.warn("[RiseZap] createBridgeBlobUrl failed", {
          contentError: contentErr?.message || String(contentErr),
          backgroundError: backgroundErr?.message || String(backgroundErr),
        });
        return null;
      }
    }
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
    // CRITICAL: Videos MUST be sent as "document" (not "video").
    // wa-js type:"video" tries to generate thumbnail via <video> element,
    // which browsers throttle/block, causing sends to hang indefinitely.
    // Sending as document with video mimetype still plays inline in WhatsApp.
    // See: https://github.com/wppconnect-team/wa-js/issues/2681
    let sendType;
    const resolvedType = asset.resolvedType;
    const isVideoAsset = isVideoMediaAsset(asset);

    if (resolvedType === "audio") {
      sendType = "audio";
    } else if (resolvedType === "media") {
      sendType = isVideoAsset ? "document" : "image";
    } else if (resolvedType === "document") {
      sendType = "document";
    } else {
      sendType = "auto-detect";
    }

    const normalizedFileName = (() => {
      const base = String(asset.name || "arquivo").trim() || "arquivo";
      if (!isVideoAsset) return base;
      if (/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(base)) return base;
      return `${base}.mp4`;
    })();

    // Always prefetch file in extension context (content/background) to avoid
    // direct cross-origin fetch in page context, which is the main source of FETCH_FAILED.
    const bridgeBlob = await createBridgeBlobUrl(signedUrl);
    const beforeSendSnapshot = snapshotOutgoingState();

    const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // Build payload
    const payload = {
      requestId,
      type: sendType,
      url: signedUrl,
      fallbackUrl: signedUrl,
      blobUrl: bridgeBlob?.blobUrl || undefined,
      isPtt: resolvedType === "audio", // audio always as PTT
      caption: undefined,
      fileName: normalizedFileName,
      asViewOnce: !!(asset.metadata?.singleView || asset.metadata?.single_view),
      mime: asset.mime || bridgeBlob?.mime || undefined,
    };

    console.log("[RiseZap] sendFileViaBridge:", {
      type: sendType,
      isPtt: payload.isPtt,
      name: asset.name,
      usingBlobUrl: !!payload.blobUrl,
      blobSource: bridgeBlob?.source || null,
    });

    // Shorter timeout to avoid funnel lock; if bridge fails/hangs we fallback to DOM upload.
    const timeoutMs = isVideoAsset ? 180000 : 60000;

    return new Promise((resolve) => {
      const releaseBlobUrl = () => {
        if (bridgeBlob?.blobUrl) {
          URL.revokeObjectURL(bridgeBlob.blobUrl);
        }
      };

      const failAndPersist = (stage, diagCode, diagMsg, strategy, normalizedSendResult) => {
        console.error(`[RiseZap] Send failed [${diagCode}] at ${stage}:`, diagMsg);
        showToast(`Erro [${diagCode}]: ${diagMsg}`, true);

        try {
          chrome.storage.local.set({
            risezap_last_send_failure: {
              assetName: asset.name,
              assetId: asset.id,
              sendType,
              stage,
              errorCode: diagCode,
              errorMessage: diagMsg,
              strategy: strategy || null,
              sendMsgResult: normalizedSendResult,
              timestamp: new Date().toISOString(),
            },
          });
        } catch {}

        resolve(false);
      };

      const timeout = setTimeout(() => {
        window.removeEventListener("risezap:result", handler);
        releaseBlobUrl();
        console.error("[RiseZap] Bridge global timeout", { requestId, timeoutMs, asset: asset.name });
        failAndPersist("SEND_REQUEST", "SEND_TIMEOUT", `bridge não respondeu em ${Math.round(timeoutMs / 1000)}s`, null, null);
      }, timeoutMs);

      async function handler(evt) {
        const detail = evt.detail || {};
        if (detail.requestId !== requestId) return;

        window.removeEventListener("risezap:result", handler);
        clearTimeout(timeout);
        releaseBlobUrl();

        const { success, stage, errorCode, errorMessage, strategy, messageId, sendMsgResult } = detail;

        console.log("[RiseZap] Bridge result:", {
          success,
          stage,
          errorCode,
          strategy,
          messageId,
          sendMsgResult,
          asset: asset.name,
        });

        const normalizedSendResult =
          typeof sendMsgResult === "string"
            ? sendMsgResult
            : sendMsgResult?.messageSendResult ?? null;

        const hasExplicitAck = normalizedSendResult === "OK" || normalizedSendResult === 0;

        if (success === true && stage === "SEND_RESULT" && hasExplicitAck) {
          resolve(true);
          return;
        }

        // Some WA builds omit explicit ack in wa-js return.
        // In this case, we only accept success if a new outgoing message is observed in chat.
        if (success === true && stage === "SEND_RESULT" && messageId) {
          const domConfirmation = await waitForOutgoingCommit(beforeSendSnapshot, isVideoAsset ? 90000 : 45000);
          if (domConfirmation.ok) {
            console.warn("[RiseZap] Bridge ack missing, but DOM confirmed outgoing message", {
              messageId,
              statusIcon: domConfirmation.statusIcon,
            });
            resolve(true);
            return;
          }
        }

        const diagCode = errorCode || (normalizedSendResult ? `SEND_RESULT_${normalizedSendResult}` : "SEND_RESULT_UNCONFIRMED");
        const diagMsg = errorMessage || "envio não confirmado pelo WhatsApp";
        failAndPersist(stage || "SEND_RESULT", diagCode, diagMsg, strategy, normalizedSendResult);
      }

      window.addEventListener("risezap:result", handler);
      window.dispatchEvent(new CustomEvent("risezap:send", { detail: payload }));
    });
  }

  async function fetchAssetBlob(fileUrl, fallbackMime) {
    const fetchInContent = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);
      try {
        const res = await fetch(fileUrl, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      return await fetchInContent();
    } catch (contentErr) {
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

  function resolveUploadFileName(asset, blobMime) {
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

  function pickAttachmentInput(inputs, preferMediaInput) {
    const mediaInput = inputs.find((input) => /(image|video)/i.test(input.accept || ""));
    const documentInput = inputs.find((input) => {
      const accept = String(input.accept || "").toLowerCase();
      if (!accept || accept === "*/*") return true;
      return accept.includes("application") || accept.includes("audio") || accept.includes("text");
    });

    return preferMediaInput
      ? mediaInput || documentInput || inputs[0]
      : documentInput || mediaInput || inputs[0];
  }

  async function sendFileViaDomUpload(asset) {
    if (!asset?.storage_path) return false;

    try {
      const signedUrl = await getSignedUrl(asset.storage_path);
      if (!signedUrl) {
        showToast("Erro ao gerar URL do arquivo", true);
        return false;
      }

      const blob = await fetchAssetBlob(signedUrl, asset.mime || "application/octet-stream");
      const fileName = resolveUploadFileName(asset, blob.type);
      const fileMime = asset.mime || blob.type || "application/octet-stream";
      const file = new File([blob], fileName, { type: fileMime });
      const beforeSendSnapshot = snapshotOutgoingState();

      const attachAnchor =
        document.querySelector('button[title="Attach"]') ||
        document.querySelector('button[aria-label="Attach"]') ||
        document.querySelector('button[aria-label="Anexar"]') ||
        document.querySelector('span[data-icon="plus-rounded"]') ||
        document.querySelector('span[data-icon="clip"]');

      if (attachAnchor) {
        const attachBtn = attachAnchor.closest("button") || attachAnchor;
        attachBtn.click();
        await sleep(180);
      }

      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled);
      if (!fileInputs.length) {
        showToast("Entrada de upload não encontrada no WhatsApp", true);
        return false;
      }

      const preferMediaInput = asset.resolvedType === "media";
      const targetInput = pickAttachmentInput(fileInputs, preferMediaInput);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      try {
        targetInput.files = dataTransfer.files;
      } catch {
        Object.defineProperty(targetInput, "files", {
          value: dataTransfer.files,
          configurable: true,
        });
      }

      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));

      const dialogRoot = targetInput.closest('div[role="dialog"]') || document;
      let sendBtn = findVisibleSendButton(dialogRoot);

      if (!sendBtn) {
        try {
          await sleep(250);
          sendBtn = findVisibleSendButton(document);
        } catch {}
      }

      if (!sendBtn) {
        showToast("Prévia não abriu para envio", true);
        return false;
      }

      const sendBtnEl = sendBtn.closest("button") || sendBtn;
      sendBtnEl.click();

      const confirmation = await waitForOutgoingCommit(beforeSendSnapshot, isVideoMediaAsset(asset) ? 120000 : 45000);
      if (!confirmation.ok) {
        showToast(`WhatsApp não confirmou envio (${confirmation.reason})`, true);
        return false;
      }

      console.log("[RiseZap] DOM upload fallback sent", {
        assetId: asset.id,
        assetName: asset.name,
        mime: fileMime,
        statusIcon: confirmation.statusIcon,
      });

      return true;
    } catch (err) {
      console.error("[RiseZap] sendFileViaDomUpload error", err);
      showToast(`Fallback DOM falhou: ${err?.message || "erro desconhecido"}`, true);
      return false;
    }
  }

  async function sendFileWithFallback(asset) {
    const nativeOk = await sendFileViaBridge(asset);
    if (nativeOk) return true;

    console.warn("[RiseZap] Native bridge failed, trying DOM fallback", {
      assetId: asset?.id,
      assetName: asset?.name,
      resolvedType: asset?.resolvedType,
    });

    showToast("Bridge falhou, tentando envio alternativo...", false, true);
    return await sendFileViaDomUpload(asset);
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

      const beforeSendSnapshot = snapshotOutgoingState();
      let sendBtn = findVisibleSendButton(document);

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

      const confirmation = await waitForOutgoingCommit(beforeSendSnapshot, 45000);
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
    return {
      count: nodes.length,
      lastMessageId: getMessageNodeId(lastNode),
    };
  }

  function readOutgoingStatus(node) {
    if (!node) {
      return { accepted: false, hasError: false, statusIcon: null };
    }

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
        if (status.hasError) {
          return { ok: false, reason: "msg-error", statusIcon: status.statusIcon };
        }

        if (status.accepted) {
          return { ok: true, reason: null, statusIcon: status.statusIcon };
        }

        // Some builds delay status icon rendering. If the new outgoing node is stable,
        // accept it as a committed send.
        if (Date.now() - candidateSeenAt >= 1500) {
          return { ok: true, reason: null, statusIcon: null };
        }
      }

      await sleep(250);
    }

    return { ok: false, reason: "timeout", statusIcon: null };
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

        let ok = false;

        showToast(`⏳ Funil "${funnelName}" — item ${i + 1}/${items.length}: ${asset.name || asset.resolvedType}`, false, true);

        if (asset.resolvedType === "message") {
          // Text stays DOM-based
          ok = await sendTextViaDom(asset.content || asset.name);
        } else {
          // Audio, Media, Document → native bridge with DOM fallback
          ok = await sendFileWithFallback(asset);
        }

        if (!ok) {
          console.error(`[RiseZap] Funnel item ${i + 1}/${items.length} FAILED: ${asset.resolvedType}`);
          if (!document.getElementById("risezap-toast")) {
            showToast(`Falha no item ${i + 1}. Funil interrompido.`, true);
          }
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
    if (!persistent) {
      setTimeout(() => t.remove(), 4000);
    }
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

      // Instant feedback: close modal + show toast immediately
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

    // Áudios — ciano (bridge + fallback DOM)
    assets.audios.forEach((a) => {
      const btn = makeBtn("🎙", a.name, "rz-audio");
      btn.addEventListener("click", () => {
        if (!a.storage_path) return showToast("Áudio sem arquivo", true);
        showPreview("Enviar Áudio", `🎙 ${a.name}`, async () => {
          return sendFileWithFallback({
            ...a,
            resolvedType: "audio",
          });
        });
      });
      bar.appendChild(btn);
    });

    // Mídias — amarelo (bridge + fallback DOM)
    assets.medias.forEach((m) => {
      const btn = makeBtn("🖼", m.name, "rz-media");
      btn.addEventListener("click", () => {
        if (!m.storage_path) return showToast("Mídia sem arquivo", true);
        const isVideo = (m.mime || "").startsWith("video");
        showPreview("Enviar Mídia", `${isVideo ? "🎬" : "🖼"} ${m.name}`, async () => {
          return sendFileWithFallback({
            ...m,
            resolvedType: "media",
          });
        });
      });
      bar.appendChild(btn);
    });

    // Documentos — rosa/magenta (bridge + fallback DOM)
    assets.documents.forEach((d) => {
      const btn = makeBtn("📄", d.name, "rz-document");
      btn.addEventListener("click", () => {
        if (!d.storage_path) return showToast("Documento sem arquivo", true);
        showPreview("Enviar Documento", `📄 ${d.name}`, async () => {
          return sendFileWithFallback({
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
