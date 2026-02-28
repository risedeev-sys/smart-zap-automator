

# Importar Backup = Limpar Tudo + Inserir Novo

## Problema Atual
Quando você importa um backup, os dados antigos permanecem no banco e os novos são adicionados junto. O comportamento correto deve ser: **apagar tudo do usuário** (mensagens, audios, midias, documentos, funnel_items, funnels) e depois inserir apenas os dados do backup importado.

## Mudanças

### 1. `importBackupToSupabase.ts` - Adicionar limpeza antes da inserção
Antes de inserir qualquer dado, deletar todos os registros do usuário nas tabelas, na ordem correta (respeitando dependencias):

1. `funnel_items` (depende de funnels)
2. `funnels`
3. `messages`
4. `audios`
5. `medias`
6. `documents`

Isso garante que o banco fique limpo antes de receber os novos dados.

### 2. `BackupsPage.tsx` - Simplificar lógica de importação
- Remover o toggle "Substituir todos os itens existentes" (agora sempre substitui)
- Remover toda a lógica condicional de "append vs replace" -- sempre faz replace
- Atualizar o estado local diretamente com os dados importados (setMensagens, setAudios, etc.)
- Remover o bloco de remapeamento de IDs no lado do frontend (o `importBackupToSupabase` já faz isso)

### 3. Aviso ao usuário
Manter o aviso amarelo na UI, mas atualizar o texto para deixar claro que a importação **substituirá todos os dados existentes**.

---

### Detalhes Tecnico

**Ordem de deleção no `importBackupToSupabase`:**
```text
DELETE funnel_items WHERE user_id = ?
DELETE funnels      WHERE user_id = ?
DELETE messages     WHERE user_id = ?
DELETE audios       WHERE user_id = ?
DELETE medias       WHERE user_id = ?
DELETE documents    WHERE user_id = ?
```

Depois disso, o fluxo de inserção continua exatamente como já funciona hoje.

**Estado local no `BackupsPage`:** Após a importação, o estado local será atualizado com os dados do backup (usando os setters do AssetsContext), garantindo que a UI reflita imediatamente os novos dados sem precisar recarregar a pagina.
