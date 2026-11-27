import {
  FEEA_CMD,
  GATT_UUIDS,
  bytesToHex,
  chunkPacket,
  describeIncomingFrame,
  detectProtocolFromManufacturer,
  expectedFrameLength,
  framePacket,
  parseFee1Activity,
  parseFeeaHealthResponse,
  parseStandardHeartRate,
  parseStandardSpo2,
  type ProtocolVersion,
} from './feeaCodec';

export interface WatchDeviceInfo {
  manufacturer: string;
  model: string;
  firmware: string;
  hardware: string;
}

export interface BleConnectionResult {
  deviceName: string;
  deviceId: string;
  batteryLevel: number | null;
  deviceInfo: WatchDeviceInfo;
  detectedProtocol: ProtocolVersion;
  isVirtual: boolean;
  discoveredServicesSummary?: string;
  feeaCharacteristicsSummary?: string;
}

// Minimal Web Bluetooth structural types to avoid global DOM type dependency gaps
interface WebBleCharacteristic {
  uuid: string;
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    read: boolean;
  };
  readValue(): Promise<DataView>;
  writeValueWithResponse?(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(value: Uint8Array): Promise<void>;
  writeValue?(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<WebBleCharacteristic>;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

interface WebBleService {
  uuid?: string;
  getCharacteristic(uuid: string | number): Promise<WebBleCharacteristic>;
  getCharacteristics(): Promise<WebBleCharacteristic[]>;
}

interface WebBleGattServer {
  connected: boolean;
  connect(): Promise<WebBleGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string | number): Promise<WebBleService>;
  getPrimaryServices?(): Promise<WebBleService[]>;
}

interface WebBleDevice {
  id: string;
  name?: string;
  gatt?: WebBleGattServer;
  addEventListener(type: string, listener: () => void): void;
}

interface WebBluetoothApi {
  requestDevice(options: Record<string, unknown>): Promise<WebBleDevice>;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

const textDecoder = new TextDecoder('utf-8');

export class WebBleWatchSession {
  private device: WebBleDevice | null = null;
  private gatt: WebBleGattServer | null = null;
  private activityChar: WebBleCharacteristic | null = null;
  private dataOutChar: WebBleCharacteristic | null = null;
  private batteryChar: WebBleCharacteristic | null = null;
  private alertLevelChar: WebBleCharacteristic | null = null;
  private newAlertChar: WebBleCharacteristic | null = null;
  private rxBuffer: Uint8Array = new Uint8Array(0);
  private rxExpectedLen = 0;
  private virtual = false;
  private virtualSyncCount = 0;

  onDisconnected?: () => void;
  onBatteryChanged?: (level: number) => void;
  onDataReceived?: (hex: string, label?: string) => void;
  onActivityDataReceived?: (dayOffset: number, steps: number, distanceMeters: number) => void;
  onHeartRateReceived?: (bpm: number) => void;
  onSpo2Received?: (spo2: number) => void;
  onBloodPressureReceived?: (systolic: number, diastolic: number) => void;
  onWatchActionReceived?: (actionCode: number) => void;

  get isVirtual(): boolean {
    return this.virtual;
  }

  get hasAlertNotificationService(): boolean {
    return this.newAlertChar !== null;
  }

  async connectVirtual(modelVariant: 'v2' | 'v1' = 'v2'): Promise<BleConnectionResult> {
    this.disconnect();
    this.virtual = true;
    await new Promise((resolve) => setTimeout(resolve, 260));

    const isV2 = modelVariant === 'v2';
    const deviceInfo: WatchDeviceInfo = isV2
      ? {
          manufacturer: 'BLE-WATCH-V2',
          model: 'Watch V2 Demo',
          firmware: 'FEEA-2.0.4',
          hardware: 'HW-REV2',
        }
      : {
          manufacturer: 'BLE-WATCH-V1',
          model: 'Watch V1 Demo',
          firmware: 'FEEA-1.4.2',
          hardware: 'HW-REV1',
        };

    return {
      deviceName: isV2 ? 'Watch V2 Demo' : 'Watch V1 Demo',
      deviceId: isV2 ? 'C4:7C:8D:6A:19:E2' : 'D8:2A:4F:11:09:B4',
      batteryLevel: isV2 ? 84 : 67,
      deviceInfo,
      detectedProtocol: detectProtocolFromManufacturer(deviceInfo.manufacturer),
      isVirtual: true,
    };
  }

  async connectWebBluetooth(showAllDevices: boolean): Promise<BleConnectionResult> {
    if (!isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome, Edge, or Brave, or connect a simulated watch.');
    }

    this.disconnect();
    this.virtual = false;

    const bluetooth = (navigator as unknown as { bluetooth: WebBluetoothApi }).bluetooth;
    const optionalServices: Array<string | number> = [
      GATT_UUIDS.SERVICE_FEEA,
      GATT_UUIDS.SERVICE_BATTERY,
      GATT_UUIDS.SERVICE_DEVICE_INFO,
      GATT_UUIDS.SERVICE_IMMEDIATE_ALERT,
      GATT_UUIDS.SERVICE_ALERT_NOTIFICATION,
      GATT_UUIDS.SERVICE_HEART_RATE,
      GATT_UUIDS.SERVICE_PULSE_OXIMETER,
      0xfeef,
      0xfee0,
      0xfee7,
      0xff00,
      0xfff0,
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    ];

    const requestOptions = showAllDevices
      ? { acceptAllDevices: true, optionalServices }
      : {
          filters: [
            { services: [GATT_UUIDS.SERVICE_FEEA] },
            { namePrefix: 'Watch' },
            { namePrefix: 'Band' },
          ],
          optionalServices,
        };

    const device = await bluetooth.requestDevice(requestOptions);
    if (!device.gatt) {
      throw new Error('Selected device does not expose a GATT server.');
    }

    this.device = device;
    device.addEventListener('gattserverdisconnected', () => {
      this.cleanupHandles();
      this.onDisconnected?.();
    });

    const gatt = await device.gatt.connect();
    this.gatt = gatt;

    // 1. Device Information service (0x180A) first so V1/V2 protocol version is known immediately
    const deviceInfo: WatchDeviceInfo = {
      manufacturer: '-',
      model: '-',
      firmware: '-',
      hardware: '-',
    };
    try {
      const infoSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_DEVICE_INFO);
      const readText = async (uuid: number): Promise<string> => {
        try {
          const ch = await infoSvc.getCharacteristic(uuid);
          const dv = await ch.readValue();
          return textDecoder.decode(dv).replace(/\0/g, '').trim() || '-';
        } catch {
          return '-';
        }
      };
      deviceInfo.manufacturer = await readText(GATT_UUIDS.CHAR_MANUFACTURER_NAME);
      deviceInfo.model = await readText(GATT_UUIDS.CHAR_MODEL_NUMBER);
      deviceInfo.firmware = await readText(GATT_UUIDS.CHAR_FIRMWARE_REV);
      deviceInfo.hardware = await readText(GATT_UUIDS.CHAR_HARDWARE_REV);
    } catch {
      // Optional on some watches
    }

    let discoveredServicesSummary = '';
    try {
      if (gatt.getPrimaryServices) {
        const services = await gatt.getPrimaryServices();
        discoveredServicesSummary = services
          .map((s) => (s.uuid ? s.uuid.slice(0, 8).toUpperCase() : '?'))
          .join(', ');
      }
    } catch {
      // Optional depending on browser Web Bluetooth implementation
    }

    // 2. Discover 0xFEEA BLE service (0xFEE1 activity, 0xFEE2 write, 0xFEE3 notify)
    let feeaCharacteristicsSummary = '';
    try {
      const feeaSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_FEEA);
      const chars = await feeaSvc.getCharacteristics();

      feeaCharacteristicsSummary = chars
        .map((c) => {
          const props: string[] = [];
          if (c.properties.read) props.push('R');
          if (c.properties.write) props.push('W');
          if (c.properties.writeWithoutResponse) props.push('WNR');
          if (c.properties.notify) props.push('N');
          return `${c.uuid.slice(0, 8).toUpperCase()}[${props.join(',')}]`;
        })
        .join(' ');

      this.activityChar = chars.find((c) => c.uuid === GATT_UUIDS.CHAR_ACTIVITY) ?? null;
      this.dataOutChar =
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_OUT) ??
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_OUT_ALT) ??
        chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) ??
        null;

      const dataInChar =
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_IN) ??
        chars.find((c) => c.uuid !== GATT_UUIDS.CHAR_ACTIVITY && c.properties.notify) ??
        null;

      if (dataInChar) {
        try {
          await dataInChar.startNotifications();
          dataInChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
            const target = ev.target as unknown as { value?: DataView };
            if (target?.value) {
              const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
              this.handleIncomingFeeaChunk(bytes);
            }
          });
        } catch {
          // Non-fatal: watch may still accept outbound commands
        }
      }

      if (this.activityChar) {
        if (this.activityChar.properties.notify) {
          try {
            await this.activityChar.startNotifications();
            this.activityChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
              const target = ev.target as unknown as { value?: DataView };
              if (target?.value) {
                const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
                this.onDataReceived?.(bytesToHex(bytes), 'Activity Telemetry (0xFEE1)');
                this.dispatchParsedHealth(parseFee1Activity(bytes));
              }
            });
          } catch {
            // Non-fatal
          }
        }
      }

      // Subscribe to any additional notify characteristics inside 0xFEEA so auxiliary replies are visible
      for (const ch of chars) {
        if (
          ch.uuid !== dataInChar?.uuid &&
          ch.uuid !== this.activityChar?.uuid &&
          ch.properties.notify
        ) {
          try {
            const shortUuid = ch.uuid.slice(4, 8).toUpperCase();
            await ch.startNotifications();
            ch.addEventListener('characteristicvaluechanged', (ev: Event) => {
              const target = ev.target as unknown as { value?: DataView };
              if (target?.value) {
                const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
                this.onDataReceived?.(bytesToHex(bytes), `Aux Notify (0x${shortUuid})`);
              }
            });
          } catch {
            // Non-fatal
          }
        }
      }
    } catch {
      // Allow inspection even if device only exposes standard services
    }

    // 3. Battery service (0x180F)
    let batteryLevel: number | null = null;
    try {
      const battSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_BATTERY);
      const battChar = await battSvc.getCharacteristic(GATT_UUIDS.CHAR_BATTERY_LEVEL);
      this.batteryChar = battChar;
      const val = await battChar.readValue();
      batteryLevel = val.getUint8(0);
      if (battChar.properties.notify) {
        try {
          await battChar.startNotifications();
          battChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
            const target = ev.target as unknown as { value?: DataView };
            if (target?.value) {
              this.onBatteryChanged?.(target.value.getUint8(0));
            }
          });
        } catch {
          // Non-fatal
        }
      }
    } catch {
      // Optional on some watches
    }

    // 4. Optional Immediate Alert (0x1802)
    try {
      const alertSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_IMMEDIATE_ALERT);
      this.alertLevelChar = await alertSvc.getCharacteristic(GATT_UUIDS.CHAR_ALERT_LEVEL);
    } catch {
      // Optional
    }

    // 4b. Optional standard Alert Notification Service (0x1811 / 0x2A46 New Alert)
    try {
      const ansSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_ALERT_NOTIFICATION);
      this.newAlertChar = await ansSvc.getCharacteristic(GATT_UUIDS.CHAR_NEW_ALERT);
    } catch {
      this.newAlertChar = null;
    }

    // 5. Optional standard Heart Rate Service (0x180D)
    try {
      const hrSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_HEART_RATE);
      const hrChar = await hrSvc.getCharacteristic(GATT_UUIDS.CHAR_HEART_RATE_MEASUREMENT);
      if (hrChar.properties.notify) {
        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
          const target = ev.target as unknown as { value?: DataView };
          if (target?.value) {
            const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
            const bpm = parseStandardHeartRate(bytes);
            if (bpm !== null) {
              this.onHeartRateReceived?.(bpm);
            }
          }
        });
      }
    } catch {
      // Optional on watches that report HR strictly over 0xFEE3
    }

    // 6. Optional standard Pulse Oximeter Service (0x1822)
    try {
      const plxSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_PULSE_OXIMETER);
      const plxUuids = [GATT_UUIDS.CHAR_PLX_CONTINUOUS, GATT_UUIDS.CHAR_PLX_SPOT_CHECK];
      for (const uuid of plxUuids) {
        try {
          const plxChar = await plxSvc.getCharacteristic(uuid);
          if (plxChar.properties.notify) {
            await plxChar.startNotifications();
            plxChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
              const target = ev.target as unknown as { value?: DataView };
              if (target?.value) {
                const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
                const spo2 = parseStandardSpo2(bytes);
                if (spo2 !== null) {
                  this.onSpo2Received?.(spo2);
                }
              }
            });
          }
        } catch {
          // Try next characteristic
        }
      }
    } catch {
      // Optional on watches that report SpO2 strictly over 0xFEE3
    }

    return {
      deviceName: device.name || 'BLE Watch',
      deviceId: device.id,
      batteryLevel,
      deviceInfo,
      detectedProtocol: detectProtocolFromManufacturer(deviceInfo.manufacturer),
      isVirtual: false,
      discoveredServicesSummary,
      feeaCharacteristicsSummary,
    };
  }

  async writePacket(
    packet: Uint8Array,
    mtuSize: number,
    writeDelayMs: number,
    preferWriteNoResponse = false
  ): Promise<{ chunks: number; ackHex?: string }> {
    const chunks = chunkPacket(packet, mtuSize);

    if (this.virtual) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(140, writeDelayMs)));
      const cmd = packet[4] ?? 0x00;
      const version: 'v1' | 'v2' = (packet[2] & 0xf0) === 0x10 ? 'v1' : 'v2';

      if (cmd === FEEA_CMD.GET_TODAY_ACTIVITY) {
        await new Promise((resolve) => setTimeout(resolve, 220));
        this.virtualSyncCount += 1;
        const bump = this.virtualSyncCount * 145;
        const steps = 7840 + bump;
        const meters = 5820 + Math.round(bump * 0.74);
        const payload = new Uint8Array([
          (steps >> 16) & 0xff,
          (steps >> 8) & 0xff,
          steps & 0xff,
          (meters >> 16) & 0xff,
          (meters >> 8) & 0xff,
          meters & 0xff,
        ]);
        const responseFrame = framePacket(version, FEEA_CMD.GET_TODAY_ACTIVITY, payload);
        this.dispatchParsedHealth(parseFeeaHealthResponse(responseFrame));
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      if (cmd === FEEA_CMD.MEASURE_BLOOD_PRESSURE) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        this.virtualSyncCount += 1;
        const bpSeries: Array<[number, number]> = [
          [118, 76],
          [122, 79],
          [116, 74],
          [120, 78],
          [114, 73],
          [124, 80],
        ];
        const [sys, dia] = bpSeries[this.virtualSyncCount % bpSeries.length];
        const responseFrame = framePacket(
          version,
          FEEA_CMD.MEASURE_BLOOD_PRESSURE,
          new Uint8Array([sys, dia])
        );
        this.dispatchParsedHealth(parseFeeaHealthResponse(responseFrame));
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      if (cmd === FEEA_CMD.MEASURE_HEART_RATE) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        this.virtualSyncCount += 1;
        const hrSeries = [72, 74, 69, 76, 71, 68, 75, 73];
        const bpm = hrSeries[this.virtualSyncCount % hrSeries.length];
        const responseFrame = framePacket(version, FEEA_CMD.MEASURE_HEART_RATE, new Uint8Array([bpm]));
        this.dispatchParsedHealth(parseFeeaHealthResponse(responseFrame));
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      if (cmd === FEEA_CMD.MEASURE_SPO2) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        this.virtualSyncCount += 1;
        const spo2Series = [98, 99, 97, 98, 99, 98, 97, 98];
        const spo2 = spo2Series[this.virtualSyncCount % spo2Series.length];
        const responseFrame = framePacket(version, FEEA_CMD.MEASURE_SPO2, new Uint8Array([spo2]));
        this.dispatchParsedHealth(parseFeeaHealthResponse(responseFrame));
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      const ack = framePacket(version, cmd, new Uint8Array([0x01]));
      return { chunks: chunks.length, ackHex: bytesToHex(ack) };
    }

    if (!this.gatt?.connected || !this.dataOutChar) {
      throw new Error('Watch is disconnected or 0xFEE2 write characteristic is unavailable.');
    }

    const writeSingleChunk = async (data: Uint8Array): Promise<void> => {
      if (!this.dataOutChar) {
        throw new Error('0xFEE2 write characteristic is unavailable.');
      }
      if (
        preferWriteNoResponse &&
        this.dataOutChar.properties.writeWithoutResponse &&
        this.dataOutChar.writeValueWithoutResponse
      ) {
        try {
          await this.dataOutChar.writeValueWithoutResponse(data);
          return;
        } catch (err) {
          if (this.dataOutChar.properties.write && this.dataOutChar.writeValueWithResponse) {
            await this.dataOutChar.writeValueWithResponse(data);
            return;
          }
          throw err;
        }
      }
      // Prefer write-with-response when supported; fall back to write-without-response if rejected.
      if (this.dataOutChar.properties.write && this.dataOutChar.writeValueWithResponse) {
        try {
          await this.dataOutChar.writeValueWithResponse(data);
          return;
        } catch (err) {
          if (
            this.dataOutChar.properties.writeWithoutResponse &&
            this.dataOutChar.writeValueWithoutResponse
          ) {
            await this.dataOutChar.writeValueWithoutResponse(data);
            return;
          }
          throw err;
        }
      }
      if (this.dataOutChar.properties.write && this.dataOutChar.writeValue) {
        await this.dataOutChar.writeValue(data);
      } else if (
        this.dataOutChar.properties.writeWithoutResponse &&
        this.dataOutChar.writeValueWithoutResponse
      ) {
        await this.dataOutChar.writeValueWithoutResponse(data);
      } else if (this.dataOutChar.writeValue) {
        await this.dataOutChar.writeValue(data);
      }
    };

    // When the browser/OS negotiated a larger ATT MTU (e.g., 247B on Android/Linux/macOS),
    // try sending frames <= 244B in a single write first (matching native BLE writes) and fall
    // back cleanly to mtuSize chunking if the host rejects oversized writes.
    if (chunks.length > 1 && packet.length <= 244) {
      try {
        await writeSingleChunk(packet);
        return { chunks: 1 };
      } catch {
        // Fall back to chunked writes below
      }
    }

    const interChunkDelay = Math.min(writeDelayMs, 20);
    for (let i = 0; i < chunks.length; i += 1) {
      await writeSingleChunk(chunks[i]);
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, interChunkDelay));
      }
    }

    return { chunks: chunks.length };
  }

  async sendStandardNewAlert(payload: Uint8Array): Promise<boolean> {
    if (this.virtual || !this.newAlertChar || !this.gatt?.connected) return false;
    try {
      if (this.newAlertChar.properties.write && this.newAlertChar.writeValueWithResponse) {
        await this.newAlertChar.writeValueWithResponse(payload);
        return true;
      }
      if (
        this.newAlertChar.properties.writeWithoutResponse &&
        this.newAlertChar.writeValueWithoutResponse
      ) {
        await this.newAlertChar.writeValueWithoutResponse(payload);
        return true;
      }
      if (this.newAlertChar.writeValue) {
        await this.newAlertChar.writeValue(payload);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async triggerImmediateAlert(): Promise<void> {
    if (this.virtual || !this.alertLevelChar) return;
    const payload = new Uint8Array([0x02]);
    if (this.alertLevelChar.writeValueWithoutResponse) {
      await this.alertLevelChar.writeValueWithoutResponse(payload);
    } else if (this.alertLevelChar.writeValue) {
      await this.alertLevelChar.writeValue(payload);
    }
  }

  async readBattery(): Promise<number | null> {
    if (this.virtual) {
      return 84;
    }
    if (!this.batteryChar) return null;
    const dv = await this.batteryChar.readValue();
    return dv.getUint8(0);
  }

  async readActivity(): Promise<boolean> {
    if (this.virtual) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      this.virtualSyncCount += 1;
      const bump = this.virtualSyncCount * 145;
      const steps = 7840 + bump;
      const meters = 5820 + Math.round(bump * 0.74);
      const raw = new Uint8Array([
        steps & 0xff,
        (steps >> 8) & 0xff,
        (steps >> 16) & 0xff,
        meters & 0xff,
        (meters >> 8) & 0xff,
        (meters >> 16) & 0xff,
        0x2c,
        0x01,
        0x00,
      ]);
      this.onDataReceived?.(bytesToHex(raw), 'Activity Telemetry (0xFEE1)');
      this.dispatchParsedHealth(parseFee1Activity(raw));
      return true;
    }
    if (!this.activityChar || !this.activityChar.properties.read) return false;
    try {
      const dv = await this.activityChar.readValue();
      const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      this.onDataReceived?.(bytesToHex(bytes), 'Activity Telemetry (0xFEE1)');
      this.dispatchParsedHealth(parseFee1Activity(bytes));
      return true;
    } catch {
      return false;
    }
  }

  disconnect(): void {
    this.virtual = false;
    if (this.gatt?.connected) {
      this.gatt.disconnect();
    }
    this.cleanupHandles();
  }

  private handleIncomingFeeaChunk(chunk: Uint8Array): void {
    const expLen = expectedFrameLength(chunk);
    if (expLen > 0) {
      this.rxBuffer = chunk;
      this.rxExpectedLen = expLen;
    } else if (this.rxBuffer.length > 0 && this.rxExpectedLen > 0) {
      const merged = new Uint8Array(this.rxBuffer.length + chunk.length);
      merged.set(this.rxBuffer, 0);
      merged.set(chunk, this.rxBuffer.length);
      this.rxBuffer = merged;
    } else {
      this.onDataReceived?.(bytesToHex(chunk), describeIncomingFrame(chunk));
      this.dispatchParsedHealth(parseFeeaHealthResponse(chunk));
      return;
    }

    while (this.rxExpectedLen > 0 && this.rxBuffer.length >= this.rxExpectedLen) {
      const complete = this.rxBuffer.slice(0, this.rxExpectedLen);
      const remainder = this.rxBuffer.slice(this.rxExpectedLen);
      const nextExpLen = expectedFrameLength(remainder);
      if (nextExpLen > 0) {
        this.rxBuffer = remainder;
        this.rxExpectedLen = nextExpLen;
      } else {
        this.rxBuffer = new Uint8Array(0);
        this.rxExpectedLen = 0;
      }

      this.onDataReceived?.(bytesToHex(complete), describeIncomingFrame(complete));
      this.dispatchParsedHealth(parseFeeaHealthResponse(complete));
    }
  }

  private dispatchParsedHealth(parsed: ReturnType<typeof parseFeeaHealthResponse>): void {
    if (parsed.type === 'activity') {
      this.onActivityDataReceived?.(parsed.dayOffset, parsed.steps, parsed.distanceMeters);
    } else if (parsed.type === 'heartRate') {
      this.onHeartRateReceived?.(parsed.heartRateBpm);
    } else if (parsed.type === 'spo2') {
      this.onSpo2Received?.(parsed.spo2Percent);
    } else if (parsed.type === 'bloodPressure') {
      this.onBloodPressureReceived?.(parsed.systolicMmHg, parsed.diastolicMmHg);
    } else if (parsed.type === 'battery' && parsed.batteryPercent >= 0) {
      this.onBatteryChanged?.(parsed.batteryPercent);
    } else if (parsed.type === 'watchAction' && parsed.watchActionCode >= 0) {
      this.onWatchActionReceived?.(parsed.watchActionCode);
    }
  }

  private cleanupHandles(): void {
    this.device = null;
    this.gatt = null;
    this.activityChar = null;
    this.dataOutChar = null;
    this.batteryChar = null;
    this.alertLevelChar = null;
    this.newAlertChar = null;
    this.rxBuffer = new Uint8Array(0);
    this.rxExpectedLen = 0;
  }
}
