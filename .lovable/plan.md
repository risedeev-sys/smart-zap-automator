

# Carregar Conversas Reais do WhatsApp no Espaco de Teste

## Objetivo
Substituir os contatos fictícios na barra lateral do Espaço de Teste pelas últimas 10 conversas reais do WhatsApp, buscadas diretamente da Evolution API.

## O que muda

### 1. Nova ação na edge function `whatsapp-manage`
Adicionar a ação `fetch-chats` que chama o endpoint da Evolution API `/chat/findChats/{instanceName}` para buscar as conversas reais. Retorna nome, número, última mensagem e timestamp.

### 2. Atualizar o Espaço de Teste
- Quando o "Modo Real" estiver ativo e uma instância selecionada, buscar automaticamente as conversas reais via `whatsapp-manage` com ação `fetch-chats`
- Substituir a lista de contatos fictícios (`INITIAL_CONTACTS`) pelos contatos reais retornados (últimas 10 conversas)
- Quando o modo real estiver desativado, voltar para os contatos de simulação

### 3. Mapeamento dos dados
Cada conversa retornada da Evolution API será convertida para o formato `Contact`:
- `name`: nome do contato ou número formatado
- `phone`: número do WhatsApp
- `lastMessage`: última mensagem da conversa
- `lastTime`: horário formatado
- `avatar`: emoji genérico (pessoa/grupo)

## Detalhes Tecnicos

### Edge Function `whatsapp-manage` - nova ação `fetch-chats`

```typescript
case "fetch-chats": {
  // Busca instância do usuário
  // Chama Evolution API: GET /chat/findChats/{instanceName}
  // Retorna as últimas 10 conversas ordenadas por timestamp
}
```

### Pagina `EspacoTestePage.tsx`

1. Novo `useEffect` que dispara quando `realMode` e `selectedInstanceId` mudam
2. Chama `supabase.functions.invoke("whatsapp-manage", { body: { action: "fetch-chats", instance_id } })`
3. Converte o resultado para `Contact[]` e atualiza o estado `contacts`
4. Ao desativar o modo real, restaura `INITIAL_CONTACTS`
5. Ao selecionar um contato real, preenche o `targetPhone` automaticamente para envio

