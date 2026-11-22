import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Bluetooth, Clock, Cpu, LayoutDashboard, Unplug } from 'lucide-react';
import { ConnectDialog } from './components/ConnectDialog';
import { DeviceProtocolView } from './components/DeviceProtocolView';
import { NotificationsView } from './components/NotificationsView';
import { OverviewView } from './components/OverviewView';
import { TimeSyncView } from './components/TimeSyncView';
import {
  bytesToHex,
  encodeFindWatch,
  encodeNotification,
  encodeSyncTime,
  encodeTimeFormat,
  formatProtocolLabel,
  resolveProtocolVersion,
  type ProtocolPreference,
} from './protocol/feeaCodec';
import { WebBleWatchSession } from './protocol/watchController';
import type {
  AppMirrorRule,
  NavTab,
  NotificationTemplate,
  PacketLogEntry,
  ScheduledAlert,
  WatchAlertBanner,
  WatchRuntimeState,
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

interface PersistedConfig {
  use24Hour: boolean;
  autoSyncOnConnect: boolean;
  protocolPreference: ProtocolPreference;
  mtuSize: number;
  writeDelayMs: number;
  osMirroringEnabled: boolean;
  appFilters: AppMirrorRule[];
  templates: NotificationTemplate[];
  scheduledAlerts: ScheduledAlert[];
}

function loadPersisted(): PersistedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
      return {
        use24Hour: parsed.use24Hour ?? true,
        autoSyncOnConnect: parsed.autoSyncOnConnect ?? true,
        protocolPreference: parsed.protocolPreference ?? 'auto',
        mtuSize: parsed.mtuSize ?? 20,
        writeDelayMs: parsed.writeDelayMs ?? 50,
        osMirroringEnabled: parsed.osMirroringEnabled ?? true,
        appFilters: parsed.appFilters?.length ? parsed.appFilters : DEFAULT_APP_FILTERS,
        templates: parsed.templates ?? DEFAULT_TEMPLATES,
        scheduledAlerts: parsed.scheduledAlerts ?? [],
      };
    }
  } catch {
    // Fall back to defaults
  }
  return {
    use24Hour: true,
    autoSyncOnConnect: true,
    protocolPreference: 'auto',
    mtuSize: 20,
    writeDelayMs: 50,
    osMirroringEnabled: true,
    appFilters: DEFAULT_APP_FILTERS,
    templates: DEFAULT_TEMPLATES,
    scheduledAlerts: [],
  };
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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
  const [showAllBleDevices, setShowAllBleDevices] = useState(false);

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
  const [androidPermissionGranted, setAndroidPermissionGranted] = useState(false);
  const [appFilters, setAppFilters] = useState<AppMirrorRule[]>(initial.appFilters);

  const [templates, setTemplates] = useState<NotificationTemplate[]>(initial.templates);
  const [scheduledAlerts, setScheduledAlerts] = useState<ScheduledAlert[]>(initial.scheduledAlerts);
  const [packetLog, setPacketLog] = useState<PacketLogEntry[]>([]);

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

  // Persist user preferences, templates, app filters, and scheduled alerts locally
  useEffect(() => {
    const payload: PersistedConfig = {
      use24Hour,
      autoSyncOnConnect,
      protocolPreference: watch.protocolPreference,
      mtuSize: watch.mtuSize,
      writeDelayMs: watch.writeDelayMs,
      osMirroringEnabled,
      appFilters,
      templates,
      scheduledAlerts,
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
    osMirroringEnabled,
    appFilters,
    templates,
    scheduledAlerts,
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
    session.onDataReceived = (hex) => {
      appendLog({
        direction: 'rx',
        actionLabel: 'Watch Notify (0xFEE3)',
        protocolLabel: 'FEEA',
        hexPreview: hex,
        chunkCount: 1,
        status: 'ack',
      });
    };
  }, [appendLog, showToast]);

  const transmitPacket = useCallback(
    async (
      actionLabel: string,
      packet: Uint8Array,
      protoOverride?: 'v1' | 'v2'
    ): Promise<boolean> => {
      const session = sessionRef.current!;
      const resolved =
        protoOverride ??
        resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const protoLabel = formatProtocolLabel(resolved);
      try {
        const res = await session.writePacket(packet, watch.mtuSize, watch.writeDelayMs);
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

  const finalizeConnection = useCallback(
    async (result: Awaited<ReturnType<WebBleWatchSession['connectVirtual']>>) => {
      const resolved = resolveProtocolVersion(result.detectedProtocol, watch.protocolPreference);
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
      setConnectDialogOpen(false);
      showToast(`Connected to ${result.deviceName}`);

      if (autoSyncOnConnect) {
        window.setTimeout(() => {
          void handleSyncTime(undefined, undefined, resolved);
        }, 350);
      }
    },
    [appendLog, autoSyncOnConnect, handleSyncTime, showToast, watch.protocolPreference]
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
    async (iconId: number, title: string, body: string, sourceLabel = 'Push Notification (0x64)') => {
      if (!watch.isConnected) {
        showToast('Connect a watch before pushing notifications', true);
        return;
      }
      const resolved = resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference);
      const pkt = encodeNotification(resolved, iconId, title, body);
      const ok = await transmitPacket(sourceLabel, pkt, resolved);
      if (ok) {
        setActiveWatchBanner({
          iconId,
          title: title.trim() || 'Notification',
          body: body.trim(),
          receivedAt: formatNowTime(),
        });
        showToast('Notification pushed to watch');
      }
    },
    [showToast, transmitPacket, watch.detectedProtocol, watch.isConnected, watch.protocolPreference]
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
              mtuSize={watch.mtuSize}
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
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-[#E2E8F0] bg-white md:hidden"
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
