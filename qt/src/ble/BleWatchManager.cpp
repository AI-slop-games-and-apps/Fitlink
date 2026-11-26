#include "BleWatchManager.h"

#include <QBluetoothHostInfo>
#include <QBluetoothLocalDevice>
#include <QCoreApplication>
#include <QPair>
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
    m_serviceDiscoveryTimer.setSingleShot(true);
    connect(&m_serviceDiscoveryTimer, &QTimer::timeout,
            this, &BleWatchManager::onServiceDiscoveryTimeout);

    m_gattOpTimer.setSingleShot(true);
    connect(&m_gattOpTimer, &QTimer::timeout,
            this, &BleWatchManager::processGattOpQueue);

    m_gattOpTimeoutTimer.setSingleShot(true);
    connect(&m_gattOpTimeoutTimer, &QTimer::timeout,
            this, &BleWatchManager::onGattOpTimeout);

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

void BleWatchManager::setNotificationFormat(NotificationFormat format) {
    m_notificationFormat = format;
}

void BleWatchManager::setPreferWriteNoResponse(bool prefer) {
    if (m_preferWriteNoResponse != prefer) {
        m_preferWriteNoResponse = prefer;
        emit protocolChanged();
    }
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
    connect(m_controller, &QLowEnergyController::mtuChanged,
            this, &BleWatchManager::onControllerMtuChanged);

    m_controller->connectToDevice();
}

void BleWatchManager::disconnectDevice() {
    cleanupConnection();
    setState(ConnectionState::Disconnected);
}

