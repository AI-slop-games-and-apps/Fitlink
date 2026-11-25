import { useEffect, useState } from 'react';
import { Bell, BookmarkPlus, Clock, Play, Plus, Send, Trash2 } from 'lucide-react';
import {
  WATCH_APP_PRESETS,
  getNotificationMetrics,
  getPresetLabel,
} from '../protocol/feeaCodec';
import type {
  AppMirrorRule,
  NotificationTemplate,
  ScheduledAlert,
} from '../types/fitlink';
import { MaterialSwitch } from './MaterialSwitch';

type SubTab = 'mirror' | 'composer' | 'scheduled';

interface NotificationsViewProps {
  isConnected: boolean;
  mtuSize: number;
  osPlatformMode: 'linux' | 'android';
  onChangeOsPlatformMode: (mode: 'linux' | 'android') => void;
  osMirroringEnabled: boolean;
  onToggleOsMirroring: (enabled: boolean) => void;
  androidPermissionGranted: boolean;
  onGrantAndroidPermissionDemo: () => void;
  appFilters: AppMirrorRule[];
  onToggleAppFilter: (appId: string, enabled: boolean) => void;
  onSimulateOsNotification: (appId: string) => void;
  templates: NotificationTemplate[];
  onSendManualNotification: (iconId: number, title: string, body: string) => void;
  onSaveTemplate: (iconId: number, title: string, body: string) => void;
  onDeleteTemplate: (id: string) => void;
  scheduledAlerts: ScheduledAlert[];
  onAddScheduledAlert: (
    iconId: number,
    title: string,
    body: string,
    mode: 'once' | 'interval',
    targetTime: string,
    intervalMinutes: number
  ) => void;
  onToggleScheduledAlert: (id: string, enabled: boolean) => void;
  onDeleteScheduledAlert: (id: string) => void;
  onFireScheduledAlertNow: (id: string) => void;
}

