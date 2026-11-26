#include "FeeaCodec.h"

#include <QRegularExpression>
#include <QtEndian>
#include <algorithm>
#include <cmath>

namespace fitlink {

namespace {

int readUint24BE(const QByteArray &buf, int offset) {
    return (static_cast<uint8_t>(buf.at(offset)) << 16)
        | (static_cast<uint8_t>(buf.at(offset + 1)) << 8)
        | static_cast<uint8_t>(buf.at(offset + 2));
}

int readUint24LE(const QByteArray &buf, int offset) {
    return static_cast<uint8_t>(buf.at(offset))
        | (static_cast<uint8_t>(buf.at(offset + 1)) << 8)
        | (static_cast<uint8_t>(buf.at(offset + 2)) << 16);
}

bool decodeStepsAndDistance(const QByteArray &buf, int offset, int &stepsOut, int &distOut) {
    if (buf.size() < offset + 3) {
        return false;
    }

    const int stepsBE = readUint24BE(buf, offset);
    const int stepsLE = readUint24LE(buf, offset);

    const bool beStepsOk = (stepsBE >= 0 && stepsBE <= 200000);
    const bool leStepsOk = (stepsLE >= 0 && stepsLE <= 200000);

    bool useBE = true;
    if (beStepsOk && !leStepsOk) {
        useBE = true;
    } else if (leStepsOk && !beStepsOk) {
        useBE = false;
    } else if (!beStepsOk && !leStepsOk) {
        return false;
    } else {
        bool decided = false;
        if (buf.size() >= offset + 6) {
            const int distBE = readUint24BE(buf, offset + 3);
            const int distLE = readUint24LE(buf, offset + 3);
            const bool beDistOk = (distBE >= 0 && distBE <= 250000);
            const bool leDistOk = (distLE >= 0 && distLE <= 250000);
            if (leDistOk && !beDistOk) {
                useBE = false;
                decided = true;
            } else if (beDistOk && !leDistOk) {
                useBE = true;
                decided = true;
            }
        }
        if (!decided && stepsLE != stepsBE) {
            useBE = (stepsBE < stepsLE);
        }
    }

    stepsOut = useBE ? stepsBE : stepsLE;

    if (buf.size() >= offset + 6) {
        const int dist = useBE ? readUint24BE(buf, offset + 3) : readUint24LE(buf, offset + 3);
        if (dist >= 0 && dist <= 250000) {
            distOut = (dist == 0 && stepsOut > 0) ? static_cast<int>(std::lround(stepsOut * 0.75)) : dist;
            return true;
        }
    }
    if (buf.size() >= offset + 5) {
        const int dist16 = useBE
            ? ((static_cast<uint8_t>(buf.at(offset + 3)) << 8) | static_cast<uint8_t>(buf.at(offset + 4)))
            : (static_cast<uint8_t>(buf.at(offset + 3)) | (static_cast<uint8_t>(buf.at(offset + 4)) << 8));
        distOut = (dist16 == 0 && stepsOut > 0) ? static_cast<int>(std::lround(stepsOut * 0.75)) : dist16;
        return true;
    }

    distOut = static_cast<int>(std::lround(stepsOut * 0.75));
    return true;
}

} // namespace

ProtocolVersion FeeaCodec::detectFromManufacturer(const QString &manufacturerName) {
    const QString normalized = manufacturerName.trimmed().toUpper();
    if (normalized.isEmpty()) {
        return ProtocolVersion::Unknown;
    }
    if (normalized.endsWith(QStringLiteral("-V2")) || normalized.contains(QStringLiteral("V2"))) {
        return ProtocolVersion::V2;
    }
    return ProtocolVersion::V1;
}

ProtocolVersion FeeaCodec::detectFromIncomingFrame(const QByteArray &frame) {
    if (frame.size() < 4) {
        return ProtocolVersion::Unknown;
    }
    if (static_cast<uint8_t>(frame.at(0)) != HeaderByte0
        || static_cast<uint8_t>(frame.at(1)) != HeaderByte1) {
        return ProtocolVersion::Unknown;
    }
    const uint8_t highNibble = static_cast<uint8_t>(frame.at(2)) & 0xF0;
    if (highNibble == V1Prefix) {
        return ProtocolVersion::V1;
    }
    if (highNibble == V2Prefix) {
        return ProtocolVersion::V2;
    }
    return ProtocolVersion::Unknown;
}

ProtocolVersion FeeaCodec::resolveVersion(ProtocolVersion detected, ProtocolPreference pref) {
    if (pref == ProtocolPreference::ForceV1) {
        return ProtocolVersion::V1;
    }
    if (pref == ProtocolPreference::ForceV2) {
        return ProtocolVersion::V2;
    }
    return (detected == ProtocolVersion::V1) ? ProtocolVersion::V1 : ProtocolVersion::V2;
}

QString FeeaCodec::versionLabel(ProtocolVersion version) {
    switch (version) {
    case ProtocolVersion::V1:
        return QStringLiteral("FEEA V1");
    case ProtocolVersion::V2:
        return QStringLiteral("FEEA V2");
    default:
        return QStringLiteral("Auto (V2 default)");
    }
}

int FeeaCodec::maxPacketBytes(ProtocolVersion version, const QString &firmwareRevision) {
    // V2 uses MTU-chunked variable-length packets (up to 12-bit 4095-byte frame limit).
    // V1 (non-MTU fixed-size mode) uses 256-byte packets for firmware >= 1.6.5, and 64 otherwise.
    if (version != ProtocolVersion::V1) {
        return 4095;
    }

    static const QRegularExpression semverRe(QStringLiteral(R"((\d+)\.(\d+)(?:\.(\d+))?)"));
    const auto match = semverRe.match(firmwareRevision);
    if (match.hasMatch()) {
        const int major = match.captured(1).toInt();
        const int minor = match.captured(2).toInt();
        const int patch = match.captured(3).isEmpty() ? 0 : match.captured(3).toInt();
        if (major > 1 || (major == 1 && (minor > 6 || (minor == 6 && patch >= 5)))) {
            return 256;
        }
    }
    return 64;
}

int FeeaCodec::maxNotificationTextBytes(ProtocolVersion version, const QString &firmwareRevision) {
    // Notification frame overhead = 5 (header + size + cmd) + 1 (iconId) = 6 bytes
    const int packetLimit = maxPacketBytes(version, firmwareRevision);
    return std::clamp(packetLimit - 6, 16, 128);
}

int FeeaCodec::expectedFrameLength(const QByteArray &chunk) {
    if (chunk.size() < 4) {
        return -1;
    }
    if (static_cast<uint8_t>(chunk.at(0)) != HeaderByte0
        || static_cast<uint8_t>(chunk.at(1)) != HeaderByte1) {
        return -1;
    }
    const uint8_t b2 = static_cast<uint8_t>(chunk.at(2));
    const uint8_t b3 = static_cast<uint8_t>(chunk.at(3));
    const uint8_t prefix = b2 & 0xF0;
    if (prefix == V1Prefix || prefix == V2Prefix) {
        const int len = ((b2 & 0x0F) << 8) | b3;
        return (len >= 5 && len <= 4095) ? len : -1;
    }
    return -1;
}

QString FeeaCodec::describeIncomingFrame(const QByteArray &frame) {
    if (frame.size() < 5
        || static_cast<uint8_t>(frame.at(0)) != HeaderByte0
        || static_cast<uint8_t>(frame.at(1)) != HeaderByte1) {
        return QStringLiteral("Watch Response");
    }
    const uint8_t cmd = static_cast<uint8_t>(frame.at(4));
    const QString hexCmd = QStringLiteral("0x%1").arg(cmd, 2, 16, QLatin1Char('0')).toUpper();
    if (cmd == CmdGetTime) return QStringLiteral("Time Response (%1)").arg(hexCmd);
    if (cmd == CmdGetTimeFormat) return QStringLiteral("Time Format (%1)").arg(hexCmd);
    if (cmd == CmdGetAlarms) return QStringLiteral("Alarms (%1)").arg(hexCmd);
    if (cmd == CmdGetTodayActivity) return QStringLiteral("Steps & Distance (%1)").arg(hexCmd);
    if (cmd == CmdMeasureBloodPress || cmd == CmdStopBloodPress) return QStringLiteral("Blood Pressure (%1)").arg(hexCmd);
    if (cmd == CmdMeasureSpo2 || cmd == CmdStopSpo2) return QStringLiteral("SpO2 (%1)").arg(hexCmd);
    if (cmd == CmdMeasureHeartRate || cmd == CmdStopHeartRate || cmd == 0x6F || cmd == 0x67) return QStringLiteral("Heart Rate (%1)").arg(hexCmd);
    if (cmd == CmdWorkout && frame.size() >= 6) {
        const uint8_t sub = static_cast<uint8_t>(frame.at(5));
        return QStringLiteral("Workout (%1 %2)").arg(hexCmd, QStringLiteral("%1").arg(sub, 2, 16, QLatin1Char('0')).toUpper());
    }
    if (cmd == CmdAdvanced && frame.size() >= 6) {
        const uint8_t sub = static_cast<uint8_t>(frame.at(5));
        return QStringLiteral("Advanced (%1 %2)").arg(hexCmd, QStringLiteral("%1").arg(sub, 2, 16, QLatin1Char('0')).toUpper());
    }
    return QStringLiteral("Watch Response (%1)").arg(hexCmd);
}

QByteArray FeeaCodec::framePacket(ProtocolVersion version, uint8_t command, const QByteArray &payload) {
    // Verified 0xFEEA wire format:
    //   V1: [0xFE] [0xEA] [0x10 + size_hi] [size_lo] [cmd] [payload...]
    //   V2: [0xFE] [0xEA] [0x20 + size_hi] [size_lo] [cmd] [payload...]
    // Total size includes UUID (2), size (2), command (1), and payload (N) => min 5 bytes.
    const uint16_t totalLen = static_cast<uint16_t>(std::min<qsizetype>(4095, 5 + payload.size()));
    const uint8_t versionPrefix = (version == ProtocolVersion::V1) ? V1Prefix : V2Prefix;
    const uint8_t sizeHi = static_cast<uint8_t>(versionPrefix + ((totalLen >> 8) & 0x0F));
    const uint8_t sizeLo = static_cast<uint8_t>(totalLen & 0xFF);

    QByteArray out;
    out.reserve(totalLen);
    out.append(static_cast<char>(HeaderByte0));
    out.append(static_cast<char>(HeaderByte1));
    out.append(static_cast<char>(sizeHi));
    out.append(static_cast<char>(sizeLo));
    out.append(static_cast<char>(command));
    out.append(payload);
    return out;
}

QByteArray FeeaCodec::encodeGetCommand(ProtocolVersion version, uint8_t getCommand) {
    // Get requests carry no payload (totalLen = 5); watch responds with same cmd + payload.
    return framePacket(version, getCommand, QByteArray());
}

QByteArray FeeaCodec::encodeSubCommand(ProtocolVersion version, uint8_t command, const QByteArray &subPayload) {
    return framePacket(version, command, subPayload);
}

QByteArray FeeaCodec::encodeSyncTime(ProtocolVersion version, const QDateTime &dateTime, int utcOffsetMinutes) {
    // Verified 0x31 payload (5 bytes, totalLen = 10 / 0x0A):
    //   [epochSec BE (4 bytes)] [tzHours signed int8 (1 byte)]
    // For fractional-hour timezones (e.g., UTC+5:30), fold the minute remainder into epochSec
    // so the watch displays exact local time while preserving the strict 10-byte wire frame.
    const int tzHoursInt = std::clamp(utcOffsetMinutes / 60, -12, 14);
    const int remainderMinutes = utcOffsetMinutes - (tzHoursInt * 60);
    const qint64 adjustedEpoch = dateTime.toSecsSinceEpoch() + static_cast<qint64>(remainderMinutes) * 60;
    const uint32_t epochSec = static_cast<uint32_t>(std::max<qint64>(0, adjustedEpoch));
    const int8_t tzHours = static_cast<int8_t>(tzHoursInt);

    QByteArray payload;
    payload.reserve(5);
    payload.append(static_cast<char>((epochSec >> 24) & 0xFF));
    payload.append(static_cast<char>((epochSec >> 16) & 0xFF));
    payload.append(static_cast<char>((epochSec >> 8) & 0xFF));
    payload.append(static_cast<char>(epochSec & 0xFF));
    payload.append(static_cast<char>(tzHours));

    return framePacket(version, CmdSetTime, payload);
}

QByteArray FeeaCodec::encodeTimeFormat(ProtocolVersion version, bool use24Hour) {
    QByteArray payload;
    payload.append(static_cast<char>(use24Hour ? 0x01 : 0x00));
    return framePacket(version, CmdSetTimeFormat, payload);
}

static QByteArray truncateUtf8(const QString &input, int maxBytes) {
    QByteArray utf8 = input.toUtf8();
    if (utf8.size() <= maxBytes) {
        return utf8;
    }
    int len = maxBytes;
    while (len > 0 && (static_cast<uint8_t>(utf8.at(len)) & 0xC0) == 0x80) {
        --len;
    }
    return utf8.left(len);
}

static QByteArray encodeUtf16Le(const QString &input, int maxBytes) {
    const int safeMax = std::max(2, maxBytes - (maxBytes % 2));
    const int codeUnits = std::min<int>(static_cast<int>(input.size()), safeMax / 2);
    QByteArray out;
    out.reserve(codeUnits * 2);
    for (int i = 0; i < codeUnits; ++i) {
        const uint16_t u = input.at(i).unicode();
        out.append(static_cast<char>(u & 0xFF));
        out.append(static_cast<char>((u >> 8) & 0xFF));
    }
    return out;
}

static QByteArray encodeUtf16Be(const QString &input, int maxBytes) {
    const int safeMax = std::max(2, maxBytes - (maxBytes % 2));
    const int codeUnits = std::min<int>(static_cast<int>(input.size()), safeMax / 2);
    QByteArray out;
    out.reserve(codeUnits * 2);
    for (int i = 0; i < codeUnits; ++i) {
        const uint16_t u = input.at(i).unicode();
        out.append(static_cast<char>((u >> 8) & 0xFF));
        out.append(static_cast<char>(u & 0xFF));
    }
    return out;
}

QString FeeaCodec::notificationFormatLabel(NotificationFormat format) {
    static const char *labels[NotificationFormatCount] = {
        "1. Standard UTF-8 [icon, text]",
        "2. V2 Flag 0x01 [icon, 0x01, text]",
        "3. V2 Flag 0x02 [icon, 0x02, text]",
        "4. V2 Flag 0x00 [icon, 0x00, text]",
        "5. Split Length [icon, tLen, title, bLen, body]",
        "6. Split NUL [icon, title, 0x00, body, 0x00]",
        "7. Null-Terminated [icon, text, 0x00]",
        "8. Length-Prefixed [icon, len, text]",
        "9. UTF-16LE [icon, utf16le]",
        "10. UTF-16BE [icon, utf16be]",
        "11. Newline Split [icon, title, \\n, body]",
        "12. Split NUL (No Trail) [icon, title, 0x00, body]",
        "13. Extended Icon [icon|0x80, text]",
        "14. Extended Icon 0x00 [icon|0x80, 0x00, text]",
        "15. Extended Icon 0x01 [icon|0x80, 0x01, text]",
        "16. V2 0x01 + Split NUL [icon, 0x01, title, 0, body, 0]",
        "17. V2 0x02 + Split NUL [icon, 0x02, title, 0, body, 0]",
        "18. V2 0x00 + Split NUL [icon, 0x00, title, 0, body, 0]",
        "19. V2 0x01 + Split Len [icon, 0x01, tLen, title, bLen, body]",
        "20. V2 0x00 + Len [icon, 0x00, len, text]",
        "21. V2 0x01 + Len [icon, 0x01, len, text]",
        "22. Action 0x01 First [0x01, icon, text]",
        "23. Action 0x00 First [0x00, icon, text]",
        "24. Action 0x01 + Len [0x01, icon, len, text]",
        "25. Paged 1/1 [icon, 0x01, 0x01, text]",
        "26. Header 00 01 [icon, 0x00, 0x01, text]",
        "27. Header 01 00 [icon, 0x01, 0x00, text]",
        "28. Header 00 00 [icon, 0x00, 0x00, text]",
        "29. V1 Frame Standard [FE EA 10 LL 64 icon text]",
        "30. V1 Frame Split NUL [FE EA 10 LL 64 icon title 0 body 0]",
        "31. Payload-Only Length [FE EA 20 payLen 64 icon text]",
        "32. Raw Unframed 0x64 [64, icon, text]",
        "33. 16-bit Icon + 0x01 [0x00, icon, 0x01, text]",
        "34. 16-bit Len BE [icon, lenHi, lenLo, text]",
        "35. UTF-16LE + NUL [icon, utf16le, 0x00, 0x00]",
        "36. V2 0x01 + UTF-16LE [icon, 0x01, utf16le]"
    };
    const int idx = std::clamp(static_cast<int>(format), 0, NotificationFormatCount - 1);
    return QString::fromLatin1(labels[idx]);
}

QStringList FeeaCodec::notificationFormatLabels() {
    QStringList list;
    list.reserve(NotificationFormatCount);
    for (int i = 0; i < NotificationFormatCount; ++i) {
        list.append(notificationFormatLabel(static_cast<NotificationFormat>(i)));
    }
    return list;
}

QByteArray FeeaCodec::encodeNotification(ProtocolVersion version,
                                         WatchAppIcon icon,
                                         const QString &title,
                                         const QString &body,
                                         int maxUtf8Bytes,
                                         NotificationFormat format) {
    const int clampedMax = std::clamp(maxUtf8Bytes, 16, 240);
    const uint8_t wireIcon = static_cast<uint8_t>(icon);
    const uint8_t highBitIcon = static_cast<uint8_t>(wireIcon | 0x80);

    const QString trimmedTitle = title.trimmed();
    const QString trimmedBody = body.trimmed();
    const QString effectiveTitle = trimmedTitle.isEmpty() ? QStringLiteral("Alert") : trimmedTitle;

    QString formatted;
    if (!trimmedTitle.isEmpty() && !trimmedBody.isEmpty()) {
        formatted = trimmedTitle + QStringLiteral(": ") + trimmedBody;
    } else if (!trimmedTitle.isEmpty()) {
        formatted = trimmedTitle;
    } else {
        formatted = trimmedBody;
    }

    auto makeSplitNul = [&](bool hasPrefix, uint8_t prefixByte, bool trailingNul) {
        const QByteArray titleBytes = truncateUtf8(effectiveTitle, std::min(48, clampedMax - 4));
        const int overhead = (hasPrefix ? 1 : 0) + 1 + (trailingNul ? 1 : 0);
        const int remaining = std::max(0, clampedMax - static_cast<int>(titleBytes.size()) - overhead);
        const QByteArray bodyBytes = trimmedBody.isEmpty() ? QByteArray() : truncateUtf8(trimmedBody, remaining);
        QByteArray p;
        p.reserve(1 + overhead + static_cast<int>(titleBytes.size()) + static_cast<int>(bodyBytes.size()));
        p.append(static_cast<char>(wireIcon));
        if (hasPrefix) {
            p.append(static_cast<char>(prefixByte));
        }
        p.append(titleBytes);
        p.append('\0');
        p.append(bodyBytes);
        if (trailingNul) {
            p.append('\0');
        }
        return p;
    };

    auto makeSplitLen = [&](bool hasPrefix, uint8_t prefixByte) {
        const QByteArray titleBytes = truncateUtf8(effectiveTitle, std::min(48, clampedMax - 4));
        const int overhead = (hasPrefix ? 4 : 3);
        const int remaining = std::max(0, clampedMax - static_cast<int>(titleBytes.size()) - overhead);
        const QByteArray bodyBytes = trimmedBody.isEmpty() ? QByteArray() : truncateUtf8(trimmedBody, remaining);
        QByteArray p;
        p.reserve(overhead + static_cast<int>(titleBytes.size()) + static_cast<int>(bodyBytes.size()));
        p.append(static_cast<char>(wireIcon));
        if (hasPrefix) {
            p.append(static_cast<char>(prefixByte));
        }
        p.append(static_cast<char>(static_cast<int>(titleBytes.size()) & 0xFF));
        p.append(titleBytes);
        p.append(static_cast<char>(static_cast<int>(bodyBytes.size()) & 0xFF));
        p.append(bodyBytes);
        return p;
    };

    const QByteArray textBytes = truncateUtf8(formatted, clampedMax);
    QByteArray payload;

    switch (format) {
    case NotificationFormat::V2Version01:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(textBytes);
        break;
    case NotificationFormat::V2Version02:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x02));
        payload.append(textBytes);
        break;
    case NotificationFormat::V2Header:
        payload.append(static_cast<char>(wireIcon));
        payload.append('\0');
        payload.append(textBytes);
        break;
    case NotificationFormat::SplitLen:
        payload = makeSplitLen(false, 0x00);
        break;
    case NotificationFormat::SplitTitle:
        payload = makeSplitNul(false, 0x00, true);
        break;
    case NotificationFormat::NulTerminated:
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        payload.append('\0');
        break;
    case NotificationFormat::LengthPrefixed:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(static_cast<int>(textBytes.size()) & 0xFF));
        payload.append(textBytes);
        break;
    case NotificationFormat::Utf16Le:
        payload.append(static_cast<char>(wireIcon));
        payload.append(encodeUtf16Le(formatted, clampedMax));
        break;
    case NotificationFormat::Utf16Be:
        payload.append(static_cast<char>(wireIcon));
        payload.append(encodeUtf16Be(formatted, clampedMax));
        break;
    case NotificationFormat::NewlineSplit: {
        const QString nlText = (!trimmedTitle.isEmpty() && !trimmedBody.isEmpty())
            ? trimmedTitle + QStringLiteral("\n") + trimmedBody
            : formatted;
        payload.append(static_cast<char>(wireIcon));
        payload.append(truncateUtf8(nlText, clampedMax));
        break;
    }
    case NotificationFormat::SplitTitleNoTrail:
        payload = makeSplitNul(false, 0x00, false);
        break;
    case NotificationFormat::HighBitIcon:
        payload.append(static_cast<char>(highBitIcon));
        payload.append(textBytes);
        break;
    case NotificationFormat::HighBitV2Header00:
        payload.append(static_cast<char>(highBitIcon));
        payload.append('\0');
        payload.append(textBytes);
        break;
    case NotificationFormat::HighBitV2Version01:
        payload.append(static_cast<char>(highBitIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(textBytes);
        break;
    case NotificationFormat::V2Flag01SplitNul:
        payload = makeSplitNul(true, 0x01, true);
        break;
    case NotificationFormat::V2Flag02SplitNul:
        payload = makeSplitNul(true, 0x02, true);
        break;
    case NotificationFormat::V2Flag00SplitNul:
        payload = makeSplitNul(true, 0x00, true);
        break;
    case NotificationFormat::V2Flag01SplitLen:
        payload = makeSplitLen(true, 0x01);
        break;
    case NotificationFormat::V2Flag00LenUtf8:
        payload.append(static_cast<char>(wireIcon));
        payload.append('\0');
        payload.append(static_cast<char>(static_cast<int>(textBytes.size()) & 0xFF));
        payload.append(textBytes);
        break;
    case NotificationFormat::V2Flag01LenUtf8:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(static_cast<char>(static_cast<int>(textBytes.size()) & 0xFF));
        payload.append(textBytes);
        break;
    case NotificationFormat::Action01Icon:
        payload.append(static_cast<char>(0x01));
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        break;
    case NotificationFormat::Action00Icon:
        payload.append('\0');
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        break;
    case NotificationFormat::Action01IconLen:
        payload.append(static_cast<char>(0x01));
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(static_cast<int>(textBytes.size()) & 0xFF));
        payload.append(textBytes);
        break;
    case NotificationFormat::Paged0101:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(static_cast<char>(0x01));
        payload.append(textBytes);
        break;
    case NotificationFormat::Header0001:
        payload.append(static_cast<char>(wireIcon));
        payload.append('\0');
        payload.append(static_cast<char>(0x01));
        payload.append(textBytes);
        break;
    case NotificationFormat::Header0100:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append('\0');
        payload.append(textBytes);
        break;
    case NotificationFormat::Header0000:
        payload.append(static_cast<char>(wireIcon));
        payload.append('\0');
        payload.append('\0');
        payload.append(textBytes);
        break;
    case NotificationFormat::V1FrameStandard:
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        return framePacket(ProtocolVersion::V1, CmdPushNotification, payload);
    case NotificationFormat::V1FrameSplitNul:
        payload = makeSplitNul(false, 0x00, true);
        return framePacket(ProtocolVersion::V1, CmdPushNotification, payload);
    case NotificationFormat::PayloadLenOnly: {
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        const uint16_t payLen = static_cast<uint16_t>(std::min<int>(4095, static_cast<int>(payload.size())));
        const uint8_t versionPrefix = (version == ProtocolVersion::V1) ? V1Prefix : V2Prefix;
        QByteArray out;
        out.reserve(5 + payload.size());
        out.append(static_cast<char>(HeaderByte0));
        out.append(static_cast<char>(HeaderByte1));
        out.append(static_cast<char>(versionPrefix + ((payLen >> 8) & 0x0F)));
        out.append(static_cast<char>(payLen & 0xFF));
        out.append(static_cast<char>(CmdPushNotification));
        out.append(payload);
        return out;
    }
    case NotificationFormat::RawNoHeader: {
        QByteArray out;
        out.reserve(2 + textBytes.size());
        out.append(static_cast<char>(CmdPushNotification));
        out.append(static_cast<char>(wireIcon));
        out.append(textBytes);
        return out;
    }
    case NotificationFormat::Icon16BeV2Flag01:
        payload.append('\0');
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(textBytes);
        break;
    case NotificationFormat::IconLen16BeUtf8: {
        const int len = static_cast<int>(textBytes.size());
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>((len >> 8) & 0xFF));
        payload.append(static_cast<char>(len & 0xFF));
        payload.append(textBytes);
        break;
    }
    case NotificationFormat::Utf16LeNul:
        payload.append(static_cast<char>(wireIcon));
        payload.append(encodeUtf16Le(formatted, clampedMax));
        payload.append('\0');
        payload.append('\0');
        break;
    case NotificationFormat::V2Flag01Utf16Le:
        payload.append(static_cast<char>(wireIcon));
        payload.append(static_cast<char>(0x01));
        payload.append(encodeUtf16Le(formatted, clampedMax));
        break;
    case NotificationFormat::Standard:
    default:
        payload.append(static_cast<char>(wireIcon));
        payload.append(textBytes);
        break;
    }

    return framePacket(version, CmdPushNotification, payload);
}

