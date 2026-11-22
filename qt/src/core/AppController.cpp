#include "AppController.h"

#if defined(FITLINK_PLATFORM_ANDROID)
#include "notifications/AndroidNotificationBridge.h"
#elif defined(FITLINK_PLATFORM_LINUX_DBUS)
#include "notifications/LinuxDbusNotificationBridge.h"
#else
#include "notifications/StubNotificationBridge.h"
#endif

#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSettings>
#include <QStandardPaths>
#include <QTime>
#include <QUuid>
#include <algorithm>

namespace fitlink {

AppController::AppController(QObject *parent)
    : QObject(parent)
    , m_ble(new BleWatchManager(this)) {
#if defined(FITLINK_PLATFORM_ANDROID)
    m_osBridge = new AndroidNotificationBridge(this);
#elif defined(FITLINK_PLATFORM_LINUX_DBUS)
    m_osBridge = new LinuxDbusNotificationBridge(this);
#else
    m_osBridge = new StubNotificationBridge(this);
#endif

    connect(m_ble, &BleWatchManager::stateChanged, this, &AppController::onBleStateChanged);
    connect(m_ble, &BleWatchManager::discoveredDevicesChanged, this, &AppController::discoveredDevicesChanged);
    connect(m_ble, &BleWatchManager::connectedDeviceChanged, this, &AppController::deviceChanged);
    connect(m_ble, &BleWatchManager::batteryLevelChanged, this, &AppController::batteryChanged);
    connect(m_ble, &BleWatchManager::deviceInfoChanged, this, &AppController::deviceInfoChanged);
    connect(m_ble, &BleWatchManager::protocolChanged, this, &AppController::protocolChanged);
    connect(m_ble, &BleWatchManager::packetLogged, this, &AppController::onPacketLogged);
    connect(m_ble, &BleWatchManager::errorOccurred, this, [this](const QString &msg) {
        emit toastMessage(msg, true);
    });

    connect(m_osBridge, &PlatformNotificationBridge::stateChanged, this, &AppController::mirroringChanged);
    connect(m_osBridge, &PlatformNotificationBridge::notificationReceived, this, &AppController::onOsNotificationReceived);
    connect(m_osBridge, &PlatformNotificationBridge::bridgeError, this, [this](const QString &msg) {
        emit toastMessage(msg, true);
    });

    loadPersistedState();

    m_schedulerTimer.setInterval(1000);
    connect(&m_schedulerTimer, &QTimer::timeout, this, &AppController::onSchedulerTick);
    m_schedulerTimer.start();
}

int AppController::connectionState() const {
    return static_cast<int>(m_ble->state());
}

QString AppController::connectionStateText() const {
    switch (m_ble->state()) {
    case BleWatchManager::ConnectionState::Scanning: return tr("Scanning");
    case BleWatchManager::ConnectionState::Connecting: return tr("Connecting");
    case BleWatchManager::ConnectionState::Connected: return tr("Connected");
    default: return tr("Disconnected");
    }
}

bool AppController::isConnected() const {
    return m_ble->state() == BleWatchManager::ConnectionState::Connected;
}

bool AppController::isScanning() const {
    return m_ble->state() == BleWatchManager::ConnectionState::Scanning;
}

bool AppController::showAllBleDevices() const { return m_ble->showAllDevices(); }

void AppController::setShowAllBleDevices(bool showAll) {
    m_ble->setShowAllDevices(showAll);
    emit scanOptionsChanged();
}

QVariantList AppController::discoveredDevices() const { return m_ble->discoveredDevices(); }
QString AppController::deviceName() const { return m_ble->deviceName(); }
QString AppController::deviceAddress() const { return m_ble->deviceAddress(); }
int AppController::batteryLevel() const { return m_ble->batteryLevel(); }
QVariantMap AppController::deviceInfo() const { return m_ble->deviceInfo(); }

int AppController::protocolPreference() const {
    return static_cast<int>(m_ble->protocolPreference());
}

void AppController::setProtocolPreference(int pref) {
    const auto clamped = static_cast<ProtocolPreference>(std::clamp(pref, 0, 2));
    m_ble->setProtocolPreference(clamped);
    savePersistedState();
}

QString AppController::activeProtocolLabel() const {
    const auto active = FeeaCodec::resolveVersion(m_ble->detectedProtocol(), m_ble->protocolPreference());
    return FeeaCodec::versionLabel(active);
}

QString AppController::detectedProtocolLabel() const {
    return FeeaCodec::versionLabel(m_ble->detectedProtocol());
}

int AppController::mtuSize() const { return m_ble->mtuSize(); }

void AppController::setMtuSize(int mtu) {
    m_ble->setMtuSize(mtu);
    emit protocolChanged();
    savePersistedState();
}

int AppController::writeDelayMs() const { return m_ble->writeDelayMs(); }

void AppController::setWriteDelayMs(int delayMs) {
    m_ble->setWriteDelayMs(delayMs);
    emit protocolChanged();
    savePersistedState();
}

void AppController::setUse24Hour(bool use24h) {
    if (m_use24Hour == use24h) return;
    m_use24Hour = use24h;
    emit timeSettingsChanged();
    savePersistedState();
    if (isConnected()) {
        m_ble->sendTimeFormat(m_use24Hour);
        emit toastMessage(m_use24Hour ? tr("Watch set to 24-hour clock") : tr("Watch set to 12-hour clock"), false);
    }
}

void AppController::setAutoSyncOnConnect(bool enabled) {
    if (m_autoSyncOnConnect == enabled) return;
    m_autoSyncOnConnect = enabled;
    emit timeSettingsChanged();
    savePersistedState();
}

QString AppController::lastSyncedTime() const {
    return m_lastSyncedAt.isValid()
        ? m_lastSyncedAt.toString(m_use24Hour ? QStringLiteral("yyyy-MM-dd HH:mm:ss") : QStringLiteral("yyyy-MM-dd hh:mm:ss AP"))
        : tr("Never synced");
}

QString AppController::osBridgePlatform() const { return m_osBridge->platformLabel(); }
bool AppController::osBridgeAvailable() const { return m_osBridge->isAvailable(); }
bool AppController::osBridgeHasPermission() const { return m_osBridge->hasPermission(); }
bool AppController::osMirroringEnabled() const { return m_osBridge->isEnabled(); }

void AppController::setOsMirroringEnabled(bool enabled) {
    m_osBridge->setEnabled(enabled);
    savePersistedState();
}

void AppController::startScan() { m_ble->startScan(); }
void AppController::stopScan() { m_ble->stopScan(); }
void AppController::connectToDevice(const QString &addressOrId) { m_ble->connectToDevice(addressOrId); }
void AppController::disconnectDevice() { m_ble->disconnectDevice(); }
void AppController::refreshBattery() { m_ble->refreshBattery(); }

void AppController::triggerFindWatch() {
    if (m_ble->sendFindWatch()) {
        emit toastMessage(tr("Find Watch alert sent"), false);
    }
}

void AppController::syncTimeNow() {
    const QDateTime now = QDateTime::currentDateTime();
    const int offsetMinutes = now.offsetFromUtc() / 60;
    if (m_ble->sendSyncTime(now, offsetMinutes)) {
        m_ble->sendTimeFormat(m_use24Hour);
        m_lastSyncedAt = now;
        emit timeSettingsChanged();
        emit toastMessage(tr("Time synchronized with watch"), false);
    }
}

void AppController::syncCustomTime(const QString &isoDateTime, int utcOffsetMinutes) {
    const QDateTime dt = QDateTime::fromString(isoDateTime, Qt::ISODate);
    if (!dt.isValid()) {
        emit toastMessage(tr("Invalid custom date/time format"), true);
        return;
    }
    if (m_ble->sendSyncTime(dt, utcOffsetMinutes)) {
        m_lastSyncedAt = dt;
        emit timeSettingsChanged();
        emit toastMessage(tr("Custom time pushed to watch"), false);
    }
}

void AppController::sendManualNotification(int iconId, const QString &title, const QString &body) {
    if (title.trimmed().isEmpty() && body.trimmed().isEmpty()) {
        emit toastMessage(tr("Enter a title or message body before sending"), true);
        return;
    }
    const auto icon = static_cast<WatchAppIcon>(std::clamp(iconId, 0, 15));
    if (m_ble->sendNotification(icon, title, body)) {
        emit toastMessage(tr("Notification pushed to watch"), false);
    }
}

int AppController::utf8ByteLength(const QString &title, const QString &body) const {
    QString formatted = (!title.trimmed().isEmpty() && !body.trimmed().isEmpty())
        ? title.trimmed() + QStringLiteral(": ") + body.trimmed()
        : (title.trimmed().isEmpty() ? body.trimmed() : title.trimmed());
    return formatted.toUtf8().size();
}

int AppController::estimatedChunkCount(const QString &title, const QString &body) const {
    const int bytes = std::min(128, utf8ByteLength(title, body)) + 7; // header + icon + len
    const int mtu = std::max(20, m_ble->mtuSize());
    return std::max(1, (bytes + mtu - 1) / mtu);
}

void AppController::saveTemplate(int iconId, const QString &title, const QString &body) {
    if (title.trimmed().isEmpty() && body.trimmed().isEmpty()) {
        return;
    }
    QVariantMap tpl;
    tpl[QStringLiteral("id")] = QUuid::createUuid().toString(QUuid::WithoutBraces);
    tpl[QStringLiteral("iconId")] = std::clamp(iconId, 0, 15);
    tpl[QStringLiteral("title")] = title.trimmed();
    tpl[QStringLiteral("body")] = body.trimmed();
    m_templates.prepend(tpl);
    emit templatesChanged();
    savePersistedState();
    emit toastMessage(tr("Saved notification template"), false);
}

void AppController::deleteTemplate(const QString &templateId) {
    for (int i = 0; i < m_templates.size(); ++i) {
        if (m_templates.at(i).toMap().value(QStringLiteral("id")).toString() == templateId) {
            m_templates.removeAt(i);
            emit templatesChanged();
            savePersistedState();
            return;
        }
    }
}

void AppController::toggleAppFilter(const QString &appId, bool enabled) {
    for (int i = 0; i < m_appFilters.size(); ++i) {
        QVariantMap item = m_appFilters.at(i).toMap();
        if (item.value(QStringLiteral("appId")).toString() == appId) {
            item[QStringLiteral("enabled")] = enabled;
            m_appFilters[i] = item;
            emit appFiltersChanged();
            savePersistedState();
            return;
        }
    }
}

void AppController::openOsNotificationSettings() { m_osBridge->openPermissionSettings(); }
void AppController::refreshOsNotificationPermission() { m_osBridge->refreshPermissionState(); }

qint64 AppController::computeNextRunMs(const QString &mode, const QString &targetHHMM, int intervalMinutes) const {
    const QDateTime now = QDateTime::currentDateTime();
    if (mode == QStringLiteral("interval")) {
        return now.addSecs(std::max(1, intervalMinutes) * 60).toMSecsSinceEpoch();
    }
    const QTime targetTime = QTime::fromString(targetHHMM, QStringLiteral("HH:mm"));
    if (!targetTime.isValid()) {
        return now.addSecs(300).toMSecsSinceEpoch();
    }
    QDateTime next(now.date(), targetTime);
    if (next <= now) {
        next = next.addDays(1);
    }
    return next.toMSecsSinceEpoch();
}

void AppController::addScheduledAlert(int iconId,
                                      const QString &title,
                                      const QString &body,
                                      const QString &mode,
                                      const QString &targetTimeHHMM,
                                      int intervalMinutes) {
    if (title.trimmed().isEmpty()) {
        emit toastMessage(tr("Alert title is required"), true);
        return;
    }
    QVariantMap alert;
    alert[QStringLiteral("id")] = QUuid::createUuid().toString(QUuid::WithoutBraces);
    alert[QStringLiteral("iconId")] = std::clamp(iconId, 0, 15);
    alert[QStringLiteral("title")] = title.trimmed();
    alert[QStringLiteral("body")] = body.trimmed();
    alert[QStringLiteral("mode")] = (mode == QStringLiteral("interval")) ? QStringLiteral("interval") : QStringLiteral("once");
    alert[QStringLiteral("targetTime")] = targetTimeHHMM;
    alert[QStringLiteral("intervalMinutes")] = std::max(1, intervalMinutes);
    alert[QStringLiteral("enabled")] = true;
    alert[QStringLiteral("nextRunMs")] = computeNextRunMs(alert[QStringLiteral("mode")].toString(), targetTimeHHMM, intervalMinutes);

    m_scheduledAlerts.prepend(alert);
    emit scheduledAlertsChanged();
    savePersistedState();
    emit toastMessage(tr("Scheduled alert added"), false);
}

void AppController::toggleScheduledAlert(const QString &alertId, bool enabled) {
    for (int i = 0; i < m_scheduledAlerts.size(); ++i) {
        QVariantMap alert = m_scheduledAlerts.at(i).toMap();
        if (alert.value(QStringLiteral("id")).toString() == alertId) {
            alert[QStringLiteral("enabled")] = enabled;
            if (enabled) {
                alert[QStringLiteral("nextRunMs")] = computeNextRunMs(
                    alert.value(QStringLiteral("mode")).toString(),
                    alert.value(QStringLiteral("targetTime")).toString(),
                    alert.value(QStringLiteral("intervalMinutes")).toInt()
                );
            }
            m_scheduledAlerts[i] = alert;
            emit scheduledAlertsChanged();
            savePersistedState();
            return;
        }
    }
}

void AppController::deleteScheduledAlert(const QString &alertId) {
    for (int i = 0; i < m_scheduledAlerts.size(); ++i) {
        if (m_scheduledAlerts.at(i).toMap().value(QStringLiteral("id")).toString() == alertId) {
            m_scheduledAlerts.removeAt(i);
            emit scheduledAlertsChanged();
            savePersistedState();
            return;
        }
    }
}

void AppController::fireScheduledAlertNow(const QString &alertId) {
    for (const auto &v : m_scheduledAlerts) {
        const QVariantMap alert = v.toMap();
        if (alert.value(QStringLiteral("id")).toString() == alertId) {
            sendManualNotification(
                alert.value(QStringLiteral("iconId")).toInt(),
                alert.value(QStringLiteral("title")).toString(),
                alert.value(QStringLiteral("body")).toString()
            );
            return;
        }
    }
}

void AppController::clearPacketLog() {
    m_packetLog.clear();
    emit packetLogChanged();
}

void AppController::onBleStateChanged(BleWatchManager::ConnectionState state) {
    emit connectionStateChanged();
    if (state == BleWatchManager::ConnectionState::Connected && m_autoSyncOnConnect) {
        QTimer::singleShot(600, this, &AppController::syncTimeNow);
    }
}

void AppController::onPacketLogged(const QString &direction,
                                   const QString &actionLabel,
                                   const QString &protocolLabel,
                                   const QString &hexPreview,
                                   int chunkCount,
                                   const QString &status) {
    QVariantMap row;
    row[QStringLiteral("timestamp")] = QDateTime::currentDateTime().toString(QStringLiteral("HH:mm:ss"));
    row[QStringLiteral("direction")] = direction;
    row[QStringLiteral("actionLabel")] = actionLabel;
    row[QStringLiteral("protocolLabel")] = protocolLabel;
    row[QStringLiteral("hexPreview")] = hexPreview;
    row[QStringLiteral("chunkCount")] = chunkCount;
    row[QStringLiteral("status")] = status;

    m_packetLog.prepend(row);
    while (m_packetLog.size() > 100) {
        m_packetLog.removeLast();
    }
    emit packetLogChanged();
}

void AppController::onOsNotificationReceived(const QString &appId,
                                             const QString &appName,
                                             const QString &title,
                                             const QString &body) {
    // Check if an explicit app filter rule exists; auto-register newly seen apps as enabled.
    bool allowed = true;
    bool known = false;
    WatchAppIcon mappedIcon = FeeaCodec::mapAppNameToIcon(appId + QStringLiteral(" ") + appName);

    for (const auto &v : m_appFilters) {
        const QVariantMap rule = v.toMap();
        const QString ruleId = rule.value(QStringLiteral("appId")).toString();
        if (ruleId.compare(appId, Qt::CaseInsensitive) == 0
            || appId.contains(ruleId, Qt::CaseInsensitive)
            || appName.contains(rule.value(QStringLiteral("displayName")).toString(), Qt::CaseInsensitive)) {
            known = true;
            allowed = rule.value(QStringLiteral("enabled")).toBool();
            mappedIcon = static_cast<WatchAppIcon>(rule.value(QStringLiteral("iconId")).toInt());
            break;
        }
    }

    if (!known) {
        QVariantMap newRule;
        newRule[QStringLiteral("appId")] = appId;
        newRule[QStringLiteral("displayName")] = appName;
        newRule[QStringLiteral("iconId")] = static_cast<int>(mappedIcon);
        newRule[QStringLiteral("enabled")] = true;
        m_appFilters.append(newRule);
        emit appFiltersChanged();
        savePersistedState();
    }

    if (allowed && isConnected()) {
        m_ble->sendNotification(mappedIcon, title.isEmpty() ? appName : title, body);
    }
}

void AppController::onSchedulerTick() {
    const qint64 nowMs = QDateTime::currentMSecsSinceEpoch();
    bool changed = false;

    for (int i = 0; i < m_scheduledAlerts.size(); ++i) {
        QVariantMap alert = m_scheduledAlerts.at(i).toMap();
        if (!alert.value(QStringLiteral("enabled")).toBool()) {
            continue;
        }
        const qint64 nextRunMs = alert.value(QStringLiteral("nextRunMs")).toLongLong();
        if (nextRunMs > 0 && nowMs >= nextRunMs) {
            if (isConnected()) {
                m_ble->sendNotification(
                    static_cast<WatchAppIcon>(alert.value(QStringLiteral("iconId")).toInt()),
                    alert.value(QStringLiteral("title")).toString(),
                    alert.value(QStringLiteral("body")).toString()
                );
            }
            if (alert.value(QStringLiteral("mode")).toString() == QStringLiteral("interval")) {
                alert[QStringLiteral("nextRunMs")] = nowMs + std::max(1, alert.value(QStringLiteral("intervalMinutes")).toInt()) * 60000LL;
            } else {
                alert[QStringLiteral("enabled")] = false;
            }
            m_scheduledAlerts[i] = alert;
            changed = true;
        }
    }

    if (changed) {
        emit scheduledAlertsChanged();
        savePersistedState();
    }
}

QString AppController::stateFilePath() const {
    const QString dirPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dirPath);
    return dirPath + QStringLiteral("/fitlink-state.json");
}

