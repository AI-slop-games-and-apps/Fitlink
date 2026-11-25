import type { ProtocolPreference, ProtocolVersion } from '../protocol/feeaCodec';
import type { WatchDeviceInfo } from '../protocol/watchController';

export type NavTab = 'overview' | 'activity' | 'time' | 'notifications' | 'device';

export type DistanceUnit = 'km' | 'mi';

export interface DailyActivityRecord {
  steps: number;
  distanceMeters: number;
}

export interface WeeklyActivityDay {
  dateKey: string;
  dayShort: string;
  dayFull: string;
  dateLabel: string;
  steps: number;
  distanceMeters: number;
  isToday: boolean;
}

export interface ActivityState {
  distanceUnit: DistanceUnit;
  dailyDistanceGoalMeters: number;
  dailyByDate: Record<string, DailyActivityRecord>;
  latestHeartRate: number | null;
  heartRateUpdatedAt: string | null;
  heartRateSamples: number[];
  latestSpo2: number | null;
  spo2UpdatedAt: string | null;
  spo2Samples: number[];
  lastActivitySyncedAt: string | null;
}

export interface AppMirrorRule {
  appId: string;
  displayName: string;
  iconId: number;
  enabled: boolean;
}

export interface NotificationTemplate {
  id: string;
  iconId: number;
  title: string;
  body: string;
}

export interface ScheduledAlert {
  id: string;
  iconId: number;
  title: string;
  body: string;
  mode: 'once' | 'interval';
  targetTime: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunMs: number;
}

export interface PacketLogEntry {
  id: string;
  timestamp: string;
  direction: 'tx' | 'rx' | 'system';
  actionLabel: string;
  protocolLabel: string;
  hexPreview: string;
  chunkCount: number;
  status: 'sent' | 'ack' | 'error';
}

export interface WatchAlertBanner {
  iconId: number;
  title: string;
  body: string;
  receivedAt: string;
}

export interface WatchRuntimeState {
  isConnected: boolean;
  isVirtual: boolean;
  deviceName: string;
  deviceId: string;
  batteryLevel: number | null;
  deviceInfo: WatchDeviceInfo;
  detectedProtocol: ProtocolVersion;
  protocolPreference: ProtocolPreference;
  mtuSize: number;
  writeDelayMs: number;
}
