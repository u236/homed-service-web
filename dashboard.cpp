#include "controller.h"
#include "dashboard.h"
#include "logger.h"

DashboardList::DashboardList(QSettings *config, QObject *parent) : QObject(parent), m_timer(new QTimer(this)), m_sync(false)
{
    m_file.setFileName(config->value("dashboard/database", "/opt/homed-web/database.json").toString());
    connect(m_timer, &QTimer::timeout, this, &DashboardList::writeDatabase);
    m_timer->setSingleShot(true);
}

DashboardList::~DashboardList(void)
{
    m_sync = true;
    writeDatabase();
}

void DashboardList::init(void)
{
    if (!m_file.open(QFile::ReadOnly))
        return;

    m_data =  QJsonDocument::fromJson(m_file.readAll()).object().value("dashboards").toArray();
    m_file.close();
}

void DashboardList::store(bool sync)
{
    m_sync = sync;
    m_timer->start(STORE_DATABASE_DELAY);
}

void DashboardList::writeDatabase(void)
{
    QJsonObject json = {{"dashboards", m_data}, {"timestamp", QDateTime::currentSecsSinceEpoch()}, {"version", SERVICE_VERSION}};
    QByteArray data = QJsonDocument(json).toJson(QJsonDocument::Compact);
    bool check = true;

    emit statusUpdated(json);

    if (!m_sync)
        return;

    m_sync = false;

    if (!m_file.open(QFile::WriteOnly))
    {
        logWarning << "Database not stored, file" << m_file.fileName() << "open error:" << m_file.errorString();
        return;
    }

    if (m_file.write(data) != data.length())
    {
        logWarning << "Database not stored, file" << m_file.fileName() << "open error:" << m_file.errorString();
        check = false;
    }

    m_file.close();

    if (!check)
        return;

    system("sync");
}
