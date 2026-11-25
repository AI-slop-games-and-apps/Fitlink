#include "BleWatchManager.h"

#include <QBluetoothHostInfo>
#include <QBluetoothLocalDevice>
#include <QCoreApplication>
#include <QLowEnergyDescriptor>
#include <algorithm>

#if defined(FITLINK_PLATFORM_LINUX_DBUS)
#include <QDBusConnection>
#include <QDBusConnectionInterface>
#endif

#if QT_VERSION >= QT_VERSION_CHECK(6, 6, 0)
#include <QBluetoothPermission>
#include <QPermission>
#endif

namespace fitlink {

BleWatchManager::BleWatchManager(QObject *parent)
    : QObject(parent) {
    m_writeTimer.setSingleShot(true);
    connect(&m_writeTimer, &QTimer::timeout, this, &BleWatchManager::processWriteQueue);

    checkBluetoothAvailability();
}

void BleWatchManager::ensureDiscoveryAgent() {
    if (m_discoveryAgent) {
        return;
    }
    m_discoveryAgent = new QBluetoothDeviceDiscoveryAgent(this);
    m_discoveryAgent->setLowEnergyDiscoveryTimeout(12000);

    connect(m_discoveryAgent, &QBluetoothDeviceDiscoveryAgent::deviceDiscovered,
            this, &BleWatchManager::onDeviceDiscovered);
    connect(m_discoveryAgent, &QBluetoothDeviceDiscoveryAgent::finished,
            this, &BleWatchManager::onScanFinished);
    connect(m_discoveryAgent, &QBluetoothDeviceDiscoveryAgent::errorOccurred,
            this, &BleWatchManager::onScanError);
}

bool BleWatchManager::checkBluetoothAvailability() {
    bool available = true;
    QString message = tr("Bluetooth Ready");

#if defined(FITLINK_PLATFORM_LINUX_DBUS)
    QDBusConnection sysBus = QDBusConnection::systemBus();
    if (!sysBus.isConnected() || !sysBus.interface()) {
        available = false;
        message = tr("System D-Bus is unavailable. BlueZ cannot be queried on this system.");
    } else if (!sysBus.interface()->isServiceRegistered(QStringLiteral("org.bluez"))) {
        available = false;
        message = tr("BlueZ Bluetooth service is not installed or running. Install and start 'bluez' to connect BLE watches.");
    } else {
        const auto adapters = QBluetoothLocalDevice::allDevices();
        if (adapters.isEmpty()) {
            available = false;
            message = tr("BlueZ is running, but no Bluetooth adapter was detected.");
        } else {
            bool anyPoweredOn = false;
            for (const auto &hostInfo : adapters) {
                QBluetoothLocalDevice local(hostInfo.address());
                if (local.isValid() && local.hostMode() != QBluetoothLocalDevice::HostPoweredOff) {
                    anyPoweredOn = true;
                    break;
                }
            }
            if (!anyPoweredOn) {
                available = false;
                message = tr("Bluetooth adapter is powered off. Enable Bluetooth to connect a watch.");
            } else {
                available = true;
                message = tr("Bluetooth Ready (BlueZ)");
            }
        }
    }
#elif !defined(Q_OS_ANDROID)
    const auto adapters = QBluetoothLocalDevice::allDevices();
    if (adapters.isEmpty()) {
        available = false;
        message = tr("No Bluetooth adapter was detected on this device.");
    }
#endif

    if (m_bluetoothAvailable != available || m_bluetoothStatusMessage != message) {
        m_bluetoothAvailable = available;
        m_bluetoothStatusMessage = message;
        emit bluetoothAvailabilityChanged();
    }
    return m_bluetoothAvailable;
}

BleWatchManager::~BleWatchManager() {
    cleanupConnection();
}

void BleWatchManager::setState(ConnectionState newState) {
    if (m_state != newState) {
        m_state = newState;
        emit stateChanged(m_state);
    }
}

void BleWatchManager::setShowAllDevices(bool showAll) {
    m_showAllDevices = showAll;
}

void BleWatchManager::setProtocolPreference(ProtocolPreference pref) {
    if (m_protocolPref != pref) {
        m_protocolPref = pref;
        emit protocolChanged();
    }
}

void BleWatchManager::setMtuSize(int mtu) {
    m_mtuSize = std::clamp(mtu, 20, 244);
}

void BleWatchManager::setWriteDelayMs(int delayMs) {
    m_writeDelayMs = std::clamp(delayMs, 20, 200);
}

QString BleWatchManager::deviceIdentifier(const QBluetoothDeviceInfo &info) {
#if defined(Q_OS_DARWIN)
    return info.deviceUuid().toString();
#else
    return info.address().toString();
#endif
}

void BleWatchManager::startScan() {
    if (!checkBluetoothAvailability()) {
        emit errorOccurred(m_bluetoothStatusMessage);
        return;
    }
    ensureBluetoothPermissionsAndScan();
}

void BleWatchManager::ensureBluetoothPermissionsAndScan() {
#if QT_VERSION >= QT_VERSION_CHECK(6, 6, 0) && defined(Q_OS_ANDROID)
    QBluetoothPermission btPermission;
    btPermission.setCommunicationModes(QBluetoothPermission::Access);
    switch (qApp->checkPermission(btPermission)) {
    case Qt::PermissionStatus::Undetermined:
        qApp->requestPermission(btPermission, this, [this](const QPermission &permission) {
            if (permission.status() == Qt::PermissionStatus::Granted) {
                beginScanInternal();
            } else {
                emit errorOccurred(tr("Bluetooth permission is required to scan for BLE watches."));
            }
        });
        return;
    case Qt::PermissionStatus::Denied:
        emit errorOccurred(tr("Bluetooth permission was denied. Enable Nearby Devices in Android settings."));
        return;
    case Qt::PermissionStatus::Granted:
        break;
    }
#endif
    beginScanInternal();
}

void BleWatchManager::beginScanInternal() {
    ensureDiscoveryAgent();

    m_discoveredDevices.clear();
    m_discoveredDevicesVariant.clear();
    emit discoveredDevicesChanged();

    if (m_discoveryAgent->isActive()) {
        m_discoveryAgent->stop();
    }
    setState(ConnectionState::Scanning);
    m_discoveryAgent->start(QBluetoothDeviceDiscoveryAgent::LowEnergyMethod);
}

void BleWatchManager::stopScan() {
    if (m_discoveryAgent && m_discoveryAgent->isActive()) {
        m_discoveryAgent->stop();
    }
    if (m_state == ConnectionState::Scanning) {
        setState(ConnectionState::Disconnected);
    }
}

void BleWatchManager::onDeviceDiscovered(const QBluetoothDeviceInfo &info) {
    if (!(info.coreConfigurations() & QBluetoothDeviceInfo::LowEnergyCoreConfiguration)) {
        return;
    }

    const QString name = info.name().trimmed();
    const bool hasFeeaService = info.serviceUuids().contains(GattUuids::ServiceFeea);
    const bool matchesWatchHeuristic = hasFeeaService
        || name.contains(QStringLiteral("Watch"), Qt::CaseInsensitive)
        || name.contains(QStringLiteral("Band"), Qt::CaseInsensitive);

    if (!m_showAllDevices && !matchesWatchHeuristic) {
        return;
    }

    const QString id = deviceIdentifier(info);
    for (int i = 0; i < m_discoveredDevices.size(); ++i) {
        if (deviceIdentifier(m_discoveredDevices.at(i)) == id) {
            m_discoveredDevices[i] = info;
            QVariantMap entry = m_discoveredDevicesVariant[i].toMap();
            entry[QStringLiteral("rssi")] = info.rssi();
            m_discoveredDevicesVariant[i] = entry;
            emit discoveredDevicesChanged();
            return;
        }
    }

    m_discoveredDevices.append(info);
    QVariantMap entry;
    entry[QStringLiteral("id")] = id;
    entry[QStringLiteral("name")] = name.isEmpty() ? tr("Unnamed BLE Device") : name;
    entry[QStringLiteral("rssi")] = info.rssi();
    entry[QStringLiteral("hasFeeaUuid")] = hasFeeaService;
    m_discoveredDevicesVariant.append(entry);
    emit discoveredDevicesChanged();
}

void BleWatchManager::onScanFinished() {
    if (m_state == ConnectionState::Scanning) {
        setState(ConnectionState::Disconnected);
    }
}

void BleWatchManager::onScanError(QBluetoothDeviceDiscoveryAgent::Error error) {
    if (error == QBluetoothDeviceDiscoveryAgent::NoError) {
        return;
    }
    setState(ConnectionState::Disconnected);
    emit errorOccurred(tr("Bluetooth scan failed: %1").arg(m_discoveryAgent->errorString()));
}

void BleWatchManager::connectToDevice(const QString &addressOrId) {
    stopScan();
    cleanupConnection();

    QBluetoothDeviceInfo target;
    bool found = false;
    for (const auto &info : m_discoveredDevices) {
        if (deviceIdentifier(info) == addressOrId) {
            target = info;
            found = true;
            break;
        }
    }
    if (!found) {
        emit errorOccurred(tr("Selected watch is no longer in the scan list. Please scan again."));
        return;
    }

    m_deviceName = target.name().isEmpty() ? tr("BLE Watch") : target.name();
    m_deviceAddress = addressOrId;
    m_batteryLevel = -1;
    m_deviceInfo.clear();
    m_detectedProtocol = ProtocolVersion::Unknown;
    emit connectedDeviceChanged();
    emit batteryLevelChanged(m_batteryLevel);
    emit deviceInfoChanged();
    emit protocolChanged();

    setState(ConnectionState::Connecting);
    m_controller = QLowEnergyController::createCentral(target, this);

    connect(m_controller, &QLowEnergyController::connected,
            this, &BleWatchManager::onControllerConnected);
    connect(m_controller, &QLowEnergyController::disconnected,
            this, &BleWatchManager::onControllerDisconnected);
    connect(m_controller, &QLowEnergyController::errorOccurred,
            this, &BleWatchManager::onControllerError);
    connect(m_controller, &QLowEnergyController::serviceDiscovered,
            this, &BleWatchManager::onServiceDiscovered);
    connect(m_controller, &QLowEnergyController::discoveryFinished,
            this, &BleWatchManager::onServiceDiscoveryFinished);

    m_controller->connectToDevice();
}

void BleWatchManager::disconnectDevice() {
    cleanupConnection();
    setState(ConnectionState::Disconnected);
}

void BleWatchManager::cleanupConnection() {
    m_writeTimer.stop();
    m_writeQueue.clear();

    auto deleteService = [](QLowEnergyService *&svc) {
        if (svc) {
            svc->deleteLater();
            svc = nullptr;
        }
    };
    deleteService(m_feeaService);
    deleteService(m_batteryService);
    deleteService(m_deviceInfoService);
    deleteService(m_immediateAlertService);
    deleteService(m_heartRateService);
    deleteService(m_pulseOximeterService);

    m_dataOutChar = QLowEnergyCharacteristic();
    m_dataInChar = QLowEnergyCharacteristic();
    m_batteryChar = QLowEnergyCharacteristic();
    m_alertLevelChar = QLowEnergyCharacteristic();
    m_heartRateChar = QLowEnergyCharacteristic();
    m_spo2Char = QLowEnergyCharacteristic();

    if (m_controller) {
        m_controller->disconnectFromDevice();
        m_controller->deleteLater();
        m_controller = nullptr;
    }
}

void BleWatchManager::onControllerConnected() {
    emit packetLogged(QStringLiteral("system"),
                      tr("BLE Connected"),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      m_deviceAddress,
                      0,
                      QStringLiteral("ack"));
    m_controller->discoverServices();
}

void BleWatchManager::onControllerDisconnected() {
    cleanupConnection();
    setState(ConnectionState::Disconnected);
    emit packetLogged(QStringLiteral("system"),
                      tr("BLE Disconnected"),
                      QStringLiteral("-"),
                      m_deviceAddress,
                      0,
                      QStringLiteral("sent"));
}

void BleWatchManager::onControllerError(QLowEnergyController::Error error) {
    if (error == QLowEnergyController::NoError) {
        return;
    }
    emit errorOccurred(tr("Bluetooth connection error: %1").arg(m_controller->errorString()));
    cleanupConnection();
    setState(ConnectionState::Disconnected);
}

void BleWatchManager::onServiceDiscovered(const QBluetoothUuid &serviceUuid) {
    if (!m_controller) {
        return;
    }
    if (serviceUuid == GattUuids::ServiceFeea && !m_feeaService) {
        m_feeaService = m_controller->createServiceObject(serviceUuid, this);
    } else if (serviceUuid == GattUuids::ServiceBattery && !m_batteryService) {
        m_batteryService = m_controller->createServiceObject(serviceUuid, this);
    } else if (serviceUuid == GattUuids::ServiceDeviceInfo && !m_deviceInfoService) {
        m_deviceInfoService = m_controller->createServiceObject(serviceUuid, this);
    } else if (serviceUuid == GattUuids::ServiceImmediateAlert && !m_immediateAlertService) {
        m_immediateAlertService = m_controller->createServiceObject(serviceUuid, this);
    } else if (serviceUuid == GattUuids::ServiceHeartRate && !m_heartRateService) {
        m_heartRateService = m_controller->createServiceObject(serviceUuid, this);
    } else if (serviceUuid == GattUuids::ServicePulseOximeter && !m_pulseOximeterService) {
        m_pulseOximeterService = m_controller->createServiceObject(serviceUuid, this);
    }
}

void BleWatchManager::onServiceDiscoveryFinished() {
    if (!m_feeaService) {
        emit errorOccurred(tr("Connected device does not expose BLE service 0xFEEA."));
    } else {
        connect(m_feeaService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onFeeaServiceStateChanged);
        connect(m_feeaService, &QLowEnergyService::characteristicChanged,
                this, &BleWatchManager::onCharacteristicChanged);
        m_feeaService->discoverDetails();
    }

    if (m_batteryService) {
        connect(m_batteryService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onBatteryServiceStateChanged);
        connect(m_batteryService, &QLowEnergyService::characteristicChanged,
                this, &BleWatchManager::onCharacteristicChanged);
        connect(m_batteryService, &QLowEnergyService::characteristicRead,
                this, &BleWatchManager::onCharacteristicRead);
        m_batteryService->discoverDetails();
    }

    if (m_deviceInfoService) {
        connect(m_deviceInfoService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onDeviceInfoServiceStateChanged);
        connect(m_deviceInfoService, &QLowEnergyService::characteristicRead,
                this, &BleWatchManager::onCharacteristicRead);
        m_deviceInfoService->discoverDetails();
    }

    if (m_immediateAlertService) {
        connect(m_immediateAlertService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onImmediateAlertServiceStateChanged);
        m_immediateAlertService->discoverDetails();
    }

    if (m_heartRateService) {
        connect(m_heartRateService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onHeartRateServiceStateChanged);
        connect(m_heartRateService, &QLowEnergyService::characteristicChanged,
                this, &BleWatchManager::onCharacteristicChanged);
        m_heartRateService->discoverDetails();
    }

    if (m_pulseOximeterService) {
        connect(m_pulseOximeterService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onPulseOximeterServiceStateChanged);
        connect(m_pulseOximeterService, &QLowEnergyService::characteristicChanged,
                this, &BleWatchManager::onCharacteristicChanged);
        m_pulseOximeterService->discoverDetails();
    }

    setState(ConnectionState::Connected);
}

void BleWatchManager::onFeeaServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_feeaService) {
        return;
    }

    m_dataOutChar = m_feeaService->characteristic(GattUuids::CharDataOut);
    if (!m_dataOutChar.isValid()) {
        m_dataOutChar = m_feeaService->characteristic(GattUuids::CharDataOutAlt);
    }
    m_dataInChar = m_feeaService->characteristic(GattUuids::CharDataIn);

    // Fallback scan for watches using alternate characteristic UUIDs inside 0xFEEA
    const auto chars = m_feeaService->characteristics();
    for (const auto &ch : chars) {
        if (!m_dataOutChar.isValid() && (ch.properties() & (QLowEnergyCharacteristic::Write | QLowEnergyCharacteristic::WriteNoResponse))) {
            m_dataOutChar = ch;
        }
        if (!m_dataInChar.isValid() && (ch.properties() & QLowEnergyCharacteristic::Notify)) {
            m_dataInChar = ch;
        }
    }

    if (m_dataInChar.isValid()) {
        subscribeToNotify(m_feeaService, m_dataInChar);
    }
}

