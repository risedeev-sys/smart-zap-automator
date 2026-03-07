/**
 * Rise Zap — WPP Bridge (Page Context)
 *
 * Runs inside the WhatsApp Web page context with full access to
 * window, webpack modules, and the WPP global from @wppconnect/wa-js.
 *
 * Communication protocol:
 *   Content Script → CustomEvent("risezap:send", { detail: { requestId, type, url, isPtt, caption, fileName } })
 *   Bridge         → CustomEvent("risezap:result", { detail: { requestId, success, stage, errorCode, errorMessage, strategy, messageId } })
 *
 * Stages: FETCH_CONTENT → PREPARE_CONTENT → SEND_REQUEST → SEND_RESULT
 *
 * Storage bridge (chrome.storage proxy):
 *   Bridge         → CustomEvent("REQ_RISEZAP_STORE_GET", { detail: { requestCode, key } })
 *   Content Script → CustomEvent("RES_RISEZAP_STORE_GET_{requestCode}", { detail: { value } })
 */

(function () {
  "use strict";

  // ─── Constants ─────────────────────────────────────────

  const STAGE = Object.freeze({
    FETCH_CONTENT: "FETCH_CONTENT",
    PREPARE_CONTENT: "PREPARE_CONTENT",
    SEND_REQUEST: "SEND_REQUEST",
    SEND_RESULT: "SEND_RESULT",
  });

  const ERROR_CODE = Object.freeze({
    BRIDGE_NOT_READY: "BRIDGE_NOT_READY",
    NO_ACTIVE_CHAT: "NO_ACTIVE_CHAT",
    NO_URL: "NO_URL",
    FETCH_FAILED: "FETCH_FAILED",
    SEND_FAILED: "SEND_FAILED",
    SEND_RESULT_ERROR: "SEND_RESULT_ERROR",
    SEND_RESULT_TIMEOUT: "SEND_RESULT_TIMEOUT",
    SEND_TIMEOUT: "SEND_TIMEOUT",
    FETCH_TIMEOUT: "FETCH_TIMEOUT",
    UNKNOWN: "UNKNOWN",
  });

  // Timeouts by payload type
  const TIMEOUT = Object.freeze({
    FETCH_NORMAL: 45000,
    FETCH_VIDEO: 180000,
    SEND_NORMAL: 90000,
    SEND_VIDEO_FAST_PATH: 90000,
    SEND_VIDEO: 300000,
    SEND_RESULT_WAIT: 120000,
  });

  // ─── State ──────────────────────────────────────────────

  let wppReady = false;

  // ─── Wait for WPP (wa-js) ──────────────────────────────

  function initWpp() {
    if (typeof WPP === "undefined") {
      console.warn("[RiseZap:Bridge] WPP global not found. wa-js may not be loaded.");
      return;
    }

    if (WPP.webpack && typeof WPP.webpack.onReady === "function") {
      WPP.webpack.onReady(function () {
        wppReady = true;
        console.log("[RiseZap:Bridge] WPP.webpack ready — bridge active");
        window.dispatchEvent(new CustomEvent("risezap:bridge-ready"));
      });
    } else {
      const poll = setInterval(function () {
        if (WPP.isReady) {
          clearInterval(poll);
          wppReady = true;
          console.log("[RiseZap:Bridge] WPP.isReady — bridge active (polled)");
          window.dispatchEvent(new CustomEvent("risezap:bridge-ready"));
        }
      }, 500);
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  function isVideoPayload(type, mime, fileName) {
    const lowerMime = String(mime || "").toLowerCase();
    const lowerName = String(fileName || "").toLowerCase();
    if (type === "video") return true;
    if (type === "document") {
      return lowerMime.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/.test(lowerName);
    }
    return false;
  }

  async function fetchBlobWithTimeout(targetUrl, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function ensureSendableContent(content, type, fileName, mime) {
    if (!(content instanceof Blob)) return content;

    const finalMime = mime || content.type || (
      type === "video" ? "video/mp4" :
        type === "audio" ? "audio/mpeg" :
          type === "image" ? "image/jpeg" :
            "application/octet-stream"
    );

    // Bypassing InvalidMediaCheck on WhatsApp Business (@lid):
    // PTT audio cannot have filename or File wrapper, MUST be a raw Blob.
    if (type === "audio") {
      return new Blob([content], { type: finalMime });
    }

    if (content instanceof File && content.name) return content; // already a valid File
    if (typeof File === "undefined") return content;

    const defaultName = type === "video" ? "video.mp4" :
      type === "image" ? "image.jpg" : "file";

    const normalizedName = (fileName && String(fileName).trim()) || defaultName;
    const hasExt = normalizedName.includes(".");
    const fallbackExt = type === "video" ? ".mp4" :
      type === "image" ? ".jpg" : "";

    const finalName = hasExt ? normalizedName : `${normalizedName}${fallbackExt}`;

    try {
      return new File([content], finalName, { type: finalMime });
    } catch (e) {
      log("File constructor failed, using Blob", { error: String(e) });
      const b = new Blob([content], { type: finalMime });
      b.name = finalName;
      return b;
    }
  }

  function dataUrlToFile(dataUrl, fileName) {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    try {
      const arr = dataUrl.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const defaultName = fileName || `file_${Date.now()}`;
      try {
        return new File([u8arr], defaultName, { type: mime || "application/octet-stream" });
      } catch (e) {
        const b = new Blob([u8arr], { type: mime || "application/octet-stream" });
        b.name = defaultName;
        return b;
      }
    } catch (e) {
      log("dataUrlToFile failed", { error: String(e) });
      return dataUrl;
    }
  }

  // ─── Structured Response ──────────────────────────────

  function respond(requestId, payload) {
    window.dispatchEvent(
      new CustomEvent("risezap:result", {
        detail: { requestId, ...payload },
      })
    );
  }

  function respondSuccess(requestId, stage, extra) {
    respond(requestId, {
      success: true,
      stage,
      errorCode: null,
      errorMessage: null,
      ...(extra || {}),
    });
  }

  function respondError(requestId, stage, errorCode, errorMessage, extra) {
    respond(requestId, {
      success: false,
      stage,
      errorCode,
      errorMessage,
      ...(extra || {}),
    });
  }

  // ─── Build WPP Options ───────────────────────────────

  function buildSendOptions(type, detail, isVideo, strategy) {
    const { isPtt, caption, fileName, asViewOnce, mime } = detail;
    const opts = {};

    // waitForAck=true can cause sendFileMessage to hang on current WA builds.
    opts.waitForAck = false;

    switch (type) {
      case "audio": {
        opts.type = "auto-detect";

        // Progressive fallback strategy:
        // 1) PTT first (voice note UX)
        // 2) Regular audio fallback if PTT is rejected by current WA build/codec
        const normalizedStrategy = String(strategy || "");
        const forceCommonAudio = normalizedStrategy.startsWith("audio-common");
        opts.isPtt = !forceCommonAudio;

        // Omitting mimetype parameter mimics native attachment processing
        if (normalizedStrategy === "audio-ptt-with-viewonce" && asViewOnce) {
          opts.isViewOnce = true;
        }
        break;
      }

      case "image":
      case "video":
        // Forcing exact types + mimetypes on media sends triggers InvalidMediaCheck in @lid chats. 
        // Using "auto-detect" lets wa-js / WhatsApp derive it naturally from the DataUrl header.
        opts.type = "auto-detect";
        opts.caption = caption || undefined;
        if (asViewOnce) opts.isViewOnce = true;
        break;

      case "document":
        opts.type = "document";
        opts.filename = fileName || "file";
        opts.caption = caption || undefined;
        // Specifically omitting mimetype avoids strict typing mismatches
        break;

      default:
        opts.type = "auto-detect";
        opts.caption = caption || undefined;
        opts.filename = fileName || undefined;
        break;
    }

    return opts;
  }

  // ─── Core Send Logic (single attempt) ─────────────────

  async function attemptSend(chatId, content, options, sendTimeoutMs) {
    const sendPromise = WPP.chat.sendFileMessage(chatId, content, options);
    const sendReturn = await withTimeout(sendPromise, sendTimeoutMs, "sendFileMessage");

    // Extract message ID if available
    const messageId = sendReturn?.id?._serialized || sendReturn?.id || null;

    // Some wa-js builds may not expose sendMsgResult in certain paths.
    // If we at least have a message id, treat as accepted by client and continue.
    if (!sendReturn || !sendReturn.sendMsgResult) {
      if (messageId) {
        return {
          success: true,
          messageId,
          sendMsgResult: null,
          acceptedWithoutAck: true,
        };
      }

      return {
        success: false,
        errorCode: ERROR_CODE.SEND_RESULT_ERROR,
        errorMessage: "sendMsgResult missing from sendFileMessage return",
        messageId,
      };
    }

    try {
      const ackResult = await withTimeout(
        Promise.resolve(sendReturn.sendMsgResult),
        TIMEOUT.SEND_RESULT_WAIT,
        "sendMsgResult"
      );

      const messageSendResult = ackResult?.messageSendResult;
      if (messageSendResult !== undefined && messageSendResult !== 0 && messageSendResult !== "OK") {
        return {
          success: false,
          errorCode: `SEND_RESULT_${messageSendResult}`,
          errorMessage: `sendMsgResult: ${messageSendResult}`,
          messageId,
          sendMsgResult: messageSendResult,
        };
      }

      return {
        success: true,
        messageId,
        sendMsgResult: messageSendResult ?? "OK",
      };
    } catch (ackErr) {
      return {
        success: false,
        errorCode: ERROR_CODE.SEND_RESULT_TIMEOUT,
        errorMessage: ackErr?.message || String(ackErr),
        messageId,
      };
    }
  }

  // ─── Send Handler ──────────────────────────────────────

  window.addEventListener("risezap:send", async function (evt) {
    const detail = evt.detail || {};
    const { requestId, type, url, fallbackUrl, blobUrl, dataUrl, fileName, mime } = detail;

    if (!requestId) return;

    const startMs = Date.now();
    const isVideo = isVideoPayload(type, mime, fileName);

    const log = (msg, data) => {
      const elapsed = Date.now() - startMs;
      console.log(`[RiseZap:Bridge] [${elapsed}ms] ${msg}`, data || "");
    };

    // ─── Guard: bridge must be ready ───────────────────

    if (!wppReady) {
      respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.BRIDGE_NOT_READY, "WPP bridge not ready.");
      return;
    }

    // ─── Get active chat ──────────────────────────────

    let chatId;
    try {
      let activeChat = await WPP.chat.getActiveChat();

      // Fallback manual caso a lib WPPConnect (WA-JS) esteja com a Store.Chat quebrada para a UI atual
      if (!activeChat || !activeChat.id) {
        log("WPP.chat.getActiveChat failed. Attempting DOM heuristic fallback...");
        const allChats = await WPP.chat.getChats();
        const fallbackChat = allChats.find(c => c.active) || allChats[0];
        if (fallbackChat) activeChat = fallbackChat;
      }

      if (!activeChat || !activeChat.id) {
        respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.NO_ACTIVE_CHAT, "No active chat found after fallback.");
        return;
      }

      function stringifyWid(wid) {
        if (!wid) return "";
        if (typeof wid === "string") return wid;
        if (typeof wid._serialized === "string") return wid._serialized;
        const user = wid.user || wid.id || "";
        const server = wid.server || wid.domain || "c.us";
        if (user) return `${user}@${server}`;
        const fallback = wid.toString();
        return fallback === "[object Object]" ? "" : fallback;
      }

      chatId = stringifyWid(activeChat.id);

      if (!chatId || typeof chatId !== "string" || !chatId.includes("@")) {
        respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.INVALID_WID, "Invalid WID formatting.");
        return;
      }

      // ─── STAGE: Text Message ────────────────────────────
      if (type === "text") {
        try {
          const sendReturn = await WPP.chat.sendTextMessage(chatId, detail.content, { waitForAck: false });
          const messageId = sendReturn?.id?._serialized || sendReturn?.id || null;
          respond(requestId, { success: true, messageId, sendMsgResult: "OK" });
        } catch (err) {
          respondError(requestId, "SEND_RESULT", "SEND_TEXT_ERROR", err?.message || String(err));
        }
        return;
      }

      log("Active chat resolved", { chatId });
    } catch (err) {
      respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.NO_ACTIVE_CHAT, err.message || String(err));
      return;
    }

    // ─── STAGE: FETCH_CONTENT ─────────────────────────

    let content;

    // Priority 1: dataUrl (base64 string from content script — no CORS, no context issues)
    if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
      log("FETCH_CONTENT using dataUrl (base64)", { type, length: dataUrl.length });
      content = dataUrl;
    } else {
      // Legacy path: fetch from URL candidates
      log("FETCH_CONTENT start (URL fetch)", { type, isVideo });

      const fetchErrors = [];
      const fetchTimeoutMs = isVideo ? TIMEOUT.FETCH_VIDEO : TIMEOUT.FETCH_NORMAL;

      const candidates = [
        { value: blobUrl, label: "blobUrl" },
        { value: url, label: "url" },
        { value: fallbackUrl, label: "fallbackUrl" },
      ].filter((c, i, arr) => c.value && arr.findIndex((x) => x.value === c.value) === i);

      if (!candidates.length) {
        respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.NO_URL, "No URL or dataUrl provided.");
        return;
      }

      for (const candidate of candidates) {
        try {
          content = await fetchBlobWithTimeout(candidate.value, fetchTimeoutMs);
          log(`FETCH_CONTENT success via ${candidate.label}`, { size: content.size, type: content.type });
          break;
        } catch (err) {
          fetchErrors.push(`${candidate.label}: ${err.message || err}`);
        }
      }

      if (!content) {
        respondError(requestId, STAGE.FETCH_CONTENT, ERROR_CODE.FETCH_FAILED, fetchErrors.join(" | "));
        return;
      }
    }

    // ─── STAGE: PREPARE_CONTENT ───────────────────────

    log("PREPARE_CONTENT", { isVideo, originalType: type, contentIsDataUrl: typeof content === "string" });

    // Trust wa-js to handle the DataURL natively, as our DataURLs now have strict magic byte MimeTypes.
    // Converting them to Blobs/Files manually here seems to trigger InvalidMediaCheckRepairFailedType
    // in the WA module pipeline for certain media types.
    // UPDATE: Actually, native wa-js on @lid performs better when receiving clean bloated Blobs/Files 
    // rather than dealing with base64 parsing directly which triggers rigid heuristics.
    const sendableContent = typeof content === "string"
      ? ensureSendableContent(dataUrlToFile(content, fileName), type, fileName, mime)
      : ensureSendableContent(content, type, fileName, mime);

    // ─── STAGE: SEND_REQUEST + SEND_RESULT ────────────

    const isAudio = type === "audio";
    // Audio strategies: start with cleanest (most compatible), add options progressively
    // This ensures the first attempt has the highest chance of success.
    const strategies = isVideo
      ? ["video-native"]
      : isAudio
        ? ["audio-ptt-clean", "audio-ptt-with-mime", "audio-ptt-with-viewonce", "audio-common-clean", "audio-common-with-mime"]
        : ["default"];

    for (let si = 0; si < strategies.length; si++) {
      const strategy = strategies[si];
      const isLastStrategy = si === strategies.length - 1;

      const options = buildSendOptions(type, detail, isVideo, strategy);

      const sendTimeoutMs = isVideo
        ? TIMEOUT.SEND_VIDEO
        : TIMEOUT.SEND_NORMAL;

      log(`SEND_REQUEST strategy=${strategy}`, {
        chatId: chatId.toString(),
        wppType: options.type,
        mimetype: options.mimetype,
        filename: options.filename,
        waitForAck: options.waitForAck ?? true,
        sendTimeoutMs,
      });

      try {
        const result = await attemptSend(chatId, sendableContent, options, sendTimeoutMs);

        if (result.success) {
          log("SEND_RESULT success", { strategy, messageId: result.messageId, sendMsgResult: result.sendMsgResult });

          // Persist success diagnostic
          persistDiagnostic({
            success: true,
            strategy,
            sendMsgResult: result.sendMsgResult,
            elapsedMs: Date.now() - startMs,
            type,
            isVideo,
          });

          respondSuccess(requestId, STAGE.SEND_RESULT, {
            strategy,
            messageId: result.messageId,
            sendMsgResult: result.sendMsgResult,
          });
          return;
        }

        // Send returned but with error result
        log(`SEND_RESULT error (strategy=${strategy})`, { errorCode: result.errorCode });

        if (!isLastStrategy) {
          log(`Falling back to next strategy...`);
          continue;
        }

        // Last strategy failed
        persistDiagnostic({
          success: false,
          strategy,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          elapsedMs: Date.now() - startMs,
          type,
          isVideo,
        });

        respondError(requestId, STAGE.SEND_RESULT, result.errorCode, result.errorMessage, { strategy });
        return;

      } catch (err) {
        const errMsg = err.message || String(err);
        log(`SEND_REQUEST exception (strategy=${strategy}):`, errMsg);

        if (!isLastStrategy) {
          log(`Falling back to next strategy...`);
          continue;
        }

        const isTimeout = errMsg.includes("timeout");

        persistDiagnostic({
          success: false,
          strategy,
          errorCode: isTimeout ? ERROR_CODE.SEND_TIMEOUT : ERROR_CODE.SEND_FAILED,
          errorMessage: errMsg,
          elapsedMs: Date.now() - startMs,
          type,
          isVideo,
        });

        respondError(
          requestId,
          STAGE.SEND_REQUEST,
          isTimeout ? ERROR_CODE.SEND_TIMEOUT : ERROR_CODE.SEND_FAILED,
          errMsg,
          { strategy }
        );
        return;
      }
    }
  });

  // ─── Diagnostic Persistence ───────────────────────────

  function persistDiagnostic(data) {
    try {
      if (typeof window._rzStoreSet === "function") {
        window._rzStoreSet("risezap_last_send_diagnostic", {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Non-critical
    }
  }

  // ─── Storage Bridge ────────────────────────────────────

  let storeRequestCounter = 0;

  window._rzStoreGet = function (key) {
    return new Promise(function (resolve) {
      const requestCode = ++storeRequestCounter;

      const handler = function (evt) {
        window.removeEventListener("RES_RISEZAP_STORE_GET_" + requestCode, handler);
        resolve(evt.detail?.value ?? null);
      };
      window.addEventListener("RES_RISEZAP_STORE_GET_" + requestCode, handler);

      window.dispatchEvent(
        new CustomEvent("REQ_RISEZAP_STORE_GET", {
          detail: { requestCode, key },
        })
      );

      setTimeout(function () {
        window.removeEventListener("RES_RISEZAP_STORE_GET_" + requestCode, handler);
        resolve(null);
      }, 5000);
    });
  };

  window._rzStoreSet = function (key, value) {
    window.dispatchEvent(
      new CustomEvent("REQ_RISEZAP_STORE_SET", {
        detail: { key, value },
      })
    );
  };

  // ─── Init ──────────────────────────────────────────────

  setTimeout(initWpp, 100);

  console.log("[RiseZap:Bridge] Bridge script loaded (v2 — deterministic contract), waiting for WPP...");
})();
