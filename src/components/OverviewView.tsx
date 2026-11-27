import { BatteryCharging, BellRing, Clock, RefreshCw, Vibrate, Watch } from 'lucide-react';
import { formatProtocolLabel, getPresetLabel, resolveProtocolVersion } from '../protocol/feeaCodec';
import type { DistanceUnit, PacketLogEntry, ScheduledAlert, WatchAlertBanner, WatchRuntimeState } from '../types/fitlink';

const METERS_PER_MILE = 1609.344;

function formatOverviewDistance(meters: number, unit: DistanceUnit): string {
  const val = unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
  return val.toFixed(2);
}

interface OverviewViewProps {
  watch: WatchRuntimeState;
  lastSyncedLabel: string;
  use24Hour: boolean;
  autoSyncOnConnect: boolean;
  osMirroringEnabled: boolean;
  osPlatformMode: 'linux' | 'android';
  scheduledAlerts: ScheduledAlert[];
  packetLog: PacketLogEntry[];
  todaySteps: number | null;
  todayDistanceMeters: number | null;
  distanceUnit: DistanceUnit;
  dailyDistanceGoalMeters: number;
  isSyncingActivity: boolean;
  isVibrating: boolean;
  activeWatchBanner: WatchAlertBanner | null;
  onOpenConnect: () => void;
  onSyncTimeNow: () => void;
  onFindWatch: () => void;
  onRefreshBattery: () => void;
  onRefreshActivity: () => void;
  onNavigate: (tab: 'activity' | 'time' | 'notifications' | 'device') => void;
}

