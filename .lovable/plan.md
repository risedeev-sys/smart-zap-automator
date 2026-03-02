

# Replicar Interface Real do WhatsApp Web no Espaco de Teste

## Problema Atual
A lista de contatos no modo real mostra dados brutos: numeros em vez de nomes salvos, sem separacao visual entre grupos e contatos individuais, sem avatares diferenciados, e sem os detalhes visuais do WhatsApp Web real (checks de leitura, prefixo de remetente em grupos, etc).

## Mudancas Planejadas

### 1. Melhorar dados vindos da Edge Function `whatsapp-manage`
- Extrair campo `profilePicUrl` dos contatos da Evolution API (quando disponivel)
- Retornar campo `unreadCount` de cada chat (ja disponivel na resposta da Evolution API)
- Melhorar extracaoo de `lastMessage` incluindo prefixo do remetente em grupos
- Garantir que nomes de grupos venham completos (ex: "Networking - Rise Community #1")

### 2. Redesenhar a lista de contatos no estilo WhatsApp Web
- **Avatares**: Usar `Avatar` component com iniciais coloridas para contatos e icone de grupo para grupos (em vez de emojis genericos)
- **Nomes**: Exibir nome salvo (pushName) em negrito, ou numero formatado como fallback
- **Ultima mensagem**: Mostrar com checks de leitura (azul/cinza) e prefixo do remetente em grupos
- **Timestamp**: Alinhado a direita, formatado como "10:42", "ontem", etc.
- **Contador de nao lidas**: Badge verde circular (estilo WhatsApp)
- **Separacao visual**: Grupos com icone de grupo distinto, contatos com avatar de inicial

### 3. Header do chat ativo no estilo WhatsApp Web
- Avatar com inicial ou foto do contato
- Nome e status ("online", "digitando...", ou "clique aqui para informacoes do grupo")
- Icones de busca, chamada de voz, video e menu (ja existem, manter)

### 4. Estilo visual geral
- Background do sidebar mais escuro (whatsapp-like)
- Hover states nos contatos
- Linha divisoria sutil entre contatos
- Fonte e espacamento consistentes com WhatsApp Web

## Detalhes Tecnicos

### Edge Function `whatsapp-manage` - acao `fetch-chats`
- Adicionar `unreadCount` ao retorno (campo `unreadCount` ou `unreadMessages` do chat)
- Tentar buscar `profilePictureUrl` via endpoint `/chat/fetchProfilePicture` (com fallback silencioso)
- Para grupos, extrair nome do grupo do campo `subject` ou `name`

### Componente de Avatar inteligente
- Gerar cor de fundo baseada no nome/numero (hash simples para cor consistente)
- Mostrar iniciais (1-2 letras) para contatos
- Mostrar icone de grupo para chats `@g.us`

### Formatacao de timestamps
- Hoje: "HH:mm"
- Ontem: "ontem"  
- Esta semana: dia da semana ("seg", "ter", etc.)
- Mais antigo: "dd/mm/yyyy"

### Mapeamento de contatos reais para o formato `Contact`
```text
Contact {
  id: string
  name: string          // pushName ou numero formatado
  phone: string         // numero limpo para envio
  avatar: string        // URL da foto ou vazio
  avatarInitials: string // iniciais para fallback
  avatarColor: string   // cor gerada por hash
  isGroup: boolean      // true para @g.us
  status: string
  lastMessage: string   // com prefixo de remetente em grupos
  lastTime: string      // formatado inteligente
  unread: number
}
```

### Arquivos modificados
1. **`supabase/functions/whatsapp-manage/index.ts`** - Adicionar `unreadCount` e melhorar dados retornados no `fetch-chats`
2. **`src/pages/EspacoTestePage.tsx`** - Redesenhar sidebar de contatos, adicionar logica de avatar/cor, melhorar formatacao de timestamps, separar visualmente grupos de contatos
3. **`src/components/RealModePanel.tsx`** - Ajustes menores de estilo para consistencia

