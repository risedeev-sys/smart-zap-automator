

# Rise Zap — Plano de Implementação (UI)

## Visão Geral
Painel web para gerenciar automações de WhatsApp via Evolution API. Foco 100% visual/UI nesta fase — sem backend real. Tema **light como padrão** com toggle para **dark mode**. Visual clean, premium, estilo SaaS moderno.

---

## 1. Layout Global (Base de todas as telas)

### Sidebar (menu lateral)
- Logo "Rise Zap" no topo
- Itens: Início, Mensagens, Áudios, Mídias, Documentos, Funis, Gatilhos, Fluxos (desabilitado), Backups
- Ícones + texto, item ativo destacado
- Colapsável (modo ícone)

### Topbar (barra superior)
- Título da página atual
- Badge "Plano Básico – chave restrita"
- Info do usuário (nome + telefone + avatar)
- Ícones: configurações, sair
- Toggle claro/escuro

### Cards de métricas/limites (faixa horizontal abaixo da topbar)
- Áudios enviados 0/20, Mídias 0/20, Documentos 0/20, Mensagens 0/20
- Funis enviados 2/5, Disparos em massa 0/2, Itens agendados 0/5, Fluxos 0/5
- Visíveis em todas as telas

---

## 2. Dashboard (Início)
- Mensagem de boas-vindas
- Cards informativos (Guia rápido, Conectar WhatsApp)
- Card "WhatsApp (Evolution API)" com status conectado/desconectado, botão conectar, área placeholder QR code
- Bloco "Total de itens cadastrados" com contagem por módulo (Mensagens, Áudios, Mídias, Documentos, Funis, Gatilhos, Fluxos)

---

## 3. Mensagens (layout 2 colunas)
- **Esquerda**: busca + botão "+ Adicionar" + lista de cards (nome, ações editar/favoritar, drag handle)
- **Direita**: header com nome, ações (deletar, duplicar, editar, favoritar), área de preview do texto

---

## 4. Áudios (layout 2 colunas)
- Mesmo padrão: lista à esquerda com busca/adicionar, preview à direita
- Empty state com ilustração quando vazio

---

## 5. Mídias (layout 2 colunas)
- Mesmo padrão de lista/detalhe
- Preview de imagem à direita
- Empty state quando vazio

---

## 6. Documentos
- Empty state com ilustração + botão "+ Adicionar"
- Com itens: padrão lista/detalhe consistente

---

## 7. Funis (layout 2 colunas)
- **Esquerda**: busca + "+ Adicionar" + lista de funis (nome, tempo total, ícones por tipo, editar/favoritar, drag)
- **Direita**: header com nome do funil, ações, botão "+ Adicionar item", lista de itens do funil (tipo, nome, delay "Enviando após X", editar/excluir)
- **Modal "Editar item"**: tabs Mensagem/Áudio/Mídia/Documento, select do item, inputs de delay (minutos/segundos), botões Cancelar/Salvar

---

## 8. Gatilhos (layout 2 colunas)
- **Esquerda**: lista de gatilhos com toggle liga/desliga, favoritar, busca, drag
- **Direita**: condições de disparo, funil vinculado, atraso, regras (enviar para grupos, contatos salvos, ignorar maiúsculas)
- **Modal "Editar gatilho 1/2"**: campo nome, condições de disparo (dropdown: igual/contém/começa/não contém), chips de palavras-chave com ENTER, "+ Adicionar outra condição", botões Cancelar/Próximo

---

## 9. Backups
- Tabs: Importar backup / Gerar backup
- **Importar**: toggle "Substituir todos os itens existentes", área de drag/drop para .json, aviso, botão importar
- **Gerar**: botão "Gerar backup", bloco informativo
- **Modal "Confirmação de exportação"**: campo nome do backup, toggle "Exportar tudo" (desativando permite seleção parcial), botões Cancelar/Exportar

---

## 10. Tema & Identidade Visual
- Tema **light** como padrão (fundo branco, textos escuros, cards claros)
- Dark mode via toggle (coerente com marca)
- Cores accent: azul/teal para visual SaaS premium clean
- Toda UI em português (PT-BR)

---

## 11. Placeholder Evolution API
- Card no Dashboard com status conectado/desconectado
- Badge de status, nome da instância, botão conectar
- Área de QR code (placeholder visual)
- Botão reconectar, bloco de logs (placeholder)

---

## Fora do escopo desta fase
- Fluxos (item no menu, mas desabilitado/sem tela)
- Backend real, persistência, uploads reais
- Integração real com Evolution API
- Autenticação real

