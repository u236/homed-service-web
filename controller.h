#ifndef CONTROLLER_H
#define CONTROLLER_H

#define SERVICE_VERSION     "2.6.2"
#define COOKIE_MAX_AGE      31536000

#include <QMetaEnum>
#include <QTcpServer>
#include <QWebSocket>
#include <QWebSocketServer>
#include "database.h"
#include "homed.h"

class Controller : public HOMEd
{
    Q_OBJECT

public:

    enum class Command
    {
        restartService,
        updateDashboards,
        updateNames
    };

    Controller(const QString &configFile);

    Q_ENUM(Command)

private:

    Database *m_database;
    QTcpServer *m_tcpServer;
    QWebSocketServer *m_webSocket;

    QMetaEnum m_commands;

    QString m_frontend, m_username, m_password, m_guest;
    bool m_debug, m_auth;

    QList <QString> m_retained, m_types;
    QMap <QString, QByteArray> m_messages;

    QList <QTcpSocket*> m_sockets;
    QMap <QWebSocket*, QStringList> m_clients;

    void httpResponse(QTcpSocket *socket, quint16 code, const QMap <QString, QString> &headers = QMap <QString, QString> (), const QByteArray &response = QByteArray());
    void fileResponse(QTcpSocket *socket, const QString &fileName);

public slots:

    void quit(void) override;

private slots:

    void mqttConnected(void) override;
    void mqttDisconnected(void) override;
    void mqttReceived(const QByteArray &message, const QMqttTopicName &topic) override;

    void statusUpdated(const QJsonObject &json);

    void socketConnected(void);
    void socketDisconnected(void);
    void readyRead(void);

    void clientConnected(void);
    void clientDisconnected(void);
    void textMessageReceived(const QString &message);

};

#endif
