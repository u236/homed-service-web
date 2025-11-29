#ifndef DATABASE_H
#define DATABASE_H

#define STORE_DELAY     20

#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSettings>
#include <QTimer>

class Database : public QObject
{
    Q_OBJECT

public:

    Database(QSettings *config, QObject *parent);
    ~Database(void);

    inline bool passive(void) { return m_passive; }

    inline QString adminToken(void) { return m_adminToken; }
    inline void resetAdminToken(void) { m_adminToken = randomData(32).toHex(); }

    inline QString guestToken(void) { return m_guestToken; }
    inline void resetGuestToken(void) { m_guestToken = randomData(32).toHex(); }

    inline void updateDasboards(const QJsonArray &data) { m_dashboards = data; }
    inline void updateNames(const QJsonObject &data) { m_names = data; }

    void init(void);
    void store(bool sync = false);

private:

    QTimer *m_timer;
    QFile m_file;
    bool m_sync, m_passive;

    QString m_adminToken, m_guestToken;
    QJsonArray m_dashboards;
    QJsonObject m_names;

    QByteArray randomData(int length);

private slots:

    void write(void);

signals:

    void statusUpdated(const QJsonObject &json);

};

#endif
