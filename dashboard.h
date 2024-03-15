#ifndef DASHBOARD_H
#define DASHBOARD_H

#define STORE_DATABASE_DELAY    20

#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSettings>
#include <QTimer>

class DashboardList : public QObject
{
    Q_OBJECT

public:

    DashboardList(QSettings *config, QObject *parent);
    ~DashboardList(void);

    inline void update(const QJsonArray &data) { m_data = data; }

    void init(void);
    void store(bool sync = false);

private:

    QTimer *m_timer;
    QFile m_file;

    QJsonArray m_data;
    bool m_sync;

private slots:

    void writeDatabase(void);

signals:

    void statusUpdated(const QJsonObject &json);

};

#endif
