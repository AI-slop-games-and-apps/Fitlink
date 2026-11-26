import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bell, Bluetooth, Clock, Cpu, LayoutDashboard, Unplug } from 'lucide-react';
import { ActivityView } from './components/ActivityView';
import { ConnectDialog } from './components/ConnectDialog';
import { DeviceProtocolView } from './components/DeviceProtocolView';
import { NotificationsView } from './components/NotificationsView';
import { OverviewView } from './components/OverviewView';
import { TimeSyncView } from './components/TimeSyncView';
import {
  NOTIFICATION_FORMAT_OPTIONS,
  bytesToHex,
  encodeFindWatch,
  encodeGetTodayActivity,
  encodeMeasureBloodPressure,
  encodeMeasureHeartRate,
  encodeMeasureSpo2,
  encodeNotification,
  encodeStandardNewAlert,
  encodeSyncTime,
  encodeTimeFormat,
  formatProtocolLabel,
  maxNotificationTextBytes,
  resolveProtocolVersion,
  type NotificationFormat,
  type ProtocolPreference,
} from './protocol/feeaCodec';
import { WebBleWatchSession } from './protocol/watchController';
import type {
  ActivityState,
  AppMirrorRule,
  DailyActivityRecord,
  NavTab,
  NotificationTemplate,
  PacketLogEntry,
  ScheduledAlert,
  WatchAlertBanner,
  WatchRuntimeState,
  WeeklyActivityDay,
} from './types/fitlink';

const STORAGE_KEY = 'fitlink.state.v1';

const DEFAULT_APP_FILTERS: AppMirrorRule[] = [
  { appId: 'whatsapp', displayName: 'WhatsApp', iconId: 0x06, enabled: true },
  { appId: 'telegram', displayName: 'Telegram', iconId: 0x0c, enabled: true },
  { appId: 'gmail', displayName: 'Gmail / Thunderbird', iconId: 0x0b, enabled: true },
  { appId: 'slack', displayName: 'Slack', iconId: 0x0d, enabled: true },
  { appId: 'calendar', displayName: 'Calendar', iconId: 0x0e, enabled: true },
  { appId: 'sms', displayName: 'SMS / Messages', iconId: 0x01, enabled: true },
];

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl-standup',
    iconId: 0x0e,
    title: 'Standup Reminder',
    body: 'Daily sync starts in 5 minutes',
  },
  {
    id: 'tpl-hydrate',
    iconId: 0x0f,
    title: 'Hydration Break',
    body: 'Drink a glass of water and stretch',
  },
];

const DEFAULT_ACTIVITY_STATE: ActivityState = {
  distanceUnit: 'km',
  dailyDistanceGoalMeters: 5000,
  dailyByDate: {},
  latestHeartRate: null,
  heartRateUpdatedAt: null,
  heartRateSamples: [],
  latestSpo2: null,
  spo2UpdatedAt: null,
  spo2Samples: [],
  latestSystolic: null,
  latestDiastolic: null,
  bloodPressureUpdatedAt: null,
  bloodPressureSamples: [],
  lastActivitySyncedAt: null,
};

interface PersistedConfig {
  use24Hour: boolean;
  autoSyncOnConnect: boolean;
  protocolPreference: ProtocolPreference;
  mtuSize: number;
  writeDelayMs: number;
  notificationFormat: NotificationFormat;
  preferWriteNoResponse: boolean;
  osMirroringEnabled: boolean;
  appFilters: AppMirrorRule[];
  templates: NotificationTemplate[];
  scheduledAlerts: ScheduledAlert[];
  activityState: ActivityState;
}

