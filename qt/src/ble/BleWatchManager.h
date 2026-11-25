#pragma once

#include "protocol/FeeaCodec.h"

#include <QBluetoothDeviceDiscoveryAgent>
#include <QBluetoothDeviceInfo>
#include <QLowEnergyController>
#include <QLowEnergyService>
#include <QObject>
#include <QQueue>
#include <QTimer>
#include <QVariantList>
#include <QVariantMap>

namespace fitlink {

struct QueuedWrite {
    QByteArray chunk;
    QString actionLabel;
    int chunkIndex = 0;
    int totalChunks = 1;
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
    bool sendNotification(WatchAppIcon icon, const QString &title, const QString &body);
    bool sendFindWatch();
    void refreshBattery();
    bool requestHealthSync();

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
    void onServiceDiscovered(const QBluetoothUuid &serviceUuid);
    void onServiceDiscoveryFinished();

    void onFeeaServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onBatteryServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onDeviceInfoServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onImmediateAlertServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onHeartRateServiceStateChanged(QLowEnergyService::ServiceState newState);
    void onPulseOximeterServiceStateChanged(QLowEnergyService::ServiceState newState);

    void onCharacteristicChanged(const QLowEnergyCharacteristic &characteristic, const QByteArray &value);
    void onCharacteristicRead(const QLowEnergyCharacteristic &characteristic, const QByteArray &value);

    void processWriteQueue();

private:
    void setState(ConnectionState newState);
    void ensureDiscoveryAgent();
    void ensureBluetoothPermissionsAndScan();
    void beginScanInternal();
    void cleanupConnection();
    bool enqueuePacket(const QByteArray &packet, const QString &actionLabel);
    void subscribeToNotify(QLowEnergyService *service, const QLowEnergyCharacteristic &characteristic);
    static QString deviceIdentifier(const QBluetoothDeviceInfo &info);

    ConnectionState m_state = ConnectionState::Disconnected;
    bool m_bluetoothAvailable = false;
    QString m_bluetoothStatusMessage;
    bool m_showAllDevices = false;

    ProtocolVersion m_detectedProtocol = ProtocolVersion::Unknown;
    ProtocolPreference m_protocolPref = ProtocolPreference::Auto;
    int m_mtuSize = 20;
    int m_writeDelayMs = 50;

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

    QLowEnergyCharacteristic m_dataOutChar;
    QLowEnergyCharacteristic m_dataInChar;
    QLowEnergyCharacteristic m_batteryChar;
    QLowEnergyCharacteristic m_alertLevelChar;
    QLowEnergyCharacteristic m_heartRateChar;
    QLowEnergyCharacteristic m_spo2Char;

    QString m_deviceName;
    QString m_deviceAddress;
    int m_batteryLevel = -1;
    QVariantMap m_deviceInfo;

    QQueue<QueuedWrite> m_writeQueue;
    QTimer m_writeTimer;
};

} // namespace fitlink