function formatCountdown(nextRunMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nextRunMs - nowMs) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}h ${pad(mins)}m ${pad(secs)}s` : `${pad(mins)}m ${pad(secs)}s`;
}

export function NotificationsView({
  isConnected,
  mtuSize,
  osPlatformMode,
  onChangeOsPlatformMode,
  osMirroringEnabled,
  onToggleOsMirroring,
  androidPermissionGranted,
  onGrantAndroidPermissionDemo,
  appFilters,
  onToggleAppFilter,
  onSimulateOsNotification,
  templates,
  onSendManualNotification,
  onSaveTemplate,
  onDeleteTemplate,
  scheduledAlerts,
  onAddScheduledAlert,
  onToggleScheduledAlert,
  onDeleteScheduledAlert,
  onFireScheduledAlertNow,
}: NotificationsViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('composer');

  // Manual Composer state
  const [iconId, setIconId] = useState<number>(0x06); // WhatsApp
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Scheduled Alerts form state
  const [schedIconId, setSchedIconId] = useState<number>(0x0e); // Calendar
  const [schedTitle, setSchedTitle] = useState('');
  const [schedBody, setSchedBody] = useState('');
  const [schedMode, setSchedMode] = useState<'once' | 'interval'>('interval');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedInterval, setSchedInterval] = useState(45);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const metrics = getNotificationMetrics(title, body, mtuSize);

  const handleSendComposer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    onSendManualNotification(iconId, title, body);
  };

  const handleSaveTemplate = () => {
    if (!title.trim() && !body.trim()) return;
    onSaveTemplate(iconId, title, body);
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim()) return;
    onAddScheduledAlert(
      schedIconId,
      schedTitle,
      schedBody,
      schedMode,
      schedTime,
      schedInterval
    );
    setSchedTitle('');
    setSchedBody('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Material Sub-Tab Strip */}
      <div className="border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-6 overflow-x-auto" role="tablist">
          {(
            [
              { id: 'composer', label: 'Manual Composer' },
              { id: 'scheduled', label: 'Scheduled Alerts' },
              { id: 'mirror', label: 'OS Mirroring' },
            ] as const
          ).map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(tab.id)}
                className={`relative h-12 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                  active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t bg-[#2563EB]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* TAB 1: OS MIRRORING */}
        {subTab === 'mirror' && (
          <>
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    System Notification Mirroring
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Live OS notification capture runs in the native Android APK and Debian app. In the browser, use Test Forward below or Manual Composer to push real BLE notifications.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1">
                    <button
                      type="button"
                      onClick={() => onChangeOsPlatformMode('linux')}
                      className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                        osPlatformMode === 'linux'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Linux D-Bus
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeOsPlatformMode('android')}
                      className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                        osPlatformMode === 'android'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Android Service
                    </button>
                  </div>

                  <MaterialSwitch
                    checked={osMirroringEnabled}
                    onChange={onToggleOsMirroring}
                    label="Mirror system notifications"
                  />
                </div>
              </div>

              {osPlatformMode === 'android' && !androidPermissionGranted && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-[#92400E]">
                    Notification Access permission is required on Android before FitLinkNotificationService can intercept system alerts.
                  </div>
                  <button
                    type="button"
                    onClick={onGrantAndroidPermissionDemo}
                    className="h-9 shrink-0 rounded-lg bg-[#D97706] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#B45309] whitespace-nowrap"
                  >
                    Grant Notification Access
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    Per-App Mirroring Filters
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Toggle which apps forward alerts to the watch and test mapped watch icon IDs.
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-[#F1F5F9]">
                {appFilters.map((rule) => (
                  <div
                    key={rule.appId}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#0F172A]">
                        {rule.displayName}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-[#64748B] tabular-nums">
                        Watch icon: {getPresetLabel(rule.iconId)} · 0x
                        {rule.iconId.toString(16).padStart(2, '0').toUpperCase()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        disabled={!isConnected || !osMirroringEnabled || !rule.enabled}
                        onClick={() => onSimulateOsNotification(rule.appId)}
                        className="h-8 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                      >
                        Test Forward
                      </button>
                      <MaterialSwitch
                        checked={rule.enabled}
                        onChange={(val) => onToggleAppFilter(rule.appId, val)}
                        label={`Mirror ${rule.displayName}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* TAB 2: MANUAL COMPOSER & TEMPLATES */}
        {subTab === 'composer' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 lg:col-span-7">
              <h3 className="text-base font-semibold text-[#0F172A]">
                Compose Watch Notification
              </h3>

              <form onSubmit={handleSendComposer} className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-medium text-[#475569]">App Icon Preset</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {WATCH_APP_PRESETS.map((preset) => {
                      const active = iconId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setIconId(preset.id)}
                          className={`h-9 rounded-xl border px-2.5 text-xs font-medium transition-colors truncate ${
                            active
                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                              : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="notif-title" className="block text-xs font-medium text-[#475569]">
                    Sender or Title
                  </label>
                  <input
                    id="notif-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="notif-body" className="block text-xs font-medium text-[#475569]">
                    Message Body
                  </label>
                  <textarea
                    id="notif-body"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type notification text to push via 0x64..."
                    className="mt-1.5 w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="font-mono tabular-nums">
                    {metrics.utf8Bytes} / 128 UTF-8 bytes · {metrics.chunks} BLE chunk(s) at {mtuSize}B MTU
                  </span>
                  {metrics.utf8Bytes > 128 && (
                    <span className="text-[#D97706]">Truncates safely at 128 UTF-8 bytes</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={!isConnected || (!title.trim() && !body.trim())}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send to Watch</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => onSendManualNotification(0x01, 'FitLink', 'Test alert')}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2563EB]/30 bg-[#EFF6FF] px-4 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Send Quick Test</span>
                  </button>
                  <button
                    type="button"
                    disabled={!title.trim() && !body.trim()}
                    onClick={handleSaveTemplate}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    <span>Save Template</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Right Column: Compact Watch Preview + Saved Templates */}
            <div className="space-y-6 lg:col-span-5">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <div className="text-xs font-medium text-[#64748B]">Watch Screen Preview</div>
                <div className="mt-4 flex justify-center">
                  <div className="flex h-48 w-44 flex-col justify-between rounded-[28px] border-4 border-[#1E293B] bg-[#0F172A] p-4 text-white">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate font-medium text-[#93C5FD]">
                        {getPresetLabel(iconId)}
                      </span>
                      <span className="font-mono tabular-nums">Now</span>
                    </div>
                    <div className="my-auto space-y-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {title.trim() || 'Notification Title'}
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">
                        {body.trim() || 'Your message preview appears here exactly as chunked for the watch.'}
                      </p>
                    </div>
                    <div className="text-center font-mono text-[10px] text-slate-500 tabular-nums">
                      0x{iconId.toString(16).padStart(2, '0').toUpperCase()} · {metrics.truncatedBytes}B
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <h3 className="text-base font-semibold text-[#0F172A]">Saved Templates</h3>
                {templates.length === 0 ? (
                  <p className="mt-3 text-xs text-[#64748B]">
                    No templates saved yet. Save a frequent message from the composer.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-[#F1F5F9]">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIconId(tpl.iconId);
                            setTitle(tpl.title);
                            setBody(tpl.body);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-medium text-[#0F172A]">
                            {tpl.title}
                          </div>
                          <div className="truncate text-xs text-[#64748B]">
                            {getPresetLabel(tpl.iconId)} · {tpl.body}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={!isConnected}
                            onClick={() => onSendManualNotification(tpl.iconId, tpl.title, tpl.body)}
                            aria-label={`Send ${tpl.title}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-40"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTemplate(tpl.id)}
                            aria-label={`Delete ${tpl.title}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULED ALERTS */}
        {subTab === 'scheduled' && (
          <>
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <h3 className="text-base font-semibold text-[#0F172A]">Create Scheduled Alert</h3>
              <form onSubmit={handleCreateSchedule} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sched-title" className="block text-xs font-medium text-[#475569]">
                    Reminder Title
                  </label>
                  <input
                    id="sched-title"
                    type="text"
                    required
                    value={schedTitle}
                    onChange={(e) => setSchedTitle(e.target.value)}
                    placeholder="e.g. Stand & Stretch"
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="sched-icon" className="block text-xs font-medium text-[#475569]">
                    Watch App Icon
                  </label>
                  <select
                    id="sched-icon"
                    value={schedIconId}
                    onChange={(e) => setSchedIconId(Number(e.target.value))}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  >
                    {WATCH_APP_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="sched-body" className="block text-xs font-medium text-[#475569]">
                    Message Body
                  </label>
                  <input
                    id="sched-body"
                    type="text"
                    value={schedBody}
                    onChange={(e) => setSchedBody(e.target.value)}
                    placeholder="Drink water and take a 2-minute walk"
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#475569]">Schedule Type</span>
                  <div className="mt-1.5 inline-flex rounded-xl bg-[#F1F5F9] p-1">
                    <button
                      type="button"
                      onClick={() => setSchedMode('interval')}
                      className={`h-8 rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        schedMode === 'interval'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Repeating Interval
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedMode('once')}
                      className={`h-8 rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        schedMode === 'once'
                          ? 'bg-white text-[#0F172A] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      Specific Time
                    </button>
                  </div>
                </div>

                <div>
                  {schedMode === 'interval' ? (
                    <>
                      <label htmlFor="sched-interval" className="block text-xs font-medium text-[#475569]">
                        Repeat Every (Minutes)
                      </label>
                      <input
                        id="sched-interval"
                        type="number"
                        min={1}
                        max={720}
                        value={schedInterval}
                        onChange={(e) => setSchedInterval(Math.max(1, Number(e.target.value) || 1))}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 font-mono text-sm text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:outline-none"
                      />
                    </>
                  ) : (
                    <>
                      <label htmlFor="sched-time" className="block text-xs font-medium text-[#475569]">
                        Trigger Time (24h)
                      </label>
                      <input
                        id="sched-time"
                        type="time"
                        value={schedTime}
                        onChange={(e) => setSchedTime(e.target.value)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 font-mono text-sm text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:outline-none"
                      />
                    </>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Scheduled Alert</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <h3 className="text-base font-semibold text-[#0F172A]">Active Schedules</h3>
              {scheduledAlerts.length === 0 ? (
                <div className="mt-6 flex flex-col items-center py-6 text-center">
                  <Bell className="h-6 w-6 text-[#94A3B8]" />
                  <p className="mt-2 text-sm text-[#475569]">No scheduled alerts configured.</p>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Add a repeating interval or clock-time reminder above.
                  </p>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#F1F5F9]">
                  {scheduledAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[#0F172A]">
                            {alert.title}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            · {getPresetLabel(alert.iconId)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#475569]">
                          {alert.body || 'No body text'}
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-xs text-[#64748B] tabular-nums">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {alert.mode === 'interval'
                              ? `Every ${alert.intervalMinutes} min`
                              : `At ${alert.targetTime}`}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {alert.enabled
                              ? `Next in ${formatCountdown(alert.nextRunMs, nowMs)}`
                              : 'Paused'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          disabled={!isConnected}
                          onClick={() => onFireScheduledAlertNow(alert.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-40 whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Send Now</span>
                        </button>
                        <MaterialSwitch
                          checked={alert.enabled}
                          onChange={(val) => onToggleScheduledAlert(alert.id, val)}
                          label={`Toggle ${alert.title}`}
                        />
                        <button
                          type="button"
                          onClick={() => onDeleteScheduledAlert(alert.id)}
                          aria-label={`Delete ${alert.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
