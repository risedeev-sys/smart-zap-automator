
# Importacao Completa de Funis com Assets Vinculados

## Problema Atual
Quando um backup e importado, os funis referenciam assets (mensagens, audios, midias, documentos) pelo `assetId`. Se os assets correspondentes nao forem importados juntos, os itens do funil aparecem como "(item removido)". Alem disso, ao adicionar (sem substituir), IDs duplicados podem causar conflitos.

## Solucao

### 1. Remapeamento de IDs na importacao
Ao importar sem a opcao "Substituir todos", os itens importados podem ter IDs iguais aos existentes. A solucao e gerar novos IDs unicos para todos os itens importados e atualizar as referencias internas (ex: `assetId` nos funis apontando para os novos IDs dos assets).

### 2. Validacao de integridade pos-importacao
Apos processar o arquivo, verificar se todos os `assetId` referenciados pelos funis importados existem nos assets (importados + existentes). Exibir um aviso se houver assets faltando.

### 3. Importacao inteligente de funis
Quando o arquivo contem funis mas falta alguma categoria de assets referenciada, mostrar um toast de alerta informando quais categorias estao ausentes.

## Detalhes Tecnicos

### Arquivo: `src/pages/BackupsPage.tsx`

**Funcao `handleImport` reformulada:**

- Ler o JSON importado
- Criar um mapa de remapeamento de IDs antigos para novos (usando `crypto.randomUUID()` ou `Date.now() + index`)
- Para cada categoria de assets (mensagens, audios, midias, documentos):
  - Gerar novos IDs para cada item
  - Guardar o mapeamento `idAntigo -> idNovo`
- Para funis:
  - Gerar novos IDs para cada funil e cada `FunnelItem`
  - Atualizar o `assetId` de cada `FunnelItem` usando o mapa de remapeamento
- Para gatilhos:
  - Gerar novos IDs
  - Atualizar `funnelName` se necessario (ou migrar para `funnelId` no futuro)
- Se `replaceAll` estiver ativo, substituir tudo diretamente (sem remapear, pois nao ha conflito)
- Se `replaceAll` estiver desativado, usar os IDs remapeados e fazer append
- Exibir toast de sucesso com resumo: "Importado: X mensagens, Y audios, Z midias, W documentos, N funis"
- Se algum `assetId` de funil nao foi encontrado nos assets importados nem nos existentes, exibir aviso

### Resultado esperado
- Importar um backup com 10 mensagens, 5 midias e 2 funis traz exatamente tudo
- Os funis importados apontam corretamente para os assets importados
- Nenhum item aparece como "(item removido)" apos a importacao
- Multiplas importacoes nao geram conflitos de ID