export function OverviewView({
  watch,
  lastSyncedLabel,
  use24Hour,
  autoSyncOnConnect,
  osMirroringEnabled,
  osPlatformMode,
  scheduledAlerts,
  packetLog,
  todaySteps,
  todayDistanceMeters,
  distanceUnit,
  dailyDistanceGoalMeters,
  isSyncingActivity,
  isVibrating,
  activeWatchBanner,
  onOpenConnect,
  onSyncTimeNow,
  onFindWatch,
  onRefreshBattery,
  onRefreshActivity,
  onNavigate,
}: OverviewViewProps) {
  const activeProto = formatProtocolLabel(
    resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference)
  );
  const enabledSchedulesCount = scheduledAlerts.filter((a) => a.enabled).length;
  const formattedDistance =
    todayDistanceMeters !== null
      ? `${formatOverviewDistance(todayDistanceMeters, distanceUnit)} ${distanceUnit}`
      : `-- ${distanceUnit}`;
  const formattedGoal = `${formatOverviewDistance(dailyDistanceGoalMeters, distanceUnit)} ${distanceUnit}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Primary Watch Summary Surface */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-xs font-medium text-[#64748B]">
              <span>{watch.isConnected ? (watch.isVirtual ? 'Simulated BLE Watch' : 'Connected via BLE') : 'No Watch Connected'}</span>
              {watch.isConnected && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#16A34A]">{activeProto}</span>
                </>
              )}
            </div>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#0F172A]">
              {watch.isConnected ? watch.deviceName : 'Ready to Pair'}
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              {watch.isConnected ? (
                <span className="font-mono text-xs text-[#64748B] tabular-nums">
                  {watch.deviceId} · {watch.deviceInfo.firmware !== '-' ? watch.deviceInfo.firmware : 'GATT 0xFEEA'}
                </span>
              ) : (
                'Pair a compatible 0xFEEA BLE smartwatch to sync time, mirror OS notifications, and trigger Find Watch alerts.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-6 sm:text-right">
            <div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <BatteryCharging
                  className={`h-5 w-5 ${
                    watch.batteryLevel !== null && watch.batteryLevel <= 20
                      ? 'text-[#D97706]'
                      : watch.isConnected
                      ? 'text-[#16A34A]'
                      : 'text-[#94A3B8]'
                  }`}
                />
                <span className="font-mono text-3xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                  {watch.batteryLevel !== null ? `${watch.batteryLevel}%` : '--%'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 sm:justify-end">
                <span className="text-xs text-[#64748B]">Battery Level</span>
                {watch.isConnected && (
                  <button
                    type="button"
                    onClick={onRefreshBattery}
                    title="Refresh battery (GATT 0x2A19)"
                    aria-label="Refresh battery"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-[#E2E8F0] pt-5">
          {watch.isConnected ? (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap sm:items-center">
              <button
                type="button"
                onClick={onSyncTimeNow}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap sm:px-4"
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span>Sync Time</span>
              </button>
              <button
                type="button"
                onClick={onFindWatch}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap sm:px-4 ${
                  isVibrating
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                    : 'border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Vibrate className="h-4 w-4 shrink-0" />
                <span>{isVibrating ? 'Buzzing...' : 'Find Watch'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenConnect}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap shrink-0"
            >
              <Watch className="h-4 w-4" />
              <span>Connect Watch</span>
            </button>
          )}
        </div>

        {/* Live watch display confirmation banner when a notification or buzz occurs */}
        {(activeWatchBanner || isVibrating) && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#0F172A] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              {isVibrating ? (
                <Vibrate className="h-4 w-4 shrink-0 text-[#93C5FD]" />
              ) : (
                <BellRing className="h-4 w-4 shrink-0 text-[#93C5FD]" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {isVibrating
                    ? 'Watch Haptic Alert Active (0x61)'
                    : `${getPresetLabel(activeWatchBanner!.iconId)} · ${activeWatchBanner!.title}`}
                </div>
                <div className="truncate text-xs text-slate-300">
                  {isVibrating ? 'Vibrating connected watch peripheral' : activeWatchBanner!.body}
                </div>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
              {activeWatchBanner?.receivedAt ?? 'Now'}
            </span>
          </div>
        )}
      </section>

      {/* Today's Activity Box (same size as boxes below, directly above Time Sync) */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 text-left transition-colors hover:border-[#CBD5E1]">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-xs font-medium text-[#64748B] hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
            >
              Today&apos;s Activity
            </button>
            <button
              type="button"
              disabled={!watch.isConnected || isSyncingActivity}
              onClick={onRefreshActivity}
              title="Refresh activity"
              aria-label="Refresh activity"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingActivity ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="mt-2 flex flex-col text-left focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-base font-semibold text-[#0F172A] tabular-nums">
              <span>{todaySteps !== null ? `${todaySteps.toLocaleString()} steps` : '-- steps'}</span>
              <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
              <span>{formattedDistance}</span>
            </div>
            <span className="mt-1.5 text-xs text-[#475569]">
              Daily goal: {formattedGoal}
            </span>
          </button>
        </div>
      </section>

      {/* 3-Column Feature Status Strip */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate('time')}
          className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 text-left transition-colors hover:border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <span className="text-xs font-medium text-[#64748B]">Last Time Sync</span>
          <span className="mt-2 font-mono text-base font-semibold text-[#0F172A] tabular-nums">
            {lastSyncedLabel}
          </span>
          <span className="mt-1.5 text-xs text-[#475569]">
            {use24Hour ? '24-hour clock' : '12-hour clock'} · Auto-sync {autoSyncOnConnect ? 'On' : 'Off'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('notifications')}
          className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 text-left transition-colors hover:border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <span className="text-xs font-medium text-[#64748B]">OS Notification Mirror</span>
          <span
            className={`mt-2 text-base font-semibold ${
              osMirroringEnabled ? 'text-[#16A34A]' : 'text-[#0F172A]'
            }`}
          >
            {osMirroringEnabled ? 'Mirroring Active' : 'Mirroring Paused'}
          </span>
          <span className="mt-1.5 truncate text-xs text-[#475569]">
            {osPlatformMode === 'linux'
              ? 'Linux D-Bus (org.freedesktop.Notifications)'
              : 'Android NotificationListenerService'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('notifications')}
          className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 text-left transition-colors hover:border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <span className="text-xs font-medium text-[#64748B]">Scheduled Alerts</span>
          <span className="mt-2 font-mono text-base font-semibold text-[#0F172A] tabular-nums">
            {enabledSchedulesCount} active · {scheduledAlerts.length} total
          </span>
          <span className="mt-1.5 text-xs text-[#475569]">
            Local 1-second timer scheduler
          </span>
        </button>
      </section>

      {/* Recent Commands Table */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-[#0F172A]">Recent Watch Commands</h3>
          <button
            type="button"
            onClick={() => onNavigate('device')}
            className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
          >
            View full packet log
          </button>
        </div>

        {packetLog.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">
            No BLE packets exchanged yet. Connect your watch and run a time sync or test notification.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs font-medium text-[#64748B]">
                  <th className="py-2.5 pr-4">Time</th>
                  <th className="py-2.5 pr-4">Action</th>
                  <th className="py-2.5 pr-4">Protocol</th>
                  <th className="py-2.5 pr-4">Frame Preview</th>
                  <th className="py-2.5 text-right">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {packetLog.slice(0, 6).map((row) => (
                  <tr key={row.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 pr-4 font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {row.timestamp}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                      {row.actionLabel}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-[#475569] whitespace-nowrap">
                      {row.protocolLabel}
                    </td>
                    <td className="max-w-xs truncate py-2.5 pr-4 font-mono text-xs text-[#475569]">
                      {row.hexPreview}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {row.chunkCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
