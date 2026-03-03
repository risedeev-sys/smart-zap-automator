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

  async function resolveAsset(type, assetId) {
    const normalizedType = type === "mensagem" ? "message"
      : type === "midia" ? "media"
      : type === "documento" ? "document"
      : type;

    const table = normalizedType === "message" ? "messages"
      : normalizedType === "audio" ? "audios"
      : normalizedType === "media" ? "medias"
      : normalizedType === "document" ? "documents"
      : null;

    if (!table) return null;

    const rows = await supaFetch(table, "id,name,content,storage_path,mime", `&id=eq.${assetId}`);
    if (!rows.length) return null;

    return { ...rows[0], resolvedType: normalizedType, table };
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
  // This is the KEY fix: we must click the correct menu option
  // (Fotos e vídeos, Áudio, Documento) BEFORE looking for file inputs.
  // Without this, WhatsApp never renders the correct input[type=file].

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

  async function clickAttachmentOption(targetKind) {
    // Map targetKind to the menu label patterns
    const labelPatterns = {
      media: ["fotos e videos", "fotos e vídeos", "photos & videos", "photos and videos", "photo"],
      audio: ["audio", "áudio"],
      document: ["documento", "document"],
    };

    const patterns = labelPatterns[targetKind] || labelPatterns.document;

    // Look for clickable menu items with matching text
    const candidates = document.querySelectorAll(
      "#main li, #main button, #main [role='button'], " +
      "[data-animate-dropdown-item='true'], " +
      "li[tabindex], li[role='menuitem'], " +
      "div[role='button'], span[role='button']"
    );

    for (const el of candidates) {
      const text = normalizeLabel(el.textContent || "");
      const ariaLabel = normalizeLabel(el.getAttribute("aria-label") || "");
      const combined = `${text} ${ariaLabel}`;

      for (const pattern of patterns) {
        if (combined.includes(normalizeLabel(pattern))) {
          console.log(`[RiseZap] Clicking menu option: "${el.textContent?.trim()}" for targetKind=${targetKind}`);
          el.click();
          await sleep(500);
          return true;
        }
      }
    }

    console.warn(`[RiseZap] Menu option not found for targetKind=${targetKind}`);
    return false;
  }

  // ─── Send File via DOM ────────────────────────────────

  async function sendFileViaDom(blob, fileName, mimeType) {
    try {
      const normalized = await normalizeUploadAsset(blob, fileName, mimeType);
      const uploadBlob = normalized.blob;
      const resolvedMime = normalized.mime;
      const sourceFileName = normalized.fileName;
      const isAudioMime = resolvedMime.startsWith("audio/");
      const isMedia = /^(image|video)\//.test(resolvedMime);
      const targetKind = isAudioMime ? "audio" : isMedia ? "media" : "document";

      const extensionMap = {
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "image/jpeg": "jpg",
        "image/png": "png",
        "video/mp4": "mp4",
        "application/pdf": "pdf",
      };

      const hasExtension = /\.[a-z0-9]{2,8}$/i.test(sourceFileName || "");
      const fallbackExt = extensionMap[resolvedMime] || "bin";
      const safeFileName = hasExtension ? sourceFileName : `${sourceFileName || "arquivo"}.${fallbackExt}`;

      console.log("[RiseZap] sendFileViaDom:", safeFileName, resolvedMime, uploadBlob.size, "bytes", "kind:", targetKind);

      // STEP 1: Open attachment menu
      const menuOpened = await openAttachmentMenu();
      if (!menuOpened) {
        showToast("Não encontrei o botão de anexar", true);
        return false;
      }

      // STEP 2: Click the correct menu option (Fotos e vídeos / Áudio / Documento)
      const optionClicked = await clickAttachmentOption(targetKind);
      if (!optionClicked) {
        console.warn("[RiseZap] Could not click menu option, trying direct input injection");
      }

      // STEP 3: Wait for file input to appear
      const file = new File([uploadBlob], safeFileName, { type: resolvedMime });
      const dt = new DataTransfer();
      dt.items.add(file);

      await sleep(300);

      // Find the file input that WhatsApp just rendered
      let fileInput = null;
      for (let attempt = 0; attempt < 25; attempt++) {
        const inputs = [...document.querySelectorAll("input[type='file']")];
        // Get the most recently added input (usually last in DOM)
        // Filter out sticker inputs
        const valid = inputs.filter((inp) => {
          const accept = (inp.getAttribute("accept") || "").toLowerCase();
          // Skip sticker-only inputs
          if (accept === "image/webp" || accept === ".webp") return false;
          if (!inp.isConnected || inp.disabled) return false;
          return true;
        });

        if (valid.length > 0) {
          // Prefer the last one (most recently added by WhatsApp after menu click)
          fileInput = valid[valid.length - 1];
          break;
        }
        await sleep(150);
      }

      if (!fileInput) {
        showToast("Input de arquivo não encontrado", true);
        return false;
      }

      console.log("[RiseZap] Found file input:", {
        accept: fileInput.getAttribute("accept") || "(none)",
        id: fileInput.id || "(none)",
      });

      // STEP 4: Inject file into the input (WITHOUT calling input.click())
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
      if (setter) setter.call(fileInput, dt.files);
      else fileInput.files = dt.files;

      fileInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      fileInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

      // STEP 5: Wait for WhatsApp to process and show send button
      const prepareTimeout = Math.min(20000, Math.max(5000, Math.floor(uploadBlob.size / 220)));

      const findSendButton = () => {
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

        if (iconBtn) return iconBtn.closest("button, [role='button']") || iconBtn;

        return null;
      };

      let sendBtn = null;
      const startedAt = Date.now();
      while (Date.now() - startedAt < prepareTimeout) {
        sendBtn = findSendButton();
        if (sendBtn) break;
        await sleep(200);
      }

      // Fallback: try drop if input injection didn't work
      if (!sendBtn) {
        console.log("[RiseZap] Input injection didn't trigger send UI, trying drop fallback");
        const dropTargets = [
          document.querySelector("#main [role='application']"),
          document.querySelector("#main"),
          document.querySelector("#main footer"),
        ].filter(Boolean);

        for (const target of dropTargets) {
          try {
            const dropTransfer = new DataTransfer();
            dropTransfer.items.add(file);
            target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));
            target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));
            target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));

            const dropStart = Date.now();
            while (Date.now() - dropStart < 5000) {
              sendBtn = findSendButton();
              if (sendBtn) break;
              await sleep(200);
            }
            if (sendBtn) break;
          } catch (e) {
            console.warn("[RiseZap] Drop fallback failed", e);
          }
        }
      }

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
    const items = await loadFunnelItems(funnelId);
    if (!items || items.length === 0) {
      showToast(`Funil "${funnelName}" está vazio`, true);
      return false;
    }

    showToast(`Enviando funil "${funnelName}" (${items.length} itens)...`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Apply item delay
      const delayMs = ((item.delay_min || 0) * 60 + (item.delay_sec || 0)) * 1000;
      if (delayMs > 0 && i > 0) {
        console.log(`[RiseZap] Funnel delay: ${delayMs / 1000}s before item ${i + 1}`);
        await sleep(delayMs);
      }

      const asset = await resolveAsset(item.type, item.asset_id);
      if (!asset) {
        console.warn(`[RiseZap] Could not resolve asset: type=${item.type}, id=${item.asset_id}`);
        showToast(`Item ${i + 1} não encontrado, pulando...`, true);
        continue;
      }

      let ok = false;

      if (asset.resolvedType === "message") {
        ok = await sendTextViaDom(asset.content || asset.name);
      } else {
        // Audio, media, document — need to download and send
        if (!asset.storage_path) {
          showToast(`Item ${i + 1} sem arquivo, pulando...`, true);
          continue;
        }

        const signedUrl = await getSignedUrl(asset.storage_path);
        if (!signedUrl) {
          showToast(`Erro ao gerar URL do item ${i + 1}`, true);
          continue;
        }

        const blob = await downloadAsBlob(signedUrl);
        const defaultMime = asset.resolvedType === "audio" ? "audio/ogg"
          : asset.resolvedType === "document" ? "application/pdf"
          : "image/jpeg";
        ok = await sendFileViaDom(blob, asset.name, asset.mime || defaultMime);
      }

      if (ok) {
        console.log(`[RiseZap] Funnel item ${i + 1}/${items.length} sent: ${asset.resolvedType}`);
      } else {
        console.error(`[RiseZap] Funnel item ${i + 1}/${items.length} FAILED: ${asset.resolvedType}`);
      }

      // Small gap between items to let WhatsApp process
      if (i < items.length - 1) {
        await sleep(1500);
      }
    }

    showToast(`Funil "${funnelName}" concluído! ✓`);
    return true;
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
    overlay.querySelector(".rz-btn-send").addEventListener("click", async () => {
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
