#pragma once

#include "ble/BleWatchManager.h"
#include "notifications/PlatformNotificationBridge.h"
#include "protocol/FeeaCodec.h"

#include <QDateTime>
#include <QObject>
#include <QTimer>
#include <QVariantList>
#include <QVariantMap>

namespace fitlink {

class AppController : public QObject {
    Q_OBJECT

    Q_PROPERTY(int connectionState READ connectionState NOTIFY connectionStateChanged)
    Q_PROPERTY(QString connectionStateText READ connectionStateText NOTIFY connectionStateChanged)
    Q_PROPERTY(bool isConnected READ isConnected NOTIFY connectionStateChanged)
    Q_PROPERTY(bool isScanning READ isScanning NOTIFY connectionStateChanged)
    Q_PROPERTY(bool showAllBleDevices READ showAllBleDevices WRITE setShowAllBleDevices NOTIFY scanOptionsChanged)
    Q_PROPERTY(QVariantList discoveredDevices READ discoveredDevices NOTIFY discoveredDevicesChanged)

    Q_PROPERTY(QString deviceName READ deviceName NOTIFY deviceChanged)
    Q_PROPERTY(QString deviceAddress READ deviceAddress NOTIFY deviceChanged)
    Q_PROPERTY(int batteryLevel READ batteryLevel NOTIFY batteryChanged)
    Q_PROPERTY(QVariantMap deviceInfo READ deviceInfo NOTIFY deviceInfoChanged)

    Q_PROPERTY(int protocolPreference READ protocolPreference WRITE setProtocolPreference NOTIFY protocolChanged)
    Q_PROPERTY(QString activeProtocolLabel READ activeProtocolLabel NOTIFY protocolChanged)
    Q_PROPERTY(QString detectedProtocolLabel READ detectedProtocolLabel NOTIFY protocolChanged)
    Q_PROPERTY(int mtuSize READ mtuSize WRITE setMtuSize NOTIFY protocolChanged)
    Q_PROPERTY(int writeDelayMs READ writeDelayMs WRITE setWriteDelayMs NOTIFY protocolChanged)

    Q_PROPERTY(bool use24Hour READ use24Hour WRITE setUse24Hour NOTIFY timeSettingsChanged)
    Q_PROPERTY(bool autoSyncOnConnect READ autoSyncOnConnect WRITE setAutoSyncOnConnect NOTIFY timeSettingsChanged)
    Q_PROPERTY(QString lastSyncedTime READ lastSyncedTime NOTIFY timeSettingsChanged)

    Q_PROPERTY(QString osBridgePlatform READ osBridgePlatform NOTIFY mirroringChanged)
    Q_PROPERTY(bool osBridgeAvailable READ osBridgeAvailable NOTIFY mirroringChanged)
    Q_PROPERTY(bool osBridgeHasPermission READ osBridgeHasPermission NOTIFY mirroringChanged)
    Q_PROPERTY(bool osMirroringEnabled READ osMirroringEnabled WRITE setOsMirroringEnabled NOTIFY mirroringChanged)
    Q_PROPERTY(QVariantList appFilters READ appFilters NOTIFY appFiltersChanged)

    Q_PROPERTY(QVariantList templates READ templates NOTIFY templatesChanged)
    Q_PROPERTY(QVariantList scheduledAlerts READ scheduledAlerts NOTIFY scheduledAlertsChanged)
    Q_PROPERTY(QVariantList packetLog READ packetLog NOTIFY packetLogChanged)

public:
    explicit AppController(QObject *parent = nullptr);

    int connectionState() const;
    QString connectionStateText() const;
    bool isConnected() const;
    bool isScanning() const;
    bool showAllBleDevices() const;
    void setShowAllBleDevices(bool showAll);
    QVariantList discoveredDevices() const;

    QString deviceName() const;
    QString deviceAddress() const;
    int batteryLevel() const;
    QVariantMap deviceInfo() const;

    int protocolPreference() const;
    void setProtocolPreference(int pref);
    QString activeProtocolLabel() const;
    QString detectedProtocolLabel() const;
    int mtuSize() const;
    void setMtuSize(int mtu);
    int writeDelayMs() const;
    void setWriteDelayMs(int delayMs);