QByteArray FeeaCodec::encodeStandardNewAlert(WatchAppIcon icon,
                                             const QString &title,
                                             const QString &body) {
    // Bluetooth SIG Alert Notification Service (0x1811) New Alert (0x2A46):
    //   [Category ID (1B)] [Num New Alerts (1B)] [Text String Info (UTF-8, <= 18B)]
    uint8_t categoryId = 0x00; // Simple Alert
    if (icon == WatchAppIcon::IncomingCall) {
        categoryId = 0x03; // Call
    } else if (icon == WatchAppIcon::Sms) {
        categoryId = 0x05; // SMS/MMS
    } else if (icon == WatchAppIcon::Gmail) {
        categoryId = 0x01; // Email
    } else if (icon == WatchAppIcon::Calendar) {
        categoryId = 0x07; // Schedule
    }

    const QString trimmedTitle = title.trimmed();
    const QString trimmedBody = body.trimmed();
    QString text;
    if (!trimmedTitle.isEmpty() && !trimmedBody.isEmpty()) {
        text = trimmedTitle + QStringLiteral(": ") + trimmedBody;
    } else {
        text = trimmedTitle.isEmpty() ? trimmedBody : trimmedTitle;
    }
    const QByteArray utf8 = truncateUtf8(text, 18);

    QByteArray out;
    out.reserve(2 + utf8.size());
    out.append(static_cast<char>(categoryId));
    out.append(static_cast<char>(0x01));
    out.append(utf8);
    return out;
}

