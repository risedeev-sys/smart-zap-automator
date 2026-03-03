/**
 * Rise Zap — Loader (Page Context)
 *
 * Injected into the WhatsApp Web DOM by the content script.
 * Bootstraps the wpp-bridge.js module that contains wa-js.
 *
 * Communication:
 *   Content Script → injects this file as <script>
 *   This file      → creates readiness signal + imports bridge
 */
(function () {
  "use strict";

  // Prevent double-injection
  if (document.getElementById("RZBridgeReady")) return;

  // Resolve the bridge URL relative to the loader's own location.
  // The content script sets data-bridge-url on the <script> tag.
  const scriptTag = document.currentScript;
  const bridgeUrl = scriptTag?.getAttribute("data-bridge-url");

  if (!bridgeUrl) {
    console.error("[RiseZap:Loader] Missing data-bridge-url attribute");
    return;
  }

  // Import the bridge module (ES module in page context)
  import(bridgeUrl)
    .then(() => {
      // Signal that the bridge script has been loaded
      const marker = document.createElement("div");
      marker.id = "RZBridgeReady";
      marker.style.display = "none";
      document.body.appendChild(marker);
      console.log("[RiseZap:Loader] Bridge loaded successfully");
    })
    .catch((err) => {
      console.error("[RiseZap:Loader] Failed to load bridge:", err);
    });
})();
