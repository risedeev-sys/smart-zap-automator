

## Integração com Evolution API

Plano completo para conectar o Rise Zap com a Evolution API, baseado nos módulos validados do devVAULT. A implementação será adaptada para o contexto do Rise Zap (single-user, não multi-vendor).

---

### Fase 1 — Banco de Dados

Criar a tabela `whatsapp_instances` adaptada ao Rise Zap:

```text
whatsapp_instances
├── id              UUID (PK, default gen_random_uuid())
├── user_id         UUID (NOT NULL, referencia auth.users)
├── instance_name   TEXT (NOT NULL, unique por user)
├── status          TEXT (default 'disconnected') — open | close | connecting | disconnected
├── qr_code         TEXT (nullable — base64 PNG do QR code)
├── phone_number    TEXT (nullable — preenchido quando conectado)
├── created_at      TIMESTAMPTZ (default now())
└── updated_at      TIMESTAMPTZ (default now())
```

RLS: cada usuario so ve/edita suas proprias instancias (mesmo padrao das outras tabelas).

---

### Fase 2 — Edge Functions (Backend)

#### 2.1 Codigo compartilhado: `_shared/whatsapp/evolution-client.ts`
Client HTTP tipado para a Evolution API v2 (conforme modulo `evolution-api-v2-client` do devVAULT):
- `createInstance(name, webhookUrl)` — cria instancia na Evolution API
- `getConnectionState(name)` — verifica status (open/close/connecting)
- `getQrCode(name)` — busca QR code base64
- `deleteInstance(name)` — remove instancia
- `sendText(name, number, text)` — envia mensagem de texto
- `sendMedia(name, number, url, caption, type)` — envia midia
- Timeout de 15s, autenticacao via apikey header

#### 2.2 Edge Function: `whatsapp-manage`
BFF para o frontend gerenciar instancias. Actions:
- `instance-create` — cria instancia na Evolution API + salva no banco
- `instance-connect` — gera QR code para conexao
- `instance-disconnect` — desconecta instancia
- `instance-delete` — remove instancia
- `instance-status` — consulta status atual
- `instance-list` — lista instancias do usuario

Auth: JWT do Supabase (usuario logado).

#### 2.3 Edge Function: `whatsapp-status-webhook`
Receptor de webhooks da Evolution API:
- Eventos: `CONNECTION_UPDATE` (atualiza status) e `QRCODE_UPDATED` (salva QR code)
- Auth: token na URL (`?token=SECRET`) com comparacao timing-safe
- Atualiza tabela `whatsapp_instances` automaticamente
- `verify_jwt = false` (webhook publico)

#### 2.4 Edge Function: `whatsapp-send`
Endpoint para envio de mensagens (usado pelo sistema de gatilhos/funis):
- Recebe: `instance_id`, `phone`, `text` (ou `media_url`, `media_type`)
- Valida que a instancia pertence ao usuario e esta `open`
- Envia via Evolution API client

---

### Fase 3 — Secrets necessarios

Sera preciso configurar no Supabase:
- `EVOLUTION_API_URL` — URL da sua instancia da Evolution API (ex: `https://evo.seudominio.com`)
- `EVOLUTION_API_KEY` — chave global da Evolution API
- `EVOLUTION_WEBHOOK_SECRET` — token aleatorio para validar webhooks

---

### Fase 4 — Frontend (Pagina de Instancias)

Transformar a pagina `ApiKeysPage.tsx` (placeholder atual) em uma interface funcional:

- **Lista de instancias** com status em tempo real (badge verde/vermelho/amarelo)
- **Botao "Nova Instancia"** — abre dialog para nomear e criar
- **Card de instancia** mostrando:
  - Nome, status, numero de telefone (quando conectado)
  - Area de QR Code (quando status = connecting) — poll a cada 3s
  - Botoes: Conectar, Desconectar, Excluir
- **Pagina Inicio (Index.tsx)** — atualizar o card "WhatsApp (Evolution API)" para mostrar dados reais da instancia

---

### Fase 5 — Integracao com Gatilhos

Atualizar o motor de gatilhos (`triggerEngine.ts`) para usar o `whatsapp-send` ao disparar funis, enviando as mensagens reais via WhatsApp quando uma instancia estiver conectada.

---

### Sequencia de implementacao

1. Secrets (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_WEBHOOK_SECRET)
2. Migration SQL (tabela whatsapp_instances + RLS)
3. Edge Function `whatsapp-manage` (com _shared/evolution-client)
4. Edge Function `whatsapp-status-webhook`
5. Edge Function `whatsapp-send`
6. Frontend — pagina de Instancias funcional
7. Frontend — card da pagina Inicio com dados reais
8. Integracao com gatilhos (opcional, fase seguinte)

