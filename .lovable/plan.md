

## Correção do erro 404: HTTP para HTTPS redirect

### Problema identificado
A Evolution API (v2.3.7) está acessivel em `http://evolution.sandrodev.cloud`, mas o servidor redireciona HTTP para HTTPS. Quando isso acontece com um POST, o navegador/runtime converte para GET (comportamento padrao de redirects 301/302), resultando em "Cannot GET /instance/create".

### Solucao

**1. Correcao no codigo (ambas Edge Functions)**
Adicionar sanitizacao automatica que converte `http://` para `https://` na URL da Evolution API, alem da limpeza de barra final ja existente:

```typescript
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "")
  .replace(/\/+$/, "")
  .replace(/^http:\/\//i, "https://");
```

Tambem adicionar `redirect: "follow"` explicitamente no fetch para maior seguranca.

**2. Arquivos alterados**

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/whatsapp-manage/index.ts` | Forcar HTTPS na URL (linha 9) |
| `supabase/functions/whatsapp-send/index.ts` | Forcar HTTPS na URL (linha 9) |

**3. Recomendacao adicional**
O usuario tambem deve atualizar o secret `EVOLUTION_API_URL` no painel do Supabase para `https://evolution.sandrodev.cloud` (com HTTPS) para evitar dependencia da correcao automatica.

### Resultado esperado
O POST sera enviado diretamente para `https://evolution.sandrodev.cloud/instance/create`, sem redirect, resolvendo o erro 404.