void BleWatchManager::cleanupConnection() {
    m_serviceDiscoveryTimer.stop();
    m_pendingServiceDiscoveries.clear();
    m_discoveringService = nullptr;
    m_initializingGatt = false;

    m_gattOpTimer.stop();
    m_gattOpTimeoutTimer.stop();
    m_gattOpQueue.clear();
    m_gattOpInFlight = false;

    m_rxAssemblyBuffer.clear();
    m_rxExpectedLength = 0;
    m_discoveredServiceUuids.clear();

    auto deleteService = [](QLowEnergyService *&svc) {
        if (svc) {
            svc->disconnect();
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
    deleteService(m_alertNotificationService);

    m_activityChar = QLowEnergyCharacteristic();
    m_dataOutChar = QLowEnergyCharacteristic();
    m_dataInChar = QLowEnergyCharacteristic();
    m_batteryChar = QLowEnergyCharacteristic();
    m_alertLevelChar = QLowEnergyCharacteristic();
    m_heartRateChar = QLowEnergyCharacteristic();
    m_spo2Char = QLowEnergyCharacteristic();
    m_newAlertChar = QLowEnergyCharacteristic();

    if (m_controller) {
        m_controller->disconnect();
        m_controller->disconnectFromDevice();
        m_controller->deleteLater();
        m_controller = nullptr;
    }
}

void BleWatchManager::onControllerConnected() {
    if (m_controller) {
        const int negotiatedMtu = m_controller->mtu();
        if (negotiatedMtu > 23) {
            const int payloadMtu = std::clamp(negotiatedMtu - 3, 20, 244);
            if (payloadMtu != m_mtuSize) {
                m_mtuSize = payloadMtu;
                emit protocolChanged();
            }
        }
    }
    emit packetLogged(QStringLiteral("system"),
                      tr("BLE Connected — Discovering Services"),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      QStringLiteral("%1 · ATT payload %2B").arg(m_deviceAddress).arg(m_mtuSize),
                      0,
                      QStringLiteral("ack"));
    m_discoveredServiceUuids.clear();
    m_controller->discoverServices();
}

void BleWatchManager::onControllerMtuChanged(int mtu) {
    if (mtu <= 23) {
        return;
    }
    const int payloadMtu = std::clamp(mtu - 3, 20, 244);
    if (payloadMtu != m_mtuSize) {
        m_mtuSize = payloadMtu;
        emit protocolChanged();
    }
    emit packetLogged(QStringLiteral("system"),
                      tr("Negotiated ATT MTU"),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      QStringLiteral("MTU %1 → %2B payload").arg(mtu).arg(m_mtuSize),
                      0,
                      QStringLiteral("ack"));
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
    m_discoveredServiceUuids.append(serviceUuid.toString(QUuid::WithoutBraces));

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
    } else if (serviceUuid == GattUuids::ServiceAlertNotification && !m_alertNotificationService) {
        m_alertNotificationService = m_controller->createServiceObject(serviceUuid, this);
    }
}

void BleWatchManager::attachServiceSignals(QLowEnergyService *service) {
    if (!service) {
        return;
    }
    connect(service, &QLowEnergyService::characteristicChanged,
            this, &BleWatchManager::onCharacteristicChanged);
    connect(service, &QLowEnergyService::characteristicRead,
            this, &BleWatchManager::onCharacteristicRead);
    connect(service, &QLowEnergyService::characteristicWritten,
            this, &BleWatchManager::onCharacteristicWritten);
    connect(service, &QLowEnergyService::descriptorWritten,
            this, &BleWatchManager::onDescriptorWritten);
    connect(service, &QLowEnergyService::errorOccurred,
            this, &BleWatchManager::onServiceError);
}

void BleWatchManager::onServiceDiscoveryFinished() {
    emit packetLogged(QStringLiteral("system"),
                      tr("Discovered %1 GATT services").arg(m_discoveredServiceUuids.size()),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      m_discoveredServiceUuids.join(QStringLiteral(", ")),
                      0,
                      QStringLiteral("ack"));

    if (!m_feeaService) {
        emit errorOccurred(tr("Connected device does not expose BLE service 0xFEEA."));
    }

    m_pendingServiceDiscoveries.clear();
    m_gattOpQueue.clear();
    m_gattOpInFlight = false;
    m_initializingGatt = true;

    // Discover service details STRICTLY ONE AT A TIME for Android BluetoothGatt stability.
    // Order: Device Info first (so V1/V2 protocol is detected from Manufacturer Name), then 0xFEEA,
    // then Battery, Heart Rate, Pulse Oximeter, Immediate Alert.
    if (m_deviceInfoService) {
        attachServiceSignals(m_deviceInfoService);
        connect(m_deviceInfoService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onDeviceInfoServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_deviceInfoService);
    }
    if (m_feeaService) {
        attachServiceSignals(m_feeaService);
        connect(m_feeaService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onFeeaServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_feeaService);
    }
    if (m_batteryService) {
        attachServiceSignals(m_batteryService);
        connect(m_batteryService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onBatteryServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_batteryService);
    }
    if (m_heartRateService) {
        attachServiceSignals(m_heartRateService);
        connect(m_heartRateService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onHeartRateServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_heartRateService);
    }
    if (m_pulseOximeterService) {
        attachServiceSignals(m_pulseOximeterService);
        connect(m_pulseOximeterService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onPulseOximeterServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_pulseOximeterService);
    }
    if (m_immediateAlertService) {
        attachServiceSignals(m_immediateAlertService);
        connect(m_immediateAlertService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onImmediateAlertServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_immediateAlertService);
    }
    if (m_alertNotificationService) {
        attachServiceSignals(m_alertNotificationService);
        connect(m_alertNotificationService, &QLowEnergyService::stateChanged,
                this, &BleWatchManager::onAlertNotificationServiceStateChanged);
        m_pendingServiceDiscoveries.enqueue(m_alertNotificationService);
    }

    discoverNextService();
}

void BleWatchManager::discoverNextService() {
    m_serviceDiscoveryTimer.stop();
    m_discoveringService = nullptr;

    while (!m_pendingServiceDiscoveries.isEmpty()) {
        QPointer<QLowEnergyService> next = m_pendingServiceDiscoveries.dequeue();
        if (!next) {
            continue;
        }
        m_discoveringService = next;
        m_serviceDiscoveryTimer.start(4000);
        next->discoverDetails();
        return;
    }

    // All service details discovered — now drain the serialized initial GATT setup queue
    // (Device Info reads, 0xFEE3/0xFEE1 CCCD enables, Battery read) before emitting Connected.
    processGattOpQueue();
}

void BleWatchManager::advanceServiceDiscovery(QLowEnergyService *completedService) {
    if (m_discoveringService == completedService) {
        m_serviceDiscoveryTimer.stop();
        m_discoveringService = nullptr;
        QTimer::singleShot(35, this, &BleWatchManager::discoverNextService);
    }
}

void BleWatchManager::onServiceDiscoveryTimeout() {
    if (m_discoveringService) {
        emit packetLogged(QStringLiteral("system"),
                          tr("Service Detail Timeout"),
                          QStringLiteral("-"),
                          m_discoveringService->serviceUuid().toString(QUuid::WithoutBraces),
                          0,
                          QStringLiteral("error"));
        m_discoveringService = nullptr;
    }
    discoverNextService();
}

void BleWatchManager::onDeviceInfoServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_deviceInfoService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_deviceInfoService) {
        return;
    }
    const QList<QPair<QBluetoothUuid, QString>> charsToRead = {
        { GattUuids::CharManufacturerName, tr("Read Manufacturer") },
        { GattUuids::CharModelNumber,      tr("Read Model Number") },
        { GattUuids::CharFirmwareRevision, tr("Read Firmware Rev") },
        { GattUuids::CharHardwareRevision, tr("Read Hardware Rev") }
    };
    for (const auto &entry : charsToRead) {
        const auto ch = m_deviceInfoService->characteristic(entry.first);
        if (ch.isValid()) {
            enqueueReadChar(m_deviceInfoService, ch, entry.second);
        }
    }
    advanceServiceDiscovery(m_deviceInfoService);
}

