

# Envio Real de WhatsApp no Espaço de Teste

## Objetivo
Permitir que o usuario envie mensagens, audios, midias e documentos reais via WhatsApp diretamente pelo Espaco de Teste, utilizando a edge function `whatsapp-send` ja existente.

## O que muda

### 1. Adicionar modo "Envio Real" na pagina de teste
- Um toggle/switch no topo do chat: **Simulacao** vs **Envio Real**
- Quando ativado, o sistema envia mensagens reais via Evolution API
- Quando desativado, funciona como hoje (simulacao local)

### 2. Seletor de instancia e numero destino
- Dropdown para selecionar a instancia conectada (busca de `whatsapp_instances` com status "open")
- Campo de input para o numero de destino (pre-preenchido com o numero da instancia selecionada para facilitar o auto-envio)
- O numero do usuario (556192039398) sera sugerido automaticamente

### 3. Integracao com a edge function `whatsapp-send`
Ao enviar no modo real, o sistema chama a edge function com os parametros corretos:

- **Mensagem de texto**: envia `text` via `sendText`
- **Audio**: busca o `storage_path`, gera URL publica e envia como `media_type: "audio"`
- **Midia (imagem/video)**: busca o `storage_path`, gera URL publica e envia como `media_type: "image"` ou `"video"`
- **Documento**: busca o `storage_path`, gera URL publica e envia como `media_type: "document"`
- **Funil**: executa cada item do funil com delay real, enviando cada ativo via WhatsApp

### 4. Feedback visual
- Indicador de status do envio (enviando, enviado, falhou) em cada mensagem
- Toast de sucesso/erro apos cada envio
- As mensagens enviadas com sucesso aparecem com um badge "Enviado via WhatsApp"

## Detalhes Tecnicos

### Arquivo modificado: `src/pages/EspacoTestePage.tsx`

1. Adicionar estados: `realMode`, `selectedInstanceId`, `targetPhone`, `instances`
2. Fetch das instancias conectadas ao montar o componente
3. Nova funcao `sendRealMessage(phone, text, mediaUrl?, mediaType?, caption?)` que invoca:
```typescript
supabase.functions.invoke("whatsapp-send", {
  body: { instance_id, phone, text, media_url, media_type, caption }
})
```
4. Modificar `handleSend`, `sendAsset` e `executeFunnel` para chamar `sendRealMessage` quando `realMode` estiver ativo
5. Para ativos com arquivo (audio, midia, documento), gerar URL publica via `supabase.storage.from("assets").createSignedUrl()` antes de enviar

### UI do painel de controle (acima do chat)
- Switch com label "Envio Real via WhatsApp"
- Ao ativar, expande um painel com:
  - Select da instancia
  - Input do numero destino
  - Badge verde "Pronto para enviar" ou vermelho "Sem instancia conectada"

## Fluxo do teste
1. Usuario ativa o modo real
2. Seleciona a instancia "Meu tst"
3. Numero destino ja vem preenchido com 556192039398
4. Clica em um ativo (mensagem, audio, etc.) ou digita texto
5. Mensagem e enviada via WhatsApp real para o proprio numero
6. Usuario recebe no celular e confirma que funcionou
