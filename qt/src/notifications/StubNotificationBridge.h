#pragma once

#include "PlatformNotificationBridge.h"

namespace fitlink {

// Clean placeholder ready for future Windows WinRT UserNotificationListener support.
class StubNotificationBridge : public PlatformNotificationBridge {
    Q_OBJECT

public:
    explicit StubNotificationBridge(QObject *parent = nullptr)
        : PlatformNotificationBridge(parent) {}

    QString platformLabel() const override {
#if defined(Q_OS_WIN)
        return QStringLiteral("Windows Notification Bridge (Planned)");
#else
        return QStringLiteral("Manual Notifications Only");
#endif
    }
    bool isAvailable() const override { return false; }
    bool hasPermission() const override { return false; }
    bool isEnabled() const override { return false; }

    void setEnabled(bool) override {}
    void refreshPermissionState() override {}
    void openPermissionSettings() override {}
};

} // namespace fitlink
