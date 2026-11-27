#pragma once

#include <QByteArray>
#include <QDateTime>
#include <QList>
#include <QString>
#include <QStringList>
#include <QBluetoothUuid>
#include <cstdint>

namespace fitlink {

enum class ProtocolVersion {
    Unknown = 0,
    V1 = 1, // 0xFEEA V1 framing: 0xFE 0xEA [0x10 + len_hi] [len_lo] <cmd> <payload...>
    V2 = 2  // 0xFEEA V2 framing: 0xFE 0xEA [0x20 + len_hi] [len_lo] <cmd> <payload...>
};

enum class ProtocolPreference {
    Auto = 0,
    ForceV2 = 1,
    ForceV1 = 2
};

enum class NotificationFormat {
    Standard = 0,           // FE EA 20 LL 41 [icon] Title:Body
    Generic80 = 1,          // FE EA 20 LL 41 80 Title:Body
    HighBitIcon = 2,        // FE EA 20 LL 41 [icon|0x80] Title:Body
    V1FrameStandard = 3,    // FE EA 10 LL 41 [icon] Title:Body
    Legacy64Standard = 4,   // FE EA 20 LL 64 [icon] Title:Body
    Legacy64Generic80 = 5   // FE EA 20 LL 64 80 Title:Body
};

inline constexpr int NotificationFormatCount = 6;

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
    GenericOther = 0x0F,
    OtherAll     = 0x80
};