function loadPersisted(): PersistedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
      const rawAct = parsed.activityState;
      const validFormat = NOTIFICATION_FORMAT_OPTIONS.some(
        (opt) => opt.id === parsed.notificationFormat
      )
        ? (parsed.notificationFormat as NotificationFormat)
        : 'standard';
      return {
        use24Hour: parsed.use24Hour ?? true,
        autoSyncOnConnect: parsed.autoSyncOnConnect ?? false,
        protocolPreference: parsed.protocolPreference ?? 'auto',
        mtuSize: parsed.mtuSize ?? 20,
        writeDelayMs: parsed.writeDelayMs ?? 50,
        notificationFormat: validFormat,
        preferWriteNoResponse: parsed.preferWriteNoResponse ?? false,
        osMirroringEnabled: parsed.osMirroringEnabled ?? true,
        appFilters: parsed.appFilters?.length ? parsed.appFilters : DEFAULT_APP_FILTERS,
        templates: parsed.templates ?? DEFAULT_TEMPLATES,
        scheduledAlerts: parsed.scheduledAlerts ?? [],
        activityState: rawAct
          ? {
              distanceUnit: rawAct.distanceUnit === 'mi' ? 'mi' : 'km',
              dailyDistanceGoalMeters:
                typeof rawAct.dailyDistanceGoalMeters === 'number' &&
                rawAct.dailyDistanceGoalMeters >= 1000
                  ? rawAct.dailyDistanceGoalMeters
                  : 5000,
              dailyByDate: rawAct.dailyByDate ?? {},
              latestHeartRate:
                typeof rawAct.latestHeartRate === 'number' ? rawAct.latestHeartRate : null,
              heartRateUpdatedAt: rawAct.heartRateUpdatedAt ?? null,
              heartRateSamples: Array.isArray(rawAct.heartRateSamples)
                ? rawAct.heartRateSamples.slice(-12)
                : [],
              latestSpo2: typeof rawAct.latestSpo2 === 'number' ? rawAct.latestSpo2 : null,
              spo2UpdatedAt: rawAct.spo2UpdatedAt ?? null,
              spo2Samples: Array.isArray(rawAct.spo2Samples)
                ? rawAct.spo2Samples.slice(-12)
                : [],
              latestSystolic:
                typeof rawAct.latestSystolic === 'number' ? rawAct.latestSystolic : null,
              latestDiastolic:
                typeof rawAct.latestDiastolic === 'number' ? rawAct.latestDiastolic : null,
              bloodPressureUpdatedAt: rawAct.bloodPressureUpdatedAt ?? null,
              bloodPressureSamples: Array.isArray(rawAct.bloodPressureSamples)
                ? rawAct.bloodPressureSamples
                    .filter(
                      (s): s is { systolic: number; diastolic: number } =>
                        typeof s === 'object' &&
                        s !== null &&
                        typeof s.systolic === 'number' &&
                        typeof s.diastolic === 'number'
                    )
                    .slice(-12)
                : [],
              lastActivitySyncedAt: rawAct.lastActivitySyncedAt ?? null,
            }
          : DEFAULT_ACTIVITY_STATE,
      };
    }
  } catch {
    // Fall back to defaults
  }
  return {
    use24Hour: true,
    autoSyncOnConnect: false,
    protocolPreference: 'auto',
    mtuSize: 20,
    writeDelayMs: 50,
    notificationFormat: 'standard',
    preferWriteNoResponse: false,
    osMirroringEnabled: true,
    appFilters: DEFAULT_APP_FILTERS,
    templates: DEFAULT_TEMPLATES,
    scheduledAlerts: [],
    activityState: DEFAULT_ACTIVITY_STATE,
  };
}

function getLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateOffsetFromToday(dayOffset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.min(6, dayOffset)));
  return d;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function buildCurrentWeekDays(
  dailyByDate: Record<string, DailyActivityRecord>
): WeeklyActivityDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getLocalDateKey(today);
  // Monday-based index (0 = Mon ... 6 = Sun)
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  return Array.from({ length: 7 }).map((_, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const key = getLocalDateKey(dayDate);
    const rec = dailyByDate[key];
    return {
      dateKey: key,
      dayShort: WEEKDAY_SHORT[idx],
      dayFull: WEEKDAY_FULL[idx],
      dateLabel: dayDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      steps: rec?.steps ?? 0,
      distanceMeters: rec?.distanceMeters ?? 0,
      isToday: key === todayKey,
    };
  });
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatShortTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function computeNextRunMs(mode: 'once' | 'interval', targetHHMM: string, intervalMinutes: number): number {
  const now = new Date();
  if (mode === 'interval') {
    return now.getTime() + Math.max(1, intervalMinutes) * 60_000;
  }
  const [hStr, mStr] = targetHHMM.split(':');
  const target = new Date(now);
  target.setHours(Number(hStr) || 0, Number(mStr) || 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; shortLabel: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'activity', label: 'Activity', shortLabel: 'Activity', icon: Activity },
  { id: 'time', label: 'Time Sync', shortLabel: 'Time', icon: Clock },
  { id: 'notifications', label: 'Notifications', shortLabel: 'Alerts', icon: Bell },
  { id: 'device', label: 'Device & Protocol', shortLabel: 'Device', icon: Cpu },
];

