#include <QFile>
#include "controller.h"

Controller::Controller(const QString &configFile) : HOMEd(configFile), m_tcpServer(new QTcpServer(this)), m_webSocket(new QWebSocketServer("HOMEd", QWebSocketServer::NonSecureMode, this))
{
    m_retained = {"device", "expose", "service", "status"};

    connect(m_tcpServer, &QTcpServer::newConnection, this, &Controller::socketConnected);
    connect(m_webSocket, &QWebSocketServer::newConnection, this, &Controller::clientConnected);

    m_tcpServer->listen(QHostAddress::Any, static_cast <quint16> (getConfig()->value("server/port", 8080).toInt()));
    m_path = getConfig()->value("server/path", "/usr/share/homed-web").toString();
}

void Controller::handleRequest(QTcpSocket *socket, const QByteArray &request)
{
    QList <QByteArray> list = request.split(' ');
    QFile file;

    if (list.value(0) != "GET")
    {
        socket->write("HTTP/1.1 405 Method Not Allowed");
        return;
    }

    file.setFileName(QString(m_path).append(list.value(1) != "/" ? list.value(1).split('?').value(0) : "/index.html"));

    if (!file.exists())
    {
        socket->write("HTTP/1.1 404 Not Found");
        return;
    }

    if (!file.open(QFile::ReadOnly))
    {
        socket->write("HTTP/1.1 404 Internal Server Error");
        return;
    }

    socket->write(QString("HTTP/1.1 200 OK\r\nContent-Length: %1\r\n\r\n").arg(file.size()).toUtf8());
    socket->write(file.readAll());

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
    logInfo << "MQTT connected";

    for (auto it = m_clients.begin(); it != m_clients.end(); it++)
        for (int i = 0; i < it.value().count(); i++)
            mqttSubscribe(mqttTopic(it.value().at(i)));
}

void Controller::mqttReceived(const QByteArray &message, const QMqttTopicName &topic)
{
    QString subTopic = topic.name().replace(mqttTopic(), QString());
    QJsonObject json = QJsonDocument::fromJson(message).object();
    bool check = false;

    if (m_retained.contains(subTopic.split('/').value(0)))
        m_messages.insert(subTopic, json);

    for (auto it = m_clients.begin(); it != m_clients.end(); it++)
    {
        if (!it.value().contains(subTopic))
            continue;

        it.key()->sendTextMessage(QJsonDocument({{"topic", subTopic}, {"message", json.isEmpty() ? QJsonValue::Null : QJsonValue(json)}}).toJson(QJsonDocument::Compact));
        check = true;
    }

    if (!check)
    {
        mqttUnsubscribe(topic.name());
        m_messages.remove(subTopic);
    }
}

void Controller::socketConnected(void)
{
    QTcpSocket *socket = m_tcpServer->nextPendingConnection();
    connect(socket, &QTcpSocket::disconnected, this, &Controller::socketDisconnected);
    connect(socket, &QTcpSocket::readyRead, this, &Controller::readyRead);
    m_sockets.push_back(socket);
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

    disconnect(socket, &QTcpSocket::readyRead, this, &Controller::readyRead);

    if (request.contains("Upgrade: websocket\r\n"))
    {
        m_webSocket->handleConnection(socket);
        return;
    }

    handleRequest(socket, request);
    socket->close();
}

void Controller::clientConnected(void)
{
    QWebSocket *client = m_webSocket->nextPendingConnection();

    logInfo << "Client" << (client->request().hasRawHeader("X-Real-IP") ? client->request().rawHeader("X-Real-IP") : client->peerAddress().toString()) << "websocket connected";

    connect(client, &QWebSocket::disconnected, this, &Controller::clientDisconnected);
    connect(client, &QWebSocket::textMessageReceived, this, &Controller::textMessageReceived);

    m_clients.insert(client, QStringList());
}

void Controller::clientDisconnected(void)
{
    QWebSocket *client = reinterpret_cast <QWebSocket*> (sender());

    logInfo << "Client" << (client->request().hasRawHeader("X-Real-IP") ? client->request().rawHeader("X-Real-IP") : client->peerAddress().toString()) << "websocket disconnected";

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
        if (!it.value().contains(subTopic))
            it.value().push_back(subTopic);

        if (m_messages.contains(subTopic))
        {
            QJsonObject json = m_messages.value(subTopic);
            it.key()->sendTextMessage(QJsonDocument({{"topic", subTopic}, {"message", json.isEmpty() ? QJsonValue::Null : QJsonValue(json)}}).toJson(QJsonDocument::Compact));
            return;
        }

        mqttSubscribe(mqttTopic(subTopic));
    }
    else if (action == "publish")
        mqttPublish(mqttTopic(subTopic), json.value("message").toObject());
    else if (action == "unsubscribe")
        it.value().removeAll(subTopic);
}
