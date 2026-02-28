

## Auditoria: Implementacao vs devVAULT

Comparei cada Edge Function e o frontend com os modulos validados do devVAULT. Alem dos 2 problemas ja conhecidos (rota `/instancias` e deploy), encontrei **mais 5 problemas** que precisam ser corrigidos.

---

### Problema 1 (Ja conhecido) — Rota incorreta na Index.tsx

**Onde:** `src/pages/Index.tsx` linhas 109 e 176
**O que:** `navigate("/instancias")` mas a rota real no App.tsx e `/api-keys`
**Correcao:** Trocar para `navigate("/api-keys")`

---

### Problema 2 — `getClaims()` nao existe no supabase-js v2

**Onde:** `whatsapp-manage/index.ts` linha 79, `whatsapp-send/index.ts` linha 57
**O que:** `supabase.auth.getClaims(token)` nao e um metodo valido do supabase-js v2. Isso vai causar erro em runtime.
**Correcao (conforme devVAULT):** Usar `supabase.auth.getUser()` que ja usa o token do header Authorization passado no client:

```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) return null;
return { userId: user.id, supabase };
```

---

### Problema 3 — Polling a cada 4s, devVAULT recomenda 3s + timeout de 60s

**Onde:** `src/pages/ApiKeysPage.tsx` linha 125
**O que do devVAULT:** `whatsapp-status-webhook-url-token` diz explicitamente: "Poll for QR code updates every 3 seconds until status = 'open'. Set a 60-second timeout for QR code scanning — after that, regenerate."
**Implementacao atual:** Poll a cada 4s, sem timeout de 60s.
**Correcao:** Mudar intervalo para 3s e adicionar timeout de 60s que para o poll e mostra mensagem de "QR expirado, clique para reconectar".

---

### Problema 4 — Frontend usa fetch direto com URL hardcoded em vez de supabase.functions.invoke()

**Onde:** `src/pages/ApiKeysPage.tsx` linha 80-91, `src/pages/Index.tsx` linhas 52-63
**O que:** As regras do projeto dizem "NEVER CALL FUNCTIONS BY SPECIFYING A PATH... use either `supabase.functions.invoke()` or construct the full URL using `import.meta.env.VITE_SUPABASE_PROJECT_ID`". Alem disso, o devVAULT recomenda hooks React Query (`whatsapp-react-query-hooks`).
**Correcao:** Substituir `fetch("https://txnhtcyjzohxkfwdfrvh...")` por `supabase.functions.invoke("whatsapp-manage", { body: { action, ...payload } })`. Isso tambem elimina o anon key hardcoded no codigo.

---

### Problema 5 — whatsapp-send usa sendMedia com path incorreto da Evolution API

**Onde:** `whatsapp-send/index.ts` linha 84
**O que:** Usa `/message/sendMedia/${name}` mas de acordo com o devVAULT (`evolution-api-v2-client-whatsapp`), o endpoint correto e `/message/sendMedia/${name}` para imagens, porem o campo `media` deve ter o campo `mimetype` para funcionar corretamente com a Evolution API v2. O campo `mediatype` tambem precisa ser validado (image, video, audio, document).
**Correcao:** Adicionar validacao do `media_type` e incluir `mimetype` quando necessario.

---

### Problema 6 — Falta tabela whatsapp_message_logs

**Onde:** Schema do banco
**O que do devVAULT:** Todos os modulos de dispatch (`whatsapp-internal-dispatcher`, `whatsapp-message-dispatcher`, `whatsapp-sql-schema`) mencionam uma tabela `whatsapp_message_logs` para registrar cada envio/falha. Sem essa tabela, nao ha como debugar por que uma mensagem nao foi enviada.
**Correcao (futura):** Criar tabela `whatsapp_message_logs` com campos: id, user_id, instance_id, phone, status (sent/failed), error, sent_at. E logar no `whatsapp-send` apos cada envio.

---

### Problema 7 — Sem deploy das Edge Functions

**Onde:** Supabase Edge Functions
**O que:** As 3 functions (`whatsapp-manage`, `whatsapp-status-webhook`, `whatsapp-send`) precisam ser deployadas. Sem deploy, nenhuma chamada do frontend vai funcionar e nao havera logs para verificar.
**Correcao:** Executar deploy das 3 functions.

---

### Sequencia de correcao recomendada

1. **Corrigir auth** — trocar `getClaims()` por `getUser()` nas 2 Edge Functions (critico, bloqueia tudo)
2. **Corrigir chamadas frontend** — trocar fetch hardcoded por `supabase.functions.invoke()` (boas praticas + seguranca)
3. **Corrigir rota** — `/instancias` para `/api-keys` na Index.tsx
4. **Ajustar polling** — 3s + timeout 60s conforme devVAULT
5. **Deploy** das 3 Edge Functions
6. **Testar end-to-end** — criar instancia, gerar QR, conectar
7. **(Futuro)** Criar tabela `whatsapp_message_logs` e logar envios

### Resumo tecnico

| # | Severidade | Problema | Arquivo |
|---|-----------|----------|---------|
| 1 | Media | Rota `/instancias` errada | Index.tsx |
| 2 | **Critica** | `getClaims()` nao existe | whatsapp-manage, whatsapp-send |
| 3 | Baixa | Poll 4s sem timeout | ApiKeysPage.tsx |
| 4 | Media | fetch hardcoded com anon key | ApiKeysPage.tsx, Index.tsx |
| 5 | Baixa | sendMedia sem mimetype | whatsapp-send |
| 6 | Baixa | Falta whatsapp_message_logs | Schema |
| 7 | **Critica** | Functions nao deployadas | Supabase |

