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
    Q_PROPERTY(bool bluetoothAvailable READ bluetoothAvailable NOTIFY bluetoothAvailabilityChanged)
    Q_PROPERTY(QString bluetoothStatusMessage READ bluetoothStatusMessage NOTIFY bluetoothAvailabilityChanged)
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
    Q_PROPERTY(int notificationFormat READ notificationFormat WRITE setNotificationFormat NOTIFY notificationFormatChanged)
    Q_PROPERTY(QStringList notificationFormatLabels READ notificationFormatLabels CONSTANT)
    Q_PROPERTY(bool isTestingFormats READ isTestingFormats NOTIFY formatTestChanged)
    Q_PROPERTY(QString formatTestStatus READ formatTestStatus NOTIFY formatTestChanged)
    Q_PROPERTY(bool preferWriteNoResponse READ preferWriteNoResponse WRITE setPreferWriteNoResponse NOTIFY protocolChanged)
    Q_PROPERTY(bool hasAlertNotificationService READ hasAlertNotificationService NOTIFY protocolChanged)
    Q_PROPERTY(QVariantList appFilters READ appFilters NOTIFY appFiltersChanged)

    Q_PROPERTY(QVariantList templates READ templates NOTIFY templatesChanged)
    Q_PROPERTY(QVariantList scheduledAlerts READ scheduledAlerts NOTIFY scheduledAlertsChanged)
    Q_PROPERTY(QVariantList packetLog READ packetLog NOTIFY packetLogChanged)

    Q_PROPERTY(QString distanceUnit READ distanceUnit WRITE setDistanceUnit NOTIFY activityChanged)
    Q_PROPERTY(int dailyDistanceGoalMeters READ dailyDistanceGoalMeters WRITE setDailyDistanceGoalMeters NOTIFY activityChanged)
    Q_PROPERTY(int todaySteps READ todaySteps NOTIFY activityChanged)
    Q_PROPERTY(int todayDistanceMeters READ todayDistanceMeters NOTIFY activityChanged)
    Q_PROPERTY(QVariantList weeklyActivity READ weeklyActivity NOTIFY activityChanged)
    Q_PROPERTY(int latestHeartRate READ latestHeartRate NOTIFY activityChanged)
    Q_PROPERTY(QString heartRateUpdatedAt READ heartRateUpdatedAt NOTIFY activityChanged)
    Q_PROPERTY(QVariantList heartRateSamples READ heartRateSamples NOTIFY activityChanged)
    Q_PROPERTY(int latestSpo2 READ latestSpo2 NOTIFY activityChanged)
    Q_PROPERTY(QString spo2UpdatedAt READ spo2UpdatedAt NOTIFY activityChanged)
    Q_PROPERTY(QVariantList spo2Samples READ spo2Samples NOTIFY activityChanged)
    Q_PROPERTY(int latestSystolic READ latestSystolic NOTIFY activityChanged)
    Q_PROPERTY(int latestDiastolic READ latestDiastolic NOTIFY activityChanged)
    Q_PROPERTY(QString bloodPressureUpdatedAt READ bloodPressureUpdatedAt NOTIFY activityChanged)
    Q_PROPERTY(QVariantList bloodPressureSamples READ bloodPressureSamples NOTIFY activityChanged)
    Q_PROPERTY(QString lastActivitySyncText READ lastActivitySyncText NOTIFY activityChanged)
    Q_PROPERTY(bool isSyncingActivity READ isSyncingActivity NOTIFY activityChanged)
    Q_PROPERTY(bool isMeasuringHeartRate READ isMeasuringHeartRate NOTIFY activityChanged)
    Q_PROPERTY(bool isContinuousHeartRate READ isContinuousHeartRate NOTIFY activityChanged)
    Q_PROPERTY(int continuousHeartRateStep READ continuousHeartRateStep NOTIFY activityChanged)
    Q_PROPERTY(int continuousHeartRateTotal READ continuousHeartRateTotal NOTIFY activityChanged)
    Q_PROPERTY(bool isMeasuringSpo2 READ isMeasuringSpo2 NOTIFY activityChanged)
    Q_PROPERTY(bool isMeasuringBloodPressure READ isMeasuringBloodPressure NOTIFY activityChanged)

