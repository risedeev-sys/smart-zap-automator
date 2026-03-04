

## Diagnóstico: Por que vídeos continuam sendo enviados como arquivo

### Descoberta Principal da Análise do ZapVoice

Após análise profunda do repositório `saandro-dev/zapvoice-extension` (branch `readable`), a descoberta crítica é:

**O ZapVoice usa `WPP.chat.sendFileMessage` para TODOS os tipos de mídia** — áudio, imagem, vídeo e documento. Eles **não** usam injeção de menu de anexos ("attach menu injection") para nenhum tipo de arquivo. A arquitetura é:

1. Content Script detecta o WhatsApp pronto e injeta o chunk principal (`chunk-B0T2D0A7.js`) no contexto da página via `importLoader`
2. O chunk roda no **contexto da página** (não no content script) com acesso total ao `WPP`
3. Funnels são "agendados" como jobs com delay, e cada item é enviado via `WPP.chat.sendFileMessage`
4. O conteúdo é armazenado como **base64 em `chrome.storage.local`**, não em Supabase Storage com URLs assinadas

### A Causa-Raiz do Nosso Problema

O problema é uma **combinação de fatores** que impede o `WPP.chat.sendFileMessage` de enviar vídeos como mídia nativa:

1. **Fetch cross-origin no contexto da página**: O `wpp-bridge.js` roda no contexto da página (WhatsApp Web). Quando ele faz `fetch()` para a URL assinada do Supabase, o WhatsApp Web bloqueia ou corrompe a resposta por CORS. O ZapVoice evita isso totalmente porque seus dados já estão em `chrome.storage.local` como base64.

2. **Blob de contexto errado**: Mesmo usando `blobUrl`, o Blob é criado no contexto do **content script** e passado como Object URL para o contexto da **página**. Blobs criados em diferentes contextos de execução podem não ser acessíveis entre si.

3. **O método attach-menu-injection funciona para imagens mas não vídeos**: O WhatsApp Web trata vídeos injetados no input de mídia de forma diferente — eles requerem transcodificação/thumbnail que pode falhar com arquivos injetados programaticamente.

### Solução: Enviar Vídeos via Bridge com Conteúdo Base64

A solução é alinhar com o que o ZapVoice faz: **enviar o conteúdo como base64 data URL diretamente para o bridge**, eliminando problemas de CORS e de contexto de Blob.

```text
FLUXO ATUAL (QUEBRADO):
  Content Script → fetch(signedUrl) → blob → URL.createObjectURL()
  → bridge recebe blobUrl → fetch(blobUrl) no contexto da página → FALHA/CORRUPTO
  → WPP.chat.sendFileMessage(...) → enviado como documento

FLUXO PROPOSTO (CORRETO):
  Content Script → fetch(signedUrl) → blob → FileReader.readAsDataURL()
  → bridge recebe base64 data URL → WPP.chat.sendFileMessage(chatId, base64DataUrl, {type:"video"})
  → WPP.chat internamente decodifica → enviado como vídeo nativo com player
```

### Mudanças Planejadas

**Arquivo: `extensao/content/content.js`**
- Modificar `sendVideoViaBridge` para converter o blob em **data URL (base64)** em vez de Object URL
- Passar o `dataUrl` diretamente no evento `risezap:send` em vez de `blobUrl`
- Remover a dependência de `URL.createObjectURL` para vídeos
- Também aplicar a mesma técnica para `sendAudioViaBridge` (consistência)

**Arquivo: `extensao/injected/wpp-bridge.js`**
- Aceitar `dataUrl` como campo no payload do evento `risezap:send`
- Quando `dataUrl` presente, usar diretamente como conteúdo para `WPP.chat.sendFileMessage` sem fazer fetch
- O wa-js aceita nativamente strings data URL como conteúdo

### Detalhes Técnicos

O `WPP.chat.sendFileMessage` aceita os seguintes formatos de conteúdo:
- `Blob` / `File`
- `string` (data URL no formato `data:video/mp4;base64,...`)
- URL absoluta (mas com restrições de CORS)

O ZapVoice armazena mídia como base64 strings e passa diretamente. Nós faremos o mesmo: converter o blob baixado do Supabase em data URL e enviar como string para o bridge.

### Análise de Soluções

**Solução A: Data URL direto via bridge**
- Manutenibilidade: 9/10
- Zero DT: 9/10
- Arquitetura: 9/10
- Escalabilidade: 8/10 (limitação de tamanho do base64 para vídeos muito grandes, mas funcional)
- Segurança: 10/10
- **NOTA FINAL: 9.0/10**

**Solução B: Continuar melhorando attach-menu injection para vídeos**
- Manutenibilidade: 6/10
- Zero DT: 4/10 (depende de seletores DOM instáveis do WhatsApp)
- Arquitetura: 5/10 (solução frágil, workaround)
- Escalabilidade: 5/10
- Segurança: 10/10
- **NOTA FINAL: 6.0/10**

**DECISÃO: Solução A (Nota 9.0)** — alinhada com o modelo funcional do ZapVoice.

