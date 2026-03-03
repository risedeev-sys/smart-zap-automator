

# Auditoria de Conformidade: Protocolo RiseZap V1

## Status: VIOLAÇÕES CRÍTICAS DETECTADAS

O protocolo **não** está sendo seguido corretamente. Abaixo, o diagnóstico honesto.

---

## VIOLAÇÕES ATIVAS

### V1. Regra 5.5 — Zero Database Access from Frontend (CRÍTICA)

**9 arquivos** no frontend acessam o banco diretamente via `supabase.from()`. O protocolo diz:

> "O frontend NUNCA acessa o banco diretamente. Todas as operações passam por Edge Functions."

**Arquivos violadores:**

| Arquivo | Chamadas diretas |
|---------|-----------------|
| `src/pages/FunisPage.tsx` | ~10 chamadas (CRUD completo de funnels/items) |
| `src/pages/EspacoTestePage.tsx` | ~6 chamadas (select de todas as tabelas) |
| `src/pages/BackupsPage.tsx` | chamadas diretas de select/triggers |
| `src/utils/exportFunnel.ts` | select direto em funnels, funnel_items, assets |
| `src/utils/importBackupToSupabase.ts` | insert/delete direto em 7 tabelas |
| `src/utils/uploadAssetFile.ts` | update direto + storage upload |
| `src/hooks/use-real-whatsapp.ts` | select direto em whatsapp_instances |

Estes arquivos deveriam invocar Edge Functions BFF (`supabase.functions.invoke`), nunca `supabase.from()`.

### V2. Regra 5.6 — Isolamento Multi-Tenant (CRÍTICA)

**Zero referências a `workspace_id`** em todo o frontend. Nenhuma query filtra por tenant. O isolamento multi-tenant é inexistente na camada de aplicação. Toda a lógica atual assume single-tenant (filtra por `user_id` quando muito).

### V3. Regra 5.4 — Limite de 300 Linhas

`extensao/content/content.js` tem **731 linhas**. É um God Object que concentra: auth, fetch, UI, envio, bridge, funil, storage bridge, tudo num único arquivo.

### V4. Regra 5.5 — Extensão acessa banco direto

A extensão (`content.js`) faz chamadas REST diretas ao Supabase (`/rest/v1/{table}`) nas linhas 24-34. Isso é equivalente a `supabase.from()` — acesso direto ao banco sem passar por Edge Functions.

### V5. Memory Desatualizada — `extension/sending-strategy`

A memory ainda referencia: *"arquivos (áudio, mídia e documentos) são roteados via backend através da Edge Function whatsapp-send"*. Isso já foi migrado para wa-js nativo. A memory está desalinhada com a realidade do código.

---

## CONFORMIDADES VERIFICADAS

| Regra | Status |
|-------|--------|
| 5.2 — Permissão para Breaking Changes | Aplicada (extensão reescrita) |
| Extensão sem Evolution API | Confirmado — zero referências |
| wa-js Bridge Architecture | Implementado corretamente (loader → bridge → CustomEvent) |
| Storage Bridge (chrome.storage proxy) | Implementado |
| Linter Supabase — RLS | Sem violações críticas de RLS |

---

## PLANO DE CORREÇÃO NECESSÁRIO

A correção destas violações exige a continuação da **Fase 2 e Fase 3** do Plano de Refatoração Arquitetural já definido:

1. **Migrar todos os `supabase.from()` do frontend para Edge Functions BFF** — FunisPage, EspacoTestePage, BackupsPage, exportFunnel, importBackup, uploadAssetFile, use-real-whatsapp
2. **Introduzir `workspace_id` no schema e em todas as queries** — migração de banco + RLS por workspace
3. **Refatorar `content.js` (731 linhas) em módulos separados** — auth, ui, bridge-client, asset-loader, funnel-runner
4. **Migrar a extensão de REST direto para Edge Functions** — `supaFetch` deve chamar Edge Functions, não `/rest/v1/`
5. **Atualizar memories desatualizadas**

Deseja que eu priorize e detalhe o plano de correção para uma dessas violações específicas?

