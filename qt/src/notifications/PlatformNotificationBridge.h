#pragma once

#include <QObject>
#include <QString>

namespace fitlink {

// Clean platform abstraction for OS notification mirroring:
// - Linux (Debian amd64/arm64): Qt6::DBus BecomeMonitor on org.freedesktop.Notifications
// - Android: Java NotificationListenerService + JNI callback
// - Future Windows: WinRT UserNotificationListener
class PlatformNotificationBridge : public QObject {
    Q_OBJECT

public:
    explicit PlatformNotificationBridge(QObject *parent = nullptr)
        : QObject(parent) {}
    ~PlatformNotificationBridge() override = default;

    virtual QString platformLabel() const = 0;
    virtual bool isAvailable() const = 0;
    virtual bool hasPermission() const = 0;
    virtual bool isEnabled() const = 0;

    virtual void setEnabled(bool enabled) = 0;
    virtual void refreshPermissionState() = 0;
    virtual void openPermissionSettings() = 0;

signals:
    void stateChanged();
    void notificationReceived(const QString &appId,
                              const QString &appName,
                              const QString &title,
                              const QString &body);
    void bridgeError(const QString &message);
};

} // namespace fitlink
