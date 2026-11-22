import { useEffect, useState } from 'react';
import { Clock, Send } from 'lucide-react';
import { MaterialSwitch } from './MaterialSwitch';

interface TimeSyncViewProps {
  isConnected: boolean;
  use24Hour: boolean;
  autoSyncOnConnect: boolean;
  lastSyncedLabel: string;
  onSyncTimeNow: () => void;
  onToggleUse24Hour: (use24h: boolean) => void;
  onToggleAutoSync: (enabled: boolean) => void;
  onSyncCustomTime: (date: Date, utcOffsetMinutes: number) => void;
}

function toLocalDateTimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TimeSyncView({
  isConnected,
  use24Hour,
  autoSyncOnConnect,
  lastSyncedLabel,
  onSyncTimeNow,
  onToggleUse24Hour,
  onToggleAutoSync,
  onSyncCustomTime,
}: TimeSyncViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [customDateTime, setCustomDateTime] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [utcOffsetHours, setUtcOffsetHours] = useState(() =>
    Math.round(-new Date().getTimezoneOffset() / 60)
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedClock = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !use24Hour,
  });

  const formattedDate = now.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = new Date(customDateTime);
    if (Number.isNaN(parsed.getTime())) return;
    onSyncCustomTime(parsed, utcOffsetHours * 60);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Live Host Clock */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="text-xs font-medium text-[#64748B]">System Clock</div>
        <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-[#0F172A] tabular-nums sm:text-5xl">
          {formattedClock}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#475569]">
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-xs text-[#64748B] tabular-nums">
            Last synced: {lastSyncedLabel}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!isConnected}
            onClick={onSyncTimeNow}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Clock className="h-4 w-4" />
            <span>Sync Time Now</span>
          </button>
          {!isConnected && (
            <span className="text-xs text-[#64748B]">
              Connect a watch to transmit FEEA time packet (0x31).
            </span>
          )}
        </div>
      </section>

      {/* Clock Preferences */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <h3 className="text-base font-semibold text-[#0F172A]">Clock Preferences</h3>
        <div className="mt-4 divide-y divide-[#E2E8F0]">
          <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
            <div>
              <div className="text-sm font-medium text-[#0F172A]">24-Hour Time Format</div>
              <div className="text-xs text-[#64748B]">
                Sends FEEA clock format command (0x27) immediately when connected.
              </div>
            </div>
            <MaterialSwitch
              checked={use24Hour}
              onChange={onToggleUse24Hour}
              label="24-Hour Time Format"
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
            <div>
              <div className="text-sm font-medium text-[#0F172A]">Auto-Sync on Connect</div>
              <div className="text-xs text-[#64748B]">
                Automatically synchronizes host date and time whenever the watch pairs.
              </div>
            </div>
            <MaterialSwitch
              checked={autoSyncOnConnect}
              onChange={onToggleAutoSync}
              label="Auto-Sync on Connect"
            />
          </div>
        </div>
      </section>

      {/* Custom Time & Timezone Override */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Custom Time & Timezone Override
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Push an explicit timestamp and UTC offset to test travel zones or watch RTC drift.
        </p>

        <form onSubmit={handleCustomSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="custom-dt" className="block text-xs font-medium text-[#475569]">
              Date & Time
            </label>
            <input
              id="custom-dt"
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 font-mono text-sm text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="custom-tz" className="block text-xs font-medium text-[#475569]">
              UTC Offset (Hours)
            </label>
            <select
              id="custom-tz"
              value={utcOffsetHours}
              onChange={(e) => setUtcOffsetHours(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 font-mono text-sm text-[#0F172A] tabular-nums focus:border-[#2563EB] focus:outline-none"
            >
              {Array.from({ length: 27 }, (_, idx) => idx - 12).map((offset) => (
                <option key={offset} value={offset}>
                  UTC{offset >= 0 ? `+${offset}` : offset}:00
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!isConnected}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-4 w-4" />
              <span>Push Custom Time</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