void BleWatchManager::onFeeaServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_feeaService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_feeaService) {
        return;
    }

    m_activityChar = m_feeaService->characteristic(GattUuids::CharActivity);
    m_dataOutChar = m_feeaService->characteristic(GattUuids::CharDataOut);
    if (!m_dataOutChar.isValid()) {
        m_dataOutChar = m_feeaService->characteristic(GattUuids::CharDataOutAlt);
    }
    m_dataInChar = m_feeaService->characteristic(GattUuids::CharDataIn);

    QStringList charSummary;
    const auto chars = m_feeaService->characteristics();
    for (const auto &ch : chars) {
        QStringList props;
        if (ch.properties() & QLowEnergyCharacteristic::Read) props << QStringLiteral("R");
        if (ch.properties() & QLowEnergyCharacteristic::Write) props << QStringLiteral("W");
        if (ch.properties() & QLowEnergyCharacteristic::WriteNoResponse) props << QStringLiteral("WNR");
        if (ch.properties() & QLowEnergyCharacteristic::Notify) props << QStringLiteral("N");
        if (ch.properties() & QLowEnergyCharacteristic::Indicate) props << QStringLiteral("I");
        charSummary << QStringLiteral("%1[%2]")
            .arg(ch.uuid().toString(QUuid::WithoutBraces).left(8), props.join(QStringLiteral(",")));

        if (!m_dataOutChar.isValid()
            && (ch.properties() & (QLowEnergyCharacteristic::Write | QLowEnergyCharacteristic::WriteNoResponse))) {
            m_dataOutChar = ch;
        }
        if (!m_dataInChar.isValid()
            && ch.uuid() != GattUuids::CharActivity
            && (ch.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate))) {
            m_dataInChar = ch;
        }
    }

    emit packetLogged(QStringLiteral("system"),
                      tr("0xFEEA Characteristics"),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      charSummary.join(QStringLiteral(" ")),
                      0,
                      QStringLiteral("ack"));

    if (m_dataInChar.isValid()) {
        enqueueSubscribeToNotify(m_feeaService, m_dataInChar, tr("Enable 0xFEE3 Notify"));
    }
    if (m_activityChar.isValid()) {
        if (m_activityChar.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate)) {
            enqueueSubscribeToNotify(m_feeaService, m_activityChar, tr("Enable 0xFEE1 Notify"));
        }
        if (m_activityChar.properties() & QLowEnergyCharacteristic::Read) {
            enqueueReadChar(m_feeaService, m_activityChar, tr("Read Activity (0xFEE1)"));
        }
    }

    // Subscribe to any additional Notify characteristics inside 0xFEEA so no watch telemetry is missed
    for (const auto &ch : chars) {
        if (ch.uuid() != m_dataInChar.uuid()
            && ch.uuid() != m_activityChar.uuid()
            && (ch.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate))) {
            enqueueSubscribeToNotify(m_feeaService, ch, tr("Enable 0xFEEA Aux Notify"));
        }
    }

    advanceServiceDiscovery(m_feeaService);
}

