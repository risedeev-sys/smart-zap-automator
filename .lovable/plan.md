

## Diagnóstico

**Dados no banco**: 2 áudios, 2 mídias, 2 documentos — todos existem e estão vinculados ao user_id correto.

**Causa raiz**: Nas funções `fetchDocuments`, `fetchAudios` e `fetchMedias`, o código mapeia `storage_path` para `fileName` mas nunca gera uma URL assinada (signed URL) do Supabase Storage para popular `fileUrl`. Resultado: o detalhe sempre mostra "Nenhum arquivo" após recarregar a página.

**Por que só funcionava antes**: O `fileUrl` era preenchido apenas via `URL.createObjectURL(uploadFile)` no momento do upload. Essa URL é efêmera e se perde ao navegar ou recarregar.

## Solução

Após o fetch de cada tabela, gerar **signed URLs** do Supabase Storage para cada registro que possua `storage_path` preenchido, e popular o campo `fileUrl` do `AssetItem`.

### Arquivos a modificar

1. **`src/pages/DocumentosPage.tsx`** — No `fetchDocuments`, após obter os registros, chamar `supabase.storage.from("assets").createSignedUrl(storage_path, 3600)` para cada registro com `storage_path`, e atribuir o resultado ao `fileUrl`.

2. **`src/pages/AudiosPage.tsx`** — Mesma correção no `fetchAudios`.

3. **`src/pages/MidiasPage.tsx`** — Mesma correção no `fetchMedias`.

### Implementação técnica

Para cada página, o padrão será:

```typescript
// Dentro do fetch, após mapear os rows:
const rowsWithUrls = await Promise.all(
  (data ?? []).map(async (row) => {
    let fileUrl: string | undefined;
    if (row.storage_path) {
      const { data: urlData } = await supabase.storage
        .from("assets")
        .createSignedUrl(row.storage_path, 3600); // 1 hora
      fileUrl = urlData?.signedUrl;
    }
    return { ...mappedRow, fileUrl };
  })
);
```

Signed URLs expiram em 1 hora, o que é adequado para a sessão de uso. O bucket `assets` é privado, então signed URLs é a abordagem correta (não public URLs).

### Escopo

- Nenhuma alteração de banco de dados necessária
- Nenhuma alteração de RLS necessária
- 3 arquivos modificados, mesmo padrão em todos