void AppController::seedDefaultFiltersAndTemplates() {
    if (m_appFilters.isEmpty()) {
        auto addRule = [this](const QString &id, const QString &name, WatchAppIcon icon, bool enabled) {
            QVariantMap m;
            m[QStringLiteral("appId")] = id;
            m[QStringLiteral("displayName")] = name;
            m[QStringLiteral("iconId")] = static_cast<int>(icon);
            m[QStringLiteral("enabled")] = enabled;
            m_appFilters.append(m);
        };
        addRule(QStringLiteral("whatsapp"), QStringLiteral("WhatsApp"), WatchAppIcon::WhatsApp, true);
        addRule(QStringLiteral("telegram"), QStringLiteral("Telegram"), WatchAppIcon::Telegram, true);
        addRule(QStringLiteral("gmail"), QStringLiteral("Gmail / Thunderbird"), WatchAppIcon::Gmail, true);
        addRule(QStringLiteral("slack"), QStringLiteral("Slack"), WatchAppIcon::Slack, true);
        addRule(QStringLiteral("calendar"), QStringLiteral("Calendar"), WatchAppIcon::Calendar, true);
        addRule(QStringLiteral("sms"), QStringLiteral("SMS / Messages"), WatchAppIcon::Sms, true);
    }
    if (m_templates.isEmpty()) {
        auto addTpl = [this](WatchAppIcon icon, const QString &title, const QString &body) {
            QVariantMap m;
            m[QStringLiteral("id")] = QUuid::createUuid().toString(QUuid::WithoutBraces);
            m[QStringLiteral("iconId")] = static_cast<int>(icon);
            m[QStringLiteral("title")] = title;
            m[QStringLiteral("body")] = body;
            m_templates.append(m);
        };
        addTpl(WatchAppIcon::Calendar, QStringLiteral("Standup Reminder"), QStringLiteral("Daily sync starts in 5 minutes"));
        addTpl(WatchAppIcon::GenericOther, QStringLiteral("Hydration Break"), QStringLiteral("Drink a glass of water and stretch"));
    }
}

