#include <QRandomGenerator>
#include "controller.h"
#include "database.h"
#include "logger.h"

Database::Database(QSettings *config, QObject *parent) : QObject(parent), m_timer(new QTimer(this)), m_sync(false)
{
    m_file.setFileName(config->value("server/database", "/opt/homed-web/database.json").toString());
    m_passive = config->value("server/passive", false).toBool();

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
    m_names = json.value("names").toObject();

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

    if (!m_dashboards.isEmpty())
        json.insert("dashboards", m_dashboards);

    if (!m_names.isEmpty())
        json.insert("names", m_names);

    if (!m_passive)
        emit statusUpdated(json);

    if (!m_sync)
        return;

    json.insert("adminToken", m_adminToken);
    json.insert("guestToken", m_guestToken);
    m_sync = false;

    if (reinterpret_cast <Controller*> (parent())->writeFile(m_file, QJsonDocument(json).toJson(QJsonDocument::Compact)))
        return;

    logWarning << "Database not stored";
}