    bool use24Hour() const { return m_use24Hour; }
    void setUse24Hour(bool use24h);
    bool autoSyncOnConnect() const { return m_autoSyncOnConnect; }
    void setAutoSyncOnConnect(bool enabled);
    QString lastSyncedTime() const;

    QString osBridgePlatform() const;
    bool osBridgeAvailable() const;
    bool osBridgeHasPermission() const;
    bool osMirroringEnabled() const;
    void setOsMirroringEnabled(bool enabled);
    QVariantList appFilters() const { return m_appFilters; }

    QVariantList templates() const { return m_templates; }
    QVariantList scheduledAlerts() const { return m_scheduledAlerts; }
    QVariantList packetLog() const { return m_packetLog; }

    // BLE & Device actions
    Q_INVOKABLE void startScan();
    Q_INVOKABLE void stopScan();
    Q_INVOKABLE void connectToDevice(const QString &addressOrId);
    Q_INVOKABLE void disconnectDevice();
    Q_INVOKABLE void refreshBattery();
    Q_INVOKABLE void triggerFindWatch();

    // Time actions
    Q_INVOKABLE void syncTimeNow();
    Q_INVOKABLE void syncCustomTime(const QString &isoDateTime, int utcOffsetMinutes);

    // Notification actions
    Q_INVOKABLE void sendManualNotification(int iconId, const QString &title, const QString &body);
    Q_INVOKABLE int utf8ByteLength(const QString &title, const QString &body) const;
    Q_INVOKABLE int estimatedChunkCount(const QString &title, const QString &body) const;

    Q_INVOKABLE void saveTemplate(int iconId, const QString &title, const QString &body);
    Q_INVOKABLE void deleteTemplate(const QString &templateId);

    Q_INVOKABLE void toggleAppFilter(const QString &appId, bool enabled);
    Q_INVOKABLE void openOsNotificationSettings();
    Q_INVOKABLE void refreshOsNotificationPermission();

    // Scheduled alert actions
    Q_INVOKABLE void addScheduledAlert(int iconId,
                                       const QString &title,
                                       const QString &body,
                                       const QString &mode,
                                       const QString &targetTimeHHMM,
                                       int intervalMinutes);
    Q_INVOKABLE void toggleScheduledAlert(const QString &alertId, bool enabled);
    Q_INVOKABLE void deleteScheduledAlert(const QString &alertId);
    Q_INVOKABLE void fireScheduledAlertNow(const QString &alertId);

    Q_INVOKABLE void clearPacketLog();

signals:
    void connectionStateChanged();
    void scanOptionsChanged();
    void discoveredDevicesChanged();
    void deviceChanged();
    void batteryChanged();
    void deviceInfoChanged();
    void protocolChanged();
    void timeSettingsChanged();
    void mirroringChanged();
    void appFiltersChanged();
    void templatesChanged();
    void scheduledAlertsChanged();
    void packetLogChanged();
    void toastMessage(const QString &message, bool isError);

private slots:
    void onBleStateChanged(BleWatchManager::ConnectionState state);
    void onPacketLogged(const QString &direction,
                        const QString &actionLabel,
                        const QString &protocolLabel,
                        const QString &hexPreview,
                        int chunkCount,
                        const QString &status);
    void onOsNotificationReceived(const QString &appId,
                                  const QString &appName,
                                  const QString &title,
                                  const QString &body);
    void onSchedulerTick();

private:
    void loadPersistedState();
    void savePersistedState() const;
    void seedDefaultFiltersAndTemplates();
    QString stateFilePath() const;
    qint64 computeNextRunMs(const QString &mode, const QString &targetHHMM, int intervalMinutes) const;

    BleWatchManager *m_ble = nullptr;
    PlatformNotificationBridge *m_osBridge = nullptr;
    QTimer m_schedulerTimer;

    bool m_use24Hour = true;
    bool m_autoSyncOnConnect = true;
    QDateTime m_lastSyncedAt;

    QVariantList m_appFilters;
    QVariantList m_templates;
    QVariantList m_scheduledAlerts;
    QVariantList m_packetLog;
};

} // namespace fitlink
