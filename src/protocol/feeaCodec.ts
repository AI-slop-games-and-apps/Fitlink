export type ProtocolVersion = 'unknown' | 'v1' | 'v2';
export type ProtocolPreference = 'auto' | 'v2' | 'v1';

export type NotificationFormat =
  | 'standard'
  | 'v2_version_01'
  | 'v2_version_02'
  | 'v2_header'
  | 'split_len'
  | 'split_title'
  | 'nul'
  | 'length_prefixed'
  | 'utf16le'
  | 'utf16be'
  | 'newline_split'
  | 'split_title_notrail'
  | 'high_bit_icon'
  | 'high_bit_v2_00'
  | 'high_bit_v2_01'
  | 'v2_flag01_split_nul'
  | 'v2_flag02_split_nul'
  | 'v2_flag00_split_nul'
  | 'v2_flag01_split_len'
  | 'v2_flag00_len_utf8'
  | 'v2_flag01_len_utf8'
  | 'action01_icon'
  | 'action00_icon'
  | 'action01_icon_len'
  | 'paged_01_01'
  | 'header_00_01'
  | 'header_01_00'
  | 'header_00_00'
  | 'v1_frame_standard'
  | 'v1_frame_split_nul'
  | 'payload_len_only'
  | 'raw_no_header'
  | 'icon16be_v2_01'
  | 'icon_len16be_utf8'
  | 'utf16le_nul'
  | 'v2_flag01_utf16le';

export interface NotificationFormatOption {
  id: NotificationFormat;
  label: string;
  description: string;
}

export const NOTIFICATION_FORMAT_OPTIONS: NotificationFormatOption[] = [
  { id: 'standard', label: '1. Standard UTF-8', description: '[icon] [text]' },
  { id: 'v2_version_01', label: '2. V2 Flag 0x01', description: '[icon] [0x01] [text]' },
  { id: 'v2_version_02', label: '3. V2 Flag 0x02', description: '[icon] [0x02] [text]' },
  { id: 'v2_header', label: '4. V2 Flag 0x00', description: '[icon] [0x00] [text]' },
  { id: 'split_len', label: '5. Split Length', description: '[icon] [tLen] [title] [bLen] [body]' },
  { id: 'split_title', label: '6. Split NUL', description: '[icon] [title] [0x00] [body] [0x00]' },
  { id: 'nul', label: '7. Null-Terminated', description: '[icon] [text] [0x00]' },
  { id: 'length_prefixed', label: '8. Length-Prefixed', description: '[icon] [len] [text]' },
  { id: 'utf16le', label: '9. UTF-16LE', description: '[icon] [utf16le]' },
  { id: 'utf16be', label: '10. UTF-16BE', description: '[icon] [utf16be]' },
  { id: 'newline_split', label: '11. Newline Split', description: '[icon] [title] [\\n] [body]' },
  { id: 'split_title_notrail', label: '12. Split NUL (No Trail)', description: '[icon] [title] [0x00] [body]' },
  { id: 'high_bit_icon', label: '13. Extended Icon', description: '[icon|0x80] [text]' },
  { id: 'high_bit_v2_00', label: '14. Extended Icon 0x00', description: '[icon|0x80] [0x00] [text]' },
  { id: 'high_bit_v2_01', label: '15. Extended Icon 0x01', description: '[icon|0x80] [0x01] [text]' },
  { id: 'v2_flag01_split_nul', label: '16. V2 0x01 + Split NUL', description: '[icon] [0x01] [title] [0] [body] [0]' },
  { id: 'v2_flag02_split_nul', label: '17. V2 0x02 + Split NUL', description: '[icon] [0x02] [title] [0] [body] [0]' },
  { id: 'v2_flag00_split_nul', label: '18. V2 0x00 + Split NUL', description: '[icon] [0x00] [title] [0] [body] [0]' },
  { id: 'v2_flag01_split_len', label: '19. V2 0x01 + Split Len', description: '[icon] [0x01] [tLen] [title] [bLen] [body]' },
  { id: 'v2_flag00_len_utf8', label: '20. V2 0x00 + Len', description: '[icon] [0x00] [len] [text]' },
  { id: 'v2_flag01_len_utf8', label: '21. V2 0x01 + Len', description: '[icon] [0x01] [len] [text]' },
  { id: 'action01_icon', label: '22. Action 0x01 First', description: '[0x01] [icon] [text]' },
  { id: 'action00_icon', label: '23. Action 0x00 First', description: '[0x00] [icon] [text]' },
  { id: 'action01_icon_len', label: '24. Action 0x01 + Len', description: '[0x01] [icon] [len] [text]' },
  { id: 'paged_01_01', label: '25. Paged 1/1', description: '[icon] [0x01] [0x01] [text]' },
  { id: 'header_00_01', label: '26. Header 00 01', description: '[icon] [0x00] [0x01] [text]' },
  { id: 'header_01_00', label: '27. Header 01 00', description: '[icon] [0x01] [0x00] [text]' },
  { id: 'header_00_00', label: '28. Header 00 00', description: '[icon] [0x00] [0x00] [text]' },
  { id: 'v1_frame_standard', label: '29. V1 Frame Standard', description: 'FE EA 10 LL 64 [icon] [text]' },
  { id: 'v1_frame_split_nul', label: '30. V1 Frame Split NUL', description: 'FE EA 10 LL 64 [icon] [title] 0 [body] 0' },
  { id: 'payload_len_only', label: '31. Payload-Only Length', description: 'FE EA 20 payLen 64 [icon] [text]' },
  { id: 'raw_no_header', label: '32. Raw Unframed 0x64', description: '64 [icon] [text]' },
  { id: 'icon16be_v2_01', label: '33. 16-bit Icon + 0x01', description: '[0x00] [icon] [0x01] [text]' },
  { id: 'icon_len16be_utf8', label: '34. 16-bit Len BE', description: '[icon] [lenHi] [lenLo] [text]' },
  { id: 'utf16le_nul', label: '35. UTF-16LE + NUL', description: '[icon] [utf16le] [0x00] [0x00]' },
  { id: 'v2_flag01_utf16le', label: '36. V2 0x01 + UTF-16LE', description: '[icon] [0x01] [utf16le]' },
];

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
  { id: 0xff, key: 'other_all', label: 'All / Other' },
];

