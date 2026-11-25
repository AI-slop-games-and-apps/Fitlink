import {
  FEEA_CMD,
  GATT_UUIDS,
  bytesToHex,
  chunkPacket,
  detectProtocolFromManufacturer,
  framePacket,
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
  writeValueWithoutResponse?(value: Uint8Array): Promise<void>;
  writeValue?(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<WebBleCharacteristic>;
  addEventListener(type: string, listener: (event: Event) => void): void;
}

interface WebBleService {
  getCharacteristic(uuid: string | number): Promise<WebBleCharacteristic>;
  getCharacteristics(): Promise<WebBleCharacteristic[]>;
}

interface WebBleGattServer {
  connected: boolean;
  connect(): Promise<WebBleGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string | number): Promise<WebBleService>;
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
  private dataOutChar: WebBleCharacteristic | null = null;
  private batteryChar: WebBleCharacteristic | null = null;
  private alertLevelChar: WebBleCharacteristic | null = null;
  private virtual = false;
  private virtualSyncCount = 0;

  onDisconnected?: () => void;
  onBatteryChanged?: (level: number) => void;
  onDataReceived?: (hex: string) => void;
  onActivityDataReceived?: (dayOffset: number, steps: number, distanceMeters: number) => void;
  onHeartRateReceived?: (bpm: number) => void;
  onSpo2Received?: (spo2: number) => void;

  get isVirtual(): boolean {
    return this.virtual;
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
      GATT_UUIDS.SERVICE_HEART_RATE,
      GATT_UUIDS.SERVICE_PULSE_OXIMETER,
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

    // 1. Discover 0xFEEA BLE service
    try {
      const feeaSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_FEEA);
      const chars = await feeaSvc.getCharacteristics();

      this.dataOutChar =
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_OUT) ??
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_OUT_ALT) ??
        chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) ??
        null;

      const dataInChar =
        chars.find((c) => c.uuid === GATT_UUIDS.CHAR_DATA_IN) ??
        chars.find((c) => c.properties.notify) ??
        null;

      if (dataInChar) {
        try {
          await dataInChar.startNotifications();
          dataInChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
            const target = ev.target as unknown as { value?: DataView };
            if (target?.value) {
              const bytes = new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
              this.onDataReceived?.(bytesToHex(bytes));
              this.dispatchFeeaHealthFrame(bytes);
            }
          });
        } catch {
          // Non-fatal: watch may still accept outbound commands
        }
      }
    } catch {
      // Allow inspection even if device only exposes standard services
    }

    // 2. Battery service (0x180F)
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
      // Optional on some OEM watches
    }

    // 3. Device Information service (0x180A)
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
      // Optional on some OEM watches
    }

    // 4. Optional Immediate Alert (0x1802)
    try {
      const alertSvc = await gatt.getPrimaryService(GATT_UUIDS.SERVICE_IMMEDIATE_ALERT);
      this.alertLevelChar = await alertSvc.getCharacteristic(GATT_UUIDS.CHAR_ALERT_LEVEL);
    } catch {
      // Optional
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
    };
  }

  async writePacket(
    packet: Uint8Array,
    mtuSize: number,
    writeDelayMs: number
  ): Promise<{ chunks: number; ackHex?: string }> {
    const chunks = chunkPacket(packet, mtuSize);

    if (this.virtual) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(140, writeDelayMs)));
      const cmd = packet[4] ?? 0x00;
      const version: 'v1' | 'v2' = packet[2] === 0x10 ? 'v1' : 'v2';

      if (cmd === FEEA_CMD.SYNC_ACTIVITY) {
        const dayOffset = packet[5] ?? 0;
        const responseFrame = this.buildVirtualActivityFrame(version, dayOffset);
        this.dispatchFeeaHealthFrame(responseFrame);
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      if (cmd === FEEA_CMD.SYNC_HEART_RATE) {
        this.virtualSyncCount += 1;
        const hrSeries = [72, 74, 69, 76, 71, 68, 75, 73];
        const bpm = hrSeries[this.virtualSyncCount % hrSeries.length];
        const responseFrame = framePacket(version, FEEA_CMD.SYNC_HEART_RATE, new Uint8Array([bpm]));
        this.dispatchFeeaHealthFrame(responseFrame);
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      if (cmd === FEEA_CMD.SYNC_SPO2) {
        const spo2Series = [98, 99, 97, 98, 99, 98, 97, 98];
        const spo2 = spo2Series[this.virtualSyncCount % spo2Series.length];
        const responseFrame = framePacket(version, FEEA_CMD.SYNC_SPO2, new Uint8Array([spo2]));
        this.dispatchFeeaHealthFrame(responseFrame);
        return { chunks: chunks.length, ackHex: bytesToHex(responseFrame) };
      }

      const ack = new Uint8Array([0xfe, 0xea, 0x06, 0x00, cmd, 0x01]);
      return { chunks: chunks.length, ackHex: bytesToHex(ack) };
    }

    if (!this.gatt?.connected || !this.dataOutChar) {
      throw new Error('Watch is disconnected or 0xFEE2 write characteristic is unavailable.');
    }

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (this.dataOutChar.properties.writeWithoutResponse && this.dataOutChar.writeValueWithoutResponse) {
        await this.dataOutChar.writeValueWithoutResponse(chunk);
      } else if (this.dataOutChar.writeValue) {
        await this.dataOutChar.writeValue(chunk);
      }
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, writeDelayMs));
      }
    }

    return { chunks: chunks.length };
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

  disconnect(): void {
    this.virtual = false;
    if (this.gatt?.connected) {
      this.gatt.disconnect();
    }
    this.cleanupHandles();
  }

  private dispatchFeeaHealthFrame(bytes: Uint8Array): void {
    const parsed = parseFeeaHealthResponse(bytes);
    if (parsed.type === 'activity') {
      this.onActivityDataReceived?.(parsed.dayOffset, parsed.steps, parsed.distanceMeters);
    } else if (parsed.type === 'heartRate') {
      this.onHeartRateReceived?.(parsed.heartRateBpm);
    } else if (parsed.type === 'spo2') {
      this.onSpo2Received?.(parsed.spo2Percent);
    }
  }

  private buildVirtualActivityFrame(version: 'v1' | 'v2', dayOffset: number): Uint8Array {
    // Realistic 7-day walking profile in steps + meters; today increments slightly per refresh
    const baseSteps = [7840, 6210, 8950, 5120, 7430, 9380, 4680];
    const baseMeters = [5820, 4610, 6680, 3810, 5510, 6990, 3480];
    const idx = Math.max(0, Math.min(6, dayOffset));
    const bump = idx === 0 ? this.virtualSyncCount * 145 : 0;
    const steps = baseSteps[idx] + bump;
    const meters = baseMeters[idx] + Math.round(bump * 0.74);

    const payload = new Uint8Array([
      idx & 0xff,
      (steps >> 16) & 0xff,
      (steps >> 8) & 0xff,
      steps & 0xff,
      (meters >> 16) & 0xff,
      (meters >> 8) & 0xff,
      meters & 0xff,
    ]);
    return framePacket(version, FEEA_CMD.SYNC_ACTIVITY, payload);
  }

  private cleanupHandles(): void {
    this.device = null;
    this.gatt = null;
    this.dataOutChar = null;
    this.batteryChar = null;
    this.alertLevelChar = null;
  }
}