export default function App() {
  const initial = loadPersisted();
  const sessionRef = useRef<WebBleWatchSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new WebBleWatchSession();
  }

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAllBleDevices, setShowAllBleDevices] = useState(true);

  const [watch, setWatch] = useState<WatchRuntimeState>({
    isConnected: false,
    isVirtual: false,
    deviceName: '',
    deviceId: '',
    batteryLevel: null,
    deviceInfo: { manufacturer: '-', model: '-', firmware: '-', hardware: '-' },
    detectedProtocol: 'unknown',
    protocolPreference: initial.protocolPreference,
    mtuSize: initial.mtuSize,
    writeDelayMs: initial.writeDelayMs,
  });

  const [use24Hour, setUse24Hour] = useState(initial.use24Hour);
  const [autoSyncOnConnect, setAutoSyncOnConnect] = useState(initial.autoSyncOnConnect);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [osPlatformMode, setOsPlatformMode] = useState<'linux' | 'android'>('linux');
  const [osMirroringEnabled, setOsMirroringEnabled] = useState(initial.osMirroringEnabled);
  const [notificationFormat, setNotificationFormat] = useState<NotificationFormat>(
    initial.notificationFormat
  );
  const [preferWriteNoResponse, setPreferWriteNoResponse] = useState<boolean>(
    initial.preferWriteNoResponse
  );
  const [hasAlertNotificationService, setHasAlertNotificationService] = useState(false);
  const [isTestingFormats, setIsTestingFormats] = useState(false);
  const [formatTestStatus, setFormatTestStatus] = useState('');
  const cancelFormatTestRef = useRef(false);
  const [androidPermissionGranted, setAndroidPermissionGranted] = useState(false);
  const [appFilters, setAppFilters] = useState<AppMirrorRule[]>(initial.appFilters);

  const [templates, setTemplates] = useState<NotificationTemplate[]>(initial.templates);
  const [scheduledAlerts, setScheduledAlerts] = useState<ScheduledAlert[]>(initial.scheduledAlerts);
  const [packetLog, setPacketLog] = useState<PacketLogEntry[]>([]);
  const [activityState, setActivityState] = useState<ActivityState>(initial.activityState);
  const [isSyncingActivity, setIsSyncingActivity] = useState(false);
  const [isMeasuringHeartRate, setIsMeasuringHeartRate] = useState(false);
  const [isMeasuringSpo2, setIsMeasuringSpo2] = useState(false);
  const [isMeasuringBloodPressure, setIsMeasuringBloodPressure] = useState(false);
  const hrTimerRef = useRef<number | null>(null);
  const spo2TimerRef = useRef<number | null>(null);
  const bpTimerRef = useRef<number | null>(null);

  const [isVibrating, setIsVibrating] = useState(false);
  const [activeWatchBanner, setActiveWatchBanner] = useState<WatchAlertBanner | null>(null);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Persist user preferences, templates, app filters, scheduled alerts, and activity state locally
  useEffect(() => {
    const payload: PersistedConfig = {
      use24Hour,
      autoSyncOnConnect,
      protocolPreference: watch.protocolPreference,
      mtuSize: watch.mtuSize,
      writeDelayMs: watch.writeDelayMs,
      notificationFormat,
      preferWriteNoResponse,
      osMirroringEnabled,
      appFilters,
      templates,
      scheduledAlerts,
      activityState,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    use24Hour,
    autoSyncOnConnect,
    watch.protocolPreference,
    watch.mtuSize,
    watch.writeDelayMs,
    notificationFormat,
    preferWriteNoResponse,
    osMirroringEnabled,
    appFilters,
    templates,
    scheduledAlerts,
    activityState,
  ]);

  const appendLog = useCallback(
    (entry: Omit<PacketLogEntry, 'id' | 'timestamp'>) => {
      setPacketLog((prev) =>
        [
          {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: formatNowTime(),
          },
          ...prev,
        ].slice(0, 100)
      );
    },
    []
  );

  // Wire BLE disconnect & incoming notify callbacks
  useEffect(() => {
    const session = sessionRef.current!;
    session.onDisconnected = () => {
      if (hrTimerRef.current !== null) {
        window.clearTimeout(hrTimerRef.current);
        hrTimerRef.current = null;
      }
      if (spo2TimerRef.current !== null) {
        window.clearTimeout(spo2TimerRef.current);
        spo2TimerRef.current = null;
      }
      if (bpTimerRef.current !== null) {
        window.clearTimeout(bpTimerRef.current);
        bpTimerRef.current = null;
      }
      setIsMeasuringHeartRate(false);
      setIsMeasuringSpo2(false);
      setIsMeasuringBloodPressure(false);
      setHasAlertNotificationService(false);
      setWatch((prev) => ({
        ...prev,
        isConnected: false,
        isVirtual: false,
      }));
      appendLog({
        direction: 'system',
        actionLabel: 'BLE Disconnected',
        protocolLabel: '-',
        hexPreview: 'Peripheral link closed',
        chunkCount: 0,
        status: 'sent',
      });
      showToast('Watch disconnected', true);
    };
    session.onBatteryChanged = (level) => {
      setWatch((prev) => ({ ...prev, batteryLevel: level }));
    };
    session.onDataReceived = (hex, label) => {
      appendLog({
        direction: 'rx',
        actionLabel: label ?? 'Watch Notify (0xFEE3)',
        protocolLabel: 'FEEA',
        hexPreview: hex,
        chunkCount: 1,
        status: 'ack',
      });
    };
    session.onActivityDataReceived = (dayOffset, steps, distanceMeters) => {
      const targetKey = getLocalDateKey(dateOffsetFromToday(dayOffset));
      const cleanSteps = Math.max(0, steps);
      const cleanDist = Math.max(0, distanceMeters);
      setActivityState((prev) => {
        const existing = prev.dailyByDate[targetKey];
        const prevSteps = existing?.steps ?? 0;
        const prevDist = existing?.distanceMeters ?? 0;
        // Keep existing non-zero totals if an idle or trailing zero packet arrives for the same date.
        if (cleanSteps === 0 && cleanDist === 0 && (prevSteps > 0 || prevDist > 0)) {
          return prev;
        }
        return {
          ...prev,
          dailyByDate: {
            ...prev.dailyByDate,
            [targetKey]: {
              steps: cleanSteps > 0 ? cleanSteps : prevSteps,
              distanceMeters: cleanDist > 0 ? cleanDist : prevDist,
            },
          },
          lastActivitySyncedAt: formatShortTime(),
        };
      });
    };
    session.onHeartRateReceived = (bpm) => {
      if (hrTimerRef.current !== null) {
        window.clearTimeout(hrTimerRef.current);
        hrTimerRef.current = null;
      }
      setIsMeasuringHeartRate(false);
      const stamped = formatShortTime();
      setActivityState((prev) => ({
        ...prev,
        latestHeartRate: bpm,
        heartRateUpdatedAt: stamped,
        heartRateSamples: [...prev.heartRateSamples, bpm].slice(-12),
        lastActivitySyncedAt: stamped,
      }));
    };
    session.onSpo2Received = (spo2) => {
      if (spo2TimerRef.current !== null) {
        window.clearTimeout(spo2TimerRef.current);
        spo2TimerRef.current = null;
      }
      setIsMeasuringSpo2(false);
      const stamped = formatShortTime();
      setActivityState((prev) => ({
        ...prev,
        latestSpo2: spo2,
        spo2UpdatedAt: stamped,
        spo2Samples: [...prev.spo2Samples, spo2].slice(-12),
        lastActivitySyncedAt: stamped,
      }));
    };
    session.onBloodPressureReceived = (systolic, diastolic) => {
      if (bpTimerRef.current !== null) {
        window.clearTimeout(bpTimerRef.current);
        bpTimerRef.current = null;
      }
      setIsMeasuringBloodPressure(false);
      const stamped = formatShortTime();
      setActivityState((prev) => ({
        ...prev,
        latestSystolic: systolic,
        latestDiastolic: diastolic,
        bloodPressureUpdatedAt: stamped,
        bloodPressureSamples: [...prev.bloodPressureSamples, { systolic, diastolic }].slice(-12),
        lastActivitySyncedAt: stamped,
      }));
    };
  }, [appendLog, showToast]);

  const transmitPacket = useCallback(
    async (
      actionLabel: string,
      packet: Uint8Array,
      protoOverride?: 'v1' | 'v2',
      preferWnr = false
    ): Promise<boolean> => {
      const session = sessionRef.current!;
      const resolved =
        protoOverride ??
        resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const protoLabel = formatProtocolLabel(resolved);
      try {
        const res = await session.writePacket(packet, watch.mtuSize, watch.writeDelayMs, preferWnr);
        appendLog({
          direction: 'tx',
          actionLabel,
          protocolLabel: protoLabel,
          hexPreview: bytesToHex(packet),
          chunkCount: res.chunks,
          status: 'sent',
        });
        if (res.ackHex) {
          appendLog({
            direction: 'rx',
            actionLabel: `${actionLabel} ACK`,
            protocolLabel: protoLabel,
            hexPreview: res.ackHex,
            chunkCount: 1,
            status: 'ack',
          });
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to write BLE packet';
        appendLog({
          direction: 'tx',
          actionLabel: `${actionLabel} Failed`,
          protocolLabel: protoLabel,
          hexPreview: msg,
          chunkCount: 0,
          status: 'error',
        });
        showToast(msg, true);
        return false;
      }
    },
    [appendLog, showToast, watch.detectedProtocol, watch.mtuSize, watch.protocolPreference, watch.writeDelayMs]
  );

  const handleSyncTime = useCallback(
    async (
      customDate?: Date,
      customOffsetMin?: number,
      protoOverride?: 'v1' | 'v2'
    ) => {
      const targetDate = customDate ?? new Date();
      const offsetMin = customOffsetMin ?? -targetDate.getTimezoneOffset();
      const resolved =
        protoOverride ??
        resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const timePacket = encodeSyncTime(resolved, targetDate, offsetMin);
      const ok = await transmitPacket(
        customDate ? 'Sync Custom Time (0x31)' : 'Sync Time (0x31)',
        timePacket,
        resolved
      );
      if (ok) {
        const fmtPacket = encodeTimeFormat(resolved, use24Hour);
        await transmitPacket(
          use24Hour ? 'Set 24h Format (0x27)' : 'Set 12h Format (0x27)',
          fmtPacket,
          resolved
        );
        setLastSyncedAt(targetDate);
        showToast(customDate ? 'Custom time pushed to watch' : 'Time synchronized with watch');
      }
    },
    [showToast, transmitPacket, use24Hour, watch.detectedProtocol, watch.protocolPreference]
  );

  const handleRefreshActivity = useCallback(
    async (protoOverride?: 'v1' | 'v2', silent = false) => {
      if (!watch.isConnected) {
        if (!silent) {
          showToast('Connect a watch before syncing steps and distance', true);
        }
        return;
      }
      setIsSyncingActivity(true);
      try {
        const resolved =
          protoOverride ??
          resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
        // 1. Read 0xFEE1 directly if the watch exposes a readable activity characteristic
        const readOk = await sessionRef.current!.readActivity();
        // 2. Also send the empty-payload 0x81 get request for today's steps & distance
        const cmdOk = await transmitPacket(
          'Get Steps & Distance (0x81)',
          encodeGetTodayActivity(resolved),
          resolved
        );
        if (readOk || cmdOk) {
          setActivityState((prev) => ({
            ...prev,
            lastActivitySyncedAt: formatShortTime(),
          }));
          if (!silent) {
            showToast('Requested today steps and distance from watch');
          }
        } else if (!silent) {
          showToast('Unable to request steps and distance from watch', true);
        }
      } finally {
        setIsSyncingActivity(false);
      }
    },
    [showToast, transmitPacket, watch.detectedProtocol, watch.isConnected, watch.protocolPreference]
  );

  const handleMeasureHeartRate = useCallback(async () => {
    if (!watch.isConnected) {
      showToast('Connect a watch before measuring heart rate', true);
      return;
    }
    const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
    setIsMeasuringHeartRate(true);
    if (hrTimerRef.current !== null) {
      window.clearTimeout(hrTimerRef.current);
    }
    hrTimerRef.current = window.setTimeout(() => {
      setIsMeasuringHeartRate(false);
      hrTimerRef.current = null;
    }, 30_000);
    const ok = await transmitPacket(
      'Measure Heart Rate (0x6D)',
      encodeMeasureHeartRate(resolved),
      resolved
    );
    if (ok) {
      showToast('Heart rate reading started on watch');
    } else {
      if (hrTimerRef.current !== null) {
        window.clearTimeout(hrTimerRef.current);
        hrTimerRef.current = null;
      }
      setIsMeasuringHeartRate(false);
    }
  }, [showToast, transmitPacket, watch.detectedProtocol, watch.isConnected, watch.protocolPreference]);

  const handleMeasureSpo2 = useCallback(async () => {
    if (!watch.isConnected) {
      showToast('Connect a watch before measuring SpO2', true);
      return;
    }
    const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
    setIsMeasuringSpo2(true);
    if (spo2TimerRef.current !== null) {
      window.clearTimeout(spo2TimerRef.current);
    }
    spo2TimerRef.current = window.setTimeout(() => {
      setIsMeasuringSpo2(false);
      spo2TimerRef.current = null;
    }, 30_000);
    const ok = await transmitPacket('Measure SpO2 (0x6B)', encodeMeasureSpo2(resolved), resolved);
    if (ok) {
      showToast('SpO2 reading started on watch');
    } else {
      if (spo2TimerRef.current !== null) {
        window.clearTimeout(spo2TimerRef.current);
        spo2TimerRef.current = null;
      }
      setIsMeasuringSpo2(false);
    }
  }, [showToast, transmitPacket, watch.detectedProtocol, watch.isConnected, watch.protocolPreference]);

  const handleMeasureBloodPressure = useCallback(async () => {
    if (!watch.isConnected) {
      showToast('Connect a watch before measuring blood pressure', true);
      return;
    }
    const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
    setIsMeasuringBloodPressure(true);
    if (bpTimerRef.current !== null) {
      window.clearTimeout(bpTimerRef.current);
    }
    bpTimerRef.current = window.setTimeout(() => {
      setIsMeasuringBloodPressure(false);
      bpTimerRef.current = null;
    }, 35_000);
    const ok = await transmitPacket(
      'Measure Blood Pressure (0x69)',
      encodeMeasureBloodPressure(resolved),
      resolved
    );
    if (ok) {
      showToast('Blood pressure reading started on watch');
    } else {
      if (bpTimerRef.current !== null) {
        window.clearTimeout(bpTimerRef.current);
        bpTimerRef.current = null;
      }
      setIsMeasuringBloodPressure(false);
    }
  }, [showToast, transmitPacket, watch.detectedProtocol, watch.isConnected, watch.protocolPreference]);

  const finalizeConnection = useCallback(
    async (result: Awaited<ReturnType<WebBleWatchSession['connectVirtual']>>) => {
      const resolved = resolveProtocolVersion(result.detectedProtocol, watch.protocolPreference);
      setHasAlertNotificationService(sessionRef.current!.hasAlertNotificationService);
      setWatch((prev) => ({
        ...prev,
        isConnected: true,
        isVirtual: result.isVirtual,
        deviceName: result.deviceName,
        deviceId: result.deviceId,
        batteryLevel: result.batteryLevel,
        deviceInfo: result.deviceInfo,
        detectedProtocol: result.detectedProtocol,
      }));
      appendLog({
        direction: 'system',
        actionLabel: result.isVirtual ? 'Simulated Watch Paired' : 'BLE Connected',
        protocolLabel: formatProtocolLabel(resolved),
        hexPreview: `${result.deviceName} (${result.deviceId})`,
        chunkCount: 0,
        status: 'ack',
      });
      if (result.discoveredServicesSummary) {
        appendLog({
          direction: 'system',
          actionLabel: 'GATT Services',
          protocolLabel: formatProtocolLabel(resolved),
          hexPreview: result.discoveredServicesSummary,
          chunkCount: 0,
          status: 'ack',
        });
      }
      if (result.feeaCharacteristicsSummary) {
        appendLog({
          direction: 'system',
          actionLabel: '0xFEEA Characteristics',
          protocolLabel: formatProtocolLabel(resolved),
          hexPreview: result.feeaCharacteristicsSummary,
          chunkCount: 0,
          status: 'ack',
        });
      }
      setConnectDialogOpen(false);
      showToast(`Connected to ${result.deviceName}`);
    },
    [appendLog, showToast, watch.protocolPreference]
  );

  const handlePairWebBluetooth = async () => {
    setIsConnecting(true);
    try {
      const result = await sessionRef.current!.connectWebBluetooth(showAllBleDevices);
      await finalizeConnection(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bluetooth pairing cancelled';
      if (!msg.toLowerCase().includes('cancelled')) {
        showToast(msg, true);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePairVirtual = async (variant: 'v2' | 'v1') => {
    setIsConnecting(true);
    try {
      const result = await sessionRef.current!.connectVirtual(variant);
      await finalizeConnection(result);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    sessionRef.current!.disconnect();
    if (hrTimerRef.current !== null) {
      window.clearTimeout(hrTimerRef.current);
      hrTimerRef.current = null;
    }
    if (spo2TimerRef.current !== null) {
      window.clearTimeout(spo2TimerRef.current);
      spo2TimerRef.current = null;
    }
    if (bpTimerRef.current !== null) {
      window.clearTimeout(bpTimerRef.current);
      bpTimerRef.current = null;
    }
    setIsMeasuringHeartRate(false);
    setIsMeasuringSpo2(false);
    setIsMeasuringBloodPressure(false);
    setHasAlertNotificationService(false);
    setWatch((prev) => ({
      ...prev,
      isConnected: false,
      isVirtual: false,
    }));
    appendLog({
      direction: 'system',
      actionLabel: 'Disconnected',
      protocolLabel: '-',
      hexPreview: watch.deviceId || 'Closed by user',
      chunkCount: 0,
      status: 'sent',
    });
    showToast('Watch disconnected');
  };

  const handleFindWatch = async () => {
    const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
    const pkt = encodeFindWatch(resolved);
    const ok = await transmitPacket('Find Watch (0x61)', pkt, resolved);
    if (ok) {
      await sessionRef.current!.triggerImmediateAlert();
      setIsVibrating(true);
      showToast('Find Watch alert sent');
      window.setTimeout(() => setIsVibrating(false), 2600);
    }
  };

  const handleRefreshBattery = async () => {
    try {
      const level = await sessionRef.current!.readBattery();
      if (level !== null) {
        setWatch((prev) => ({ ...prev, batteryLevel: level }));
        showToast(`Battery refreshed: ${level}%`);
      } else {
        showToast('Battery characteristic 0x2A19 not exposed by watch', true);
      }
    } catch {
      showToast('Unable to read battery level', true);
    }
  };

  const handleSendNotification = useCallback(
    async (
      iconId: number,
      title: string,
      body: string,
      sourceLabel = 'Push Notification (0x64)',
      formatOverride?: NotificationFormat
    ) => {
      if (!watch.isConnected) {
        showToast('Connect a watch before pushing notifications', true);
        return;
      }
      const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const maxBytes = maxNotificationTextBytes(resolved, watch.deviceInfo.firmware);
      const activeFormat = formatOverride ?? notificationFormat;
      const pkt = encodeNotification(resolved, iconId, title, body, maxBytes, activeFormat);
      const ok = await transmitPacket(sourceLabel, pkt, resolved, preferWriteNoResponse);
      if ((!formatOverride || formatOverride === 'standard') && sessionRef.current!.hasAlertNotificationService) {
        const ansPkt = encodeStandardNewAlert(iconId, title, body);
        const ansSent = await sessionRef.current!.sendStandardNewAlert(ansPkt);
        if (ansSent) {
          appendLog({
            direction: 'tx',
            actionLabel: 'BLE New Alert (0x2A46)',
            protocolLabel: 'ANS 0x1811',
            hexPreview: bytesToHex(ansPkt),
            chunkCount: 1,
            status: 'sent',
          });
        }
      }
      if (ok) {
        setActiveWatchBanner({
          iconId,
          title: title.trim() || 'Notification',
          body: body.trim(),
          receivedAt: formatNowTime(),
        });
        if (!formatOverride) {
          showToast('Notification pushed to watch');
        }
      }
    },
    [
      appendLog,
      notificationFormat,
      preferWriteNoResponse,
      showToast,
      transmitPacket,
      watch.detectedProtocol,
      watch.deviceInfo.firmware,
      watch.isConnected,
      watch.protocolPreference,
    ]
  );

  const handleStopFormatTest = useCallback(() => {
    cancelFormatTestRef.current = true;
    setIsTestingFormats(false);
    setFormatTestStatus('');
  }, []);

  const handleTestAllNotificationFormats = useCallback(
    async (iconId: number, title: string, body: string) => {
      if (!watch.isConnected) {
        showToast('Connect a watch before testing notification formulas', true);
        return;
      }
      cancelFormatTestRef.current = false;
      setIsTestingFormats(true);
      try {
        for (let i = 0; i < NOTIFICATION_FORMAT_OPTIONS.length; i += 1) {
          if (cancelFormatTestRef.current) break;
          const opt = NOTIFICATION_FORMAT_OPTIONS[i];
          setFormatTestStatus(
            `Testing ${i + 1}/${NOTIFICATION_FORMAT_OPTIONS.length}: ${opt.label} (${opt.description})`
          );
          await handleSendNotification(
            iconId,
            `${title} #${i + 1}`,
            body,
            `Formula #${i + 1} (0x64)`,
            opt.id
          );
          if (i < NOTIFICATION_FORMAT_OPTIONS.length - 1 && !cancelFormatTestRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
        if (!cancelFormatTestRef.current) {
          showToast(
            `Finished testing all ${NOTIFICATION_FORMAT_OPTIONS.length} formulas — select the # shown on your watch`
          );
        }
      } finally {
        setIsTestingFormats(false);
        setFormatTestStatus('');
      }
    },
    [handleSendNotification, showToast, watch.isConnected]
  );

  const handleToggleUse24Hour = async (next: boolean) => {
    setUse24Hour(next);
    if (watch.isConnected) {
      const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const pkt = encodeTimeFormat(resolved, next);
      await transmitPacket(next ? 'Set 24h Format (0x27)' : 'Set 12h Format (0x27)', pkt, resolved);
      showToast(next ? 'Watch set to 24-hour clock' : 'Watch set to 12-hour clock');
    }
  };

  const handleSimulateOsNotification = (appId: string) => {
    const rule = appFilters.find((r) => r.appId === appId);
    if (!rule) return;
    const prefix = osPlatformMode === 'linux' ? 'D-Bus Mirror' : 'Android Mirror';
    void handleSendNotification(
      rule.iconId,
      rule.displayName,
      `New alert mirrored via ${prefix}`,
      `${prefix} · ${rule.displayName}`
    );
  };

  // 1-second local scheduled alert engine
  useEffect(() => {
    const id = window.setInterval(() => {
      const nowMs = Date.now();
      setScheduledAlerts((prev) => {
        let changed = false;
        const next = prev.map((alert) => {
          if (!alert.enabled || alert.nextRunMs > nowMs) return alert;
          changed = true;
          if (watch.isConnected) {
            void handleSendNotification(
              alert.iconId,
              alert.title,
              alert.body,
              `Scheduled Alert · ${alert.title}`
            );
          }
          if (alert.mode === 'interval') {
            return {
              ...alert,
              nextRunMs: nowMs + Math.max(1, alert.intervalMinutes) * 60_000,
            };
          }
          return { ...alert, enabled: false };
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [handleSendNotification, watch.isConnected]);

  const lastSyncedLabel = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24Hour,
      })
    : 'Never synced';

  const weeklyDays = useMemo(
    () => buildCurrentWeekDays(activityState.dailyByDate),
    [activityState.dailyByDate]
  );
  const todayKey = getLocalDateKey(new Date());
  const todayRecord = activityState.dailyByDate[todayKey];
  const todaySteps = todayRecord ? todayRecord.steps : null;
  const todayDistanceMeters = todayRecord ? todayRecord.distanceMeters : null;

  const currentNavMeta = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="flex min-h-screen bg-[#F5F7FA] text-[#0F172A]">
      {/* Desktop / Tablet Material Navigation Rail (Debian amd64 / arm64) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#E2E8F0] bg-white md:flex">
        <div className="flex h-16 items-center px-6">
          <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
            FitLink
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                  active
                    ? 'bg-[#EFF6FF] text-[#2563EB]'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E2E8F0] p-4">
          <div className="truncate text-sm font-semibold text-[#0F172A]">
            {watch.isConnected ? watch.deviceName : 'No watch paired'}
          </div>
          <div
            className={`mt-0.5 truncate text-xs ${
              watch.isConnected ? 'text-[#16A34A]' : 'text-[#64748B]'
            }`}
          >
            {watch.isConnected
              ? `Connected${watch.batteryLevel !== null ? ` · ${watch.batteryLevel}%` : ''}`
              : 'Disconnected · BLE Ready'}
          </div>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {/* Single-row Top App Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[#0F172A] md:hidden whitespace-nowrap">
              FitLink
            </span>
            <h1 className="hidden truncate text-lg font-semibold text-[#0F172A] md:block">
              {currentNavMeta.label}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {watch.isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] whitespace-nowrap shrink-0"
              >
                <Unplug className="h-4 w-4" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConnectDialogOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap shrink-0"
              >
                <Bluetooth className="h-4 w-4" />
                <span>Connect Watch</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1">
          {activeTab === 'overview' && (
            <OverviewView
              watch={watch}
              lastSyncedLabel={lastSyncedLabel}
              use24Hour={use24Hour}
              autoSyncOnConnect={autoSyncOnConnect}
              osMirroringEnabled={osMirroringEnabled}
              osPlatformMode={osPlatformMode}
              scheduledAlerts={scheduledAlerts}
              packetLog={packetLog}
              isVibrating={isVibrating}
              activeWatchBanner={activeWatchBanner}
              onOpenConnect={() => setConnectDialogOpen(true)}
              onSyncTimeNow={() => void handleSyncTime()}
              onFindWatch={() => void handleFindWatch()}
              onRefreshBattery={() => void handleRefreshBattery()}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityView
              isConnected={watch.isConnected}
              isSyncing={isSyncingActivity}
              isMeasuringHeartRate={isMeasuringHeartRate}
              isMeasuringSpo2={isMeasuringSpo2}
              isMeasuringBloodPressure={isMeasuringBloodPressure}
              activity={activityState}
              weeklyDays={weeklyDays}
              todaySteps={todaySteps}
              todayDistanceMeters={todayDistanceMeters}
              onRefresh={() => void handleRefreshActivity()}
              onMeasureHeartRate={() => void handleMeasureHeartRate()}
              onMeasureSpo2={() => void handleMeasureSpo2()}
              onMeasureBloodPressure={() => void handleMeasureBloodPressure()}
              onChangeUnit={(distanceUnit) =>
                setActivityState((prev) => ({ ...prev, distanceUnit }))
              }
              onChangeDailyGoalMeters={(dailyDistanceGoalMeters) =>
                setActivityState((prev) => ({ ...prev, dailyDistanceGoalMeters }))
              }
            />
          )}

          {activeTab === 'time' && (
            <TimeSyncView
              isConnected={watch.isConnected}
              use24Hour={use24Hour}
              autoSyncOnConnect={autoSyncOnConnect}
              lastSyncedLabel={lastSyncedLabel}
              onSyncTimeNow={() => void handleSyncTime()}
              onToggleUse24Hour={(v) => void handleToggleUse24Hour(v)}
              onToggleAutoSync={setAutoSyncOnConnect}
              onSyncCustomTime={(date, offset) => void handleSyncTime(date, offset)}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              isConnected={watch.isConnected}
              protocolLabel={formatProtocolLabel(
                resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference)
              )}
              mtuSize={watch.mtuSize}
              notificationFormat={notificationFormat}
              onChangeNotificationFormat={setNotificationFormat}
              preferWriteNoResponse={preferWriteNoResponse}
              onTogglePreferWriteNoResponse={setPreferWriteNoResponse}
              hasAlertNotificationService={hasAlertNotificationService}
              packetLog={packetLog}
              isTestingFormats={isTestingFormats}
              formatTestStatus={formatTestStatus}
              onStopFormatTest={handleStopFormatTest}
              onTestAllFormats={(iconId, title, body) =>
                void handleTestAllNotificationFormats(iconId, title, body)
              }
              osPlatformMode={osPlatformMode}
              onChangeOsPlatformMode={setOsPlatformMode}
              osMirroringEnabled={osMirroringEnabled}
              onToggleOsMirroring={setOsMirroringEnabled}
              androidPermissionGranted={androidPermissionGranted}
              onGrantAndroidPermissionDemo={() => {
                setAndroidPermissionGranted(true);
                showToast('Android Notification Access enabled');
              }}
              appFilters={appFilters}
              onToggleAppFilter={(appId, enabled) =>
                setAppFilters((prev) =>
                  prev.map((rule) => (rule.appId === appId ? { ...rule, enabled } : rule))
                )
              }
              onSimulateOsNotification={handleSimulateOsNotification}
              templates={templates}
              onSendManualNotification={(iconId, title, body) =>
                void handleSendNotification(iconId, title, body)
              }
              onSaveTemplate={(iconId, title, body) => {
                setTemplates((prev) => [
                  {
                    id: `tpl-${Date.now()}`,
                    iconId,
                    title: title.trim(),
                    body: body.trim(),
                  },
                  ...prev,
                ]);
                showToast('Saved notification template');
              }}
              onDeleteTemplate={(id) =>
                setTemplates((prev) => prev.filter((tpl) => tpl.id !== id))
              }
              scheduledAlerts={scheduledAlerts}
              onAddScheduledAlert={(iconId, title, body, mode, targetTime, intervalMinutes) => {
                setScheduledAlerts((prev) => [
                  {
                    id: `sched-${Date.now()}`,
                    iconId,
                    title: title.trim(),
                    body: body.trim(),
                    mode,
                    targetTime,
                    intervalMinutes,
                    enabled: true,
                    nextRunMs: computeNextRunMs(mode, targetTime, intervalMinutes),
                  },
                  ...prev,
                ]);
                showToast('Scheduled alert added');
              }}
              onToggleScheduledAlert={(id, enabled) =>
                setScheduledAlerts((prev) =>
                  prev.map((a) =>
                    a.id === id
                      ? {
                          ...a,
                          enabled,
                          nextRunMs: enabled
                            ? computeNextRunMs(a.mode, a.targetTime, a.intervalMinutes)
                            : a.nextRunMs,
                        }
                      : a
                  )
                )
              }
              onDeleteScheduledAlert={(id) =>
                setScheduledAlerts((prev) => prev.filter((a) => a.id !== id))
              }
              onFireScheduledAlertNow={(id) => {
                const target = scheduledAlerts.find((a) => a.id === id);
                if (target) {
                  void handleSendNotification(
                    target.iconId,
                    target.title,
                    target.body,
                    `Manual Run · ${target.title}`
                  );
                }
              }}
            />
          )}

          {activeTab === 'device' && (
            <DeviceProtocolView
              watch={watch}
              packetLog={packetLog}
              onChangeProtocolPreference={(pref) =>
                setWatch((prev) => ({ ...prev, protocolPreference: pref }))
              }
              onChangeMtuSize={(mtu) =>
                setWatch((prev) => ({ ...prev, mtuSize: mtu }))
              }
              onChangeWriteDelay={(delayMs) =>
                setWatch((prev) => ({ ...prev, writeDelayMs: delayMs }))
              }
              onClearPacketLog={() => setPacketLog([])}
            />
          )}
        </main>
      </div>

      {/* Compact Mobile Bottom Navigation Bar (Android form factor) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-[#E2E8F0] bg-white md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? 'text-[#2563EB]' : 'text-[#64748B]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <ConnectDialog
        open={connectDialogOpen}
        isConnecting={isConnecting}
        showAllBleDevices={showAllBleDevices}
        onToggleShowAll={setShowAllBleDevices}
        onClose={() => setConnectDialogOpen(false)}
        onPairWebBluetooth={() => void handlePairWebBluetooth()}
        onPairVirtual={(variant) => void handlePairVirtual(variant)}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg md:bottom-6 whitespace-nowrap ${
            toast.isError ? 'bg-[#DC2626]' : 'bg-[#0F172A]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
