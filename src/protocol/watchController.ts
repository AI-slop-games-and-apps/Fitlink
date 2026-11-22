import {
  GATT_UUIDS,
  bytesToHex,
  chunkPacket,
  detectProtocolFromManufacturer,
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

  onDisconnected?: () => void;
  onBatteryChanged?: (level: number) => void;
  onDataReceived?: (hex: string) => void;

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
      await new Promise((resolve) => setTimeout(resolve, Math.min(180, writeDelayMs)));
      const ack = new Uint8Array([0xfe, 0xea, 0x06, 0x00, packet[4] ?? 0x00, 0x01]);
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

  private cleanupHandles(): void {
    this.device = null;
    this.gatt = null;
    this.dataOutChar = null;
    this.batteryChar = null;
    this.alertLevelChar = null;
  }
}
