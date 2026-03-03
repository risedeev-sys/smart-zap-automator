

# Diagnóstico e Correção — Áudio enviado como Documento + Imagem enviada como Sticker

## Análise de Causa Raiz

### Bug 1: Áudio chega como documento (arquivo "innerblom" 4MB)

A Edge Function `whatsapp-send` (linha 165-185) usa o endpoint `/message/sendWhatsAppAudio/` com `encoding: true`. Este flag instrui a Evolution API a re-codificar o áudio para formato OGG/Opus PTT (push-to-talk). Para arquivos grandes (4MB), a re-codificação pode falhar silenciosamente ou exceder o timeout, fazendo a Evolution API enviar o arquivo como documento genérico.

Além disso, o body do áudio inclui campos redundantes e possivelmente conflitantes (`audio`, `audioMessage.audio`, `options.encoding`) que podem confundir a Evolution API dependendo da versão.

### Bug 2: Imagem chega como sticker do WhatsApp

Na Edge Function `whatsapp-send` (linha 192), o caption é sempre enviado como string vazia quando não fornecido:
```typescript
caption: caption || "",
```

Na Evolution API, imagens enviadas com `caption: ""` (string vazia) e dimensões pequenas são interpretadas automaticamente como **stickers** pelo WhatsApp. A solução é não incluir o campo `caption` no payload quando ele é vazio/undefined.

---

## Correções Planejadas

### Arquivo: `supabase/functions/whatsapp-send/index.ts`

**Correção 1 — Áudio**: Simplificar o payload do `sendWhatsAppAudio` removendo campos redundantes. Desabilitar `encoding` quando o arquivo já estiver em formato OGG ou quando for grande (>2MB), para evitar timeout na re-codificação. Aumentar timeout para 60s em envios de áudio.

**Correção 2 — Imagem/Mídia**: Não enviar `caption` como string vazia. Se não houver caption real, omitir o campo do payload completamente. Isso impede que a Evolution API interprete a imagem como sticker.

### Mudanças específicas:

1. Na branch de áudio (linhas 166-185):
   - Verificar se o mime é `audio/ogg` → `encoding: false` (já está no formato correto)
   - Para outros formatos de áudio, manter `encoding: true` apenas se arquivo < 2MB
   - Simplificar payload removendo campos duplicados (`audioMessage` é redundante)

2. Na branch de mídia (linhas 187-213):
   - Mudar `caption: caption || ""` para `...(caption ? { caption } : {})` — omitir campo quando vazio
   - Aplicar o mesmo no `mediaMessage` interno

3. No `evoFetch` (linha 20-21):
   - Aumentar timeout de 30s para 60s para suportar encoding de áudios grandes

### Nenhuma mudança no frontend necessária
O frontend (`EspacoTestePage.tsx` e `use-real-whatsapp.ts`) já passa os dados corretamente. Os bugs são exclusivamente na Edge Function.