void BleWatchManager::onBatteryServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_batteryService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_batteryService) {
        return;
    }
    m_batteryChar = m_batteryService->characteristic(GattUuids::CharBatteryLevel);
    if (m_batteryChar.isValid()) {
        enqueueReadChar(m_batteryService, m_batteryChar, tr("Read Battery"));
        if (m_batteryChar.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate)) {
            enqueueSubscribeToNotify(m_batteryService, m_batteryChar, tr("Enable Battery Notify"));
        }
    }
    advanceServiceDiscovery(m_batteryService);
}

void BleWatchManager::onImmediateAlertServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_immediateAlertService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_immediateAlertService) {
        return;
    }
    m_alertLevelChar = m_immediateAlertService->characteristic(GattUuids::CharAlertLevel);
    advanceServiceDiscovery(m_immediateAlertService);
}

void BleWatchManager::onHeartRateServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_heartRateService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_heartRateService) {
        return;
    }
    m_heartRateChar = m_heartRateService->characteristic(GattUuids::CharHeartRateMeasurement);
    if (m_heartRateChar.isValid()
        && (m_heartRateChar.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate))) {
        enqueueSubscribeToNotify(m_heartRateService, m_heartRateChar, tr("Enable HR Notify"));
    }
    advanceServiceDiscovery(m_heartRateService);
}

void BleWatchManager::onPulseOximeterServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_pulseOximeterService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_pulseOximeterService) {
        return;
    }
    m_spo2Char = m_pulseOximeterService->characteristic(GattUuids::CharPlxContinuous);
    if (!m_spo2Char.isValid()) {
        m_spo2Char = m_pulseOximeterService->characteristic(GattUuids::CharPlxSpotCheck);
    }
    if (m_spo2Char.isValid()
        && (m_spo2Char.properties() & (QLowEnergyCharacteristic::Notify | QLowEnergyCharacteristic::Indicate))) {
        enqueueSubscribeToNotify(m_pulseOximeterService, m_spo2Char, tr("Enable SpO2 Notify"));
    }
    advanceServiceDiscovery(m_pulseOximeterService);
}

void BleWatchManager::onAlertNotificationServiceStateChanged(QLowEnergyService::ServiceState newState) {
    if (newState == QLowEnergyService::InvalidService) {
        advanceServiceDiscovery(m_alertNotificationService);
        return;
    }
    if (newState != QLowEnergyService::RemoteServiceDiscovered || !m_alertNotificationService) {
        return;
    }
    m_newAlertChar = m_alertNotificationService->characteristic(GattUuids::CharNewAlert);
    if (m_newAlertChar.isValid()) {
        emit packetLogged(QStringLiteral("system"),
                          tr("Alert Notification Service (0x1811)"),
                          QStringLiteral("BLE ANS"),
                          QStringLiteral("0x2A46 New Alert ready"),
                          0,
                          QStringLiteral("ack"));
        emit protocolChanged();
    }
    advanceServiceDiscovery(m_alertNotificationService);
}

void BleWatchManager::enqueueReadChar(QLowEnergyService *service,
                                      const QLowEnergyCharacteristic &characteristic,
                                      const QString &label) {
    if (!service || !characteristic.isValid()) {
        return;
    }
    GattOp op;
    op.type = GattOp::Type::ReadChar;
    op.service = service;
    op.characteristic = characteristic;
    op.label = label;
    op.postDelayMs = 35;
    m_gattOpQueue.enqueue(op);

    if (!m_initializingGatt && !m_gattOpInFlight && !m_gattOpTimer.isActive()) {
        processGattOpQueue();
    }
}

void BleWatchManager::enqueueSubscribeToNotify(QLowEnergyService *service,
                                               const QLowEnergyCharacteristic &characteristic,
                                               const QString &label) {
    if (!service || !characteristic.isValid()) {
        return;
    }
    const auto cccd = characteristic.descriptor(QBluetoothUuid::DescriptorType::ClientCharacteristicConfiguration);
    if (!cccd.isValid()) {
        return;
    }
    const bool supportsNotify = (characteristic.properties() & QLowEnergyCharacteristic::Notify) != 0;
    const QByteArray enableValue = supportsNotify ? QByteArray::fromHex("0100") : QByteArray::fromHex("0200");

    GattOp op;
    op.type = GattOp::Type::WriteDescriptor;
    op.service = service;
    op.characteristic = characteristic;
    op.descriptor = cccd;
    op.value = enableValue;
    op.label = label;
    op.postDelayMs = 40;
    m_gattOpQueue.enqueue(op);

    if (!m_initializingGatt && !m_gattOpInFlight && !m_gattOpTimer.isActive()) {
        processGattOpQueue();
    }
}

