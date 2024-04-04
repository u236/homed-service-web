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
    QJsonArray tokens;

    if (!m_file.open(QFile::ReadOnly))
        return;

    json = QJsonDocument::fromJson(m_file.readAll()).object();
    tokens = json.value("tokens").toArray();
    m_dashboards = json.value("dashboards").toArray();

    for (int i = 0; i < tokens.count(); i++)
        m_tokens.insert(tokens.at(i).toString());

    m_file.close();
}

void Database::store(bool sync)
{
    m_sync = sync;
    m_timer->start(STORE_DELAY);
}

void Database::write(void)
{
    QJsonObject json = {{"dashboards", m_dashboards}, {"tokens", QJsonArray::fromStringList(m_tokens.values())}, {"timestamp", QDateTime::currentSecsSinceEpoch()}, {"version", SERVICE_VERSION}};
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