export const GATT_UUIDS = {
  SERVICE_FEEA: '0000feea-0000-1000-8000-00805f9b34fb',
  CHAR_ACTIVITY: '0000fee1-0000-1000-8000-00805f9b34fb',
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
  SERVICE_ALERT_NOTIFICATION: 0x1811,
  CHAR_NEW_ALERT: 0x2a46,
  SERVICE_HEART_RATE: 0x180d,
  CHAR_HEART_RATE_MEASUREMENT: 0x2a37,
  SERVICE_PULSE_OXIMETER: 0x1822,
  CHAR_PLX_SPOT_CHECK: 0x2a5e,
  CHAR_PLX_CONTINUOUS: 0x2a5f,
} as const;

export const FEEA_CMD = {
  // Set/Get pairs follow get = set + 0x10 (e.g., 0x11/0x21, 0x27/0x37, 0x31/0x41)
  SET_ALARMS: 0x11,
  GET_ALARMS: 0x21,
  SET_TIME_FORMAT: 0x27,
  GET_TIME_FORMAT: 0x37,
  SET_TIME: 0x31,
  GET_TIME: 0x41,
  FIND_WATCH: 0x61,
  PUSH_NOTIFICATION: 0x64,
  MEASURE_BLOOD_PRESSURE: 0x69, // 0x69 start / 0x6A stop single Blood Pressure
  STOP_BLOOD_PRESSURE: 0x6a,
  MEASURE_SPO2: 0x6b, // 0x6B start / 0x6C stop SpO2
  STOP_SPO2: 0x6c,
  MEASURE_HEART_RATE: 0x6d, // 0x6D start / 0x6E stop single Heart Rate
  STOP_HEART_RATE: 0x6e,
  GET_TODAY_ACTIVITY: 0x81, // Empty-payload get request for today's steps & distance
  WORKOUT: 0xb2, // sub-cmd: 0x00 list req, 0x01 list resp
  ADVANCED: 0xb9, // sub-commands follow get = set + 0x10
} as const;

