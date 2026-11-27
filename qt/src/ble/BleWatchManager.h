#pragma once

#include "protocol/FeeaCodec.h"

#include <QBluetoothDeviceDiscoveryAgent>
#include <QBluetoothDeviceInfo>
#include <QLowEnergyController>
#include <QLowEnergyDescriptor>
#include <QLowEnergyService>
#include <QObject>
#include <QPointer>
#include <QQueue>
#include <QStringList>
#include <QTimer>
#include <QVariantList>
#include <QVariantMap>

namespace fitlink {

struct GattOp {
    enum class Type {
        ReadChar,
        WriteDescriptor,
        WriteChar
    };

    Type type = Type::WriteChar;
    QPointer<QLowEnergyService> service;
    QLowEnergyCharacteristic characteristic;
    QLowEnergyDescriptor descriptor;
    QByteArray value;
    QLowEnergyService::WriteMode writeMode = QLowEnergyService::WriteWithoutResponse;
    QString label;
    int postDelayMs = 40;
};

class BleWatchManager : public QObject {
    Q_OBJECT

public:
    enum class ConnectionState {
        Disconnected = 0,
        Scanning,
        Connecting,
        Connected
    };
    Q_ENUM(ConnectionState)

    explicit BleWatchManager(QObject *parent = nullptr);
    ~BleWatchManager() override;

    ConnectionState state() const { return m_state; }
    bool bluetoothAvailable() const { return m_bluetoothAvailable; }
    QString bluetoothStatusMessage() const { return m_bluetoothStatusMessage; }
    bool checkBluetoothAvailability();

    bool showAllDevices() const { return m_showAllDevices; }
    void setShowAllDevices(bool showAll);

    ProtocolVersion detectedProtocol() const { return m_detectedProtocol; }
    ProtocolPreference protocolPreference() const { return m_protocolPref; }
    void setProtocolPreference(ProtocolPreference pref);

    int mtuSize() const { return m_mtuSize; }
    void setMtuSize(int mtu);

    int writeDelayMs() const { return m_writeDelayMs; }
    void setWriteDelayMs(int delayMs);

    NotificationFormat notificationFormat() const { return m_notificationFormat; }
    void setNotificationFormat(NotificationFormat format);

    bool preferWriteNoResponse() const { return m_preferWriteNoResponse; }
    void setPreferWriteNoResponse(bool prefer);

    bool hasAlertNotificationService() const { return m_alertNotificationService != nullptr && m_newAlertChar.isValid(); }

    QString deviceName() const { return m_deviceName; }
    QString deviceAddress() const { return m_deviceAddress; }
    int batteryLevel() const { return m_batteryLevel; }
    QVariantMap deviceInfo() const { return m_deviceInfo; }
    QVariantList discoveredDevices() const { return m_discoveredDevicesVariant; }

    void startScan();
    void stopScan();
    void connectToDevice(const QString &addressOrId);
    void disconnectDevice();

    bool sendSyncTime(const QDateTime &dateTime, int utcOffsetMinutes);
    bool sendTimeFormat(bool use24Hour);
    bool sendNotification(WatchAppIcon icon,
                          const QString &title,
                          const QString &body,
                          int formatOverride = -1);
    bool sendFindWatch();
    void refreshBattery();
    bool requestHealthSync();
    bool requestHeartRateReading();
    bool requestSpo2Reading();
    bool requestBloodPressureReading();

signals:
    void stateChanged(ConnectionState state);
    void bluetoothAvailabilityChanged();
    void discoveredDevicesChanged();
    void connectedDeviceChanged();
    void batteryLevelChanged(int level);
    void deviceInfoChanged();
    void protocolChanged();
    void activityDataReceived(int dayOffset, int steps, int distanceMeters);
    void heartRateReceived(int bpm);
    void spo2Received(int percent);
    void bloodPressureReceived(int systolic, int diastolic);
    void watchActionReceived(int actionCode);
    void packetLogged(const QString &direction,
                      const QString &actionLabel,
                      const QString &protocolLabel,
                      const QString &hexPreview,
                      int chunkCount,
                      const QString &status);
    void errorOccurred(const QString &message);

private slots:
    void onDeviceDiscovered(const QBluetoothDeviceInfo &info);
    void onScanFinished();
    void onScanError(QBluetoothDeviceDiscoveryAgent::Error error);

    void onControllerConnected();
    void onControllerDisconnected();
    void onControllerError(QLowEnergyController::Error error);
    void onControllerMtuChanged(int mtu);
    void onServiceDiscovered(const QBluetoothUuid &serviceUuid);
    void onServiceDiscoveryFinished();

