
Diagnóstico completo (raiz da raiz)

1) O problema não é “só timeout”.
- O ativo de vídeo está válido no banco/storage (ex.: `11ed8ec8...mp4`, `mime=video/mp4`, ~14.46MB, path existente no bucket `assets`).
- Então a falha principal não está no upload do arquivo para Supabase.

2) A definição de “sucesso” no bridge está incorreta para vídeo.
- Hoje o fluxo considera sucesso quando `WPP.chat.sendFileMessage(...)` resolve.
- Para vídeo/documento de vídeo, foi forçado `waitForAck: false`, então o retorno pode acontecer antes da confirmação real de envio/upload.
- Resultado: funil avança/“parece enviado” sem garantia de entrega real.

3) Falta validação do resultado final do WhatsApp.
- A API da wa-js retorna `SendMessageReturn.sendMsgResult` com `messageSendResult` (`OK`, `ERROR_UPLOAD`, `ERROR_NETWORK`, etc.).
- Esse contrato não está sendo usado. Sem isso, erro real de upload fica invisível.

4) Observabilidade insuficiente.
- Só existe resposta binária `success/error`.
- Sem stage (`fetch`, `prepare`, `send`, `sendMsgResult`) e sem código de erro estruturado.
- Isso gera “travou em enviando funil” sem diagnóstico acionável.

Análise de Soluções

### Solução A: Ajustar apenas timeout e waitForAck
- Manutenibilidade: 5/10
- Zero DT: 4/10
- Arquitetura: 4/10
- Escalabilidade: 5/10
- Segurança: 8/10
- NOTA FINAL: 5.1/10
- Tempo estimado: 0.5 dia

### Solução B: Forçar vídeo sempre como documento e fallback de MIME
- Manutenibilidade: 7/10
- Zero DT: 6/10
- Arquitetura: 6/10
- Escalabilidade: 7/10
- Segurança: 8/10
- NOTA FINAL: 6.8/10
- Tempo estimado: 1 dia

### Solução C: Contrato de entrega determinístico + estratégia de envio por etapas + telemetria estruturada
- Manutenibilidade: 9/10
- Zero DT: 9/10
- Arquitetura: 9/10
- Scalabilidade: 9/10
- Segurança: 8/10
- NOTA FINAL: 8.9/10
- Tempo estimado: 2-3 dias

### DECISÃO: Solução C (Nota 8.9)
As outras são inferiores porque continuam tratando “chamada retornou” como “mensagem entregue”. A Solução C elimina isso no desenho: o funil só considera sucesso quando recebe resultado final de envio (ou erro explícito), com diagnóstico de etapa.

Plano de correção definitiva

1) Reescrever o contrato de resposta do bridge (extensao/injected/wpp-bridge.js)
- Substituir `respond(success, error)` por payload estruturado:
  - `success`, `stage`, `errorCode`, `errorMessage`, `strategy`, `messageId`, `sendMsgResult`.
- Etapas explícitas:
  - `FETCH_CONTENT` → `PREPARE_CONTENT` → `SEND_REQUEST` → `SEND_RESULT`.
- Após `sendFileMessage`, aguardar `sendReturn.sendMsgResult` com timeout dedicado e validar `messageSendResult === "OK"`.

2) Implementar estratégia em cascata para vídeo (sem depender de acaso)
- Estratégia 1: `type: "document"` com `filename .mp4` e `mimetype: "video/mp4"`.
- Se `ERROR_UPLOAD/ERROR_NETWORK/TIMEOUT`:
  - Estratégia 2: `type: "document"` com `mimetype: "application/octet-stream"` (força caminho estritamente documental).
- Apenas se ambas falharem: erro final estruturado para o funil (sem falso positivo).

3) Corrigir semântica de sucesso no content script (extensao/content/content.js)
- `sendFileViaBridge` só retorna `true` quando bridge retornar `success=true` com `sendMsgResult.messageSendResult === "OK"`.
- Em qualquer outro caso:
  - aborta item do funil com toast técnico curto + código (`ERROR_UPLOAD`, `TIMEOUT_SEND_RESULT`, etc.).
- Timeout único de 320s será substituído por timeouts por etapa (mais diagnósticos, menos “travou”).

4) Observabilidade operacional mínima (obrigatória)
- Logar no console por item:
  - `assetId`, `sendType`, `strategy`, `stage`, `elapsedMs`, `errorCode`.
- Persistir “último diagnóstico de falha” em `chrome.storage.local` para suporte rápido.

5) Controle de concorrência do funil para mídia pesada
- Não avançar para próximo item até fechamento determinístico do item atual (sucesso real ou erro real).
- Remove cenário de “pipeline segue sem entrega confirmada”.

Arquivos a alterar
- `extensao/injected/wpp-bridge.js` (núcleo da correção)
- `extensao/content/content.js` (contrato/controle de funil/telemetria)
- (Opcional de organização) extrair util de diagnóstico para `extensao/content/send-diagnostics.js` para reduzir acoplamento.

Fluxo alvo (determinístico)

```text
Funnel item(video)
  -> content.sendFileViaBridge()
    -> bridge.fetch/prepare
    -> bridge.sendFileMessage()
    -> await sendReturn.sendMsgResult
       -> OK      => success real
       -> ERROR_* => fallback strategy / fail explícito
  -> funil só avança com sucesso real
```

Critérios de aceite (fechamento do problema)
1) Vídeo do funil envia e aparece no chat em cenário normal.
2) Em falha de upload, funil interrompe com erro estruturado (sem “enviado” falso).
3) Logs mostram etapa e motivo exato da falha.
4) Repetição 5x consecutiva do mesmo funil sem travar em “Enviando funil...”.
5) Envio manual de mídia e envio via funil compartilham o mesmo contrato robusto.

Validação final (obrigatória)
- Teste ponta a ponta no WhatsApp Web com o funil real `FUNIL CONTEUDOS` (4 itens), incluindo o vídeo atual de ~14.46MB.
- Executar com aba ativa e em uma execução adicional alternando abas para confirmar comportamento de fallback e diagnóstico.