QByteArray FeeaCodec::encodeFindWatch(ProtocolVersion version) {
    // Verified 0x61 Find Watch frame uses an empty payload (totalLen = 5: FE EA 10/20 05 61)
    return encodeGetCommand(version, CmdFindWatch);
}

QByteArray FeeaCodec::encodeGetTodayActivity(ProtocolVersion version) {
    // Empty-payload get request for today's steps & distance (totalLen = 5: FE EA 10/20 05 81)
    return encodeGetCommand(version, CmdGetTodayActivity);
}

QByteArray FeeaCodec::encodeMeasureHeartRate(ProtocolVersion version) {
    // Heart Rate trigger: FE EA 10/20 06 6D 00
    QByteArray payload;
    payload.append(static_cast<char>(0x00));
    return framePacket(version, CmdMeasureHeartRate, payload);
}

QByteArray FeeaCodec::encodeMeasureSpo2(ProtocolVersion version) {
    // Verified Blood Oxygen (SpO2) trigger: FE EA 10/20 06 6B 00
    QByteArray payload;
    payload.append(static_cast<char>(0x00));
    return framePacket(version, CmdMeasureSpo2, payload);
}

QByteArray FeeaCodec::encodeMeasureBloodPressure(ProtocolVersion version) {
    // Verified Blood Pressure (BP) trigger: FE EA 10/20 06 69 00
    QByteArray payload;
    payload.append(static_cast<char>(0x00));
    return framePacket(version, CmdMeasureBloodPress, payload);
}

