

# Corrigir envio de mensagens pela extensao -- usar ClipboardEvent (paste)

## Problema
O `sendTextViaDom` usa `document.execCommand('insertText')` que nao funciona no WhatsApp Web atual. O WhatsApp Web usa React + Lexical editor, e `execCommand` nao dispara os event listeners internos do React, resultando em "Falha ao enviar" porque:
1. O texto pode nao ser inserido corretamente no campo
2. O botao de enviar pode nao aparecer (o WhatsApp so mostra o botao quando detecta texto via seus proprios eventos)

## Solucao
Trocar `execCommand('insertText')` por `ClipboardEvent('paste')` com `DataTransfer`, que e o metodo comprovado para injetar texto em campos React/Lexical. Tambem melhorar os seletores para cobrir variantes do DOM atual do WhatsApp Web.

## Alteracoes tecnicas

### Arquivo: `extensao/content/content.js`

#### 1. Reescrever `sendTextViaDom(text)` (linhas 94-129)
Trocar a estrategia de insercao de texto:

**Antes (nao funciona):**
```js
input.focus();
document.execCommand("selectAll", false, null);
document.execCommand("delete", false, null);
document.execCommand("insertText", false, text);
input.dispatchEvent(new Event("input", { bubbles: true }));
```

**Depois (metodo correto via paste):**
```js
input.focus();
await sleep(100);

// Limpar campo existente
input.textContent = '';
input.dispatchEvent(new Event("input", { bubbles: true }));
await sleep(100);

// Injetar texto via ClipboardEvent (paste) -- funciona com React/Lexical
const dataTransfer = new DataTransfer();
dataTransfer.setData("text/plain", text);
const pasteEvent = new ClipboardEvent("paste", {
  clipboardData: dataTransfer,
  bubbles: true,
  cancelable: true,
});
input.dispatchEvent(pasteEvent);
```

#### 2. Melhorar seletores do campo de texto (linha 97)
Adicionar seletores alternativos para cobrir diferentes versoes do WhatsApp Web:

```js
const input =
  document.querySelector('#main div[contenteditable="true"][data-tab="10"]') ||
  document.querySelector('#main div[contenteditable="true"][role="textbox"]') ||
  document.querySelector('#main footer div[contenteditable="true"]') ||
  document.querySelector('footer div[contenteditable="true"]');
```

#### 3. Melhorar seletor do botao de enviar (linha 116)
Adicionar fallbacks para o botao send:

```js
const sendBtn =
  document.querySelector('span[data-icon="send"]') ||
  document.querySelector('button[aria-label="Send"]') ||
  document.querySelector('button[aria-label="Enviar"]');
```

#### 4. Aumentar o tempo de espera antes de procurar o botao send
Trocar `await sleep(300)` por `await sleep(500)` para dar mais tempo ao WhatsApp processar o paste e mostrar o botao de enviar. Se nao encontrar, tentar esperar mais com `waitForElement`.

#### 5. Melhorar `sendFileViaDom` -- seletores do botao de anexo (linhas 147-150)
Adicionar mais variantes do icone de anexo:

```js
const attachBtn =
  document.querySelector('#main span[data-icon="plus"]') ||
  document.querySelector('#main span[data-icon="attach-menu-plus"]') ||
  document.querySelector('#main span[data-icon="clip"]') ||
  document.querySelector('span[data-icon="plus"]') ||
  document.querySelector('span[data-icon="attach-menu-plus"]');
```

## Resumo das mudancas
- 1 arquivo alterado: `extensao/content/content.js`
- Metodo de insercao de texto: `execCommand` trocado por `ClipboardEvent('paste')` com `DataTransfer`
- Seletores CSS melhorados com multiplos fallbacks
- Tempos de espera ajustados para o WhatsApp processar os eventos

## Apos implementar
O usuario precisa:
1. Copiar o arquivo atualizado para a pasta local da extensao
2. Ir em `chrome://extensions` e clicar em atualizar
3. Recarregar a aba do WhatsApp Web (F5)
