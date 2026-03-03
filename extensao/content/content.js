// Rise Zap — Content Script (barra no WhatsApp Web) — Envio 100% DOM
(function () {
  "use strict";

  const SUPABASE_URL = "https://txnhtcyjzohxkfwdfrvh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bmh0Y3lqem9oeGtmd2RmcnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0MTEsImV4cCI6MjA4Nzc4MDQxMX0.vUFZYFr8OLaZczKjcj4I8HOpMLNNOX1yo3GhvwPuR9Y";

  let token = null;
  let assets = { messages: [], audios: [], medias: [], documents: [], funnels: [] };
  let activeFunnelRunId = null;

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
      supaFetch("audios", "id,name,storage_path,mime"),
      supaFetch("medias", "id,name,storage_path,mime"),
      supaFetch("documents", "id,name,storage_path,mime"),
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
    const primaryTable = getTableByAssetType(normalizedType);

    const cached = getCachedAsset(normalizedType, assetId);
    if (cached) return cached;

    const tablePlan = primaryTable
      ? [primaryTable, "messages", "audios", "medias", "documents"].filter((table, idx, arr) => table && arr.indexOf(table) === idx)
      : ["messages", "audios", "medias", "documents"];

    for (const table of tablePlan) {
      const rows = await supaFetch(table, "id,name,content,storage_path,mime", `&id=eq.${assetId}`);
      if (!rows.length) continue;

      const resolvedType = getAssetTypeByTable(table);
      return {
        ...rows[0],
        resolvedType,
        table,
      };
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

  const normalizeLabel = (value) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  // ─── Send Text via DOM ────────────────────────────────

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

  // ─── Upload Normalization ──────────────────────────────

  async function convertWebpToJpeg(blob) {
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            return resolve(blob);
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((jpgBlob) => {
            URL.revokeObjectURL(url);
            resolve(jpgBlob || blob);
          }, "image/jpeg", 0.92);
        } catch {
          URL.revokeObjectURL(url);
          resolve(blob);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };

      img.src = url;
    });
  }

  async function normalizeUploadAsset(blob, fileName, mimeType) {
    let normalizedBlob = blob;
    let normalizedMime = (blob.type || mimeType || "application/octet-stream").toLowerCase();
    let normalizedFileName = fileName || "arquivo";

    const isWebp = normalizedMime.includes("image/webp") || /\.webp$/i.test(normalizedFileName);

    if (isWebp) {
      normalizedBlob = await convertWebpToJpeg(blob);
      normalizedMime = "image/jpeg";
      normalizedFileName = normalizedFileName.replace(/\.[a-z0-9]{2,8}$/i, "") + ".jpg";
      console.log("[RiseZap] WEBP convertido para JPEG para evitar envio como sticker");
    }

    return { blob: normalizedBlob, mime: normalizedMime, fileName: normalizedFileName };
  }

  // ─── Attachment Menu Navigation ────────────────────────

  function getAttachmentToggle() {
    const selectors = [
      "#main button span[data-icon='plus']",
      "#main button span[data-icon='attach-menu-plus']",
      "#main button span[data-icon='clip']",
      "#main span[data-icon='plus']",
      "#main span[data-icon='attach-menu-plus']",
      "#main span[data-icon='clip']",
      "button[aria-label*='Anexar']",
      "button[title*='Anexar']",
      "button[aria-label*='Attach']",
      "button[title*='Attach']",
    ];

    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (!found) continue;
      const clickable = found.closest("button, [role='button']") || found;
      return clickable;
    }

    return null;
  }

  async function openAttachmentMenu() {
    const toggle = getAttachmentToggle();
    if (!toggle) {
      console.warn("[RiseZap] Attachment toggle not found");
      return false;
    }
    toggle.click();
    await sleep(400);
    return true;
  }

  function findFileInputNearElement(node) {
    if (!node) return null;

    const scopes = [
      node,
      node.closest("label"),
      node.closest("li, div, button, span"),
      node.parentElement,
      node.parentElement?.parentElement,
    ].filter(Boolean);

    for (const scope of scopes) {
      const found = scope.querySelector?.("input[type='file']");
      if (found) return found;
    }

    return null;
  }

  async function clickAttachmentOption(targetKind) {
    const labelPatterns = {
      media: ["fotos e videos", "fotos e vídeos", "photos & videos", "photos and videos", "photo"],
      audio: ["audio", "áudio"],
      document: ["documento", "document"],
    };

    const patterns = labelPatterns[targetKind] || labelPatterns.document;

    const candidates = document.querySelectorAll(
      "#main li, #main button, #main label, #main [role='button'], " +
      "[data-animate-dropdown-item='true'], " +
      "li[tabindex], li[role='menuitem'], " +
      "div[role='button'], span[role='button']"
    );

    for (const el of candidates) {
      const text = normalizeLabel(el.textContent || "");
      const ariaLabel = normalizeLabel(el.getAttribute("aria-label") || "");
      const combined = `${text} ${ariaLabel}`;

      for (const pattern of patterns) {
        if (!combined.includes(normalizeLabel(pattern))) continue;

        const directInput = findFileInputNearElement(el);
        if (directInput) {
          console.log(`[RiseZap] Found direct input for targetKind=${targetKind}`);
          return { matched: true, element: el, input: directInput };
        }

        console.log(`[RiseZap] Clicking menu option: "${el.textContent?.trim()}" for targetKind=${targetKind}`);
        el.click();
        await sleep(450);

        const inputAfterClick = findFileInputNearElement(el);
        return { matched: true, element: el, input: inputAfterClick || null };
      }
    }

    console.warn(`[RiseZap] Menu option not found for targetKind=${targetKind}`);
    return { matched: false, element: null, input: null };
  }

  function getAcceptTokens(input) {
    return (input.getAttribute("accept") || "")
      .toLowerCase()
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function hasAudioAccept(tokens) {
    return tokens.some((token) =>
      token.startsWith("audio/") ||
      token.includes("opus") ||
      [".ogg", ".mp3", ".m4a", ".wav", ".aac", ".opus"].includes(token)
    );
  }

  function hasMediaAccept(tokens) {
    return tokens.some((token) =>
      token.startsWith("image/") ||
      token.startsWith("video/") ||
      [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm", ".3gp"].includes(token)
    );
  }

  function hasDocumentAccept(tokens) {
    return tokens.some((token) =>
      token === "*/*" ||
      token.startsWith("application/") ||
      token.startsWith("text/") ||
      [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar", ".csv", ".txt"].includes(token)
    );
  }

  function isStrictAudioInput(input) {
    const tokens = getAcceptTokens(input);
    if (tokens.length > 0 && hasAudioAccept(tokens) && !hasDocumentAccept(tokens)) return true;

    const hints = [
      input.getAttribute("id") || "",
      input.getAttribute("name") || "",
      input.getAttribute("class") || "",
      input.getAttribute("aria-label") || "",
      input.closest("label,li,button,div")?.textContent || "",
    ].join(" ").toLowerCase();

    return hasAudioAccept(tokens) || hints.includes("audio") || hints.includes("áudio") || hints.includes("voz");
  }

  function classifyInputKind(input) {
    const tokens = getAcceptTokens(input);
    if (tokens.length === 0) return "generic";

    const hasStickerOnly = tokens.every((token) => token === "image/webp" || token === ".webp");
    if (hasStickerOnly) return "sticker";

    const audio = hasAudioAccept(tokens);
    const media = hasMediaAccept(tokens);
    const document = hasDocumentAccept(tokens);

    if (audio && !media && !document) return "audio";
    if (media && !audio && !document) return "media";
    if (document && !audio && !media) return "document";

    return "generic";
  }

  function scoreInputForKind(input, targetKind, baselineInputs, preferredRoot = null) {
    if (!input || !input.isConnected || input.disabled) return -1000;

    const accept = (input.getAttribute("accept") || "").toLowerCase().trim();
    const tokens = getAcceptTokens(input);
    const kind = classifyInputKind(input);
    if (kind === "sticker") return -1000;

    const audioAccept = hasAudioAccept(tokens);
    const mediaAccept = hasMediaAccept(tokens);
    const documentAccept = hasDocumentAccept(tokens);

    let score = 0;
    if (!baselineInputs.has(input)) score += 45;
    if (input.closest("#main")) score += 12;
    if (preferredRoot && preferredRoot.contains?.(input)) score += 30;

    if (kind === targetKind) score += 140;
    if (kind === "generic") score += 20;

    if (targetKind === "audio") {
      if (audioAccept) score += 170;
      if (!audioAccept && (documentAccept || mediaAccept || accept.includes("application/"))) score -= 220;
      if (isStrictAudioInput(input)) score += 40;
    }

    if (targetKind === "media") {
      if (mediaAccept) score += 90;
      if (documentAccept && !mediaAccept) score -= 120;
      if (audioAccept && !mediaAccept) score -= 100;
    }

    if (targetKind === "document") {
      if (documentAccept) score += 90;
      if ((mediaAccept || audioAccept) && !documentAccept) score -= 120;
    }

    return score;
  }

  async function findFileInputForKind(targetKind, baselineInputs = [], preferredRoot = null) {
    const baselineSet = new Set(baselineInputs);

    for (let attempt = 0; attempt < 35; attempt++) {
      const inputs = [...document.querySelectorAll("input[type='file']")];
      let bestInput = null;
      let bestScore = -1000;

      for (const input of inputs) {
        const score = scoreInputForKind(input, targetKind, baselineSet, preferredRoot);
        if (score > bestScore) {
          bestScore = score;
          bestInput = input;
        }
      }

      if (targetKind === "audio") {
        const strictAudio = inputs
          .filter((input) => isStrictAudioInput(input) && classifyInputKind(input) !== "sticker")
          .sort((a, b) =>
            scoreInputForKind(b, targetKind, baselineSet, preferredRoot) -
            scoreInputForKind(a, targetKind, baselineSet, preferredRoot)
          )[0];

        if (strictAudio) return strictAudio;
      }

      if (bestInput && (bestScore >= 70 || (attempt > 10 && bestScore >= 35))) {
        return bestInput;
      }

      await sleep(140);
    }

    const allInputs = [...document.querySelectorAll("input[type='file']")].filter((input) => classifyInputKind(input) !== "sticker");

    if (targetKind === "audio") {
      const strict = allInputs.find((input) => isStrictAudioInput(input));
      return strict || null;
    }

    const preferredInput = allInputs.find((input) => preferredRoot?.contains?.(input));
    return preferredInput || allInputs[0] || null;
  }

  // ─── Send File via DOM ────────────────────────────────

  function getSendButtonCandidate() {
    const modal = document.querySelector("div[aria-modal='true'], [data-animate-modal-popup='true']");
    const lookupRoot = modal || document;

    const directButton =
      lookupRoot.querySelector("button[data-testid='compose-btn-send']") ||
      lookupRoot.querySelector("button[aria-label*='Enviar']") ||
      lookupRoot.querySelector("button[aria-label*='Send']") ||
      lookupRoot.querySelector("[role='button'][aria-label*='Enviar']") ||
      lookupRoot.querySelector("[role='button'][aria-label*='Send']");

    if (directButton) return directButton;

    const iconBtn =
      lookupRoot.querySelector("span[data-icon='send']") ||
      lookupRoot.querySelector("span[data-icon='send-filled']") ||
      lookupRoot.querySelector("span[data-icon='wds-ic-send-filled']") ||
      lookupRoot.querySelector("[data-icon*='send']");

    return iconBtn ? (iconBtn.closest("button, [role='button']") || iconBtn) : null;
  }

  async function waitForSendButton(timeoutMs) {
    const startedAt = Date.now();
    let sendBtn = null;

    while (Date.now() - startedAt < timeoutMs) {
      sendBtn = getSendButtonCandidate();
      if (sendBtn) return sendBtn;
      await sleep(200);
    }

    return null;
  }

  function getChatDropTarget() {
    const selectors = [
      "#main [data-testid='conversation-panel-wrapper']",
      "#main div[role='application']",
      "#main [data-testid='conversation-compose-box-input']",
      "#main",
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) return node;
    }

    return null;
  }

  function dispatchDragEvent(target, type, dataTransfer) {
    const event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    target.dispatchEvent(event);
  }

  async function trySendAudioViaDrop(file, bytes) {
    try {
      const dropTarget = getChatDropTarget();
      if (!dropTarget) return false;

      const dt = new DataTransfer();
      dt.items.add(file);

      dispatchDragEvent(dropTarget, "dragenter", dt);
      dispatchDragEvent(dropTarget, "dragover", dt);
      dispatchDragEvent(dropTarget, "drop", dt);

      await sleep(380);

      const prepareTimeout = Math.min(20000, Math.max(5000, Math.floor(bytes / 220)));
      const sendBtn = await waitForSendButton(prepareTimeout);
      if (!sendBtn) return false;

      sendBtn.click();
      return true;
    } catch (err) {
      console.warn("[RiseZap] Audio drop path failed, using attachment fallback", err);
      return false;
    }
  }

  async function sendFileViaDom(blob, fileName, mimeType, forcedKind = null) {
    try {
      const normalized = await normalizeUploadAsset(blob, fileName, mimeType);
      const uploadBlob = normalized.blob;
      const sourceFileName = normalized.fileName;
      const normalizedMime = normalized.mime;
      const inferredAudio = normalizedMime.startsWith("audio/");
      const inferredMedia = /^(image|video)\//.test(normalizedMime);
      const targetKind = forcedKind || (inferredAudio ? "audio" : inferredMedia ? "media" : "document");
      const effectiveMime = targetKind === "audio"
        ? (normalizedMime.startsWith("audio/") ? normalizedMime : "audio/ogg")
        : normalizedMime;

      const extensionMap = {
        "audio/ogg": "ogg",
        "audio/opus": "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "image/jpeg": "jpg",
        "image/png": "png",
        "video/mp4": "mp4",
        "application/pdf": "pdf",
      };

      const hasExtension = /\.[a-z0-9]{2,8}$/i.test(sourceFileName || "");
      const fallbackExt = extensionMap[effectiveMime] || (targetKind === "audio" ? "ogg" : "bin");
      const safeFileName = hasExtension ? sourceFileName : `${sourceFileName || "arquivo"}.${fallbackExt}`;
      const file = new File([uploadBlob], safeFileName, { type: effectiveMime });

      console.log("[RiseZap] sendFileViaDom:", safeFileName, effectiveMime, uploadBlob.size, "bytes", "kind:", targetKind);

      if (targetKind === "audio") {
        const sentByDrop = await trySendAudioViaDrop(file, uploadBlob.size);
        if (sentByDrop) return true;
      }

      const baselineInputs = [...document.querySelectorAll("input[type='file']")];

      const menuOpened = await openAttachmentMenu();
      if (!menuOpened) {
        showToast("Não encontrei o botão de anexar", true);
        return false;
      }

      const optionResult = await clickAttachmentOption(targetKind);
      if (!optionResult.matched) {
        console.warn(`[RiseZap] Não localizei opção de menu para ${targetKind}, tentando input existente`);
      }

      const dt = new DataTransfer();
      dt.items.add(file);

      await sleep(240);

      let fileInput = optionResult.input;
      if (!fileInput || !fileInput.isConnected || fileInput.disabled || classifyInputKind(fileInput) === "sticker") {
        fileInput = await findFileInputForKind(targetKind, baselineInputs, optionResult.element);
      }

      if (!fileInput) {
        await openAttachmentMenu();
        const retryOption = await clickAttachmentOption(targetKind);
        await sleep(220);
        fileInput = retryOption.input || await findFileInputForKind(targetKind, [], retryOption.element);
      }

      if (!fileInput) {
        showToast(`Input de ${targetKind} não encontrado`, true);
        return false;
      }

      let selectedKind = classifyInputKind(fileInput);

      if (targetKind === "audio" && !isStrictAudioInput(fileInput)) {
        await openAttachmentMenu();
        const retryAudioOption = await clickAttachmentOption("audio");
        const retryAudioInput = retryAudioOption.input || await findFileInputForKind("audio", [], retryAudioOption.element);
        if (retryAudioInput && isStrictAudioInput(retryAudioInput)) {
          fileInput = retryAudioInput;
          selectedKind = classifyInputKind(fileInput);
        } else {
          showToast("Não consegui selecionar o input de áudio do WhatsApp", true);
          return false;
        }
      }

      console.log("[RiseZap] Found file input:", {
        accept: fileInput.getAttribute("accept") || "(none)",
        id: fileInput.id || "(none)",
        selectedKind,
        targetKind,
      });

      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
      if (setter) setter.call(fileInput, dt.files);
      else fileInput.files = dt.files;

      fileInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      fileInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

      const prepareTimeout = Math.min(20000, Math.max(5000, Math.floor(uploadBlob.size / 220)));
      const sendBtn = await waitForSendButton(prepareTimeout);

      if (!sendBtn) {
        showToast("Não consegui preparar o arquivo para envio", true);
        return false;
      }

      sendBtn.click();
      return true;
    } catch (err) {
      console.error("[RiseZap] sendFileViaDom error:", err);
      showToast("Erro ao enviar arquivo: " + (err.message || "falha desconhecida"), true);
      return false;
    }
  }

  // ─── Send Funnel via DOM (sequential) ──────────────────

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
          ok = await sendTextViaDom(asset.content || asset.name);
        } else {
          if (!asset.storage_path) {
            showToast(`Item ${i + 1} sem arquivo, abortando funil.`, true);
            return false;
          }

          const signedUrl = await getSignedUrl(asset.storage_path);
          if (!signedUrl) {
            showToast(`Erro ao gerar URL do item ${i + 1}`, true);
            return false;
          }

          const blob = await downloadAsBlob(signedUrl);
          const defaultMime = asset.resolvedType === "audio"
            ? "audio/ogg"
            : asset.resolvedType === "document"
              ? "application/pdf"
              : "image/jpeg";
          ok = await sendFileViaDom(blob, asset.name, asset.mime || defaultMime, asset.resolvedType);
        }

        if (!ok) {
          console.error(`[RiseZap] Funnel item ${i + 1}/${items.length} FAILED: ${asset.resolvedType}`);
          showToast(`Falha no item ${i + 1}. Funil interrompido.`, true);
          return false;
        }

        console.log(`[RiseZap] Funnel item ${i + 1}/${items.length} sent: ${asset.resolvedType}`);

        if (i < items.length - 1) {
          await sleep(1500);
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
      position: "fixed", bottom: "52px", left: "50%",
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
    let sending = false;
    overlay.querySelector(".rz-btn-send").addEventListener("click", async () => {
      if (sending) return;
      sending = true;

      const btn = overlay.querySelector(".rz-btn-send");
      btn.textContent = "Enviando...";
      btn.disabled = true;
      closeModal();
      await sleep(300);

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
        sending = false;
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

    bar.innerHTML = `<span class="rz-logo">⚡</span>`;

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
          return sendFileViaDom(blob, a.name, a.mime || "audio/ogg", "audio");
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
          return sendFileViaDom(blob, m.name, m.mime || "image/jpeg", "media");
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
          return sendFileViaDom(blob, d.name, d.mime || "application/pdf", "document");
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