void AppController::loadPersistedState() {
    QSettings settings;
    m_use24Hour = settings.value(QStringLiteral("time/use24Hour"), true).toBool();
    m_autoSyncOnConnect = settings.value(QStringLiteral("time/autoSyncOnConnect"), true).toBool();
    m_ble->setProtocolPreference(static_cast<ProtocolPreference>(settings.value(QStringLiteral("protocol/pref"), 0).toInt()));
    m_ble->setMtuSize(settings.value(QStringLiteral("protocol/mtu"), 20).toInt());
    m_ble->setWriteDelayMs(settings.value(QStringLiteral("protocol/delayMs"), 50).toInt());

    QFile file(stateFilePath());
    if (file.open(QIODevice::ReadOnly)) {
        const QJsonObject root = QJsonDocument::fromJson(file.readAll()).object();
        m_appFilters = root.value(QStringLiteral("appFilters")).toArray().toVariantList();
        m_templates = root.value(QStringLiteral("templates")).toArray().toVariantList();
        m_scheduledAlerts = root.value(QStringLiteral("scheduledAlerts")).toArray().toVariantList();
    }
    seedDefaultFiltersAndTemplates();
}

void AppController::savePersistedState() const {
    QSettings settings;
    settings.setValue(QStringLiteral("time/use24Hour"), m_use24Hour);
    settings.setValue(QStringLiteral("time/autoSyncOnConnect"), m_autoSyncOnConnect);
    settings.setValue(QStringLiteral("protocol/pref"), static_cast<int>(m_ble->protocolPreference()));
    settings.setValue(QStringLiteral("protocol/mtu"), m_ble->mtuSize());
    settings.setValue(QStringLiteral("protocol/delayMs"), m_ble->writeDelayMs());

    QJsonObject root;
    root[QStringLiteral("appFilters")] = QJsonArray::fromVariantList(m_appFilters);
    root[QStringLiteral("templates")] = QJsonArray::fromVariantList(m_templates);
    root[QStringLiteral("scheduledAlerts")] = QJsonArray::fromVariantList(m_scheduledAlerts);

    QFile file(stateFilePath());
    if (file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        file.write(QJsonDocument(root).toJson(QJsonDocument::Compact));
    }
}

} // namespace fitlink
