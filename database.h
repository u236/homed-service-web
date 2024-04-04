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

    inline void update(const QJsonArray &data) { m_dashboards = data; }
    inline QSet <QString> &tokens(void) { return m_tokens; }

    void init(void);
    void store(bool sync = false);

private:

    QTimer *m_timer;
    QFile m_file;

    QJsonArray m_dashboards;
    QSet <QString> m_tokens;

    bool m_sync;

private slots:

    void write(void);

signals:

    void statusUpdated(const QJsonObject &json);

};

#endif