void BleWatchManager::processGattOpQueue() {
    if (m_gattOpInFlight || m_gattOpTimer.isActive()) {
        return;
    }

    while (!m_gattOpQueue.isEmpty()) {
        GattOp op = m_gattOpQueue.dequeue();
        if (!op.service) {
            continue;
        }

        m_activeGattOp = op;
        m_gattOpInFlight = true;

        if (op.type == GattOp::Type::ReadChar) {
            if (!op.characteristic.isValid()) {
                finishActiveGattOp(10);
                return;
            }
            m_gattOpTimeoutTimer.start(1500);
            op.service->readCharacteristic(op.characteristic);
            return;
        }

        if (op.type == GattOp::Type::WriteDescriptor) {
            if (!op.descriptor.isValid()) {
                finishActiveGattOp(10);
                return;
            }
            m_gattOpTimeoutTimer.start(1500);
            op.service->writeDescriptor(op.descriptor, op.value);
            return;
        }

        if (op.type == GattOp::Type::WriteChar) {
            if (!op.characteristic.isValid()) {
                finishActiveGattOp(10);
                return;
            }
            if (op.writeMode == QLowEnergyService::WriteWithResponse) {
                // Per protocol spec, the write-success notification arrives AFTER the watch emits its 0xFEE3 responses.
                m_gattOpTimeoutTimer.start(3000);
                op.service->writeCharacteristic(op.characteristic, op.value, QLowEnergyService::WriteWithResponse);
            } else {
                op.service->writeCharacteristic(op.characteristic, op.value, QLowEnergyService::WriteWithoutResponse);
                finishActiveGattOp(op.postDelayMs);
            }
            return;
        }
    }

    // Queue drained: if initial GATT discovery + setup just finished, transition to Connected!
    if (m_initializingGatt) {
        m_initializingGatt = false;
        const auto activeVer = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
        emit packetLogged(QStringLiteral("system"),
                          tr("GATT Ready"),
                          FeeaCodec::versionLabel(activeVer),
                          m_dataOutChar.isValid() ? tr("TX 0xFEE2 ready") : tr("TX characteristic unavailable"),
                          0,
                          m_dataOutChar.isValid() ? QStringLiteral("ack") : QStringLiteral("error"));
        setState(ConnectionState::Connected);
    }
}

void BleWatchManager::finishActiveGattOp(int delayMs) {
    m_gattOpTimeoutTimer.stop();
    m_gattOpInFlight = false;
    const int wait = std::max(10, delayMs);
    m_gattOpTimer.start(wait);
}

void BleWatchManager::onGattOpTimeout() {
    if (!m_gattOpInFlight) {
        return;
    }
    emit packetLogged(QStringLiteral("system"),
                      tr("GATT Op Timeout: %1").arg(m_activeGattOp.label),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      FeeaCodec::toHexString(m_activeGattOp.value),
                      0,
                      QStringLiteral("error"));
    finishActiveGattOp(30);
}

void BleWatchManager::onCharacteristicWritten(const QLowEnergyCharacteristic &characteristic, const QByteArray &value) {
    Q_UNUSED(value)
    if (m_gattOpInFlight
        && m_activeGattOp.type == GattOp::Type::WriteChar
        && m_activeGattOp.characteristic.uuid() == characteristic.uuid()) {
        finishActiveGattOp(m_activeGattOp.postDelayMs);
    }
}

void BleWatchManager::onDescriptorWritten(const QLowEnergyDescriptor &descriptor, const QByteArray &value) {
    Q_UNUSED(descriptor)
    Q_UNUSED(value)
    if (m_gattOpInFlight && m_activeGattOp.type == GattOp::Type::WriteDescriptor) {
        finishActiveGattOp(m_activeGattOp.postDelayMs);
    }
}

void BleWatchManager::onServiceError(QLowEnergyService::ServiceError error) {
    if (error == QLowEnergyService::NoError) {
        return;
    }
    emit packetLogged(QStringLiteral("system"),
                      tr("GATT Error (%1)").arg(static_cast<int>(error)),
                      FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                      m_activeGattOp.label,
                      0,
                      QStringLiteral("error"));
    if (m_gattOpInFlight) {
        finishActiveGattOp(40);
    }
}

