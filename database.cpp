#include <QRandomGenerator>
#include "controller.h"
#include "database.h"
#include "logger.h"

Database::Database(QSettings *config, QObject *parent) : QObject(parent), m_timer(new QTimer(this)), m_sync(false)
{
    m_file.setFileName(config->value("server/database", "/opt/homed-web/database.json").toString());
    connect(m_timer, &QTimer::timeout, this, &Database::write);
    m_timer->setSingleShot(true);
}

Database::~Database(void)
{
    m_sync = true;
    write();
}

void Database::init(void)
{
    QJsonObject json;
    bool check = false;

    if (m_file.open(QFile::ReadOnly))
    {
        json = QJsonDocument::fromJson(m_file.readAll()).object();
        m_file.close();
    }

    m_adminToken = json.value("adminToken").toString();
    m_guestToken = json.value("guestToken").toString();
    m_dashboards = json.value("dashboards").toArray();

    if (m_adminToken.isEmpty())
    {
        resetAdminToken();
        check = true;
    }

    if (m_guestToken.isEmpty())
    {
        resetGuestToken();
        check = true;
    }

    if (!check)
        return;

    write();
}

void Database::store(bool sync)
{
    m_sync = sync;
    m_timer->start(STORE_DELAY);
}

QByteArray Database::randomData(int length)
{
    QByteArray data;

    for (int i = 0; i < length; i++)
        data.append(static_cast <char> (QRandomGenerator::global()->generate()));

    return data;
}

void Database::write(void)
{
    QJsonObject json = {{"timestamp", QDateTime::currentSecsSinceEpoch()}, {"version", SERVICE_VERSION}};
    QByteArray data;
    bool check = true;

    if (!m_dashboards.isEmpty())
        json.insert("dashboards", m_dashboards);

    emit statusUpdated(json);

    if (!m_sync)
        return;

    m_sync = false;

    if (!m_file.open(QFile::WriteOnly))
    {
        logWarning << "Database not stored, file" << m_file.fileName() << "open error:" << m_file.errorString();
        return;
    }

    json.insert("adminToken", m_adminToken);
    json.insert("guestToken", m_guestToken);
    data = QJsonDocument(json).toJson(QJsonDocument::Compact);

    if (m_file.write(data) != data.length())
    {
        logWarning << "Database not stored, file" << m_file.fileName() << "write error:" << m_file.errorString();
        check = false;
    }

    m_file.close();

    if (!check)
        return;

    system("sync");
}