public:
    explicit AppController(QObject *parent = nullptr);

    int connectionState() const;
    QString connectionStateText() const;
    bool bluetoothAvailable() const;
    QString bluetoothStatusMessage() const;
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
    int notificationFormat() const;
    void setNotificationFormat(int format);
    QStringList notificationFormatLabels() const;
    bool isTestingFormats() const { return m_isTestingFormats; }
    QString formatTestStatus() const { return m_formatTestStatus; }
    bool preferWriteNoResponse() const;
    void setPreferWriteNoResponse(bool prefer);
    bool hasAlertNotificationService() const;
    QVariantList appFilters() const { return m_appFilters; }

    QVariantList templates() const { return m_templates; }
    QVariantList scheduledAlerts() const { return m_scheduledAlerts; }
    QVariantList packetLog() const { return m_packetLog; }

    QString distanceUnit() const { return m_distanceUnit; }
    void setDistanceUnit(const QString &unit);
    int dailyDistanceGoalMeters() const { return m_dailyDistanceGoalMeters; }
    void setDailyDistanceGoalMeters(int meters);
    int todaySteps() const;
    int todayDistanceMeters() const;
    QVariantList weeklyActivity() const;
    int latestHeartRate() const { return m_latestHeartRate; }
    QString heartRateUpdatedAt() const;
    QVariantList heartRateSamples() const { return m_heartRateSamples; }
    int latestSpo2() const { return m_latestSpo2; }
    QString spo2UpdatedAt() const;
    QVariantList spo2Samples() const { return m_spo2Samples; }
    int latestSystolic() const { return m_latestSystolic; }
    int latestDiastolic() const { return m_latestDiastolic; }
    QString bloodPressureUpdatedAt() const;
    QVariantList bloodPressureSamples() const { return m_bloodPressureSamples; }
    QString lastActivitySyncText() const;
    bool isSyncingActivity() const { return m_isSyncingActivity; }
    bool isMeasuringHeartRate() const { return m_isMeasuringHeartRate; }
    bool isContinuousHeartRate() const { return m_isContinuousHeartRate; }
    int continuousHeartRateStep() const { return m_hrContinuousStep; }
    int continuousHeartRateTotal() const { return kContinuousHrReadings; }
    bool isMeasuringSpo2() const { return m_isMeasuringSpo2; }
    bool isMeasuringBloodPressure() const { return m_isMeasuringBloodPressure; }

    // BLE & Device actions
    Q_INVOKABLE void recheckBluetoothAvailability();
    Q_INVOKABLE void startScan();
    Q_INVOKABLE void stopScan();
    Q_INVOKABLE void connectToDevice(const QString &addressOrId);
    Q_INVOKABLE void disconnectDevice();
    Q_INVOKABLE void refreshBattery();
    Q_INVOKABLE void refreshDeviceInfo();
    Q_INVOKABLE void triggerFindWatch();

    // Time actions
    Q_INVOKABLE void syncTimeNow();
    Q_INVOKABLE void syncCustomTime(const QString &isoDateTime, int utcOffsetMinutes);

    // Notification actions
    Q_INVOKABLE void sendManualNotification(int iconId, const QString &title, const QString &body);
    Q_INVOKABLE void testAllNotificationFormats(int iconId, const QString &title, const QString &body);
    Q_INVOKABLE void stopFormatTest();
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

    // Activity & Vitals actions
    Q_INVOKABLE void refreshActivity();
    Q_INVOKABLE void measureHeartRate();
    Q_INVOKABLE void stopContinuousHeartRate();
    Q_INVOKABLE void measureSpo2();
    Q_INVOKABLE void measureBloodPressure();
    Q_INVOKABLE QString formatDistance(int meters) const;
    Q_INVOKABLE QString formatDistanceWithUnit(int meters) const;

signals:
    void connectionStateChanged();
    void bluetoothAvailabilityChanged();
    void scanOptionsChanged();
    void discoveredDevicesChanged();
    void deviceChanged();
    void batteryChanged();
    void deviceInfoChanged();
    void protocolChanged();
    void timeSettingsChanged();
    void mirroringChanged();
    void notificationFormatChanged();
    void formatTestChanged();
    void appFiltersChanged();
    void templatesChanged();
    void scheduledAlertsChanged();
    void packetLogChanged();
    void activityChanged();
    void toastMessage(const QString &message, bool isError);

private slots:
    void onBleStateChanged(BleWatchManager::ConnectionState state);
    void onActivityDataReceived(int dayOffset, int steps, int distanceMeters);
    void onHeartRateReceived(int bpm);
    void onSpo2Received(int percent);
    void onBloodPressureReceived(int systolic, int diastolic);
    void onWatchActionReceived(int actionCode);
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
    void ensureCurrentWeekBuckets();
    bool startSingleHeartRateReading(bool silentToast);
    void resetContinuousHeartRate(bool notifyUser);
    QString stateFilePath() const;
    qint64 computeNextRunMs(const QString &mode, const QString &targetHHMM, int intervalMinutes) const;

    static constexpr int kContinuousHrReadings = 4;
    static constexpr int kHrStartupTimeoutMs = 75000;
    static constexpr int kHrStreamEndIdleMs = 6000;

    BleWatchManager *m_ble = nullptr;
    PlatformNotificationBridge *m_osBridge = nullptr;
    QTimer m_schedulerTimer;
    QTimer m_hrMeasureTimer;
    QTimer m_hrLoopDelayTimer;
    QTimer m_spo2MeasureTimer;
    QTimer m_bpMeasureTimer;
    QTimer m_formatTestTimer;

    bool m_isTestingFormats = false;
    int m_formatTestIndex = 0;
    WatchAppIcon m_formatTestIcon = WatchAppIcon::Sms;
    QString m_formatTestTitle;
    QString m_formatTestBody;
    QString m_formatTestStatus;

    bool m_use24Hour = true;
    bool m_autoSyncOnConnect = false;
    QDateTime m_lastSyncedAt;

    QString m_distanceUnit = QStringLiteral("km");
    int m_dailyDistanceGoalMeters = 5000;
    QVariantMap m_dailyActivityByDate; // dateKey -> { steps, distanceMeters }
    int m_latestHeartRate = -1;
    QDateTime m_heartRateUpdatedAt;
    QVariantList m_heartRateSamples;
    int m_latestSpo2 = -1;
    QDateTime m_spo2UpdatedAt;
    QVariantList m_spo2Samples;
    int m_latestSystolic = -1;
    int m_latestDiastolic = -1;
    QDateTime m_bloodPressureUpdatedAt;
    QVariantList m_bloodPressureSamples;
    QDateTime m_lastActivitySyncedAt;
    bool m_isSyncingActivity = false;
    bool m_isMeasuringHeartRate = false;
    bool m_isContinuousHeartRate = false;
    int m_hrContinuousStep = 0;
    QList<qint64> m_hrTapTimestamps;
    bool m_isMeasuringSpo2 = false;
    bool m_isMeasuringBloodPressure = false;

    QVariantList m_appFilters;
    QVariantList m_templates;
    QVariantList m_scheduledAlerts;
    QVariantList m_packetLog;
};

} // namespace fitlink