QByteArray FeeaCodec::encodeWorkoutListRequest(ProtocolVersion version) {
    // Workout list request: 0xB2 00 (watch responds with 0xB2 01 + list)
    QByteArray sub;
    sub.append(static_cast<char>(SubCmdWorkoutListReq));
    return encodeSubCommand(version, CmdWorkout, sub);
}

ParsedHealthPacket FeeaCodec::parseFee1Activity(const QByteArray &value) {
    ParsedHealthPacket out;
    if (value.isEmpty()) {
        return out;
    }
    if (value.size() >= 6
        && static_cast<uint8_t>(value.at(0)) == HeaderByte0
        && static_cast<uint8_t>(value.at(1)) == HeaderByte1) {
        return parseFeeaHealthResponse(value);
    }

    int steps = 0;
    int dist = 0;
    if (value.size() >= 6 && decodeStepsAndDistance(value, 0, steps, dist)) {
        out.valid = true;
        out.hasSteps = true;
        out.steps = steps;
        out.hasDistanceMeters = true;
        out.distanceMeters = dist;
        out.dayOffset = 0;
        return out;
    }

    if (value.size() >= 4) {
        const uint32_t sLE = static_cast<uint32_t>(static_cast<uint8_t>(value.at(0)))
            | (static_cast<uint32_t>(static_cast<uint8_t>(value.at(1))) << 8)
            | (static_cast<uint32_t>(static_cast<uint8_t>(value.at(2))) << 16)
            | (static_cast<uint32_t>(static_cast<uint8_t>(value.at(3))) << 24);
        const uint32_t sBE = (static_cast<uint32_t>(static_cast<uint8_t>(value.at(0))) << 24)
            | (static_cast<uint32_t>(static_cast<uint8_t>(value.at(1))) << 16)
            | (static_cast<uint32_t>(static_cast<uint8_t>(value.at(2))) << 8)
            | static_cast<uint32_t>(static_cast<uint8_t>(value.at(3)));
        const int chosen = (sLE <= 200000) ? static_cast<int>(sLE)
            : ((sBE <= 200000) ? static_cast<int>(sBE) : -1);
        if (chosen >= 0) {
            out.valid = true;
            out.hasSteps = true;
            out.steps = chosen;
            out.hasDistanceMeters = true;
            out.distanceMeters = static_cast<int>(std::lround(chosen * 0.75));
            out.dayOffset = 0;
            return out;
        }
    } else if (value.size() == 3 && decodeStepsAndDistance(value, 0, steps, dist)) {
        out.valid = true;
        out.hasSteps = true;
        out.steps = steps;
        out.hasDistanceMeters = true;
        out.distanceMeters = dist;
        out.dayOffset = 0;
        return out;
    }

    return out;
}