namespace GattUuids {
inline const QBluetoothUuid ServiceFeea(QStringLiteral("0000feea-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharActivity(QStringLiteral("0000fee1-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataOut(QStringLiteral("0000fee2-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataIn(QStringLiteral("0000fee3-0000-1000-8000-00805f9b34fb"));
inline const QBluetoothUuid CharDataOutAlt(QStringLiteral("0000fee5-0000-1000-8000-00805f9b34fb"));

inline const QBluetoothUuid ServiceBattery(QBluetoothUuid::ServiceClassUuid::BatteryService);
inline const QBluetoothUuid CharBatteryLevel(QBluetoothUuid::CharacteristicType::BatteryLevel);

inline const QBluetoothUuid ServiceDeviceInfo(QBluetoothUuid::ServiceClassUuid::DeviceInformation);
inline const QBluetoothUuid CharManufacturerName(QBluetoothUuid::CharacteristicType::ManufacturerNameString);
inline const QBluetoothUuid CharModelNumber(QBluetoothUuid::CharacteristicType::ModelNumberString);
inline const QBluetoothUuid CharSerialNumber(QBluetoothUuid::CharacteristicType::SerialNumberString);
inline const QBluetoothUuid CharFirmwareRevision(QBluetoothUuid::CharacteristicType::FirmwareRevisionString);
inline const QBluetoothUuid CharHardwareRevision(QBluetoothUuid::CharacteristicType::HardwareRevisionString);
inline const QBluetoothUuid CharSoftwareRevision(QBluetoothUuid::CharacteristicType::SoftwareRevisionString);

inline const QBluetoothUuid ServiceImmediateAlert(QBluetoothUuid::ServiceClassUuid::ImmediateAlert);
inline const QBluetoothUuid CharAlertLevel(QBluetoothUuid::CharacteristicType::AlertLevel);

inline const QBluetoothUuid ServiceHeartRate(QBluetoothUuid::ServiceClassUuid::HeartRate);
inline const QBluetoothUuid CharHeartRateMeasurement(QBluetoothUuid::CharacteristicType::HeartRateMeasurement);

inline const QBluetoothUuid ServicePulseOximeter(static_cast<uint16_t>(0x1822));
inline const QBluetoothUuid CharPlxSpotCheck(static_cast<uint16_t>(0x2A5E));
inline const QBluetoothUuid CharPlxContinuous(static_cast<uint16_t>(0x2A5F));

inline const QBluetoothUuid ServiceAlertNotification(static_cast<uint16_t>(0x1811));
inline const QBluetoothUuid CharNewAlert(static_cast<uint16_t>(0x2A46));
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
    bool hasBloodPressure = false;
    int systolicMmHg = 0;
    int diastolicMmHg = 0;
    bool hasBattery = false;
    int batteryPercent = -1;
    bool hasWatchAction = false;
    int watchActionCode = -1;
    bool hasManufacturer = false;
    QString manufacturer;
    bool hasFirmware = false;
    QString firmware;
};

class FeeaCodec {
public:
    static constexpr uint8_t HeaderByte0 = 0xFE;
    static constexpr uint8_t HeaderByte1 = 0xEA;
    static constexpr uint8_t V1Prefix    = 0x10;
    static constexpr uint8_t V2Prefix    = 0x20;

    // Documented 0xFEEA BLE command opcodes
    // Set/Get pairs follow get = set + 0x10 (e.g., 0x11/0x21, 0x27/0x37, 0x31/0x41)
    static constexpr uint8_t CmdSetAlarms         = 0x11;
    static constexpr uint8_t CmdGetAlarms         = 0x21;
    static constexpr uint8_t CmdSetTimeFormat     = 0x27;
    static constexpr uint8_t CmdGetTimeFormat     = 0x37;
    static constexpr uint8_t CmdSetTime           = 0x31;
    static constexpr uint8_t CmdPushNotification  = 0x41; // Verified 0xFEEA V2 push notification
    static constexpr uint8_t CmdGetDeviceInfo     = 0x5A; // Sub-cmd: 0x00 manufacturer/protocol, 0x01 firmware
    static constexpr uint8_t CmdFindWatch         = 0x61;
    static constexpr uint8_t CmdPushNotifLegacy   = 0x64;
    static constexpr uint8_t CmdWatchControl      = 0x67; // Watch-to-phone control events (0x03 = Reject Call)
    static constexpr uint8_t CmdMeasureBloodPress = 0x69; // 0x69 start / 0x6A stop Blood Pressure
    static constexpr uint8_t CmdStopBloodPress     = 0x6A;
    static constexpr uint8_t CmdMeasureSpo2        = 0x6B; // 0x6B start / 0x6C stop SpO2
    static constexpr uint8_t CmdStopSpo2           = 0x6C;
    static constexpr uint8_t CmdMeasureHeartRate   = 0x6D; // 0x6D start / 0x6E stop Heart Rate
    static constexpr uint8_t CmdStopHeartRate      = 0x6E;
    static constexpr uint8_t CmdGetTodayActivity   = 0x81; // Empty-payload steps/distance query
    static constexpr uint8_t CmdWorkout            = 0xB2; // sub-cmd: 0x00 list req, 0x01 list resp
    static constexpr uint8_t CmdAdvanced           = 0xB9; // sub-commands follow get = set + 0x10

    static constexpr uint8_t SubCmdDeviceInfoManufacturer = 0x00; // Verified TX: FE EA 20 06 5A 00
    static constexpr uint8_t SubCmdDeviceInfoFirmware     = 0x01; // Verified TX: FE EA 20 06 5A 01
    static constexpr uint8_t WatchActionRejectCall = 0x03; // Verified RX: FE EA 20 06 67 03
    static constexpr uint8_t SubCmdWorkoutListReq  = 0x00;
    static constexpr uint8_t SubCmdWorkoutListResp = 0x01;
    static constexpr uint8_t SubCmdAdvECard        = 0x12;

    static ProtocolVersion detectFromManufacturer(const QString &manufacturerName);
    static ProtocolVersion detectFromIncomingFrame(const QByteArray &frame);
    static ProtocolVersion resolveVersion(ProtocolVersion detected, ProtocolPreference pref);
    static QString versionLabel(ProtocolVersion version);
    static int maxPacketBytes(ProtocolVersion version, const QString &firmwareRevision = QString());
    static int maxNotificationTextBytes(ProtocolVersion version, const QString &firmwareRevision = QString());
    static int expectedFrameLength(const QByteArray &chunk);
    static uint8_t getCommandForSet(uint8_t setCommand) { return static_cast<uint8_t>(setCommand + 0x10); }
    static QString describeIncomingFrame(const QByteArray &frame);

    static QByteArray framePacket(ProtocolVersion version, uint8_t command, const QByteArray &payload);
    static QByteArray encodeGetCommand(ProtocolVersion version, uint8_t getCommand);
    static QByteArray encodeSubCommand(ProtocolVersion version, uint8_t command, const QByteArray &subPayload);
    static QByteArray encodeSyncTime(ProtocolVersion version, const QDateTime &dateTime, int utcOffsetMinutes);
    static QByteArray encodeTimeFormat(ProtocolVersion version, bool use24Hour);
    static QByteArray encodeNotification(ProtocolVersion version,
                                         WatchAppIcon icon,
                                         const QString &title,
                                         const QString &body,
                                         int maxUtf8Bytes = 128,
                                         NotificationFormat format = NotificationFormat::Standard);
    static QString notificationFormatLabel(NotificationFormat format);
    static QStringList notificationFormatLabels();
    static QByteArray encodeStandardNewAlert(WatchAppIcon icon,
                                             const QString &title,
                                             const QString &body);
    static QByteArray encodeFindWatch(ProtocolVersion version);
    static QByteArray encodeGetDeviceInfo(ProtocolVersion version, uint8_t subCmd);
    static QByteArray encodeGetTodayActivity(ProtocolVersion version);
    static QByteArray encodeMeasureHeartRate(ProtocolVersion version);
    static QByteArray encodeMeasureSpo2(ProtocolVersion version);
    static QByteArray encodeMeasureBloodPressure(ProtocolVersion version);
    static QByteArray encodeWorkoutListRequest(ProtocolVersion version);

    static ParsedHealthPacket parseFeeaHealthResponse(const QByteArray &frame);
    static ParsedHealthPacket parseFee1Activity(const QByteArray &value);
    static int parseStandardHeartRate(const QByteArray &value);
    static int parseStandardSpo2(const QByteArray &value);

    static QList<QByteArray> chunkPacket(const QByteArray &packet, int mtuSize = 20);
    static QString toHexString(const QByteArray &bytes);
    static WatchAppIcon mapAppNameToIcon(const QString &appIdOrName);
};

} // namespace fitlink
