#include <QFile>
#include "controller.h"
#include "logger.h"

Controller::Controller(const QString &configFile) : HOMEd(SERVICE_VERSION, configFile), m_database(new Database(getConfig(), this)), m_tcpServer(new QTcpServer(this)), m_webSocket(new QWebSocketServer("HOMEd", QWebSocketServer::NonSecureMode, this)), m_commands(QMetaEnum::fromType <Command> ())
{
    m_frontend = getConfig()->value("server/frontend", "/usr/share/homed-web").toString();
    m_username = getConfig()->value("server/username").toString();
    m_password = getConfig()->value("server/password").toString();
    m_guest = getConfig()->value("server/guest").toString();

    m_debug = getConfig()->value("server/debug", false).toBool();
    m_auth = m_username.isEmpty() || m_password.isEmpty() ? false : true;

    m_retained = {"device", "expose", "service", "status"};
    m_types = {"css", "js", "json", "png", "svg", "woff2"};

    connect(m_database, &Database::statusUpdated, this, &Controller::statusUpdated);
    connect(m_tcpServer, &QTcpServer::newConnection, this, &Controller::socketConnected);
    connect(m_webSocket, &QWebSocketServer::newConnection, this, &Controller::clientConnected);

    m_database->init();
    m_tcpServer->listen(QHostAddress::Any, static_cast <quint16> (getConfig()->value("server/port", 8080).toInt()));
}

void Controller::httpResponse(QTcpSocket *socket, quint16 code, const QMap <QString, QString> &headers, const QByteArray &response)
{
    QByteArray data;

    switch (code)
    {
       case 200: data = "HTTP/1.1 200 OK"; break;
       case 301: data = "HTTP/1.1 301 Moved Permanently"; break;
       case 404: data = "HTTP/1.1 404 Not Found"; break;
       case 405: data = "HTTP/1.1 405 Method Not Allowed"; break;
       case 500: data = "HTTP/1.1 500 Internal Server Error"; break;
    }

    for (auto it = headers.begin(); it != headers.end(); it++)
        data.append(QString("\r\n%1: %2").arg(it.key(), it.value()).toUtf8());

    socket->write(data.append("\r\n\r\n").append(response));
    socket->close();
}

void Controller::fileResponse(QTcpSocket *socket, const QString &fileName)
{
    QFile file(QString(m_frontend).append(fileName));
    QByteArray type, data;

    if (!file.exists())
    {
        httpResponse(socket, 404);
        return;
    }

    if (!file.open(QFile::ReadOnly))
    {
        httpResponse(socket, 500);
        return;
    }

    switch (m_types.indexOf(fileName.mid(fileName.lastIndexOf('.') + 1)))
    {
        case 0:  type = "text/css"; break;         // css
        case 1:  type = "text/javascript"; break;  // js
        case 2:  type = "application/json"; break; // json
        case 3:  type = "image/png"; break;        // png
        case 4:  type = "image/svg+xml"; break;    // svg
        case 5:  type = "font/woff2"; break;       // woff2
        default: type = "text/html"; break;
    }

    data = file.readAll();

    if (fileName == "/index.html")
    {
        QString css = "<link rel=\"stylesheet\" href=\"css/custom.css\">";
        data = QString(data).arg(QFile::exists(QString(m_frontend).append("/css/custom.css")) ? css : QString("<!-- %1 -->").arg(css), SERVICE_VERSION, m_auth ? "<span id=\"logout\"><i class=\"icon-enable\"></i> LOGOUT</span>" : QString()).toUtf8();
    }

    httpResponse(socket, 200, {{"Content-Type", type}, {"Content-Length", QString::number(data.length())}}, data);
    file.close();
}

void Controller::quit(void)
{
    m_webSocket->close();

    for (auto it = m_clients.begin(); it != m_clients.end(); it++)
        it.key()->deleteLater();

    HOMEd::quit();
}

void Controller::mqttConnected(void)
{
    mqttSubscribe(mqttTopic("command/web"));

    for (auto it = m_clients.begin(); it != m_clients.end(); it++)
        for (int i = 0; i < it.value().count(); i++)
            mqttSubscribe(mqttTopic(it.value().at(i)));

    m_database->store();
    mqttPublishStatus();
}

void Controller::mqttDisconnected(void)
{
    m_messages.clear();
}

