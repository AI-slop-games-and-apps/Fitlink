#include "FeeaCodec.h"

#include <QtEndian>
#include <algorithm>

namespace fitlink {

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

QByteArray FeeaCodec::framePacket(ProtocolVersion version, uint8_t command, const QByteArray &payload) {
    QByteArray out;
    if (version == ProtocolVersion::V1) {
        // V1 frame: [0xFE] [0xEA] [0x10] [totalLen] [cmd] [payload...]
        const uint8_t totalLen = static_cast<uint8_t>(std::min<qsizetype>(255, 5 + payload.size()));
        out.reserve(totalLen);
        out.append(static_cast<char>(HeaderByte0));
        out.append(static_cast<char>(HeaderByte1));
        out.append(static_cast<char>(V1Marker));
        out.append(static_cast<char>(totalLen));
        out.append(static_cast<char>(command));
        out.append(payload);
    } else {
        // V2 frame: [0xFE] [0xEA] [len_lo] [len_hi] [cmd] [payload...]
        const uint16_t totalLen = static_cast<uint16_t>(5 + payload.size());
        out.reserve(totalLen);
        out.append(static_cast<char>(HeaderByte0));
        out.append(static_cast<char>(HeaderByte1));
        out.append(static_cast<char>(totalLen & 0xFF));
        out.append(static_cast<char>((totalLen >> 8) & 0xFF));
        out.append(static_cast<char>(command));
        out.append(payload);
    }
    return out;
}

QByteArray FeeaCodec::encodeSyncTime(ProtocolVersion version, const QDateTime &dateTime, int utcOffsetMinutes) {
    // 0x31 payload: 4-byte uint32 epoch seconds (big-endian) + 1-byte timezone hours + 1-byte quarter-hour offset
    const uint32_t epochSec = static_cast<uint32_t>(dateTime.toSecsSinceEpoch());
    const int8_t tzHours = static_cast<int8_t>(std::clamp(utcOffsetMinutes / 60, -12, 14));
    const uint8_t tzQuarterRemainder = static_cast<uint8_t>((std::abs(utcOffsetMinutes) % 60) / 15);

    QByteArray payload;
    payload.reserve(6);
    payload.append(static_cast<char>((epochSec >> 24) & 0xFF));
    payload.append(static_cast<char>((epochSec >> 16) & 0xFF));
    payload.append(static_cast<char>((epochSec >> 8) & 0xFF));
    payload.append(static_cast<char>(epochSec & 0xFF));
    payload.append(static_cast<char>(tzHours));
    payload.append(static_cast<char>(tzQuarterRemainder));

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

QByteArray FeeaCodec::encodeNotification(ProtocolVersion version,
                                         WatchAppIcon icon,
                                         const QString &title,
                                         const QString &body,
                                         int maxUtf8Bytes) {
    const QString trimmedTitle = title.trimmed();
    const QString trimmedBody = body.trimmed();
    QString formatted;
    if (!trimmedTitle.isEmpty() && !trimmedBody.isEmpty()) {
        formatted = trimmedTitle + QStringLiteral(": ") + trimmedBody;
    } else if (!trimmedTitle.isEmpty()) {
        formatted = trimmedTitle;
    } else {
        formatted = trimmedBody;
    }

    const QByteArray textBytes = truncateUtf8(formatted, std::clamp(maxUtf8Bytes, 16, 240));

    QByteArray payload;
    payload.reserve(2 + textBytes.size());
    payload.append(static_cast<char>(static_cast<uint8_t>(icon)));
    payload.append(static_cast<char>(textBytes.size() & 0xFF));
    payload.append(textBytes);

    return framePacket(version, CmdPushNotification, payload);
}

QByteArray FeeaCodec::encodeFindWatch(ProtocolVersion version) {
    QByteArray payload;
    payload.append(static_cast<char>(0x01));
    return framePacket(version, CmdFindWatch, payload);
}

QByteArray FeeaCodec::encodeSyncActivity(ProtocolVersion version, uint8_t dayOffset) {
    QByteArray payload;
    payload.append(static_cast<char>(dayOffset));
    return framePacket(version, CmdSyncActivity, payload);
}

QByteArray FeeaCodec::encodeSyncHeartRate(ProtocolVersion version) {
    QByteArray payload;
    payload.append(static_cast<char>(0x01));
    return framePacket(version, CmdSyncHeartRate, payload);
}

QByteArray FeeaCodec::encodeSyncSpo2(ProtocolVersion version) {
    QByteArray payload;
    payload.append(static_cast<char>(0x01));
    return framePacket(version, CmdSyncSpo2, payload);
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

    if (cmd == CmdSyncActivity && payload.size() >= 3) {
        // Common 0x51 layout: [dayOffset?, steps (3-byte big-endian), distanceMeters (2- or 3-byte big-endian)]
        int offset = 0;
        if (payload.size() >= 7 && static_cast<uint8_t>(payload.at(0)) <= 6) {
            out.dayOffset = static_cast<uint8_t>(payload.at(0));
            offset = 1;
        }
        const int steps = (static_cast<uint8_t>(payload.at(offset)) << 16)
            | (static_cast<uint8_t>(payload.at(offset + 1)) << 8)
            | static_cast<uint8_t>(payload.at(offset + 2));
        out.hasSteps = true;
        out.steps = std::max(0, steps);
        if (payload.size() >= offset + 6) {
            const int dist = (static_cast<uint8_t>(payload.at(offset + 3)) << 16)
                | (static_cast<uint8_t>(payload.at(offset + 4)) << 8)
                | static_cast<uint8_t>(payload.at(offset + 5));
            out.hasDistanceMeters = true;
            out.distanceMeters = std::max(0, dist);
        } else if (payload.size() >= offset + 5) {
            const int dist = (static_cast<uint8_t>(payload.at(offset + 3)) << 8)
                | static_cast<uint8_t>(payload.at(offset + 4));
            out.hasDistanceMeters = true;
            out.distanceMeters = std::max(0, dist);
        } else {
            out.hasDistanceMeters = true;
            out.distanceMeters = static_cast<int>(out.steps * 0.75);
        }
        out.valid = true;
        return out;
    }

    if (cmd == CmdSyncHeartRate && !payload.isEmpty()) {
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

    if (cmd == CmdSyncSpo2 && !payload.isEmpty()) {
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
    return (spo2 >= 70 && spo2 <= 100) ? spo2 : -1;
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
