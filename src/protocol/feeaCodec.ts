export type ProtocolVersion = 'unknown' | 'v1' | 'v2';
export type ProtocolPreference = 'auto' | 'v2' | 'v1';

export interface WatchAppPreset {
  id: number;
  key: string;
  label: string;
}

export const WATCH_APP_PRESETS: WatchAppPreset[] = [
  { id: 0x00, key: 'call', label: 'Incoming Call' },
  { id: 0x01, key: 'sms', label: 'SMS' },
  { id: 0x06, key: 'whatsapp', label: 'WhatsApp' },
  { id: 0x0c, key: 'telegram', label: 'Telegram' },
  { id: 0x0b, key: 'gmail', label: 'Gmail' },
  { id: 0x0e, key: 'calendar', label: 'Calendar' },
  { id: 0x0d, key: 'slack', label: 'Slack' },
  { id: 0x08, key: 'instagram', label: 'Instagram' },
  { id: 0x0f, key: 'generic', label: 'Generic App' },
];

export const GATT_UUIDS = {
  SERVICE_FEEA: '0000feea-0000-1000-8000-00805f9b34fb',
  CHAR_DATA_OUT: '0000fee2-0000-1000-8000-00805f9b34fb',
  CHAR_DATA_IN: '0000fee3-0000-1000-8000-00805f9b34fb',
  CHAR_DATA_OUT_ALT: '0000fee5-0000-1000-8000-00805f9b34fb',
  SERVICE_BATTERY: 0x180f,
  CHAR_BATTERY_LEVEL: 0x2a19,
  SERVICE_DEVICE_INFO: 0x180a,
  CHAR_MANUFACTURER_NAME: 0x2a29,
  CHAR_MODEL_NUMBER: 0x2a24,
  CHAR_FIRMWARE_REV: 0x2a26,
  CHAR_HARDWARE_REV: 0x2a27,
  SERVICE_IMMEDIATE_ALERT: 0x1802,
  CHAR_ALERT_LEVEL: 0x2a06,
} as const;

export const FEEA_CMD = {
  SET_TIME_FORMAT: 0x27,
  SET_TIME: 0x31,
  FIND_WATCH: 0x61,
  PUSH_NOTIFICATION: 0x64,
} as const;

export function detectProtocolFromManufacturer(manufacturer: string): ProtocolVersion {
  const upper = manufacturer.trim().toUpperCase();
  if (!upper || upper === '-') return 'unknown';
  if (upper.endsWith('-V2') || upper.includes('V2')) return 'v2';
  return 'v1';
}

export function resolveProtocolVersion(
  detected: ProtocolVersion,
  pref: ProtocolPreference
): 'v1' | 'v2' {
  if (pref === 'v1') return 'v1';
  if (pref === 'v2') return 'v2';
  return detected === 'v1' ? 'v1' : 'v2';
}

export function formatProtocolLabel(version: ProtocolVersion): string {
  if (version === 'v1') return 'FEEA V1';
  if (version === 'v2') return 'FEEA V2';
  return 'Auto (V2 default)';
}

export function framePacket(
  version: 'v1' | 'v2',
  command: number,
  payload: Uint8Array
): Uint8Array {
  const totalLen = 5 + payload.length;
  const out = new Uint8Array(totalLen);
  out[0] = 0xfe;
  out[1] = 0xea;
  if (version === 'v1') {
    out[2] = 0x10;
    out[3] = Math.min(255, totalLen) & 0xff;
  } else {
    out[2] = totalLen & 0xff;
    out[3] = (totalLen >> 8) & 0xff;
  }
  out[4] = command & 0xff;
  out.set(payload, 5);
  return out;
}

export function encodeSyncTime(
  version: 'v1' | 'v2',
  date: Date,
  utcOffsetMinutes: number
): Uint8Array {
  const epochSec = Math.floor(date.getTime() / 1000) >>> 0;
  const tzHours = Math.max(-12, Math.min(14, Math.trunc(utcOffsetMinutes / 60)));
  const tzQuarters = Math.trunc((Math.abs(utcOffsetMinutes) % 60) / 15);

  const payload = new Uint8Array(6);
  payload[0] = (epochSec >>> 24) & 0xff;
  payload[1] = (epochSec >>> 16) & 0xff;
  payload[2] = (epochSec >>> 8) & 0xff;
  payload[3] = epochSec & 0xff;
  payload[4] = tzHours & 0xff;
  payload[5] = tzQuarters & 0xff;

  return framePacket(version, FEEA_CMD.SET_TIME, payload);
}

export function encodeTimeFormat(version: 'v1' | 'v2', use24Hour: boolean): Uint8Array {
  return framePacket(version, FEEA_CMD.SET_TIME_FORMAT, new Uint8Array([use24Hour ? 0x01 : 0x00]));
}

const textEncoder = new TextEncoder();

export function formatNotificationText(title: string, body: string): string {
  const t = title.trim();
  const b = body.trim();
  if (t && b) return `${t}: ${b}`;
  return t || b;
}

export function truncateUtf8(input: string, maxBytes: number): Uint8Array {
  const bytes = textEncoder.encode(input);
  if (bytes.length <= maxBytes) return bytes;
  let len = maxBytes;
  while (len > 0 && (bytes[len] & 0xc0) === 0x80) {
    len -= 1;
  }
  return bytes.slice(0, len);
}

export function getNotificationMetrics(
  title: string,
  body: string,
  mtuSize: number
): { utf8Bytes: number; truncatedBytes: number; chunks: number } {
  const formatted = formatNotificationText(title, body);
  const fullBytes = textEncoder.encode(formatted).length;
  const capped = Math.min(128, fullBytes);
  const frameSize = 7 + capped;
  const safeMtu = Math.max(20, mtuSize);
  return {
    utf8Bytes: fullBytes,
    truncatedBytes: capped,
    chunks: Math.max(1, Math.ceil(frameSize / safeMtu)),
  };
}

export function encodeNotification(
  version: 'v1' | 'v2',
  iconId: number,
  title: string,
  body: string,
  maxUtf8Bytes = 128
): Uint8Array {
  const textBytes = truncateUtf8(formatNotificationText(title, body), Math.max(16, Math.min(240, maxUtf8Bytes)));
  const payload = new Uint8Array(2 + textBytes.length);
  payload[0] = iconId & 0xff;
  payload[1] = textBytes.length & 0xff;
  payload.set(textBytes, 2);
  return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, payload);
}

export function encodeFindWatch(version: 'v1' | 'v2'): Uint8Array {
  return framePacket(version, FEEA_CMD.FIND_WATCH, new Uint8Array([0x01]));
}

export function chunkPacket(packet: Uint8Array, mtuSize = 20): Uint8Array[] {
  const safeMtu = Math.max(20, Math.min(244, mtuSize));
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < packet.length; offset += safeMtu) {
    chunks.push(packet.slice(offset, offset + safeMtu));
  }
  return chunks.length > 0 ? chunks : [new Uint8Array()];
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function getPresetLabel(iconId: number): string {
  return WATCH_APP_PRESETS.find((p) => p.id === iconId)?.label ?? 'Generic App';
}
