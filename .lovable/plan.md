
# Plano: Migrar Extensão para wa-js — Zero Evolution API

**STATUS: ✅ IMPLEMENTADO**

## O Que Foi Feito

### Arquivos Criados
1. **`extensao/injected/loader.js`** — Bootstrap que injeta o bridge no contexto da página
2. **`extensao/injected/wpp-bridge.js`** — Bridge que executa wa-js no contexto da página (sendFileMessage, getActiveChat)
3. **`extensao/lib/wppconnect-wa.js`** — Bundle standalone do @wppconnect/wa-js v3.20.1

### Arquivos Modificados
4. **`extensao/content/content.js`** — Reescrito:
   - ✅ Removido: `sendViaBackend()`, `sendAssetViaBackend()`, `loadConnectedInstance()`, `cachedInstance`, `getCurrentChatPhone()`, `extractPhoneFromText()`, `askPhoneManually()`, `lastDetectedPhone`, `preWarmCache()`
   - ✅ Adicionado: `injectBridge()`, `setupStorageBridge()`, `sendFileViaBridge()`, `isBridgeReady()`, indicador de status do bridge na barra
   - ✅ Todos os handlers (áudio, mídia, documento, funil) agora usam `sendFileViaBridge()` em vez de `sendAssetViaBackend()`
5. **`extensao/manifest.json`** — v3.0.0, adicionado `web_accessible_resources` para os scripts injetados

### Separação Absoluta
- **Extensão**: wa-js puro, envio nativo no contexto da página. Zero tráfego para backend.
- **Backend**: Evolution API exclusiva para automações de servidor (gatilhos, webhooks).
- Nenhum cruzamento entre as duas camadas.
