

# Plano: Migrar Extensão para wa-js — Zero Evolution API

## Entendimento

Você foi claro: a extensão **não deve usar Evolution API em nenhum cenário**. Nem como primário, nem como fallback. A Evolution API é exclusiva para automações de backend (gatilhos, webhooks). A extensão opera 100% no WhatsApp Web aberto.

O plano anterior (Solução B, nota 9.8) incluía fallback para Evolution API — isso está **errado** e viola a separação de responsabilidades. Corrijo agora.

## Análise de Soluções (Revisada)

### Solução A: wa-js puro, sem fallback para Evolution API
- Manutenibilidade: 10/10 — Camada de abstração via bridge; zero coupling com backend
- Zero DT: 10/10 — Separação total: extensão = wa-js, backend = Evolution API
- Arquitetura: 10/10 — SRP perfeito. Content script não conhece Evolution API
- Escalabilidade: 10/10 — Novos tipos de mídia = adicionar handler no bridge
- Segurança: 10/10 — Sem tráfego para backend; envio local no contexto da página
- **NOTA FINAL: 10.0/10**

### DECISÃO: Solução A (Nota 10.0)

A separação é absoluta: extensão usa wa-js no contexto da página, Evolution API é exclusiva do backend. Nenhum cruzamento.

## Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPT (extensao/content/content.js)                │
│  - Carrega assets do Supabase (supaFetch)                   │
│  - Renderiza barra + modais                                 │
│  - Texto: sendTextViaDom (paste, inalterado)                │
│  - Arquivos: dispara CustomEvent("risezap:send") ao bridge  │
│  - Escuta CustomEvent("risezap:result") para feedback       │
│  - Storage bridge: proxy chrome.storage para script injetado│
└──────────────┬───────────────────────────────────────────────┘
               │ CustomEvent
               ▼
┌──────────────────────────────────────────────────────────────┐
│  PAGE CONTEXT (extensao/injected/wpp-bridge.js)              │
│  - Importa wa-js (bundle local em extensao/lib/)             │
│  - WPP.webpack.onReady() → sinaliza bridge pronto           │
│  - Escuta risezap:send → executa WPP.chat.sendFileMessage   │
│  - Áudio PTT: { type:'audio', isPtt:true }                  │
│  - Imagem: { type:'image', caption }                        │
│  - Vídeo: { type:'video', caption }                         │
│  - Documento: { type:'document', filename }                  │
│  - Responde via risezap:result                              │
└──────────────────────────────────────────────────────────────┘
```

## Arquivos

### 1. `extensao/injected/loader.js` (NOVO ~25 linhas)
- Injetado como `<script>` no DOM pelo content script
- Cria `<div id="RZBridgeReady">` como sinal visual de ready
- Faz `import()` dinâmico do `wpp-bridge.js`

### 2. `extensao/injected/wpp-bridge.js` (NOVO ~130 linhas)
- Importa wa-js do bundle local (`extensao/lib/wppconnect-wa.js`)
- `WPP.webpack.onReady()` → marca pronto
- Escuta `CustomEvent("risezap:send")` com payload:
  - `{ requestId, type, url, isPtt, caption, fileName }`
- Para cada tipo:
  - **audio**: `fetch(url) → blob → WPP.chat.sendFileMessage(activeChat, blob, { type:'audio', isPtt:true })`
  - **image**: `WPP.chat.sendFileMessage(activeChat, blob, { type:'image', caption })`
  - **video**: `WPP.chat.sendFileMessage(activeChat, blob, { type:'video', caption })`
  - **document**: `WPP.chat.sendFileMessage(activeChat, blob, { type:'document', filename })`
- Chat ativo obtido via `WPP.chat.getActiveChat()`
- Responde com `CustomEvent("risezap:result", { requestId, success, error })`

### 3. `extensao/lib/wppconnect-wa.js` (NOVO ~200KB)
- Build oficial do `@wppconnect/wa-js` baixado do release GitHub
- Versão fixa para estabilidade

### 4. `extensao/content/content.js` (MODIFICAR)

**Adicionar:**
- Injeção do `loader.js` no DOM da página na inicialização
- Storage bridge: escuta `REQ_RISEZAP_STORE_*`, responde com `RES_RISEZAP_STORE_*` (proxy chrome.storage)
- `sendFileViaBridge(asset)`: gera signed URL, dispara `risezap:send`, aguarda `risezap:result` com timeout 30s
- `isBridgeReady()`: verifica presença de `#RZBridgeReady`

**Remover (TUDO relacionado à Evolution API):**
- `sendViaBackend()` — inteira
- `sendAssetViaBackend()` — inteira
- `loadConnectedInstance()`, `cachedInstance` — desnecessários
- `getCurrentChatPhone()`, `extractPhoneFromText()`, `askPhoneManually()`, `lastDetectedPhone` — wa-js obtém chat ativo internamente
- `preWarmCache()` — substituído por inicialização do bridge
- Todas as referências a `whatsapp-send` Edge Function

**Atualizar handlers:**
- Áudios: `sendFileViaBridge({ ...a, resolvedType:'audio' })`
- Mídias: `sendFileViaBridge({ ...m, resolvedType:'media' })`
- Documentos: `sendFileViaBridge({ ...d, resolvedType:'document' })`
- Funil: itens não-texto usam `sendFileViaBridge` em vez de `sendAssetViaBackend`

### 5. `extensao/manifest.json` (MODIFICAR)
- Adicionar `web_accessible_resources`:
  ```json
  "web_accessible_resources": [{
    "resources": ["injected/loader.js", "injected/wpp-bridge.js", "lib/wppconnect-wa.js"],
    "matches": ["https://web.whatsapp.com/*"]
  }]
  ```

## Fluxo de Envio (áudio PTT)

```text
1. Usuário clica botão de áudio na barra
2. Content script: showPreview → usuário confirma
3. Content script: getSignedUrl(asset.storage_path) → url
4. Content script: dispara CustomEvent("risezap:send", {
     requestId, type:"audio", url, isPtt:true
   })
5. Bridge (page context): fetch(url) → blob
6. Bridge: activeChat = WPP.chat.getActiveChat()
7. Bridge: WPP.chat.sendFileMessage(activeChat.id, blob, {
     type:'audio', isPtt:true
   })
8. WhatsApp Web: áudio aparece como bolinha verde PTT ✓
9. Bridge: dispara CustomEvent("risezap:result", { success:true })
10. Content script: showToast("Enviado! ✓")
```

## Pré-requisito

Antes de implementar, preciso pesquisar a API exata do `@wppconnect/wa-js` (documentação oficial) para confirmar: `sendFileMessage` params, `getActiveChat` return type, e como obter o build standalone da lib. Farei isso no início da implementação.