ParsedHealthPacket FeeaCodec::parseFeeaHealthResponse(const QByteArray &frame) {
    ParsedHealthPacket out;
    if (frame.size() < 6) {
        return out;
    }
    const uint8_t b0 = static_cast<uint8_t>(frame.at(0));
    const uint8_t b1 = static_cast<uint8_t>(frame.at(1));
    if (b0 != HeaderByte0 || b1 != HeaderByte1) {
        return out;
    }

    const uint8_t cmd = static_cast<uint8_t>(frame.at(4));
    const QByteArray payload = frame.mid(5);

    if ((cmd == CmdGetTodayActivity || cmd == 0x09) && payload.size() >= 3) {
        int offset = 0;
        // Only treat byte 0 as dayOffset when payload is 7 (1+6) or 10 (1+9) bytes;
        // 6-byte [steps_3B, dist_3B] and 9-byte [steps_3B, dist_3B, cal_3B] start at offset 0.
        if ((payload.size() == 7 || payload.size() == 10) && static_cast<uint8_t>(payload.at(0)) <= 6) {
            out.dayOffset = static_cast<uint8_t>(payload.at(0));
            offset = 1;
        }
        int steps = 0;
        int dist = 0;
        if (decodeStepsAndDistance(payload, offset, steps, dist)) {
            out.hasSteps = true;
            out.steps = steps;
            out.hasDistanceMeters = true;
            out.distanceMeters = dist;
            out.valid = true;
            return out;
        }
    }

    if ((cmd == CmdMeasureBloodPress || cmd == CmdStopBloodPress) && payload.size() >= 2) {
        // Parse [systolic, diastolic] pair (or [status, systolic, diastolic])
        for (int i = 0; i + 1 < payload.size(); ++i) {
            const int sys = static_cast<uint8_t>(payload.at(i));
            const int dia = static_cast<uint8_t>(payload.at(i + 1));
            if (sys >= 70 && sys <= 240 && dia >= 40 && dia <= 150 && sys > dia) {
                out.hasBloodPressure = true;
                out.systolicMmHg = sys;
                out.diastolicMmHg = dia;
                out.valid = true;
                return out;
            }
        }
    }

    if ((cmd == CmdMeasureHeartRate || cmd == CmdStopHeartRate || cmd == 0x6F || cmd == 0x67 || cmd == 0x68 || cmd == 0x0A)
        && !payload.isEmpty()) {
        for (int i = payload.size() - 1; i >= 0; --i) {
            const int candidate = static_cast<uint8_t>(payload.at(i));
            if (candidate >= 30 && candidate <= 220) {
                out.hasHeartRate = true;
                out.heartRateBpm = candidate;
                out.valid = true;
                return out;
            }
        }
    }

    if ((cmd == CmdMeasureSpo2 || cmd == CmdStopSpo2 || cmd == 0x72 || cmd == 0x73 || cmd == 0x80 || cmd == 0x82 || cmd == 0x0B)
        && !payload.isEmpty()) {
        for (int i = payload.size() - 1; i >= 0; --i) {
            const int candidate = static_cast<uint8_t>(payload.at(i));
            if (candidate >= 70 && candidate <= 100) {
                out.hasSpo2 = true;
                out.spo2Percent = candidate;
                out.valid = true;
                return out;
            }
        }
    }

    // Note: 0x41 is Get Time (0x31 + 0x10), not Battery. Only parse dedicated 1-byte battery frames.
    if (cmd == 0x04 && payload.size() == 1) {
        const int batt = static_cast<uint8_t>(payload.at(0));
        if (batt >= 0 && batt <= 100) {
            out.hasBattery = true;
            out.batteryPercent = batt;
            out.valid = true;
            return out;
        }
    }

    return out;
}

