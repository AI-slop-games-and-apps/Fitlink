#include "LinuxDbusNotificationBridge.h"

#include <QDBusInterface>
#include <QDBusMessage>
#include <QDBusReply>
#include <QUuid>

namespace fitlink {

LinuxDbusNotificationBridge::MonitorObject::MonitorObject(LinuxDbusNotificationBridge *owner)
    : QDBusVirtualObject(owner)
    , m_owner(owner) {}

QString LinuxDbusNotificationBridge::MonitorObject::introspect(const QString &path) const {
    Q_UNUSED(path);
    return QString();
}

bool LinuxDbusNotificationBridge::MonitorObject::handleMessage(const QDBusMessage &message,
                                                               const QDBusConnection &connection) {
    Q_UNUSED(connection);
    if (message.type() == QDBusMessage::MethodCallMessage
        && message.interface() == QStringLiteral("org.freedesktop.Notifications")
        && message.member() == QStringLiteral("Notify")) {
        const QList<QVariant> args = message.arguments();
        if (args.size() >= 5) {
            const QString appName = args.at(0).toString().trimmed();
            const QString summary = args.at(3).toString().trimmed();
            const QString body = args.at(4).toString().trimmed();

            if (!summary.isEmpty() || !body.isEmpty()) {
                const QString appId = appName.isEmpty() ? QStringLiteral("linux.desktop") : appName.toLower();
                emit m_owner->notificationReceived(appId,
                                                   appName.isEmpty() ? QStringLiteral("Desktop") : appName,
                                                   summary,
                                                   body);
            }
        }
    }
    return true;
}

LinuxDbusNotificationBridge::LinuxDbusNotificationBridge(QObject *parent)
    : PlatformNotificationBridge(parent) {
    refreshPermissionState();
}

LinuxDbusNotificationBridge::~LinuxDbusNotificationBridge() {
    stopMonitoring();
}

QString LinuxDbusNotificationBridge::platformLabel() const {
    return QStringLiteral("Linux D-Bus (org.freedesktop.Notifications)");
}

void LinuxDbusNotificationBridge::refreshPermissionState() {
    const bool busOk = QDBusConnection::sessionBus().isConnected();
    if (m_available != busOk) {
        m_available = busOk;
        emit stateChanged();
    }
}

void LinuxDbusNotificationBridge::setEnabled(bool enabled) {
    if (m_enabled == enabled) {
        return;
    }
    if (enabled) {
        startMonitoring();
    } else {
        stopMonitoring();
    }
    emit stateChanged();
}

void LinuxDbusNotificationBridge::startMonitoring() {
    stopMonitoring();

    // Use a dedicated session bus connection because BecomeMonitor switches the connection to read-only monitoring.
    m_connectionName = QStringLiteral("fitlink-dbus-monitor-%1")
        .arg(QUuid::createUuid().toString(QUuid::WithoutBraces));
    QDBusConnection monitorBus = QDBusConnection::connectToBus(QDBusConnection::SessionBus, m_connectionName);
    if (!monitorBus.isConnected()) {
        m_available = false;
        m_enabled = false;
        emit bridgeError(tr("Unable to connect to the Linux D-Bus session bus."));
        return;
    }

    m_monitorObject = new MonitorObject(this);
    if (!monitorBus.registerVirtualObject(QStringLiteral("/"), m_monitorObject, QDBusConnection::SubPath)) {
        stopMonitoring();
        emit bridgeError(tr("Failed to register D-Bus monitor object."));
        return;
    }

    QDBusInterface monitoringIface(
        QStringLiteral("org.freedesktop.DBus"),
        QStringLiteral("/org/freedesktop/DBus"),
        QStringLiteral("org.freedesktop.DBus.Monitoring"),
        monitorBus
    );

    const QStringList matchRules = {
        QStringLiteral("type='method_call',interface='org.freedesktop.Notifications',member='Notify'")
    };
    const QDBusReply<void> reply = monitoringIface.call(QStringLiteral("BecomeMonitor"), matchRules, 0U);
    if (!reply.isValid()) {
        const QString err = reply.error().message();
        stopMonitoring();
        emit bridgeError(tr("D-Bus BecomeMonitor failed: %1").arg(err));
        return;
    }

    m_available = true;
    m_enabled = true;
}

void LinuxDbusNotificationBridge::stopMonitoring() {
    if (!m_connectionName.isEmpty()) {
        QDBusConnection::disconnectFromBus(m_connectionName);
        m_connectionName.clear();
    }
    if (m_monitorObject) {
        m_monitorObject->deleteLater();
        m_monitorObject = nullptr;
    }
    m_enabled = false;
}

} // namespace fitlink
