

# Importar Backups do Zap Voice no Rise Zap

## Objetivo
Permitir que o sistema de importacao reconheca automaticamente arquivos de backup do Zap Voice e converta os dados para o formato interno do Rise Zap.

## Mapeamento de Campos Identificado

### Categorias
| Zap Voice | Rise Zap |
|-----------|----------|
| `messages` | `mensagens` |
| `audios` | `audios` |
| `medias` | `midias` |
| `docs` | `documentos` |
| `funnels` | `funis` |
| `triggers` | `gatilhos` |

### Campos dos Assets (mensagens, audios, midias, documentos)
| Zap Voice | Rise Zap |
|-----------|----------|
| `id` | `id` |
| `name` | `name` |
| `isFavorite` | `favorite` |

### Campos dos Funis
| Zap Voice | Rise Zap |
|-----------|----------|
| `funnels[].id` | `funis[].id` |
| `funnels[].name` | `funis[].name` |
| `funnels[].isFavorite` | `funis[].favorite` |
| `funnels[].itemsSequence` | `funis[].items` |
| `itemsSequence[].itemId` | `items[].assetId` |
| `itemsSequence[].type` ("message"/"media"/"audio"/"doc") | `items[].type` ("mensagem"/"midia"/"audio"/"documento") |
| `itemsSequence[].delayBeforeSend` (milissegundos) | `items[].delayMin` + `items[].delaySec` |

### Campos dos Gatilhos
| Zap Voice | Rise Zap |
|-----------|----------|
| `triggers[].isEnabled` | `enabled` |
| `triggers[].isFavorite` | `favorite` |
| `triggers[].keywordRules` | `conditions` |
| `triggers[].keywordRules[].type` | `conditions[].type` (ex: "contains" -> "contem") |
| `triggers[].isCaseSensitive` | `ignoreCase` (invertido) |
| `triggers[].funnelId` | `funnelName` (resolvido pelo nome do funil correspondente) |
| `triggers[].millisecondsBeforeSend` | `delay` (convertido para texto legivel) |
| `triggers[].sendToGroups` | `sendToGroups` |
| `triggers[].sendToContacts` | `savedContactsOnly` (invertido) |

## Implementacao

### Arquivo: `src/pages/BackupsPage.tsx`

Adicionar uma funcao `detectAndConvertZapVoice()` que:

1. **Detecta o formato** - Verifica se o JSON contem campos do Zap Voice (`messages`, `medias`, `keywordRules` nos triggers, `itemsSequence` nos funnels)
2. **Converte assets** - Mapeia `messages` para `mensagens`, `medias` para `midias`, `docs` para `documentos`, renomeia `isFavorite` para `favorite`
3. **Converte funis** - Transforma `itemsSequence` em `items`, converte `itemId` para `assetId`, converte `delayBeforeSend` (ms) em `delayMin`/`delaySec`, mapeia tipos (`message` -> `mensagem`, `media` -> `midia`, `doc` -> `documento`)
4. **Converte gatilhos** - Transforma `keywordRules` em `conditions`, resolve `funnelId` para `funnelName`, converte `millisecondsBeforeSend` para texto de delay, inverte `isCaseSensitive` para `ignoreCase`

A funcao e chamada dentro de `handleImport()` logo apos o `JSON.parse()`, antes de qualquer processamento. Se o formato for Zap Voice, os dados sao convertidos para o formato Rise Zap e o fluxo normal de importacao continua normalmente (incluindo remapeamento de IDs no modo append).

### Fluxo do usuario
1. Usuario seleciona o arquivo .json do Zap Voice
2. Clica em "Importar backup"
3. O sistema detecta automaticamente que e um backup do Zap Voice
4. Converte os dados para o formato Rise Zap
5. Importa normalmente (com ou sem substituicao)
6. Exibe toast: "Backup do Zap Voice importado com sucesso! X mensagens, Y audios..."