void BleWatchManager::onBatteryServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_batteryService) {
        return;
    }
    m_batteryChar = m_batteryService->characteristic(GattUuids::CharBatteryLevel);
    if (m_batteryChar.isValid()) {
        m_batteryService->readCharacteristic(m_batteryChar);
        if (m_batteryChar.properties() & QLowEnergyCharacteristic::Notify) {
            subscribeToNotify(m_batteryService, m_batteryChar);
        }
    }
}

void BleWatchManager::onDeviceInfoServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_deviceInfoService) {
        return;
    }
    const QList<QBluetoothUuid> uuids = {
        GattUuids::CharManufacturerName,
        GattUuids::CharModelNumber,
        GattUuids::CharFirmwareRevision,
        GattUuids::CharHardwareRevision
    };
    for (const auto &uuid : uuids) {
        const auto ch = m_deviceInfoService->characteristic(uuid);
        if (ch.isValid()) {
            m_deviceInfoService->readCharacteristic(ch);
        }
    }
}

void BleWatchManager::onImmediateAlertServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_immediateAlertService) {
        return;
    }
    m_alertLevelChar = m_immediateAlertService->characteristic(GattUuids::CharAlertLevel);
}

void BleWatchManager::onHeartRateServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_heartRateService) {
        return;
    }
    m_heartRateChar = m_heartRateService->characteristic(GattUuids::CharHeartRateMeasurement);
    if (m_heartRateChar.isValid() && (m_heartRateChar.properties() & QLowEnergyCharacteristic::Notify)) {
        subscribeToNotify(m_heartRateService, m_heartRateChar);
    }
}

