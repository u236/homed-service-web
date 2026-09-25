![HOMEd Web](.github/logo.png)

# HOMEd Web

Для компиляции необходим базовый проект:\
https://github.com/u236/homed-service-common

Документация:\
https://wiki.homed.dev/web/

## Авторизация WebSocket

Клиенты, не имеющие доступа к cookie, могут запросить одноразовый тикет, добавив к данным авторизации поле `ticket`:

```
POST / HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=homed&password=homed&ticket=true
```

Вместо cookie сервер вернёт `{"ticket": "..."}`. Тикет действует 30 секунд, используется один раз и передаётся при открытии соединения:

```
ws://host:port/?ticket=<ticket>
```

Роль пользователя сохраняется, авторизация по cookie продолжает работать без изменений.
