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