    void onFeeaServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onBatteryServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onDeviceInfoServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onImmediateAlertServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onHeartRateServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onPulseOximeterServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onAlertNotificationServiceStateChanged(QLowEnergyService::ServiceState newState);

    void onCharacteristicChanged(const QLowEnergyCharacteristic &characteristic, const QByteArray &value);
    void onCharacteristicRead(const QLowEnergyCharacteristic &characteristic, const QByteArray &value);
    void onCharacteristicWritten(const QLowEnergyCharacteristic &characteristic, const QByteArray &value);
    void onDescriptorWritten(const QLowEnergyDescriptor &descriptor, const QByteArray &value);
    void onServiceError(QLowEnergyService::ServiceError error);

    void discoverNextService();
    void onServiceDiscoveryTimeout();
    void processGattOpQueue();
    void onGattOpTimeout();

private:
    void setState(ConnectionState newState);
    void ensureDiscoveryAgent();
    void ensureBluetoothPermissionsAndScan();
    void beginScanInternal();
    void cleanupConnection();
    void attachServiceSignals(QLowEnergyService *service);
    void advanceServiceDiscovery(QLowEnergyService *completedService);

    void enqueueReadChar(QLowEnergyService *service, const QLowEnergyCharacteristic &characteristic, const QString &label);
    void enqueueSubscribeToNotify(QLowEnergyService *service, const QLowEnergyCharacteristic &characteristic, const QString &label);
    bool enqueuePacket(const QByteArray &packet, const QString &actionLabel);
    void finishActiveGattOp(int delayMs);
    void handleParsedHealth(const ParsedHealthPacket &parsed);
    static QString deviceIdentifier(const QBluetoothDeviceInfo &info);

    ConnectionState m_state = ConnectionState::Disconnected;
    bool m_bluetoothAvailable = false;
    QString m_bluetoothStatusMessage;
    bool m_showAllDevices = false;

    ProtocolVersion m_detectedProtocol = ProtocolVersion::Unknown;
    ProtocolPreference m_protocolPref = ProtocolPreference::Auto;
    int m_mtuSize = 20;
    int m_writeDelayMs = 50;
    NotificationFormat m_notificationFormat = NotificationFormat::Standard;
    bool m_preferWriteNoResponse = true;

    QBluetoothDeviceDiscoveryAgent *m_discoveryAgent = nullptr;
    QList<QBluetoothDeviceInfo> m_discoveredDevices;
    QVariantList m_discoveredDevicesVariant;

    QLowEnergyController *m_controller = nullptr;
    QLowEnergyService *m_feeaService = nullptr;
    QLowEnergyService *m_batteryService = nullptr;
    QLowEnergyService *m_deviceInfoService = nullptr;
    QLowEnergyService *m_immediateAlertService = nullptr;
    QLowEnergyService *m_heartRateService = nullptr;
    QLowEnergyService *m_pulseOximeterService = nullptr;
    QLowEnergyService *m_alertNotificationService = nullptr;

    QLowEnergyCharacteristic m_activityChar;
    QLowEnergyCharacteristic m_dataOutChar;
    QLowEnergyCharacteristic m_dataInChar;
    QLowEnergyCharacteristic m_batteryChar;
    QLowEnergyCharacteristic m_alertLevelChar;
    QLowEnergyCharacteristic m_heartRateChar;
    QLowEnergyCharacteristic m_spo2Char;
    QLowEnergyCharacteristic m_newAlertChar;

    QString m_deviceName;
    QString m_deviceAddress;
    int m_batteryLevel = -1;
    QVariantMap m_deviceInfo;
    QStringList m_discoveredServiceUuids;

    // Serialized service detail discovery (Android GATT allows only one in-flight op at a time)
    QQueue<QPointer<QLowEnergyService>> m_pendingServiceDiscoveries;
    QPointer<QLowEnergyService> m_discoveringService;
    QTimer m_serviceDiscoveryTimer;
    bool m_initializingGatt = false;

    // Unified serialized GATT operation queue (reads, CCCD writes, and command writes)
    QQueue<GattOp> m_gattOpQueue;
    GattOp m_activeGattOp;
    bool m_gattOpInFlight = false;
    QTimer m_gattOpTimer;
    QTimer m_gattOpTimeoutTimer;

    // Multi-chunk 0xFEE3 notification frame reassembly buffer
    QByteArray m_rxAssemblyBuffer;
    int m_rxExpectedLength = 0;
};

} // namespace fitlink