export const FEEA_SUBCMD = {
  WORKOUT_LIST_REQ: 0x00,
  WORKOUT_LIST_RESP: 0x01,
  ADV_ECARD: 0x12,
} as const;

export interface ParsedHealthPacket {
  type: 'none' | 'activity' | 'heartRate' | 'spo2' | 'bloodPressure' | 'battery';
  dayOffset: number;
  steps: number;
  distanceMeters: number;
  heartRateBpm: number;
  spo2Percent: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  batteryPercent: number;
}

export function detectProtocolFromManufacturer(manufacturer: string): ProtocolVersion {
  const upper = manufacturer.trim().toUpperCase();
  if (!upper || upper === '-') return 'unknown';
  if (upper.endsWith('-V2') || upper.includes('V2')) return 'v2';
  return 'v1';
}

export function detectProtocolFromIncomingFrame(frame: Uint8Array): ProtocolVersion {
  if (frame.length < 4 || frame[0] !== 0xfe || frame[1] !== 0xea) return 'unknown';
  const prefix = frame[2] & 0xf0;
  if (prefix === 0x10) return 'v1';
  if (prefix === 0x20) return 'v2';
  return 'unknown';
}

export function maxPacketBytes(version: 'v1' | 'v2', firmwareRevision = ''): number {
  // V2 uses MTU-chunked variable-length packets (up to 12-bit 4095-byte frame limit).
  // V1 (non-MTU fixed-size mode) uses 256-byte packets for firmware >= 1.6.5, and 64 otherwise.
  if (version !== 'v1') return 4095;
  const match = firmwareRevision.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (match) {
    const major = Number.parseInt(match[1], 10);
    const minor = Number.parseInt(match[2], 10);
    const patch = match[3] ? Number.parseInt(match[3], 10) : 0;
    if (major > 1 || (major === 1 && (minor > 6 || (minor === 6 && patch >= 5)))) {
      return 256;
    }
  }
  return 64;
}

export function maxNotificationTextBytes(version: 'v1' | 'v2', firmwareRevision = ''): number {
  // Notification frame overhead = 5 (header + size + cmd) + 1 (iconId) = 6 bytes
  const limit = maxPacketBytes(version, firmwareRevision);
  return Math.max(16, Math.min(128, limit - 6));
}

export function getCommandForSet(setCommand: number): number {
  return (setCommand + 0x10) & 0xff;
}

export function expectedFrameLength(chunk: Uint8Array): number {
  if (chunk.length < 4 || chunk[0] !== 0xfe || chunk[1] !== 0xea) return -1;
  const prefix = chunk[2] & 0xf0;
  if (prefix === 0x10 || prefix === 0x20) {
    const len = ((chunk[2] & 0x0f) << 8) | chunk[3];
    return len >= 5 && len <= 4095 ? len : -1;
  }
  return -1;
}