void BleWatchManager::handleParsedHealth(const ParsedHealthPacket &parsed) {
    if (!parsed.valid) {
        return;
    }
    if (parsed.hasSteps) {
        emit activityDataReceived(parsed.dayOffset, parsed.steps, parsed.distanceMeters);
    }
    if (parsed.hasHeartRate) {
        emit heartRateReceived(parsed.heartRateBpm);
    }
    if (parsed.hasSpo2) {
        emit spo2Received(parsed.spo2Percent);
    }
    if (parsed.hasBloodPressure) {
        emit bloodPressureReceived(parsed.systolicMmHg, parsed.diastolicMmHg);
    }
    if (parsed.hasBattery && parsed.batteryPercent >= 0 && parsed.batteryPercent <= 100) {
        m_batteryLevel = parsed.batteryPercent;
        emit batteryLevelChanged(m_batteryLevel);
    }
}

void BleWatchManager::onCharacteristicRead(const QLowEnergyCharacteristic &characteristic, const QByteArray &value) {
    if (characteristic.uuid() == GattUuids::CharBatteryLevel && !value.isEmpty()) {
        m_batteryLevel = static_cast<uint8_t>(value.at(0));
        emit batteryLevelChanged(m_batteryLevel);
    } else if (characteristic.uuid() == GattUuids::CharActivity) {
        emit packetLogged(QStringLiteral("rx"),
                          tr("Activity Telemetry (0xFEE1)"),
                          FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                          FeeaCodec::toHexString(value),
                          1,
                          QStringLiteral("ack"));
        handleParsedHealth(FeeaCodec::parseFee1Activity(value));
    } else {
        QByteArray cleaned = value;
        cleaned.replace('\0', QByteArray());
        const QString text = QString::fromUtf8(cleaned).trimmed();
        if (characteristic.uuid() == GattUuids::CharManufacturerName) {
            m_deviceInfo[QStringLiteral("manufacturer")] = text;
            m_detectedProtocol = FeeaCodec::detectFromManufacturer(text);
            emit protocolChanged();
            emit deviceInfoChanged();
        } else if (characteristic.uuid() == GattUuids::CharModelNumber) {
            m_deviceInfo[QStringLiteral("model")] = text;
            emit deviceInfoChanged();
        } else if (characteristic.uuid() == GattUuids::CharFirmwareRevision) {
            m_deviceInfo[QStringLiteral("firmware")] = text;
            emit deviceInfoChanged();
        } else if (characteristic.uuid() == GattUuids::CharHardwareRevision) {
            m_deviceInfo[QStringLiteral("hardware")] = text;
            emit deviceInfoChanged();
        }
    }

    if (m_gattOpInFlight
        && m_activeGattOp.type == GattOp::Type::ReadChar
        && m_activeGattOp.characteristic.uuid() == characteristic.uuid()) {
        finishActiveGattOp(m_activeGattOp.postDelayMs);
    }
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

    if (characteristic.uuid() == GattUuids::CharActivity) {
        emit packetLogged(QStringLiteral("rx"),
                          tr("Activity Update (0xFEE1)"),
                          FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref)),
                          FeeaCodec::toHexString(value),
                          1,
                          QStringLiteral("ack"));
        handleParsedHealth(FeeaCodec::parseFee1Activity(value));
        return;
    }

    // Auto-learn V1 vs V2 from the watch's own 0xFE 0xEA frame header if not already known
    const auto frameVer = FeeaCodec::detectFromIncomingFrame(value);
    if (frameVer != ProtocolVersion::Unknown && m_detectedProtocol == ProtocolVersion::Unknown) {
        m_detectedProtocol = frameVer;
        emit protocolChanged();
    }

    const QString protoLabel = FeeaCodec::versionLabel(FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref));

    // Reassemble multi-chunk 0xFEEA frames (and handle multiple frames arriving in one notify)
    const int expLen = FeeaCodec::expectedFrameLength(value);
    if (expLen > 0) {
        m_rxAssemblyBuffer = value;
        m_rxExpectedLength = expLen;
    } else if (!m_rxAssemblyBuffer.isEmpty() && m_rxExpectedLength > 0) {
        m_rxAssemblyBuffer.append(value);
    } else {
        emit packetLogged(QStringLiteral("rx"),
                          FeeaCodec::describeIncomingFrame(value),
                          protoLabel,
                          FeeaCodec::toHexString(value),
                          1,
                          QStringLiteral("ack"));
        handleParsedHealth(FeeaCodec::parseFeeaHealthResponse(value));
        return;
    }

    while (m_rxExpectedLength > 0 && m_rxAssemblyBuffer.size() >= m_rxExpectedLength) {
        const QByteArray completeFrame = m_rxAssemblyBuffer.left(m_rxExpectedLength);
        m_rxAssemblyBuffer.remove(0, m_rxExpectedLength);
        m_rxExpectedLength = FeeaCodec::expectedFrameLength(m_rxAssemblyBuffer);
        if (m_rxExpectedLength < 0) {
            m_rxAssemblyBuffer.clear();
            m_rxExpectedLength = 0;
        }

        emit packetLogged(QStringLiteral("rx"),
                          FeeaCodec::describeIncomingFrame(completeFrame),
                          protoLabel,
                          FeeaCodec::toHexString(completeFrame),
                          1,
                          QStringLiteral("ack"));
        handleParsedHealth(FeeaCodec::parseFeeaHealthResponse(completeFrame));
    }
}

