# Rise Zap - Extensão Chrome

## Instalação

1. Abra `chrome://extensions/` no Chrome
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extensao/`
5. Adicione ícones de 48x48 e 128x128 na pasta `icons/`

## Uso

1. Clique no ícone da extensão e faça login com sua conta Rise Zap
2. Selecione a instância WhatsApp conectada
3. Abra o WhatsApp Web - a barra aparecerá no rodapé
4. Cada botão corresponde a um asset/funil da sua conta
5. Clique para ver o preview e confirmar o envio

## Estrutura

```
extensao/
├── manifest.json
├── popup/
│   ├── popup.html    # Tela de login
│   └── popup.js      # Lógica de autenticação
├── content/
│   ├── content.js    # Barra injetada no WhatsApp Web
│   └── content.css   # Estilos da barra e modais
├── background/
│   └── background.js # Refresh de token
└── icons/
    ├── icon48.png
    └── icon128.png
```