export function describeIncomingFrame(frame: Uint8Array): string {
  if (frame.length < 5 || frame[0] !== 0xfe || frame[1] !== 0xea) {
    return 'Watch Response';
  }
  const cmd = frame[4];
  const hexCmd = `0x${cmd.toString(16).padStart(2, '0').toUpperCase()}`;
  if (cmd === FEEA_CMD.GET_TIME) return `Time Response (${hexCmd})`;
  if (cmd === FEEA_CMD.GET_TIME_FORMAT) return `Time Format (${hexCmd})`;
  if (cmd === FEEA_CMD.GET_ALARMS) return `Alarms (${hexCmd})`;
  if (cmd === FEEA_CMD.MEASURE_BLOOD_PRESSURE || cmd === FEEA_CMD.STOP_BLOOD_PRESSURE)
    return `Blood Pressure (${hexCmd})`;
  if (cmd === FEEA_CMD.MEASURE_SPO2 || cmd === FEEA_CMD.STOP_SPO2) return `SpO2 (${hexCmd})`;
  if (
    cmd === FEEA_CMD.MEASURE_HEART_RATE ||
    cmd === FEEA_CMD.STOP_HEART_RATE ||
    cmd === 0x6f ||
    cmd === 0x67 ||
    cmd === 0x68
  )
    return `Heart Rate (${hexCmd})`;
  if (cmd === FEEA_CMD.GET_TODAY_ACTIVITY) return `Steps & Distance (${hexCmd})`;
  if (cmd === FEEA_CMD.WORKOUT && frame.length >= 6) {
    const sub = frame[5].toString(16).padStart(2, '0').toUpperCase();
    return `Workout (${hexCmd} ${sub})`;
  }
  if (cmd === FEEA_CMD.ADVANCED && frame.length >= 6) {
    const sub = frame[5].toString(16).padStart(2, '0').toUpperCase();
    return `Advanced (${hexCmd} ${sub})`;
  }
  return `Watch Response (${hexCmd})`;
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
  // Verified 0xFEEA wire format:
  //   V1: [0xFE] [0xEA] [0x10 + size_hi] [size_lo] [cmd] [payload...]
  //   V2: [0xFE] [0xEA] [0x20 + size_hi] [size_lo] [cmd] [payload...]
  // Total size includes UUID (2), size (2), command (1), and payload (N) => min 5 bytes.
  const totalLen = Math.min(4095, 5 + payload.length);
  const prefix = version === 'v1' ? 0x10 : 0x20;
  const out = new Uint8Array(totalLen);
  out[0] = 0xfe;
  out[1] = 0xea;
  out[2] = (prefix + ((totalLen >> 8) & 0x0f)) & 0xff;
  out[3] = totalLen & 0xff;
  out[4] = command & 0xff;
  out.set(payload, 5);
  return out;
}

export function encodeGetCommand(version: 'v1' | 'v2', getCommand: number): Uint8Array {
  // Get requests carry no payload (size = 5); watch responds with same cmd + payload.
  return framePacket(version, getCommand, new Uint8Array(0));
}

export function encodeSubCommand(
  version: 'v1' | 'v2',
  command: number,
  subPayload: Uint8Array
): Uint8Array {
  return framePacket(version, command, subPayload);
}

