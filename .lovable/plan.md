

# Importar Funil com Persistencia no Supabase

## Contexto

Atualmente, ao exportar um funil individual (`exportFunnel`), o arquivo JSON contem o funil, seus itens e os assets referenciados (messages, audios, medias, documents) com todos os campos do banco, incluindo `storage_path`, `mime`, `bytes`, etc.

Porem, nao existe uma funcao para **importar** esse backup de volta. O objetivo e criar essa funcao e garantir que os registros de assets sejam criados nas tabelas `public.audios`, `public.medias`, `public.documents` e `public.messages` mesmo que `storage_path` esteja vazio/null.

## Arquivos a criar/modificar

### 1. Criar `src/utils/importFunnel.ts`

Funcao `importFunnel(file: File)` que:

- Le e parseia o arquivo JSON
- Valida a estrutura (deve ter `funnel`, `items`, `assets`)
- Obtem o `user_id` do usuario logado via `supabase.auth.getUser()`
- Cria os assets nas tabelas do Supabase com novos UUIDs, mantendo um mapa `oldId -> newId`:
  - Para cada asset em `assets.messages`: insere em `public.messages` com `name`, `content`, `user_id`
  - Para cada asset em `assets.audios`: insere em `public.audios` com `name`, `storage_path` (pode ser null), `mime`, `bytes`, `user_id`
  - Para cada asset em `assets.medias`: insere em `public.medias` com os mesmos campos
  - Para cada asset em `assets.documents`: insere em `public.documents` com os mesmos campos
- Cria o funil em `public.funnels` com novo UUID
- Cria os itens em `public.funnel_items` com `asset_id` remapeado para os novos IDs
- Retorna o ID do novo funil criado

### 2. Modificar `src/pages/FunisPage.tsx`

- Importar `importFunnel` e o icone `Upload` do lucide-react
- Adicionar um botao de importar funil na barra de acoes (ao lado do botao de adicionar)
- Adicionar um `<input type="file" accept=".json">` hidden
- Ao selecionar arquivo, chamar `importFunnel(file)`, atualizar a lista de funis e selecionar o funil importado
- Mostrar toast de sucesso/erro

## Detalhes tecnicos

- Mapeamento de tabelas: `messages`, `audios`, `medias`, `documents` (mesmo mapa `assetTables` ja existente)
- Campos nullable (`storage_path`, `mime`, `bytes`) serao inseridos como `null` quando ausentes no backup -- isso atende ao requisito de criar registros mesmo sem `storage_path`
- Remapeamento de IDs: `crypto.randomUUID()` para gerar novos IDs, mapa `Record<string, string>` para atualizar `asset_id` nos `funnel_items`
- Queries: 4 inserts de assets (um por tabela, usando arrays) + 1 insert de funnel + 1 insert batch de items = 6 operacoes
- Registro de backup: opcionalmente criar um registro em `public.backups` com `source: "funnel-import"` e referencia ao novo `funnel_id`

