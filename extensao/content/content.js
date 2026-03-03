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
        "image/webp": "webp",
        "video/mp4": "mp4",
        "application/pdf": "pdf",
      };

      const hasExtension = /\.[a-z0-9]{2,8}$/i.test(sourceFileName || "");
      const fallbackExt = extensionMap[resolvedMime] || "bin";
      const safeFileName = hasExtension ? sourceFileName : `${sourceFileName || "arquivo"}.${fallbackExt}`;

      console.log("[RiseZap] sendFileViaDom:", safeFileName, resolvedMime, uploadBlob.size, "bytes", "kind:", targetKind);

      const normalizeLabel = (value) =>
        (value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      const menuSignals = ["documento", "fotos e videos", "audio", "nova figurinha", "document", "photos", "sticker"];

      const isAttachmentMenuOpen = () => {
        const controls = document.querySelectorAll("#main button, #main [role='button'], #main li");
        for (const el of controls) {
          const text = normalizeLabel(el.textContent || "");
          if (!text) continue;
          if (menuSignals.some((signal) => text.includes(signal))) return true;
        }
        return false;
      };

      const getAttachmentToggle = () => {
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
          const text = normalizeLabel(clickable.textContent || "");
          const label = normalizeLabel(clickable.getAttribute("aria-label") || clickable.getAttribute("title") || "");
          const composite = `${text} ${label}`;
          if (/document|fotos|videos|audio|figurinha|sticker/.test(composite)) continue;
          return clickable;
        }

        return null;
      };

      const isDocumentAccept = (accept) =>
        !accept ||
        accept === "*" ||
        accept === "*/*" ||
        accept.includes("application") ||
        accept.includes("text") ||
        accept.includes("document") ||
        accept.includes(".pdf") ||
        accept.includes(".doc") ||
        accept.includes(".xls") ||
        accept.includes(".ppt");

      const getInputContext = (input) => {
        const owner =
          input.closest("[role='button']") ||
          input.closest("button") ||
          input.closest("li") ||
          input.closest("label") ||
          input.parentElement;

        const parts = [
          owner?.textContent,
          owner?.getAttribute?.("aria-label"),
          owner?.getAttribute?.("title"),
          owner?.getAttribute?.("data-testid"),
          owner?.className,
          input.getAttribute("data-testid"),
          input.className,
        ];

        return normalizeLabel(parts.filter(Boolean).join(" "));
      };

      const classifyInput = (input) => {
        const accept = (input.getAttribute("accept") || "").toLowerCase();
        const context = getInputContext(input);

        const looksLikeSticker =
          /figurinha|sticker|new sticker/.test(context) ||
          (accept.includes("image/webp") && !accept.includes("image/jpeg") && !accept.includes("image/png"));

        if (looksLikeSticker) return "sticker";
        if (accept.includes("audio")) return "audio";
        if (accept.includes("image") || accept.includes("video")) return "media";
        if (isDocumentAccept(accept)) return "document";
        return "unknown";
      };

      const scoreInput = (input) => {
        const accept = (input.getAttribute("accept") || "").toLowerCase();
        const kind = classifyInput(input);

        if (kind === "sticker") return -999;

        let score = 0;

        if (targetKind === "media") {
          if (kind === "media") score += 40;
          if (accept.includes("image") || accept.includes("video")) score += 10;
          if (accept.includes("webp") && !accept.includes("jpeg") && !accept.includes("png")) score -= 50;
        } else if (targetKind === "audio") {
          if (kind === "audio") score += 45;
          if (accept.includes("audio")) score += 10;
        } else {
          if (kind === "document") score += 40;
        }

        if (accept.includes(resolvedMime.split("/")[0])) score += 6;
        if (input.closest("#main")) score += 6;

        return score;
      };

      const getCandidateInputs = () => {
        const raw = [
          ...document.querySelectorAll("#main input[type='file']"),
          ...document.querySelectorAll("input[type='file']"),
        ];

        const unique = [];
        const seen = new Set();

        for (const input of raw) {
          if (!input || seen.has(input) || input.disabled || !input.isConnected) continue;
          seen.add(input);
          unique.push(input);
        }

        const strict = unique.filter((input) => {
          const kind = classifyInput(input);
          if (kind === "sticker") return false;
          if (targetKind === "media") return kind === "media";
          if (targetKind === "audio") return kind === "audio";
          return kind === "document";
        });

        const pool = strict.length ? strict : unique.filter((input) => classifyInput(input) !== "sticker");

        return pool
          .map((input, index) => ({ input, score: scoreInput(input), index }))
          .filter((row) => row.score > -100)
          .sort((a, b) => (b.score - a.score) || (b.index - a.index))
          .map((row) => row.input);
      };

      const file = new File([uploadBlob], safeFileName, { type: resolvedMime });
      const dt = new DataTransfer();
      dt.items.add(file);

      const setFilesOnInput = (input) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files")?.set;
        if (setter) setter.call(input, dt.files);
        else input.files = dt.files;

        input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      };

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

      const waitForPreparedState = async (timeoutMs) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const sendBtn = findSendButton();
          if (sendBtn) return sendBtn;
          await sleep(180);
        }
        return null;
      };

      const prepareTimeout = Math.min(20000, Math.max(5000, Math.floor(uploadBlob.size / 220)));

      const simulateDropUpload = async () => {
        const dropTargets = [
          document.querySelector("#main [role='application']"),
          document.querySelector("#main"),
          document.querySelector("#main footer"),
          document.querySelector("#main div[contenteditable='true']"),
        ].filter(Boolean);

        for (const target of dropTargets) {
          try {
            const dropTransfer = new DataTransfer();
            dropTransfer.items.add(file);
            target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));
            target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));
            target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dropTransfer }));

            const sendBtn = await waitForPreparedState(prepareTimeout);
            if (sendBtn) return sendBtn;
          } catch (e) {
            console.warn("[RiseZap] Falha no fallback de drop", e);
          }
        }

        return null;
      };

      const simulatePasteImageUpload = async () => {
        if (!resolvedMime.startsWith("image/")) return null;
        const input =
          document.querySelector('#main div[contenteditable="true"][role="textbox"]') ||
          document.querySelector('#main footer div[contenteditable="true"]') ||
          document.querySelector('footer div[contenteditable="true"]');

        if (!input) return null;

        input.focus();
        await sleep(80);

        const clipboard = new DataTransfer();
        clipboard.items.add(file);
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboard,
        });

        input.dispatchEvent(pasteEvent);
        return await waitForPreparedState(prepareTimeout);
      };

      let candidates = getCandidateInputs();

      if (!candidates.length) {
        const toggle = getAttachmentToggle();
        if (toggle && !isAttachmentMenuOpen()) {
          toggle.click();
          await sleep(220);
        }

        for (let i = 0; i < 20; i++) {
          candidates = getCandidateInputs();
          if (candidates.length) break;
          await sleep(120);
        }
      }

      console.log(
        "[RiseZap] Candidate inputs:",
        candidates.map((input) => ({
          accept: input.getAttribute("accept") || "(sem accept)",
          kind: classifyInput(input),
          score: scoreInput(input),
        }))
      );

      let sendBtn = null;
      for (const input of candidates) {
        try {
          console.log("[RiseZap] Trying input", {
            targetKind,
            accept: input.getAttribute("accept") || "(sem accept)",
            kind: classifyInput(input),
          });

          setFilesOnInput(input);
          sendBtn = await waitForPreparedState(prepareTimeout);
          if (sendBtn) break;
        } catch (e) {
          console.warn("[RiseZap] Falha ao injetar arquivo no input", e);
        }
      }

      if (!sendBtn && targetKind === "media") {
        sendBtn = await simulatePasteImageUpload();
      }

      if (!sendBtn) {
        sendBtn = await simulateDropUpload();
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
        if (ok) {
          showToast("Mensagem enviada! ✓");
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