export function encodeSyncTime(
  version: 'v1' | 'v2',
  date: Date,
  utcOffsetMinutes: number
): Uint8Array {
  // Verified 0x31 payload (5 bytes, totalLen = 10): [epochSec BE (4B)] [tzHours int8 (1B)]
  const tzHours = Math.max(-12, Math.min(14, Math.trunc(utcOffsetMinutes / 60)));
  const remainderMinutes = utcOffsetMinutes - tzHours * 60;
  const adjustedEpoch = Math.max(0, Math.floor(date.getTime() / 1000) + remainderMinutes * 60) >>> 0;

  const payload = new Uint8Array(5);
  payload[0] = (adjustedEpoch >>> 24) & 0xff;
  payload[1] = (adjustedEpoch >>> 16) & 0xff;
  payload[2] = (adjustedEpoch >>> 8) & 0xff;
  payload[3] = adjustedEpoch & 0xff;
  payload[4] = tzHours & 0xff;

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

function encodeUtf16Le(input: string, maxBytes: number): Uint8Array {
  const safeMax = Math.max(2, maxBytes - (maxBytes % 2));
  const codeUnits = Math.min(input.length, Math.floor(safeMax / 2));
  const out = new Uint8Array(codeUnits * 2);
  for (let i = 0; i < codeUnits; i += 1) {
    const unit = input.charCodeAt(i);
    out[i * 2] = unit & 0xff;
    out[i * 2 + 1] = (unit >> 8) & 0xff;
  }
  return out;
}

function encodeUtf16Be(input: string, maxBytes: number): Uint8Array {
  const safeMax = Math.max(2, maxBytes - (maxBytes % 2));
  const codeUnits = Math.min(input.length, Math.floor(safeMax / 2));
  const out = new Uint8Array(codeUnits * 2);
  for (let i = 0; i < codeUnits; i += 1) {
    const unit = input.charCodeAt(i);
    out[i * 2] = (unit >> 8) & 0xff;
    out[i * 2 + 1] = unit & 0xff;
  }
  return out;
}

function concatBytes(...parts: Array<Uint8Array | number[]>): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function getNotificationMetrics(
  title: string,
  body: string,
  mtuSize: number,
  format: NotificationFormat = 'standard'
): { utf8Bytes: number; truncatedBytes: number; chunks: number } {
  const formatted = formatNotificationText(title, body);
  const isUtf16 =
    format === 'utf16le' ||
    format === 'utf16be' ||
    format === 'utf16le_nul' ||
    format === 'v2_flag01_utf16le';
  const fullBytes = isUtf16 ? formatted.length * 2 : textEncoder.encode(formatted).length;
  const capped = Math.min(128, fullBytes);
  const baseOverhead = format === 'raw_no_header' ? 2 : 6;
  const frameSize = baseOverhead + 2 + capped;
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
  maxUtf8Bytes = 128,
  format: NotificationFormat = 'standard'
): Uint8Array {
  const clampedMax = Math.max(16, Math.min(240, maxUtf8Bytes));
  const wireIcon = iconId & 0xff;
  const highBitIcon = (wireIcon | 0x80) & 0xff;

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const effectiveTitle = trimmedTitle || 'Alert';
  const formatted = formatNotificationText(title, body);
  const textBytes = truncateUtf8(formatted, clampedMax);

  const makeSplitNul = (prefix: number[], trailingNul: boolean): Uint8Array => {
    const titleBytes = truncateUtf8(effectiveTitle, Math.min(48, clampedMax - 4));
    const overhead = prefix.length + 1 + (trailingNul ? 1 : 0);
    const remaining = Math.max(0, clampedMax - titleBytes.length - overhead);
    const bodyBytes = trimmedBody ? truncateUtf8(trimmedBody, remaining) : new Uint8Array(0);
    return concatBytes(
      [wireIcon, ...prefix],
      titleBytes,
      [0x00],
      bodyBytes,
      trailingNul ? [0x00] : []
    );
  };

  const makeSplitLen = (prefix: number[]): Uint8Array => {
    const titleBytes = truncateUtf8(effectiveTitle, Math.min(48, clampedMax - 4));
    const overhead = prefix.length + 3;
    const remaining = Math.max(0, clampedMax - titleBytes.length - overhead);
    const bodyBytes = trimmedBody ? truncateUtf8(trimmedBody, remaining) : new Uint8Array(0);
    return concatBytes(
      [wireIcon, ...prefix, titleBytes.length & 0xff],
      titleBytes,
      [bodyBytes.length & 0xff],
      bodyBytes
    );
  };

  switch (format) {
    case 'v2_version_01':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x01], textBytes));
    case 'v2_version_02':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x02], textBytes));
    case 'v2_header':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x00], textBytes));
    case 'split_len':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitLen([]));
    case 'split_title':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([], true));
    case 'nul':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon], textBytes, [0x00]));
    case 'length_prefixed':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon, textBytes.length & 0xff], textBytes)
      );
    case 'utf16le':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon], encodeUtf16Le(formatted, clampedMax))
      );
    case 'utf16be':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon], encodeUtf16Be(formatted, clampedMax))
      );
    case 'newline_split': {
      const nl = trimmedTitle && trimmedBody ? `${trimmedTitle}\n${trimmedBody}` : formatted;
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon], truncateUtf8(nl, clampedMax))
      );
    }
    case 'split_title_notrail':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([], false));
    case 'high_bit_icon':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([highBitIcon], textBytes));
    case 'high_bit_v2_00':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([highBitIcon, 0x00], textBytes));
    case 'high_bit_v2_01':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([highBitIcon, 0x01], textBytes));
    case 'v2_flag01_split_nul':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([0x01], true));
    case 'v2_flag02_split_nul':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([0x02], true));
    case 'v2_flag00_split_nul':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([0x00], true));
    case 'v2_flag01_split_len':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, makeSplitLen([0x01]));
    case 'v2_flag00_len_utf8':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon, 0x00, textBytes.length & 0xff], textBytes)
      );
    case 'v2_flag01_len_utf8':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon, 0x01, textBytes.length & 0xff], textBytes)
      );
    case 'action01_icon':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([0x01, wireIcon], textBytes));
    case 'action00_icon':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([0x00, wireIcon], textBytes));
    case 'action01_icon_len':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([0x01, wireIcon, textBytes.length & 0xff], textBytes)
      );
    case 'paged_01_01':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x01, 0x01], textBytes));
    case 'header_00_01':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x00, 0x01], textBytes));
    case 'header_01_00':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x01, 0x00], textBytes));
    case 'header_00_00':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon, 0x00, 0x00], textBytes));
    case 'v1_frame_standard':
      return framePacket('v1', FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon], textBytes));
    case 'v1_frame_split_nul':
      return framePacket('v1', FEEA_CMD.PUSH_NOTIFICATION, makeSplitNul([], true));
    case 'payload_len_only': {
      const payload = concatBytes([wireIcon], textBytes);
      const payLen = Math.min(4095, payload.length);
      const prefix = version === 'v1' ? 0x10 : 0x20;
      return concatBytes(
        [0xfe, 0xea, (prefix + ((payLen >> 8) & 0x0f)) & 0xff, payLen & 0xff, FEEA_CMD.PUSH_NOTIFICATION],
        payload
      );
    }
    case 'raw_no_header':
      return concatBytes([FEEA_CMD.PUSH_NOTIFICATION, wireIcon], textBytes);
    case 'icon16be_v2_01':
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([0x00, wireIcon, 0x01], textBytes));
    case 'icon_len16be_utf8':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon, (textBytes.length >> 8) & 0xff, textBytes.length & 0xff], textBytes)
      );
    case 'utf16le_nul':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon], encodeUtf16Le(formatted, clampedMax), [0x00, 0x00])
      );
    case 'v2_flag01_utf16le':
      return framePacket(
        version,
        FEEA_CMD.PUSH_NOTIFICATION,
        concatBytes([wireIcon, 0x01], encodeUtf16Le(formatted, clampedMax))
      );
    case 'standard':
    default:
      return framePacket(version, FEEA_CMD.PUSH_NOTIFICATION, concatBytes([wireIcon], textBytes));
  }
}

