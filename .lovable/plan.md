
# Envio 100% pelo DOM do WhatsApp Web + Evolution API para automacao em background

## Resumo
A extensao passara a enviar mensagens (texto, imagens, audios, videos, documentos) diretamente pelo DOM do WhatsApp Web, sem usar a Evolution API para envios manuais. A Evolution API continua existindo no backend para automacoes com o navegador fechado (gatilhos, funis automaticos, webhooks).

## O que muda na extensao

### 1. Envio de texto -- injetar no campo de digitacao
- Localizar o campo editavel: `div[contenteditable="true"]` dentro de `#main footer`
- Focar o campo e inserir o texto com `document.execCommand('insertText', false, text)`
- Disparar evento `input` com `bubbles: true`
- Aguardar e clicar no botao de enviar: `span[data-icon="send"]`

### 2. Envio de arquivos (imagens, videos, audios, documentos) -- injetar no input file
- Baixar o arquivo do Supabase Storage como Blob usando signed URL (ja implementada)
- Clicar no botao de anexo (+) do WhatsApp Web
- Esperar o menu de opcoes aparecer
- Selecionar a opcao correta (midia ou documento) baseado no tipo do arquivo
- Criar um `File` a partir do Blob e injetar no `input[type="file"]` usando `DataTransfer`
- Disparar evento `change` com `bubbles: true`
- Aguardar o modal de preview do WhatsApp carregar (usando `MutationObserver`)
- Clicar no botao de enviar do modal de preview

### 3. O que sera removido do content.js
- Funcao `sendMessage()` (envio via Edge Function)
- Funcoes `getCurrentPhone()` e `extractDigitsFromJid()` (nao precisamos mais do telefone)
- Variavel `instanceId` e referencia em `loadAuth()`
- A logica de verificar instancia antes de enviar

### 4. O que sera mantido
- `getSignedUrl()` -- necessaria para baixar arquivos do Supabase Storage
- `supaFetch()` e `loadAssets()` -- carregamento dos assets do painel
- Todo o codigo de modal/preview/toast/barra de botoes

### 5. Novas funcoes no content.js

**`waitForElement(selector, timeout)`** -- utilitario que espera um elemento aparecer no DOM usando MutationObserver com timeout configuravel (padrao 5s)

**`sendTextViaDom(text)`**:
1. Encontra o campo `div[contenteditable="true"]` no footer do chat
2. Foca, insere texto com `execCommand`
3. Dispara evento `input`
4. Espera e clica em `span[data-icon="send"]`
5. Retorna true/false

**`downloadAsBlob(signedUrl)`** -- faz fetch da URL e retorna o Blob

**`sendFileViaDom(blob, fileName, mimeType)`**:
1. Clica no botao de anexo do WhatsApp (`span[data-icon="plus"]` ou `span[data-icon="attach-menu-plus"]`)
2. Espera o menu aparecer
3. Seleciona a opcao correta baseado no mimeType (imagem/video vs documento/audio)
4. Localiza o `input[type="file"]` correspondente
5. Cria `new File([blob], fileName, { type: mimeType })`
6. Cria `DataTransfer`, adiciona o File, seta no input
7. Dispara evento `change`
8. Espera o preview do WhatsApp carregar
9. Clica no botao de enviar do preview

### 6. Atualizacao dos handlers dos botoes
- **Mensagens**: `sendTextViaDom(content)` em vez de `sendMessage({ text })`
- **Audios**: `downloadAsBlob(signedUrl)` + `sendFileViaDom(blob, name, mime)`
- **Midias**: `downloadAsBlob(signedUrl)` + `sendFileViaDom(blob, name, mime)`
- **Documentos**: `downloadAsBlob(signedUrl)` + `sendFileViaDom(blob, name, mime)`
- **Funis**: execucao sequencial de cada item com delay entre eles

## O que muda no popup

### popup.html e popup.js
- Remover a secao de selecao de instancia (nao e mais necessaria para envio direto)
- Manter apenas login/logout (o token ainda e necessario para carregar assets do Supabase)

## O que NAO muda (backend permanece igual)

A Evolution API e todas as Edge Functions continuam funcionando normalmente para:
- **whatsapp-manage**: gerenciamento de instancias e QR code
- **whatsapp-send**: envio automatizado via backend (gatilhos, funis automaticos)
- **whatsapp-message-webhook**: recepcao de mensagens para gatilhos
- **whatsapp-status-webhook**: status de entrega
- Pagina de Instancias no painel web
- Espaço de Teste com modo real
- Hook `useRealWhatsApp`

## Fluxo final

```text
[Extensao - WhatsApp Web aberto]
  Botao clicado -> Preview -> "Enviar"
    Texto: execCommand('insertText') -> clica send
    Arquivo: Baixa blob -> Injeta input file -> Espera preview -> clica send

[Backend - WhatsApp Web fechado]
  Gatilho/Funil automatico -> Edge Function whatsapp-send -> Evolution API
```

## Arquivos alterados
1. `extensao/content/content.js` -- reescrever logica de envio para DOM direto
2. `extensao/popup/popup.html` -- remover secao de instancia
3. `extensao/popup/popup.js` -- remover logica de instancias