void BleWatchManager::onPulseOximeterServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_pulseOximeterService) {
        return;
    }
    m_spo2Char = m_pulseOximeterService->characteristic(GattUuids::CharPlxContinuous);
    if (!m_spo2Char.isValid()) {
        m_spo2Char = m_pulseOximeterService->characteristic(GattUuids::CharPlxSpotCheck);
    }
    if (m_spo2Char.isValid() && (m_spo2Char.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate))) {
        subscribeToNotify(m_pulseOximeterService, m_spo2Char);
    }
}

void BleWatchManager::subscribeToNotify(QLowEnergyService *service, const QLowEnergyCharacteristic &characteristic) {
    const auto cccd = characteristic.descriptor(QBluetoothUuid::DescriptorType::ClientCharacteristicConfiguration);
    if (cccd.isValid()) {
        service->writeDescriptor(cccd, QByteArray::fromHex("0100"));
    }
}

void BleWatchManager::onCharacteristicRead(const QLowEnergyCharacteristic &characteristic, const QByteArray &value) {
    if (characteristic.uuid() == GattUuids::CharBatteryLevel && !value.isEmpty()) {
        m_batteryLevel = static_cast<uint8_t>(value.at(0));
        emit batteryLevelChanged(m_batteryLevel);
        return;
    }

    const QString text = QString::fromUtf8(value).trimmed();
    if (characteristic.uuid() == GattUuids::CharManufacturerName) {
        m_deviceInfo[QStringLiteral("manufacturer")] = text;
        m_detectedProtocol = FeeaCodec::detectFromManufacturer(text);
        emit protocolChanged();
    } else if (characteristic.uuid() == GattUuids::CharModelNumber) {
        m_deviceInfo[QStringLiteral("model")] = text;
    } else if (characteristic.uuid() == GattUuids::CharFirmwareRevision) {
        m_deviceInfo[QStringLiteral("firmware")] = text;
    } else if (characteristic.uuid() == GattUuids::CharHardwareRevision) {
        m_deviceInfo[QStringLiteral("hardware")] = text;
    }
    emit deviceInfoChanged();
}