void Controller::mqttReceived(const QByteArray &message, const QMqttTopicName &topic)
{
    QString subTopic = topic.name().replace(0, mqttTopic().length(), QString());
    QJsonObject json = QJsonDocument::fromJson(message).object();

    if (subTopic == "command/web")
    {
        switch (static_cast <Command> (m_commands.keyToValue(json.value("action").toString().toUtf8().constData())))
        {
            case Command::restartService:
            {
                logWarning << "Restart request received...";
                mqttPublish(topic.name(), QJsonObject(), true);
                QCoreApplication::exit(EXIT_RESTART);
                break;
            }

            case Command::updateDashboards:
            {
                m_database->updateDasboards(json.value("data").toArray());
                m_database->store(true);
                break;
            }

            case Command::updateNames:
            {
                m_database->updateNames(json.value("data").toObject());
                m_database->store(true);
                break;
            }
        }
    }

    if (m_retained.contains(subTopic.split('/').value(0)))
        m_messages.insert(subTopic, message);

    for (auto it = m_clients.begin(); it != m_clients.end(); it++)
    {
        for (int i = 0; i < it.value().count(); i++)
        {
            const QString item = it.value().at(i);

            if (item.endsWith('#') ? !subTopic.startsWith(item.mid(0, item.indexOf("#"))) : subTopic != item)
                continue;

            it.key()->sendTextMessage(QJsonDocument({{"topic", subTopic}, {"message", json.isEmpty() ? QJsonValue::Null : QJsonValue(json)}}).toJson(QJsonDocument::Compact));
            break;
        }
    }
}

void Controller::statusUpdated(const QJsonObject &json)
{
    mqttPublish(mqttTopic("status/web"), json, true);
}

void Controller::socketConnected(void)
{
    QTcpSocket *socket = m_tcpServer->nextPendingConnection();
    connect(socket, &QTcpSocket::disconnected, this, &Controller::socketDisconnected);
    connect(socket, &QTcpSocket::readyRead, this, &Controller::readyRead);
    m_sockets.append(socket);
}

void Controller::socketDisconnected(void)
{
    QTcpSocket *socket = reinterpret_cast <QTcpSocket*> (sender());
    m_sockets.removeAll(socket);
    socket->deleteLater();
}

void Controller::readyRead(void)
{
    QTcpSocket *socket = reinterpret_cast <QTcpSocket*> (sender());
    QByteArray request = socket->peek(socket->bytesAvailable());
    QList <QString> list = QString(request).split("\r\n\r\n"), head = list.value(0).split("\r\n"), target = head.value(0).split(0x20), cookieList, itemList;
    QString method = target.value(0), url = target.value(1), content = list.value(1);
    QMap <QString, QString> headers, cookies, items;
    bool guest = false;

    disconnect(socket, &QTcpSocket::readyRead, this, &Controller::readyRead);
    logDebug(m_debug) << "Request" << head.value(0) << "received from" << socket->peerAddress().toString();

    for (int i = 1; i < head.count(); i++)
    {
        QList <QString> header = head.at(i).split(':');

        if (header.count() < 2)
            continue;

        headers.insert(header.value(0).toLower().trimmed(), header.value(1).trimmed());
        logDebug(m_debug) << "Header received:" << head.at(i);
    }

    cookieList = headers.value("cookie").split(';');

    for (int i = 0; i < cookieList.count(); i++)
    {
        QList <QString> cookie = cookieList.at(i).split('=');

        if (cookie.count() < 2)
            continue;

        cookies.insert(cookie.value(0).trimmed(), cookie.value(1).trimmed());
        logDebug(m_debug) << "Cookie received:" << cookieList.at(i);
    }

    if (method == "POST" && headers.value("content-length").toInt() > content.length())
    {
        socket->read(request.length());
        socket->waitForReadyRead();
        content.append(socket->readAll());
    }

    itemList = QString(method == "GET" && url.contains('?') ? url.mid(url.indexOf('?') + 1) : content).split('&');

    for (int i = 0; i < itemList.count(); i++)
    {
        QList <QString> item = itemList.at(i).split('=');

        if (item.count() < 2)
            continue;

        items.insert(item.value(0), QUrl::fromPercentEncoding(item.value(1).toUtf8()));
        logDebug(m_debug) << "Data received:" << itemList.at(i);
    }

    if (m_auth)
    {
        QString token = cookies.value("homed-auth-token");

        if (token != m_database->adminToken() && token != m_database->guestToken() && url != "/manifest.json" && !url.startsWith("/css/") && !url.startsWith("/font/") && !url.startsWith("/img/"))
        {
            if (method == "POST")
            {
                QString username = items.value("username"), password = items.value("password");

                if (username == m_username && password == m_password)
                {
                    httpResponse(socket, 301, {{"Location", QString(headers.value("x-ingress-path")).append('/')}, {"Cache-Control", "no-cache, no-store"}, {"Set-Cookie", QString("homed-auth-token=%1; path=/; max-age=%2").arg(m_database->adminToken()).arg(COOKIE_MAX_AGE)}});
                    return;
                }

                if (!m_guest.isEmpty() && username == "guest" && password == m_guest)
                {
                    httpResponse(socket, 301, {{"Location", QString(headers.value("x-ingress-path")).append('/')}, {"Cache-Control", "no-cache, no-store"}, {"Set-Cookie", QString("homed-auth-token=%1; path=/; max-age=%2").arg(m_database->guestToken()).arg(COOKIE_MAX_AGE)}});
                    return;
                }
            }

            fileResponse(socket, "/login.html");
            return;
        }

        guest = token != m_database->adminToken() ? true : false;
    }

    url = url.mid(0, url.indexOf('?'));

    if (url == "/logout")
    {
        httpResponse(socket, 301, {{"Location", QString(headers.value("x-ingress-path")).append('/')}, {"Cache-Control", "no-cache, no-store"}, {"Set-Cookie", "homed-auth-token=deleted; path=/; max-age=0"}});

        if (guest || items.value("session") != "all")
            return;

        for (auto it = m_clients.begin(); it != m_clients.end(); it++)
            it.key()->deleteLater();

        m_database->resetAdminToken();
        m_database->resetGuestToken();
        m_database->store(true);
        return;
    }

    if (method != "GET")
    {
        httpResponse(socket, 405);
        return;
    }

    if (headers.value("upgrade") == "websocket")
    {
        socket->setProperty("guest", guest);
        m_webSocket->handleConnection(socket);
        return;
    }

    fileResponse(socket, url != "/" ? url : "/index.html");
}

