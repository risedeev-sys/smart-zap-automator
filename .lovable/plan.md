

# Dar vida aos Gatilhos (Backend) + Simulador de Testes

## Situacao Atual
- A tabela `triggers` no Supabase so tem `id`, `name`, `user_id`, `created_at`
- Faltam todas as colunas de configuracao (enabled, conditions, delay, regras, funil vinculado)
- A pagina `GatilhosPage.tsx` usa estado em memoria (AssetsContext) -- nada persiste no banco
- As outras paginas (Mensagens, Audios, etc.) ja seguem o padrao correto com CRUD direto no Supabase

## Como Testar sem WhatsApp?
Vamos criar um **Simulador de Gatilhos** direto na interface. Voce digita uma mensagem de teste e o sistema mostra quais gatilhos seriam disparados e qual funil seria executado. Assim da para validar toda a logica sem precisar conectar no WhatsApp.

---

## Plano de Implementacao

### 1. Migrar schema da tabela `triggers`
Adicionar as colunas que faltam:

- `enabled` (boolean, default true)
- `favorite` (boolean, default false)
- `conditions` (jsonb, default '[]') -- array de `{type, keywords[]}`
- `funnel_id` (uuid, nullable) -- referencia ao funil vinculado
- `delay_seconds` (integer, default 0)
- `send_to_groups` (boolean, default false)
- `saved_contacts_only` (boolean, default false)
- `ignore_case` (boolean, default true)
- `position` (integer, default 0) -- para ordenacao por drag

### 2. Reescrever `GatilhosPage.tsx` com CRUD no Supabase
Seguir o mesmo padrao de `MensagensPage.tsx`:
- `fetchTriggers()` no mount com `supabase.from("triggers").select()`
- Criar, editar, deletar com operacoes diretas no Supabase
- Remover dependencia do AssetsContext para triggers
- Manter estado local apenas para UI (selected, modais)
- Vincular funil via select que lista os funnels do usuario

### 3. Criar componente Simulador de Gatilhos
Um painel simples (pode ser um dialog ou uma secao na pagina) onde:
- O usuario digita uma mensagem de teste
- Clica em "Simular"
- O sistema avalia todas as condicoes dos gatilhos ativos
- Mostra uma lista dos gatilhos que seriam disparados, com o funil vinculado

A logica de matching seria:
- **contem**: mensagem inclui alguma keyword
- **igual a**: mensagem e exatamente igual a alguma keyword
- **comeca com**: mensagem comeca com alguma keyword
- **nao contem**: mensagem nao contem nenhuma keyword

Respeitando a flag `ignore_case`.

### 4. Atualizar AssetsContext
- Remover `triggers` e `setTriggers` do AssetsContext (ja que agora vive no Supabase)
- Ou manter como cache local se outras paginas precisarem dos triggers

### 5. Incluir triggers na exportacao/importacao de backup
- Adicionar triggers ao JSON de exportacao
- Adicionar limpeza e importacao de triggers no `importBackupToSupabase.ts`

---

## Detalhes Tecnicos

**Schema da coluna `conditions` (jsonb):**
```text
[
  { "type": "contem", "keywords": ["oi", "ola"] },
  { "type": "igual a", "keywords": ["menu"] }
]
```

**Logica do simulador (client-side):**
```text
para cada trigger ativo:
  para cada condition:
    normalizar mensagem (se ignore_case)
    avaliar tipo (contem/igual/comeca/nao contem)
    se TODAS as conditions passam -> trigger dispara
```

**Ordem das mudancas:**
1. Migracao do banco (adicionar colunas)
2. Reescrever GatilhosPage com Supabase
3. Adicionar simulador
4. Atualizar backup export/import