void BleWatchManager::onCharacteristicChanged(const QLowEnergyCharacteristic &characteristic, const QByteArray &value) {
    if (characteristic.uuid() == GattUuids::CharBatteryLevel && !value.isEmpty()) {
        m_batteryLevel = static_cast<uint8_t>(value.at(0));
        emit batteryLevelChanged(m_batteryLevel);
        return;
    }

    if (characteristic.uuid() == GattUuids::CharHeartRateMeasurement) {
        const int bpm = FeeaCodec::parseStandardHeartRate(value);
        if (bpm > 0) {
            emit heartRateReceived(bpm);
        }
        return;
    }

    if (characteristic.uuid() == GattUuids::CharPlxContinuous
        || characteristic.uuid() == GattUuids::CharPlxSpotCheck) {
        const int spo2 = FeeaCodec::parseStandardSpo2(value);
        if (spo2 > 0) {
            emit spo2Received(spo2);
        }
        return;
    }

    if (characteristic.uuid() == m_dataInChar.uuid()) {
        emit packetLogged(QStringLiteral("rx"),
                          tr("Watch Response"),
                          FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                          FeeaCodec::toHexString(value),
                          1,
                          QStringLiteral("ack"));

        const ParsedHealthPacket parsed = FeeaCodec::parseFeeaHealthResponse(value);
        if (parsed.valid) {
            if (parsed.hasSteps) {
                emit activityDataReceived(parsed.dayOffset, parsed.steps, parsed.distanceMeters);
            }
            if (parsed.hasHeartRate) {
                emit heartRateReceived(parsed.heartRateBpm);
            }
            if (parsed.hasSpo2) {
                emit spo2Received(parsed.spo2Percent);
            }
        }
    }
}