export function encodeStandardNewAlert(
  iconId: number,
  title: string,
  body: string
): Uint8Array {
  // Standard Bluetooth SIG Alert Notification Service (0x1811 / 0x2A46 New Alert):
  // [Category ID (1B)] [Number of New Alerts (1B)] [UTF-8 Text <= 18 bytes]
  let categoryId = 0x00; // Simple Alert
  if (iconId === 0x00) categoryId = 0x03; // Call
  else if (iconId === 0x01) categoryId = 0x05; // SMS / MMS
  else if (iconId === 0x0b) categoryId = 0x01; // Email
  else if (iconId === 0x0e) categoryId = 0x07; // Schedule

  const text = formatNotificationText(title, body) || 'Alert';
  const textBytes = truncateUtf8(text, 18);
  const out = new Uint8Array(2 + textBytes.length);
  out[0] = categoryId;
  out[1] = 0x01;
  out.set(textBytes, 2);
  return out;
}

export function encodeFindWatch(version: 'v1' | 'v2'): Uint8Array {
  // Verified 0x61 Find Watch frame uses an empty payload (totalLen = 5)
  return encodeGetCommand(version, FEEA_CMD.FIND_WATCH);
}

export function encodeGetTodayActivity(version: 'v1' | 'v2'): Uint8Array {
  // Empty-payload get request for today's steps & distance: FE EA 10/20 05 81
  return encodeGetCommand(version, FEEA_CMD.GET_TODAY_ACTIVITY);
}

export function encodeMeasureBloodPressure(version: 'v1' | 'v2'): Uint8Array {
  // Verified 0xFEEA Blood Pressure (BP) trigger: FE EA 10/20 06 69 00
  return framePacket(version, FEEA_CMD.MEASURE_BLOOD_PRESSURE, new Uint8Array([0x00]));
}

export function encodeMeasureHeartRate(version: 'v1' | 'v2'): Uint8Array {
  // Single Heart Rate trigger matching 0x69 BP / 0x6B SpO2 convention: FE EA 10/20 06 6D 00
  return framePacket(version, FEEA_CMD.MEASURE_HEART_RATE, new Uint8Array([0x00]));
}

