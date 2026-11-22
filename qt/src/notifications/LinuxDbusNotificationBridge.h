#pragma once

#include "PlatformNotificationBridge.h"

#include <QDBusConnection>
#include <QDBusVirtualObject>

namespace fitlink {

class LinuxDbusNotificationBridge : public PlatformNotificationBridge {
    Q_OBJECT

public:
    explicit LinuxDbusNotificationBridge(QObject *parent = nullptr);
    ~LinuxDbusNotificationBridge() override;

    QString platformLabel() const override;
    bool isAvailable() const override { return m_available; }
    bool hasPermission() const override { return m_available; }
    bool isEnabled() const override { return m_enabled; }

    void setEnabled(bool enabled) override;
    void refreshPermissionState() override;
    void openPermissionSettings() override {}

private:
    class MonitorObject : public QDBusVirtualObject {
    public:
        explicit MonitorObject(LinuxDbusNotificationBridge *owner);
        QString introspect(const QString &path) const override;
        bool handleMessage(const QDBusMessage &message, const QDBusConnection &connection) override;

    private:
        LinuxDbusNotificationBridge *m_owner;
    };

    void startMonitoring();
    void stopMonitoring();

    bool m_available = false;
    bool m_enabled = false;
    QString m_connectionName;
    MonitorObject *m_monitorObject = nullptr;
};

} // namespace fitlink