bool BleWatchManager::enqueuePacket(const QByteArray &packet, const QString &actionLabel) {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Watch is not connected or 0xFEE2 write characteristic is unavailable."));
        return false;
    }

    const auto chunks = FeeaCodec::chunkPacket(packet, m_mtuSize);
    for (int i = 0; i < chunks.size(); ++i) {
        QueuedWrite item;
        item.chunk = chunks.at(i);
        item.actionLabel = actionLabel;
        item.chunkIndex = i;
        item.totalChunks = chunks.size();
        m_writeQueue.enqueue(item);
    }

    const auto activeVersion = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    emit packetLogged(QStringLiteral("tx"),
                      actionLabel,
                      FeeaCodec::versionLabel(activeVersion),
                      FeeaCodec::toHexString(packet),
                      chunks.size(),
                      QStringLiteral("sent"));

    if (!m_writeTimer.isActive()) {
        processWriteQueue();
    }
    return true;
}

void BleWatchManager::processWriteQueue() {
    if (m_writeQueue.isEmpty() || !m_feeaService || !m_dataOutChar.isValid()) {
        return;
    }

    const QueuedWrite next = m_writeQueue.dequeue();
    const auto mode = (m_dataOutChar.properties() & QLowEnergyCharacteristic::WriteNoResponse)
        ? QLowEnergyService::WriteWithoutResponse
        : QLowEnergyService::WriteWithResponse;

    m_feeaService->writeCharacteristic(m_dataOutChar, next.chunk, mode);

    if (!m_writeQueue.isEmpty()) {
        m_writeTimer.start(m_writeDelayMs);
    }
}