int FeeaCodec::parseStandardHeartRate(const QByteArray &value) {
    if (value.size() < 2) {
        return -1;
    }
    const uint8_t flags = static_cast<uint8_t>(value.at(0));
    const bool is16Bit = (flags & 0x01) != 0;
    int bpm = -1;
    if (is16Bit && value.size() >= 3) {
        bpm = static_cast<uint8_t>(value.at(1)) | (static_cast<uint8_t>(value.at(2)) << 8);
    } else {
        bpm = static_cast<uint8_t>(value.at(1));
    }
    return (bpm >= 30 && bpm <= 220) ? bpm : -1;
}

int FeeaCodec::parseStandardSpo2(const QByteArray &value) {
    // Bluetooth SIG PLX Measurement (0x2A5E / 0x2A5F): [flags (1B)] [SpO2 SFLOAT (2B LE)]
    if (value.size() < 3) {
        return -1;
    }
    const uint16_t raw = static_cast<uint16_t>(static_cast<uint8_t>(value.at(1)))
        | (static_cast<uint16_t>(static_cast<uint8_t>(value.at(2))) << 8);
    int16_t mantissa = static_cast<int16_t>(raw & 0x0FFF);
    if (mantissa >= 0x0800) {
        mantissa = static_cast<int16_t>(mantissa - 0x1000);
    }
    int8_t exponent = static_cast<int8_t>((raw >> 12) & 0x0F);
    if (exponent >= 0x08) {
        exponent = static_cast<int8_t>(exponent - 0x10);
    }
    double val = static_cast<double>(mantissa);
    if (exponent > 0) {
        for (int i = 0; i < exponent; ++i) val *= 10.0;
    } else if (exponent < 0) {
        for (int i = 0; i < -exponent; ++i) val /= 10.0;
    }
    const int spo2 = static_cast<int>(val + 0.5);
    if (spo2 >= 70 && spo2 <= 100) {
        return spo2;
    }
    const int plain = static_cast<uint8_t>(value.at(1));
    return (plain >= 70 && plain <= 100) ? plain : -1;
}