bool BleWatchManager::enqueuePacket(const QByteArray &packet, const QString &actionLabel) {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Watch is not connected or 0xFEE2 write characteristic is unavailable."));
        return false;
    }

    const bool supportsWrite = (m_dataOutChar.properties() & QLowEnergyCharacteristic::Write) != 0;
    const bool supportsWriteNoResp = (m_dataOutChar.properties() & QLowEnergyCharacteristic::WriteNoResponse) != 0;
    const auto mode = (m_preferWriteNoResponse && supportsWriteNoResp)
        ? QLowEnergyService::WriteWithoutResponse
        : (supportsWrite ? QLowEnergyService::WriteWithResponse : QLowEnergyService::WriteWithoutResponse);

    const auto activeVersion = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const auto chunks = FeeaCodec::chunkPacket(packet, m_mtuSize);
    for (int i = 0; i < chunks.size(); ++i) {
        GattOp op;
        op.type = GattOp::Type::WriteChar;
        op.service = m_feeaService;
        op.characteristic = m_dataOutChar;
        op.value = chunks.at(i);
        op.writeMode = mode;
        op.label = actionLabel;
        op.postDelayMs = (i + 1 < chunks.size()) ? std::min(m_writeDelayMs, 20) : m_writeDelayMs;
        m_gattOpQueue.enqueue(op);
    }

    emit packetLogged(QStringLiteral("tx"),
                      actionLabel,
                      FeeaCodec::versionLabel(activeVersion),
                      FeeaCodec::toHexString(packet),
                      chunks.size(),
                      QStringLiteral("sent"));

    if (!m_gattOpInFlight && !m_gattOpTimer.isActive()) {
        processGattOpQueue();
    }
    return true;
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

bool BleWatchManager::sendNotification(WatchAppIcon icon,
                                       const QString &title,
                                       const QString &body,
                                       int formatOverride) {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const int maxTextBytes = FeeaCodec::maxNotificationTextBytes(
        version,
        m_deviceInfo.value(QStringLiteral("firmware")).toString()
    );
    const auto activeFormat = (formatOverride >= 0 && formatOverride < NotificationFormatCount)
        ? static_cast<NotificationFormat>(formatOverride)
        : m_notificationFormat;
    const QByteArray packet = FeeaCodec::encodeNotification(
        version, icon, title, body, maxTextBytes, activeFormat
    );
    const QString label = (formatOverride >= 0 && formatOverride < NotificationFormatCount)
        ? tr("Formula #%1 (0x64)").arg(formatOverride + 1)
        : tr("Push Notification (0x64)");
    const bool sent = enqueuePacket(packet, label);

    // Also push via standard BLE Alert Notification Service (0x1811 / 0x2A46) if the watch exposes it
    if (sent && formatOverride <= 0 && m_alertNotificationService && m_newAlertChar.isValid()
        && (m_newAlertChar.properties() & (QLowEnergyCharacteristic::Write | QLowEnergyCharacteristic::WriteNoResponse))) {
        const QByteArray ansPayload = FeeaCodec::encodeStandardNewAlert(icon, title, body);
        GattOp op;
        op.type = GattOp::Type::WriteChar;
        op.service = m_alertNotificationService;
        op.characteristic = m_newAlertChar;
        op.value = ansPayload;
        op.writeMode = (m_newAlertChar.properties() & QLowEnergyCharacteristic::WriteNoResponse)
            ? QLowEnergyService::WriteWithoutResponse
            : QLowEnergyService::WriteWithResponse;
        op.label = tr("BLE New Alert (0x2A46)");
        op.postDelayMs = 40;
        m_gattOpQueue.enqueue(op);
        emit packetLogged(QStringLiteral("tx"),
                          tr("BLE New Alert (0x2A46)"),
                          QStringLiteral("BLE ANS"),
                          FeeaCodec::toHexString(ansPayload),
                          1,
                          QStringLiteral("sent"));
        if (!m_gattOpInFlight && !m_gattOpTimer.isActive()) {
            processGattOpQueue();
        }
    }
    return sent;
}

