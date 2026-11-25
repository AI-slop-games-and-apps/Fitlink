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
  GET_ACTIVITY: 0x51,
  GET_ACTIVITY_HIST: 0x52,
  FIND_WATCH: 0x61,
  PUSH_NOTIFICATION: 0x64,
  MEASURE_SPO2: 0x6b,
  MEASURE_DYNAMIC_HR: 0x6d,
  MEASURE_HEART_RATE: 0x6f,
  WORKOUT: 0xb2, // sub-cmd: 0x00 list req, 0x01 list resp
  ADVANCED: 0xb9, // sub-commands follow get = set + 0x10
} as const;

export const FEEA_SUBCMD = {
  WORKOUT_LIST_REQ: 0x00,
  WORKOUT_LIST_RESP: 0x01,
  ADV_ECARD: 0x12,
} as const;

export interface ParsedHealthPacket {
  type: 'none' | 'activity' | 'heartRate' | 'spo2' | 'battery';
  dayOffset: number;
  steps: number;
  distanceMeters: number;
  heartRateBpm: number;
  spo2Percent: number;
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
  // Notification frame overhead = 5 (header + size + cmd) + 2 (icon + textLen) = 7 bytes
  const limit = maxPacketBytes(version, firmwareRevision);
  return Math.max(16, Math.min(128, limit - 7));
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
  if (cmd === FEEA_CMD.GET_ACTIVITY || cmd === FEEA_CMD.GET_ACTIVITY_HIST) return `Activity Response (${hexCmd})`;
  if (cmd === FEEA_CMD.MEASURE_HEART_RATE || cmd === FEEA_CMD.MEASURE_DYNAMIC_HR) return `Heart Rate (${hexCmd})`;
  if (cmd === FEEA_CMD.MEASURE_SPO2) return `SpO2 (${hexCmd})`;
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
  // Verified 0x61 Find Watch frame uses an empty payload (totalLen = 5)
  return encodeGetCommand(version, FEEA_CMD.FIND_WATCH);
}

export function encodeGetActivity(version: 'v1' | 'v2'): Uint8Array {
  // Empty-payload get request for today's activity summary (totalLen = 5: FE EA 10/20 05 51)
  return encodeGetCommand(version, FEEA_CMD.GET_ACTIVITY);
}

export function encodeGetActivityHistory(version: 'v1' | 'v2', dayOffset: number): Uint8Array {
  const safeOffset = Math.max(1, Math.min(6, Math.trunc(dayOffset)));
  return framePacket(version, FEEA_CMD.GET_ACTIVITY_HIST, new Uint8Array([safeOffset & 0xff]));
}

export function encodeMeasureHeartRate(version: 'v1' | 'v2'): Uint8Array {
  // Verified 0xFEEA single Heart Rate trigger: FE EA 10/20 06 6F 00
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
  } else if (buf.length >= offset + 6) {
    const distBE = readUint24BE(buf, offset + 3);
    const distLE = readUint24LE(buf, offset + 3);
    if (distLE <= 250_000 && distBE > 250_000) {
      useBE = false;
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
    batteryPercent: -1,
  };
  if (frame.length < 6 || frame[0] !== 0xfe || frame[1] !== 0xea) {
    return empty;
  }

  const cmd = frame[4];
  const payload = frame.subarray(5);

  if ((cmd === FEEA_CMD.GET_ACTIVITY || cmd === FEEA_CMD.GET_ACTIVITY_HIST || cmd === 0x09) && payload.length >= 3) {
    let offset = 0;
    let dayOffset = 0;
    if (payload.length >= 7 && payload[0] <= 6) {
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
    (cmd === FEEA_CMD.MEASURE_HEART_RATE ||
      cmd === FEEA_CMD.MEASURE_DYNAMIC_HR ||
      cmd === 0x6a ||
      cmd === 0x69 ||
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
      cmd === 0x6c ||
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
