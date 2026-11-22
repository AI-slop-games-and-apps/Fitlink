#pragma once

#include "PlatformNotificationBridge.h"

namespace fitlink {

class AndroidNotificationBridge : public PlatformNotificationBridge {
    Q_OBJECT

public:
    explicit AndroidNotificationBridge(QObject *parent = nullptr);
    ~AndroidNotificationBridge() override;

    QString platformLabel() const override;
    bool isAvailable() const override { return true; }
    bool hasPermission() const override { return m_hasPermission; }
    bool isEnabled() const override { return m_enabled; }

    void setEnabled(bool enabled) override;
    void refreshPermissionState() override;
    void openPermissionSettings() override;

    // Called from JNI callback on Binder thread; marshals safely onto Qt GUI thread
    static void dispatchFromJni(const QString &packageName,
                                const QString &appLabel,
                                const QString &title,
                                const QString &body);

private:
    bool m_hasPermission = false;
    bool m_enabled = false;
};

} // namespace fitlink
