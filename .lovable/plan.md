

## Exportar Funil Individual

### O que sera feito

Criar uma funcao `exportFunnel(funnelId)` que busca todos os dados relacionados a um funil no Supabase e gera um download automatico de arquivo `.json`.

### Estrutura do arquivo exportado

```text
backup-{funnel_name}.json
{
  "version": 1,
  "createdAt": "2026-02-27T...",
  "funnel": { id, name, favorite },
  "items": [ { id, type, asset_id, delay_min, delay_sec, position } ],
  "assets": {
    "messages": [...],
    "audios": [...],
    "medias": [...],
    "documents": [...]
  }
}
```

### Arquivos a criar/modificar

**1. Criar `src/utils/exportFunnel.ts`**

Funcao utilitaria que:
- Busca o funil em `funnels` por ID
- Busca os itens em `funnel_items` filtrados por `funnel_id`
- Agrupa os `asset_id` por tipo (mensagem -> messages, audio -> audios, etc.)
- Busca os assets relacionados em cada tabela usando `.in("id", [ids])`
- Monta o objeto JSON com funnel, items e assets
- Gera o download com `Blob` + `createElement("a")` + click
- Nome do arquivo: `backup-{funnel_name}.json` (com nome sanitizado)

**2. Modificar `src/pages/FunisPage.tsx`**

- Importar `exportFunnel` e o icone `Download` do lucide-react
- Adicionar um botao de export na barra de acoes do funil selecionado (ao lado dos botoes de excluir, duplicar, editar e favoritar)
- O botao chama `exportFunnel(selected)` e mostra toast de sucesso/erro

### Detalhes tecnicos

- Mapeamento de tipos para tabelas: reutiliza o mesmo `assetTables` ja existente no FunisPage (`mensagem -> messages`, `audio -> audios`, `midia -> medias`, `documento -> documents`)
- Queries agrupadas por tipo para minimizar chamadas ao Supabase (no maximo 4 queries de assets + 1 funnel + 1 items = 6 queries)
- Sanitizacao do nome do arquivo: substitui espacos por hifens e remove caracteres especiais