bool BleWatchManager::sendFindWatch() {
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    const QByteArray packet = FeeaCodec::encodeFindWatch(version);
    const bool sent = enqueuePacket(packet, tr("Find Watch"));

    // Also ping standard BLE Immediate Alert (0x1802) through the serialized GATT queue if present
    if (m_immediateAlertService && m_alertLevelChar.isValid()) {
        GattOp op;
        op.type = GattOp::Type::WriteChar;
        op.service = m_immediateAlertService;
        op.characteristic = m_alertLevelChar;
        op.value = QByteArray(1, static_cast<char>(0x02));
        op.writeMode = (m_alertLevelChar.properties() & QLowEnergyCharacteristic::WriteNoResponse)
            ? QLowEnergyService::WriteWithoutResponse
            : QLowEnergyService::WriteWithResponse;
        op.label = tr("Immediate Alert");
        op.postDelayMs = 40;
        m_gattOpQueue.enqueue(op);
        if (!m_gattOpInFlight && !m_gattOpTimer.isActive()) {
            processGattOpQueue();
        }
    }
    return sent;
}

void BleWatchManager::refreshBattery() {
    if (m_batteryService && m_batteryChar.isValid()) {
        enqueueReadChar(m_batteryService, m_batteryChar, tr("Refresh Battery"));
    }
}

bool BleWatchManager::requestHealthSync() {
    if (m_state != ConnectionState::Connected || !m_feeaService) {
        emit errorOccurred(tr("Connect a watch before refreshing steps and distance."));
        return false;
    }

    bool sentAny = false;
    // 1. Read live steps/distance characteristic (0xFEE1) if exposed as readable
    if (m_activityChar.isValid() && (m_activityChar.properties() & QLowEnergyCharacteristic::Read)) {
        enqueueReadChar(m_feeaService, m_activityChar, tr("Read Steps & Distance (0xFEE1)"));
        sentAny = true;
    }

    // 2. Query today's steps & distance via 0x81 (empty-payload get request)
    if (m_dataOutChar.isValid()) {
        const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
        if (enqueuePacket(FeeaCodec::encodeGetTodayActivity(version), tr("Get Steps & Distance (0x81)"))) {
            sentAny = true;
        }
    }

    if (!sentAny) {
        emit errorOccurred(tr("Watch does not expose 0xFEE1 or 0xFEE2 for steps and distance."));
    }
    return sentAny;
}

bool BleWatchManager::requestHeartRateReading() {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Connect a watch before measuring heart rate."));
        return false;
    }
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    return enqueuePacket(FeeaCodec::encodeMeasureHeartRate(version), tr("Measure Heart Rate (0x6D)"));
}

bool BleWatchManager::requestSpo2Reading() {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Connect a watch before measuring SpO2."));
        return false;
    }
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    return enqueuePacket(FeeaCodec::encodeMeasureSpo2(version), tr("Measure SpO2 (0x6B)"));
}

bool BleWatchManager::requestBloodPressureReading() {
    if (m_state != ConnectionState::Connected || !m_feeaService || !m_dataOutChar.isValid()) {
        emit errorOccurred(tr("Connect a watch before measuring blood pressure."));
        return false;
    }
    const auto version = FeeaCodec::resolveVersion(m_detectedProtocol, m_protocolPref);
    return enqueuePacket(FeeaCodec::encodeMeasureBloodPressure(version), tr("Measure Blood Pressure (0x69)"));
}

} // namespace fitlink
