/**
 * Rise Zap — WPP Bridge (Page Context)
 *
 * Runs inside the WhatsApp Web page context with full access to
 * window, webpack modules, and the WPP global from @wppconnect/wa-js.
 *
 * Communication protocol:
 *   Content Script → CustomEvent("risezap:send", { detail: { requestId, type, url, isPtt, caption, fileName } })
 *   Bridge         → CustomEvent("risezap:result", { detail: { requestId, success, error } })
 *
 * Storage bridge (chrome.storage proxy):
 *   Bridge         → CustomEvent("REQ_RISEZAP_STORE_GET", { detail: { requestCode, key } })
 *   Content Script → CustomEvent("RES_RISEZAP_STORE_GET_{requestCode}", { detail: { value } })
 */

(function () {
  "use strict";

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
        // Dispatch readiness event for content script
        window.dispatchEvent(new CustomEvent("risezap:bridge-ready"));
      });
    } else {
      // Fallback: poll for isReady
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

  // ─── Send Handler ──────────────────────────────────────

  window.addEventListener("risezap:send", async function (evt) {
    const detail = evt.detail || {};
    const { requestId, type, url, fallbackUrl, blobUrl, isPtt, caption, fileName, asViewOnce, mime } = detail;

    if (!requestId) return;

    const respond = (success, error) => {
      window.dispatchEvent(
        new CustomEvent("risezap:result", {
          detail: { requestId, success, error: error || null },
        })
      );
    };

    // ─── Guard: bridge must be ready ───────────────────

    if (!wppReady) {
      respond(false, "WPP bridge not ready. WhatsApp Web modules not loaded yet.");
      return;
    }

    // ─── Get active chat ──────────────────────────────

    let chatId;
    try {
      const activeChat = await WPP.chat.getActiveChat();
      if (!activeChat || !activeChat.id) {
        respond(false, "No active chat. Open a conversation first.");
        return;
      }
      chatId = activeChat.id;
    } catch (err) {
      respond(false, "Failed to get active chat: " + (err.message || err));
      return;
    }

    // ─── Fetch file (resilient strategy) ───────────────

    let content;
    const fetchErrors = [];

    const candidates = [
      { value: blobUrl, label: "blobUrl" },
      { value: url, label: "url" },
      { value: fallbackUrl, label: "fallbackUrl" },
    ].filter((candidate, index, arr) => {
      if (!candidate.value) return false;
      return arr.findIndex((x) => x.value === candidate.value) === index;
    });

    if (!candidates.length) {
      respond(false, "No URL provided for file send.");
      return;
    }

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate.value, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        content = await res.blob();
        break;
      } catch (err) {
        fetchErrors.push(`${candidate.label}: ${err.message || err}`);
      }
    }

    if (!content) {
      respond(false, "Failed to fetch file: " + fetchErrors.join(" | "));
      return;
    }

    // ─── Build options based on type ──────────────────

    let options = {};

    switch (type) {
      case "audio":
        options = {
          type: "audio",
          isPtt: isPtt !== false, // default true for audio
          mimetype: "audio/ogg; codecs=opus",
        };
        if (asViewOnce) options.isViewOnce = true;
        break;

      case "image":
        options = {
          type: "image",
          caption: caption || undefined,
          mimetype: mime || "image/jpeg",
        };
        if (asViewOnce) options.isViewOnce = true;
        break;

      case "video":
        options = {
          type: "video",
          caption: caption || undefined,
          mimetype: mime || "video/mp4",
        };
        if (asViewOnce) options.isViewOnce = true;
        break;

      case "document":
        options = {
          type: "document",
          filename: fileName || "file",
        };
        break;

      default:
        // Auto-detect
        options = {
          type: "auto-detect",
          caption: caption || undefined,
          filename: fileName || undefined,
        };
        break;
    }

    // ─── Send via WPP ─────────────────────────────────

    try {
      console.log("[RiseZap:Bridge] Sending:", { chatId: chatId.toString(), type, isPtt });
      await WPP.chat.sendFileMessage(chatId, content, options);
      console.log("[RiseZap:Bridge] Sent successfully");
      respond(true);
    } catch (err) {
      console.error("[RiseZap:Bridge] sendFileMessage failed:", err);
      respond(false, "WPP send failed: " + (err.message || err));
    }
  });

  // ─── Storage Bridge ────────────────────────────────────
  // The injected script cannot access chrome.storage directly.
  // It sends requests via CustomEvent; the content script responds.

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

      // Timeout after 5s
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

  // ─── Helpers ───────────────────────────────────────────

  // ─── Init ──────────────────────────────────────────────

  // Wait a tick for wa-js to be available (it's loaded as a script before this)
  setTimeout(initWpp, 100);

  console.log("[RiseZap:Bridge] Bridge script loaded, waiting for WPP...");
})();