bool BleWatchManager::sendSyncTime(const QDateTime &dateTime, int utcOffsetMinutes) {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const QByteArray packet = FeeaCodec::encodeSyncTime(version, dateTime, utcOffsetMinutes);
    return enqueuePacket(packet, tr("Sync Time"));
}

bool BleWatchManager::sendTimeFormat(bool use24Hour) {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const QByteArray packet = FeeaCodec::encodeTimeFormat(version, use24Hour);
    return enqueuePacket(packet, use24Hour ? tr("Set 24h Format") : tr("Set 12h Format"));
}

bool BleWatchManager::sendNotification(WatchAppIcon icon, const QString &title, const QString &body) {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const QByteArray packet = FeeaCodec::encodeNotification(version, icon, title, body);
    return enqueuePacket(packet, tr("Push Notification"));
}

bool BleWatchManager::sendFindWatch() {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const QByteArray packet = FeeaCodec::encodeFindWatch(version);
    const bool sent = enqueuePacket(packet, tr("Find Watch"));

    // Also ping standard BLE Immediate Alert (0x1802) if the watch exposes it
    if (m_immediateAlertService && m_alertLevelChar.isValid()) {
        m_immediateAlertService->writeCharacteristic(
            m_alertLevelChar,
            QByteArray(1, static_cast<char>(0x02)),
            QLowEnergyService::WriteWithoutResponse
        );
    }
    return sent;
}

void BleWatchManager::refreshBattery() {
    if (m_batteryService && m_batteryChar.isValid()) {
        m_batteryService->readCharacteristic(m_batteryChar);
    }
}

bool BleWatchManager::requestHealthSync() {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Connect a watch before refreshing activity data."));
        return false;
    }
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const bool okSteps = enqueuePacket(FeeaCodec::encodeSyncActivity(version, 0), tr("Sync Activity (0x51)"));
    enqueuePacket(FeeaCodec::encodeSyncHeartRate(version), tr("Sync Heart Rate (0x6B)"));
    enqueuePacket(FeeaCodec::encodeSyncSpo2(version), tr("Sync SpO2 (0x70)"));
    return okSteps;
}

} // namespace fitlink
