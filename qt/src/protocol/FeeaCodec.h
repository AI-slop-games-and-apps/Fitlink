#pragma once

#include <QByteArray>
#include <QDateTime>
#include <QList>
#include <QString>
#include <QBluetoothUuid>
#include <cstdint>

namespace fitlink {

enum class ProtocolVersion {
    Unknown = 0,
    V1 = 1, // Legacy 0xFEEA V1 framing: 0xFE 0xEA 0x10 <len> <cmd> <payload...>
    V2 = 2  // Modern 0xFEEA V2 framing: 0xFE 0xEA <len_lo> <len_hi> <cmd> <payload...>
};

enum class ProtocolPreference {
    Auto = 0,
    ForceV2 = 1,
    ForceV1 = 2
};

// Standard 0xFEEA BLE notification source icon IDs
enum class WatchAppIcon : uint8_t {
    IncomingCall = 0x00,
    Sms          = 0x01,
    WeChat       = 0x02,
    QQ           = 0x03,
    Facebook     = 0x04,
    TwitterX     = 0x05,
    WhatsApp     = 0x06,
    Line         = 0x07,
    Instagram    = 0x08,
    Skype        = 0x09,
    KakaoTalk    = 0x0A,
    Gmail        = 0x0B,
    Telegram     = 0x0C,
    Slack        = 0x0D,
    Calendar     = 0x0E,
    GenericOther = 0x0F
};

namespace GattUuids {
inline const QBluetoothUuid ServiceFeea(QStringLiteral("0000feea-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataOut(QStringLiteral("0000fee2-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataIn(QStringLiteral("0000fee3-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataOutAlt(QStringLiteral("0000fee5-0000-1000-8000-00805f9b34fb"));

inline const QBluetoothUuid ServiceBattery(QBluetoothUuid::ServiceClassUuid::BatteryService);
inline const QBluetoothUuid CharBatteryLevel(QBluetoothUuid::CharacteristicType::BatteryLevel);

inline const QBluetoothUuid ServiceDeviceInfo(QBluetoothUuid::ServiceClassUuid::DeviceInformation);
inline const QBluetoothUuid CharManufacturerName(QBluetoothUuid::CharacteristicType::ManufacturerNameString);
inline const QBluetoothUuid CharModelNumber(QBluetoothUuid::CharacteristicType::ModelNumberString);
inline const QBluetoothUuid CharFirmwareRevision(QBluetoothUuid::CharacteristicType::FirmwareRevisionString);
inline const QBluetoothUuid CharHardwareRevision(QBluetoothUuid::CharacteristicType::HardwareRevisionString);

inline const QBluetoothUuid ServiceImmediateAlert(QBluetoothUuid::ServiceClassUuid::ImmediateAlert);
inline const QBluetoothUuid CharAlertLevel(QBluetoothUuid::CharacteristicType::AlertLevel);

inline const QBluetoothUuid ServiceHeartRate(QBluetoothUuid::ServiceClassUuid::HeartRate);
inline const QBluetoothUuid CharHeartRateMeasurement(QBluetoothUuid::CharacteristicType::HeartRateMeasurement);

inline const QBluetoothUuid ServicePulseOximeter(static_cast<uint16_t>(0x1822));
inline const QBluetoothUuid CharPlxSpotCheck(static_cast<uint16_t>(0x2A5E));
inline const QBluetoothUuid CharPlxContinuous(static_cast<uint16_t>(0x2A5F));
} // namespace GattUuids

struct ParsedHealthPacket {
    bool valid = false;
    bool hasSteps = false;
    int steps = 0;
    bool hasDistanceMeters = false;
    int distanceMeters = 0;
    int dayOffset = 0; // 0 = today, 1 = yesterday, ...
    bool hasHeartRate = false;
    int heartRateBpm = 0;
    bool hasSpo2 = false;
    int spo2Percent = 0;
};

class FeeaCodec {
public:
    static constexpr uint8_t HeaderByte0 = 0xFE;
    static constexpr uint8_t HeaderByte1 = 0xEA;
    static constexpr uint8_t V1Marker    = 0x10;

    // Documented 0xFEEA BLE command opcodes
    static constexpr uint8_t CmdSetTimeFormat    = 0x27;
    static constexpr uint8_t CmdSetTime          = 0x31;
    static constexpr uint8_t CmdSyncActivity     = 0x51;
    static constexpr uint8_t CmdFindWatch        = 0x61;
    static constexpr uint8_t CmdPushNotification = 0x64;
    static constexpr uint8_t CmdSyncHeartRate    = 0x6B;
    static constexpr uint8_t CmdSyncSpo2         = 0x70;

    static ProtocolVersion detectFromManufacturer(const QString &manufacturerName);
    static ProtocolVersion resolveVersion(ProtocolVersion detected, ProtocolPreference pref);
    static QString versionLabel(ProtocolVersion version);

    static QByteArray framePacket(ProtocolVersion version, uint8_t command, const QByteArray &payload);
    static QByteArray encodeSyncTime(ProtocolVersion version, const QDateTime &dateTime, int utcOffsetMinutes);
    static QByteArray encodeTimeFormat(ProtocolVersion version, bool use24Hour);
    static QByteArray encodeNotification(ProtocolVersion version,
                                         WatchAppIcon icon,
                                         const QString &title,
                                         const QString &body,
                                         int maxUtf8Bytes = 128);
    static QByteArray encodeFindWatch(ProtocolVersion version);
    static QByteArray encodeSyncActivity(ProtocolVersion version, uint8_t dayOffset = 0);
    static QByteArray encodeSyncHeartRate(ProtocolVersion version);
    static QByteArray encodeSyncSpo2(ProtocolVersion version);

    static ParsedHealthPacket parseFeeaHealthResponse(const QByteArray &frame);
    static int parseStandardHeartRate(const QByteArray &value);
    static int parseStandardSpo2(const QByteArray &value);

    static QList<QByteArray> chunkPacket(const QByteArray &packet, int mtuSize = 20);
    static QString toHexString(const QByteArray &bytes);
    static WatchAppIcon mapAppNameToIcon(const QString &appIdOrName);
};

} // namespace fitlink