void Controller::clientConnected(void)
{
    QWebSocket *client = m_webSocket->nextPendingConnection();
    connect(client, &QWebSocket::disconnected, this, &Controller::clientDisconnected);
    connect(client, &QWebSocket::textMessageReceived, this, &Controller::textMessageReceived);

    if (mqttStatus())
        client->sendTextMessage(QJsonDocument({{"topic", "setup"}, {"message", QJsonObject {{"guest", client->parent() ? client->parent()->property("guest").toBool() : false}}}}).toJson(QJsonDocument::Compact));
    else
        client->sendTextMessage(QJsonDocument({{"topic", "error"}, {"message", "mqtt disconnected"}}).toJson(QJsonDocument::Compact));

    m_clients.insert(client, QStringList());
}

void Controller::clientDisconnected(void)
{
    QWebSocket *client = reinterpret_cast <QWebSocket*> (sender());
    m_clients.remove(client);
    client->deleteLater();
}

void Controller::textMessageReceived(const QString &message)
{
    auto it = m_clients.find(reinterpret_cast <QWebSocket*> (sender()));
    QJsonObject json = QJsonDocument::fromJson(message.toUtf8()).object();
    QString action = json.value("action").toString(), subTopic = json.value("topic").toString();

    if (it == m_clients.end() || subTopic.isEmpty())
        return;

    if (action == "subscribe")
    {
        QWebSocket* client = it.key();

        if (!it.value().contains(subTopic))
            it.value().append(subTopic);

        for (auto it = m_messages.begin(); it != m_messages.end(); it++)
        {
            if (subTopic.endsWith('#') ? !it.key().startsWith(subTopic.mid(0, subTopic.indexOf("#"))) : it.key() != subTopic)
                continue;

            client->sendTextMessage(QJsonDocument({{"topic", it.key()}, {"message", QJsonDocument::fromJson(it.value()).object()}}).toJson(QJsonDocument::Compact));
        }

        mqttSubscribe(mqttTopic(subTopic));
    }
    else if (action == "publish")
    {
        QJsonObject message = json.value("message").toObject();

        if (subTopic.startsWith("command/") && !message.value("action").toString().startsWith("get") && it.key()->parent() ? it.key()->parent()->property("guest").toBool() : false)
        {
            it.key()->sendTextMessage(QJsonDocument({{"topic", "error"}, {"message", "access denied"}}).toJson(QJsonDocument::Compact));
            return;
        }

        mqttPublish(mqttTopic(subTopic), message);
    }
    else if (action == "unsubscribe")
        it.value().removeAll(subTopic);
}
