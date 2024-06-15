#ifndef CONTROLLER_H
#define CONTROLLER_H

#define SERVICE_VERSION     "2.2.4"
#define COOKIE_MAX_AGE      31536000

#include <QTcpServer>
#include <QWebSocket>
#include <QWebSocketServer>
#include "database.h"
#include "homed.h"

class Controller : public HOMEd
{
    Q_OBJECT

public:

    Controller(const QString &configFile);

private:

    Database *m_database;
    QTcpServer *m_tcpServer;
    QWebSocketServer *m_webSocket;

    QString m_frontend, m_username, m_password;
    bool m_auth;

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