QList<QByteArray> FeeaCodec::chunkPacket(const QByteArray &packet, int mtuSize) {
    const int safeMtu = std::clamp(mtuSize, 20, 244);
    QList<QByteArray> chunks;
    for (qsizetype offset = 0; offset < packet.size(); offset += safeMtu) {
        chunks.append(packet.mid(offset, safeMtu));
    }
    if (chunks.isEmpty()) {
        chunks.append(QByteArray());
    }
    return chunks;
}

QString FeeaCodec::toHexString(const QByteArray &bytes) {
    return QString::fromLatin1(bytes.toHex(' ').toUpper());
}

WatchAppIcon FeeaCodec::mapAppNameToIcon(const QString &appIdOrName) {
    const QString lower = appIdOrName.toLower();
    if (lower.contains(QStringLiteral("whatsapp"))) return WatchAppIcon::WhatsApp;
    if (lower.contains(QStringLiteral("telegram"))) return WatchAppIcon::Telegram;
    if (lower.contains(QStringLiteral("gmail")) || lower.contains(QStringLiteral("thunderbird")) || lower.contains(QStringLiteral("mail"))) return WatchAppIcon::Gmail;
    if (lower.contains(QStringLiteral("slack"))) return WatchAppIcon::Slack;
    if (lower.contains(QStringLiteral("calendar")) || lower.contains(QStringLiteral("evolution"))) return WatchAppIcon::Calendar;
    if (lower.contains(QStringLiteral("instagram"))) return WatchAppIcon::Instagram;
    if (lower.contains(QStringLiteral("twitter")) || lower.contains(QStringLiteral("x.com"))) return WatchAppIcon::TwitterX;
    if (lower.contains(QStringLiteral("facebook")) || lower.contains(QStringLiteral("messenger"))) return WatchAppIcon::Facebook;
    if (lower.contains(QStringLiteral("sms")) || lower.contains(QStringLiteral("messaging")) || lower.contains(QStringLiteral("messages"))) return WatchAppIcon::Sms;
    if (lower.contains(QStringLiteral("phone")) || lower.contains(QStringLiteral("dialer")) || lower.contains(QStringLiteral("call"))) return WatchAppIcon::IncomingCall;
    if (lower.contains(QStringLiteral("skype"))) return WatchAppIcon::Skype;
    return WatchAppIcon::GenericOther;
}

} // namespace fitlink
