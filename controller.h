#ifndef CONTROLLER_H
#define CONTROLLER_H

#define SERVICE_VERSION     "1.0.11"

#include <QTcpServer>
#include <QWebSocket>
#include <QWebSocketServer>
#include "homed.h"

class Controller : public HOMEd
{
    Q_OBJECT

public:

    Controller(const QString &configFile);

private:

    QTcpServer *m_tcpServer;
    QWebSocketServer *m_webSocket;

    QString m_path;

    QList <QString> m_retained;
    QMap <QString, QJsonObject> m_messages;

    QList <QTcpSocket*> m_sockets;
    QMap <QWebSocket*, QStringList> m_clients;

    void handleRequest(QTcpSocket *socket, const QByteArray &request);

public slots:

    void quit(void) override;

private slots:

    void mqttConnected(void) override;
    void mqttReceived(const QByteArray &message, const QMqttTopicName &topic) override;

    void socketConnected(void);
    void socketDisconnected(void);
    void readyRead(void);

    void clientConnected(void);
    void clientDisconnected(void);
    void textMessageReceived(const QString &message);

};

#endif
