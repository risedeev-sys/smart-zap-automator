

## Correção do erro 404 na Evolution API

### Diagnóstico
Os logs confirmam que toda chamada à Evolution API retorna **404**. A URL montada é `http://evolution.sandrodev.cloud/instance/create`. Possíveis causas:

1. **Barra final na URL** — se o secret tem `http://evolution.sandrodev.cloud/`, gera `//instance/create`
2. **A Evolution API pode exigir um prefixo** como `/api/v1` ou `/api/v2` (dependendo da versão instalada)

### Correções

**1. Sanitizar a URL base (remover barra final) — `whatsapp-manage/index.ts` e `whatsapp-send/index.ts`**

Linha 9 de ambos os arquivos:
```typescript
// DE:
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
// PARA:
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
```

**2. Adicionar log da URL completa para diagnóstico**

Dentro da função `evoFetch` de ambos os arquivos, logo após montar a URL:
```typescript
console.log(`[evoFetch] ${options.method || "GET"} ${url}`);
```

E no bloco de erro:
```typescript
if (!res.ok) {
  console.error(`[evoFetch] ${res.status} response:`, JSON.stringify(data));
  throw new Error(data?.message || `Evolution API error ${res.status}`);
}
```

**3. Re-deploy das Edge Functions**

Após as edições, fazer deploy de `whatsapp-manage` e `whatsapp-send`.

### Resultado esperado
- Os logs vão mostrar a URL exata chamada (ex: `[evoFetch] POST http://evolution.sandrodev.cloud/instance/create`)
- A sanitização resolve o caso de barra dupla
- Se o 404 persistir, os logs indicarão se é necessário ajustar o `EVOLUTION_API_URL` no painel do Supabase para incluir um prefixo como `/api/v2`

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-manage/index.ts` | Sanitizar URL (linha 9), adicionar logs no evoFetch (linhas 16-31) |
| `supabase/functions/whatsapp-send/index.ts` | Sanitizar URL (linha 9), adicionar logs no evoFetch (linhas 15-30) |