export function encodeMeasureSpo2(version: 'v1' | 'v2'): Uint8Array {
  // Verified 0xFEEA Blood Oxygen (SpO2) trigger: FE EA 10/20 06 6B 00
  return framePacket(version, FEEA_CMD.MEASURE_SPO2, new Uint8Array([0x00]));
}

export function encodeWorkoutListRequest(version: 'v1' | 'v2'): Uint8Array {
  // Workout list request: 0xB2 00 (watch responds with 0xB2 01 + list)
  return encodeSubCommand(version, FEEA_CMD.WORKOUT, new Uint8Array([FEEA_SUBCMD.WORKOUT_LIST_REQ]));
}

function readUint24BE(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
}

function readUint24LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16);
}

function decodeStepsAndDistance(
  buf: Uint8Array,
  offset: number
): { steps: number; distanceMeters: number } | null {
  if (buf.length < offset + 3) return null;
  const stepsBE = readUint24BE(buf, offset);
  const stepsLE = readUint24LE(buf, offset);
  const beOk = stepsBE >= 0 && stepsBE <= 200_000;
  const leOk = stepsLE >= 0 && stepsLE <= 200_000;

  let useBE = true;
  if (beOk && !leOk) {
    useBE = true;
  } else if (leOk && !beOk) {
    useBE = false;
  } else if (!beOk && !leOk) {
    return null;
  } else {
    let decided = false;
    if (buf.length >= offset + 6) {
      const distBE = readUint24BE(buf, offset + 3);
      const distLE = readUint24LE(buf, offset + 3);
      const beDistOk = distBE >= 0 && distBE <= 250_000;
      const leDistOk = distLE >= 0 && distLE <= 250_000;
      if (leDistOk && !beDistOk) {
        useBE = false;
        decided = true;
      } else if (beDistOk && !leDistOk) {
        useBE = true;
        decided = true;
      }
    }
    if (!decided && stepsLE !== stepsBE) {
      useBE = stepsBE < stepsLE;
    }
  }

  const steps = useBE ? stepsBE : stepsLE;
  let distanceMeters = Math.round(steps * 0.75);
  if (buf.length >= offset + 6) {
    const dist = useBE ? readUint24BE(buf, offset + 3) : readUint24LE(buf, offset + 3);
    if (dist >= 0 && dist <= 250_000) {
      distanceMeters = dist === 0 && steps > 0 ? Math.round(steps * 0.75) : dist;
    }
  } else if (buf.length >= offset + 5) {
    const dist16 = useBE
      ? (buf[offset + 3] << 8) | buf[offset + 4]
      : buf[offset + 3] | (buf[offset + 4] << 8);
    distanceMeters = dist16 === 0 && steps > 0 ? Math.round(steps * 0.75) : dist16;
  }

  return { steps, distanceMeters };
}

export function parseFee1Activity(value: Uint8Array): ParsedHealthPacket {
  const empty: ParsedHealthPacket = {
    type: 'none',
    dayOffset: 0,
    steps: 0,
    distanceMeters: 0,
    heartRateBpm: 0,
    spo2Percent: 0,
    systolicMmHg: 0,
    diastolicMmHg: 0,
    batteryPercent: -1,
  };
  if (value.length === 0) return empty;
  if (value.length >= 6 && value[0] === 0xfe && value[1] === 0xea) {
    return parseFeeaHealthResponse(value);
  }
  const decoded = decodeStepsAndDistance(value, 0);
  if (decoded) {
    return {
      ...empty,
      type: 'activity',
      dayOffset: 0,
      steps: decoded.steps,
      distanceMeters: decoded.distanceMeters,
    };
  }
  return empty;
}

