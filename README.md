# Tégora Conferência

App de conferência de medidas em obra (inspirado no Bosch MeasureOn), com leitura da trena a laser **Bosch GLM 50 C** por Bluetooth clássico, exportação em PDF cotado e DXF (planta) para o Promob.

## Baixar o aplicativo (Android)

Abra a página **Releases** deste repositório, baixe `TegoraConferencia.apk` e instale no celular
(permita "instalar apps desconhecidos" para o navegador, se o Android pedir).

## Como usar com a trena

1. Pareie a trena em *Configurações do Android → Bluetooth* (nome "Bosch GLM50C …").
2. Abra o app, toque em **Trena ○** no topo e permita "Dispositivos próximos".
3. Toque em **Medir** ao lado de um campo e meça com a trena: o valor entra sozinho.

## Estrutura

- `app/` projeto Android (WebView + ponte Bluetooth clássico SPP em `MainActivity.java`).
- `app/src/main/assets/index.html` o app completo (arquivo único, gerado de `web/`).
- `web/` código-fonte do app web e testes (`node web/build/build.js`).
- `.github/workflows/build-apk.yml` compila o APK a cada atualização e publica em Releases.
