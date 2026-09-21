![HOMEd Web](.github/logo.png)

# HOMEd Web

Для компиляции необходим базовый проект:\
https://github.com/u236/homed-service-common

Документация:\
https://wiki.homed.dev/web/

## Авторизация WebSocket

Внешние клиенты, не имеющие доступа к браузерному хранилищу cookie, могут запросить короткоживущий одноразовый WebSocket ticket:

```http
POST /api/auth/websocket
Content-Type: application/x-www-form-urlencoded

username=homed&password=homed
```

JSON-ответ содержит `ticket`, который действует 30 секунд и может быть использован один раз при открытии WebSocket-соединения:

```text
ws://host:port/?ticket=<ticket>
```

Существующая форма входа и авторизация по cookie `homed-auth-token` продолжают работать без изменений. При публикации сервиса за пределами доверенной сети необходимо использовать HTTPS/WSS.