export function parseFeeaHealthResponse(frame: Uint8Array): ParsedHealthPacket {
  const empty: ParsedHealthPacket = {
    type: 'none',
    dayOffset: 0,
    steps: 0,
    distanceMeters: 0,
    heartRateBpm: 0,
    spo2Percent: 0,
    systolicMmHg: 0,
    diastolicMmHg: 0,
    batteryPercent: -1,
  };
  if (frame.length < 6 || frame[0] !== 0xfe || frame[1] !== 0xea) {
    return empty;
  }

  const cmd = frame[4];
  const payload = frame.subarray(5);

  if ((cmd === FEEA_CMD.GET_TODAY_ACTIVITY || cmd === 0x09) && payload.length >= 3) {
    let offset = 0;
    let dayOffset = 0;
    // Only treat byte 0 as a dayOffset when the payload explicitly carries 1 + 6 or 1 + 9 bytes.
    // Standard 6-byte [steps(3), dist(3)] or 9-byte [steps(3), dist(3), cal(3)] payloads start at 0.
    if ((payload.length === 7 || payload.length === 10) && payload[0] <= 6) {
      dayOffset = payload[0];
      offset = 1;
    }
    const decoded = decodeStepsAndDistance(payload, offset);
    if (decoded) {
      return {
        ...empty,
        type: 'activity',
        dayOffset,
        steps: decoded.steps,
        distanceMeters: decoded.distanceMeters,
      };
    }
  }

  if (
    (cmd === FEEA_CMD.MEASURE_BLOOD_PRESSURE || cmd === FEEA_CMD.STOP_BLOOD_PRESSURE) &&
    payload.length >= 2
  ) {
    // Handles both [systolic, diastolic] and [status, systolic, diastolic]
    for (let i = payload.length - 2; i >= 0; i -= 1) {
      const sys = payload[i];
      const dia = payload[i + 1];
      if (sys >= 70 && sys <= 240 && dia >= 40 && dia <= 150 && sys > dia) {
        return {
          ...empty,
          type: 'bloodPressure',
          systolicMmHg: sys,
          diastolicMmHg: dia,
        };
      }
    }
  }

  if (
    (cmd === FEEA_CMD.MEASURE_HEART_RATE ||
      cmd === FEEA_CMD.STOP_HEART_RATE ||
      cmd === 0x6f ||
      cmd === 0x67 ||
      cmd === 0x68 ||
      cmd === 0x0a) &&
    payload.length >= 1
  ) {
    for (let i = payload.length - 1; i >= 0; i -= 1) {
      const bpm = payload[i];
      if (bpm >= 30 && bpm <= 220) {
        return {
          ...empty,
          type: 'heartRate',
          heartRateBpm: bpm,
        };
      }
    }
  }

  if (
    (cmd === FEEA_CMD.MEASURE_SPO2 ||
      cmd === FEEA_CMD.STOP_SPO2 ||
      cmd === 0x72 ||
      cmd === 0x73 ||
      cmd === 0x80 ||
      cmd === 0x82 ||
      cmd === 0x0b) &&
    payload.length >= 1
  ) {
    for (let i = payload.length - 1; i >= 0; i -= 1) {
      const spo2 = payload[i];
      if (spo2 >= 70 && spo2 <= 100) {
        return {
          ...empty,
          type: 'spo2',
          spo2Percent: spo2,
        };
      }
    }
  }

  // Note: 0x41 is Get Time (0x31 + 0x10), not Battery. Only parse dedicated 1-byte battery frames.
  if (cmd === 0x04 && payload.length === 1) {
    const batt = payload[0];
    if (batt >= 0 && batt <= 100) {
      return {
        ...empty,
        type: 'battery',
        batteryPercent: batt,
      };
    }
  }

  return empty;
}

export function parseStandardHeartRate(data: Uint8Array): number | null {
  if (data.length < 2) return null;
  const flags = data[0];
  const is16Bit = (flags & 0x01) !== 0;
  let bpm = 0;
  if (is16Bit && data.length >= 3) {
    bpm = data[1] | (data[2] << 8);
  } else {
    bpm = data[1];
  }
  return bpm >= 30 && bpm <= 220 ? bpm : null;
}

export function parseStandardSpo2(data: Uint8Array): number | null {
  if (data.length < 3) return null;
  const raw = data[1] | (data[2] << 8);
  let mantissa = raw & 0x0fff;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x0f;
  if (exponent >= 0x08) exponent -= 0x10;
  const value = Math.round(mantissa * Math.pow(10, exponent));
  if (value >= 70 && value <= 100) {
    return value;
  }
  const plain = data[1];
  return plain >= 70 && plain <= 100 ? plain : null;
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
