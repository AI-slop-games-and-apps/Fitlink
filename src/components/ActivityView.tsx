import { useEffect, useState } from 'react';
import {
  Activity,
  Droplets,
  Footprints,
  HeartPulse,
  Minus,
  Plus,
  RefreshCw,
  Route,
} from 'lucide-react';
import type { ActivityState, DistanceUnit, WeeklyActivityDay } from '../types/fitlink';

interface ActivityViewProps {
  isConnected: boolean;
  isSyncing: boolean;
  activity: ActivityState;
  weeklyDays: WeeklyActivityDay[];
  todaySteps: number | null;
  todayDistanceMeters: number | null;
  onRefresh: () => void;
  onChangeUnit: (unit: DistanceUnit) => void;
  onChangeDailyGoalMeters: (meters: number) => void;
}

const METERS_PER_MILE = 1609.344;

function metersToDisplay(meters: number, unit: DistanceUnit, decimals = 2): string {
  const val = unit === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
  return val.toFixed(decimals);
}

function getHeartRateStatus(bpm: number | null): { label: string; colorClass: string } {
  if (bpm === null) return { label: 'No reading yet', colorClass: 'text-[#64748B]' };
  if (bpm < 60) return { label: 'Resting · Low', colorClass: 'text-[#2563EB]' };
  if (bpm <= 100) return { label: 'Normal Resting', colorClass: 'text-[#16A34A]' };
  if (bpm <= 135) return { label: 'Elevated · Active', colorClass: 'text-[#D97706]' };
  return { label: 'High Intensity', colorClass: 'text-[#DC2626]' };
}

function getSpo2Status(spo2: number | null): { label: string; colorClass: string } {
  if (spo2 === null) return { label: 'No reading yet', colorClass: 'text-[#64748B]' };
  if (spo2 >= 95) return { label: 'Normal (95–100%)', colorClass: 'text-[#16A34A]' };
  if (spo2 >= 90) return { label: 'Borderline (90–94%)', colorClass: 'text-[#D97706]' };
  return { label: 'Low (<90%)', colorClass: 'text-[#DC2626]' };
}

function computeStats(samples: number[]): { min: number; avg: number; max: number } | null {
  if (samples.length === 0) return null;
  let min = samples[0];
  let max = samples[0];
  let sum = 0;
  for (const val of samples) {
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }
  return {
    min,
    avg: Math.round(sum / samples.length),
    max,
  };
}

export function ActivityView({
  isConnected,
  isSyncing,
  activity,
  weeklyDays,
  todaySteps,
  todayDistanceMeters,
  onRefresh,
  onChangeUnit,
  onChangeDailyGoalMeters,
}: ActivityViewProps) {
  const todayIndex = Math.max(
    0,
    weeklyDays.findIndex((d) => d.isToday)
  );
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayIndex);

  useEffect(() => {
    if (selectedDayIdx >= weeklyDays.length) {
      setSelectedDayIdx(todayIndex);
    }
  }, [selectedDayIdx, todayIndex, weeklyDays.length]);

  const unit = activity.distanceUnit;
  const goalMeters = Math.max(1000, activity.dailyDistanceGoalMeters);
  const selectedDay = weeklyDays[selectedDayIdx] ?? weeklyDays[todayIndex] ?? weeklyDays[0];

  const weeklyTotalMeters = weeklyDays.reduce((acc, d) => acc + d.distanceMeters, 0);
  const daysMetGoal = weeklyDays.filter((d) => d.distanceMeters >= goalMeters).length;
  const maxDayMeters = weeklyDays.reduce((max, d) => Math.max(max, d.distanceMeters), 0);
  const chartScaleMax = Math.max(goalMeters, maxDayMeters, 1000) * 1.15;
  const goalLineBottomPct = Math.min(94, Math.max(8, (goalMeters / chartScaleMax) * 100));

  const todayGoalPct =
    todayDistanceMeters !== null && goalMeters > 0
      ? Math.round((todayDistanceMeters / goalMeters) * 100)
      : null;

  const selectedGoalPct =
    selectedDay && goalMeters > 0
      ? Math.round((selectedDay.distanceMeters / goalMeters) * 100)
      : 0;
  const selectedRemainingMeters = selectedDay
    ? Math.max(0, goalMeters - selectedDay.distanceMeters)
    : goalMeters;

  const hrStatus = getHeartRateStatus(activity.latestHeartRate);
  const spo2Status = getSpo2Status(activity.latestSpo2);
  const hrStats = computeStats(activity.heartRateSamples);
  const spo2Stats = computeStats(activity.spo2Samples);

  const stepGoalMeters = (delta: 1 | -1) => {
    const step = unit === 'mi' ? Math.round(0.5 * METERS_PER_MILE) : 500;
    const next = Math.max(1000, Math.min(25_000, goalMeters + delta * step));
    onChangeDailyGoalMeters(next);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* 1. Compact Top Daily Activity Card (2x2 Grid, no Connect Watch button) */}
      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-semibold text-[#0F172A]">Daily Activity</h2>
              <span className="text-xs text-[#64748B] tabular-nums">
                · {activity.lastActivitySyncedAt ? `Synced ${activity.lastActivitySyncedAt}` : 'Not synced yet'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Inline km / mi segmented toggle */}
            <div
              role="group"
              aria-label="Distance unit"
              className="inline-flex h-8 items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
            >
              <button
                type="button"
                onClick={() => onChangeUnit('km')}
                aria-pressed={unit === 'km'}
                className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  unit === 'km'
                    ? 'bg-white text-[#2563EB] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                km
              </button>
              <button
                type="button"
                onClick={() => onChangeUnit('mi')}
                aria-pressed={unit === 'mi'}
                className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  unit === 'mi'
                    ? 'bg-white text-[#2563EB] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                mi
              </button>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={!isConnected || isSyncing}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Compact 2x2 Metrics Grid */}
        <div className="grid grid-cols-2">
          {/* Row 1, Col 1: Distance Walked */}
          <div className="border-r border-b border-[#E2E8F0] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Route className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Distance Walked</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                {todayDistanceMeters !== null
                  ? metersToDisplay(todayDistanceMeters, unit, 2)
                  : '--'}
              </span>
              <span className="text-xs font-medium text-[#64748B]">{unit}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-[#64748B] tabular-nums">
              {todayGoalPct !== null
                ? `${todayGoalPct}% of ${metersToDisplay(goalMeters, unit, 1)} ${unit} goal`
                : `Goal ${metersToDisplay(goalMeters, unit, 1)} ${unit}`}
            </div>
          </div>

          {/* Row 1, Col 2: Steps Taken */}
          <div className="border-b border-[#E2E8F0] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Footprints className="h-3.5 w-3.5 text-[#16A34A]" />
              <span>Steps Taken</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                {todaySteps !== null ? todaySteps.toLocaleString() : '--'}
              </span>
              <span className="text-xs font-medium text-[#64748B]">steps</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-[#64748B]">
              {todaySteps !== null ? 'Today via 0xFEEA' : 'Awaiting sync'}
            </div>
          </div>

          {/* Row 2, Col 1: Heart Rate */}
          <div className="border-r border-[#E2E8F0] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <HeartPulse className="h-3.5 w-3.5 text-[#DC2626]" />
              <span>Heart Rate</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                {activity.latestHeartRate !== null ? activity.latestHeartRate : '--'}
              </span>
              <span className="text-xs font-medium text-[#64748B]">bpm</span>
            </div>
            <div className={`mt-0.5 truncate text-[11px] font-medium ${hrStatus.colorClass}`}>
              {hrStatus.label}
              {activity.heartRateUpdatedAt ? (
                <span className="font-normal text-[#64748B] tabular-nums">
                  {' '}
                  · {activity.heartRateUpdatedAt}
                </span>
              ) : null}
            </div>
          </div>

          {/* Row 2, Col 2: SpO2 */}
          <div className="px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Droplets className="h-3.5 w-3.5 text-[#0891B2]" />
              <span>SpO2</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                {activity.latestSpo2 !== null ? activity.latestSpo2 : '--'}
              </span>
              <span className="text-xs font-medium text-[#64748B]">%</span>
            </div>
            <div className={`mt-0.5 truncate text-[11px] font-medium ${spo2Status.colorClass}`}>
              {spo2Status.label}
              {activity.spo2UpdatedAt ? (
                <span className="font-normal text-[#64748B] tabular-nums">
                  {' '}
                  · {activity.spo2UpdatedAt}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Weekly Distance Bar Chart Card (Mon–Sun) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">Weekly Distance</h3>
            <p className="mt-0.5 text-xs text-[#64748B] tabular-nums">
              Weekly total: {metersToDisplay(weeklyTotalMeters, unit, 2)} {unit} · {daysMetGoal}/7
              {' '}days met daily goal
            </p>
          </div>

          {/* Daily Distance Goal Adjuster */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-[#64748B] whitespace-nowrap">
              Daily Goal
            </span>
            <div className="inline-flex h-8 items-center rounded-xl border border-[#CBD5E1] bg-white">
              <button
                type="button"
                onClick={() => stepGoalMeters(-1)}
                aria-label="Decrease daily distance goal"
                className="flex h-full w-8 items-center justify-center text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] rounded-l-xl"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[4.5rem] px-2 text-center font-mono text-xs font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                {metersToDisplay(goalMeters, unit, 1)} {unit}
              </span>
              <button
                type="button"
                onClick={() => stepGoalMeters(1)}
                aria-label="Increase daily distance goal"
                className="flex h-full w-8 items-center justify-center text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] rounded-r-xl"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive 7-Day Vertical Bar Chart */}
        <div className="mt-6">
          <div className="relative h-56 w-full pt-6">
            {/* Dashed Daily Goal Reference Line aligned 1:1 with the h-36 bar plot area */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[2.25rem] z-10 h-36">
              <div
                className="absolute inset-x-0 border-t border-dashed border-[#94A3B8]"
                style={{ bottom: `${goalLineBottomPct}%` }}
              >
                <span className="absolute -top-5 right-0 bg-white/90 px-1 font-mono text-[11px] font-medium text-[#64748B] tabular-nums">
                  Goal {metersToDisplay(goalMeters, unit, 1)} {unit}
                </span>
              </div>
            </div>

            {/* 7 Weekday Columns */}
            <div className="grid h-full grid-cols-7 gap-2 sm:gap-4">
              {weeklyDays.map((day, idx) => {
                const isSelected = idx === selectedDayIdx;
                const metGoal = day.distanceMeters >= goalMeters && day.distanceMeters > 0;
                const heightPct =
                  day.distanceMeters > 0
                    ? Math.max(6, Math.min(100, (day.distanceMeters / chartScaleMax) * 100))
                    : 2;

                const barColorClass = isSelected
                  ? 'bg-[#2563EB]'
                  : metGoal
                  ? 'bg-[#16A34A]'
                  : day.distanceMeters > 0
                  ? 'bg-[#93C5FD] group-hover:bg-[#60A5FA]'
                  : 'bg-[#E2E8F0]';

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    aria-pressed={isSelected}
                    aria-label={`${day.dayFull}, ${metersToDisplay(day.distanceMeters, unit, 2)} ${unit}, ${day.steps} steps`}
                    className="group flex h-full flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-lg"
                  >
                    <div className="flex h-44 w-full flex-col items-center justify-end">
                      <span
                        className={`mb-1.5 font-mono text-[11px] tabular-nums transition-colors ${
                          isSelected
                            ? 'font-semibold text-[#2563EB]'
                            : day.distanceMeters > 0
                            ? 'text-[#64748B] group-hover:text-[#0F172A]'
                            : 'text-[#CBD5E1]'
                        }`}
                      >
                        {day.distanceMeters > 0
                          ? metersToDisplay(day.distanceMeters, unit, 1)
                          : '0.0'}
                      </span>
                      <div className="flex h-36 w-full max-w-[2.75rem] items-end justify-center">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-200 ${barColorClass}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex h-7 flex-col items-center justify-start">
                      <span
                        className={`text-xs transition-colors ${
                          isSelected
                            ? 'font-semibold text-[#2563EB]'
                            : day.isToday
                            ? 'font-semibold text-[#0F172A]'
                            : 'font-medium text-[#64748B]'
                        }`}
                      >
                        {day.dayShort}
                      </span>
                      {day.isToday && (
                        <span
                          className="mt-0.5 h-1 w-1 rounded-full bg-[#2563EB]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details Footer */}
          {selectedDay && (
            <div className="mt-4 flex flex-col gap-3 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0F172A]">
                  {selectedDay.dayFull}, {selectedDay.dateLabel}
                  {selectedDay.isToday ? (
                    <span className="ml-2 text-xs font-medium text-[#2563EB]">Today</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-[#64748B]">
                  {selectedDay.distanceMeters >= goalMeters
                    ? `Daily goal reached (${selectedGoalPct}%)`
                    : selectedDay.distanceMeters > 0
                    ? `${metersToDisplay(selectedRemainingMeters, unit, 2)} ${unit} remaining to reach daily goal (${selectedGoalPct}%)`
                    : 'No walking distance recorded for this day'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 shrink-0">
                <div>
                  <div className="text-[11px] font-medium text-[#64748B]">Distance</div>
                  <div className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                    {metersToDisplay(selectedDay.distanceMeters, unit, 2)} {unit}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#64748B]">Steps</div>
                  <div className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                    {selectedDay.steps.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#64748B]">Goal Status</div>
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      selectedDay.distanceMeters >= goalMeters
                        ? 'text-[#16A34A]'
                        : selectedDay.distanceMeters > 0
                        ? 'text-[#0F172A]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {selectedDay.distanceMeters >= goalMeters
                      ? `Met · ${selectedGoalPct}%`
                      : selectedDay.distanceMeters > 0
                      ? `${selectedGoalPct}%`
                      : 'No data'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Combined Split Card: Heart Rate (Left) | SpO2 (Right) */}
      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
        <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] md:grid-cols-2 md:divide-x md:divide-y-0">
          {/* Left Side: Heart Rate */}
          <div className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-[#DC2626]" />
                  <h3 className="text-base font-semibold text-[#0F172A]">Heart Rate</h3>
                </div>
                <span className="font-mono text-xs text-[#64748B] tabular-nums">
                  {activity.heartRateUpdatedAt
                    ? `Updated ${activity.heartRateUpdatedAt}`
                    : 'Waiting for sensor'}
                </span>
              </div>

              <div className="mt-5 flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                    {activity.latestHeartRate !== null ? activity.latestHeartRate : '--'}
                  </span>
                  <span className="text-sm font-medium text-[#64748B]">bpm</span>
                </div>
                <span className={`text-xs font-semibold ${hrStatus.colorClass}`}>
                  {hrStatus.label}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3 text-xs text-[#64748B] tabular-nums">
                <span>
                  Min:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {hrStats ? `${hrStats.min}` : '--'}
                  </strong>
                </span>
                <span>
                  Avg:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {hrStats ? `${hrStats.avg}` : '--'}
                  </strong>
                </span>
                <span>
                  Max:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {hrStats ? `${hrStats.max}` : '--'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Recent Heart Rate Samples Bar Strip */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#64748B]">
                <span>Recent Readings</span>
                <span className="font-mono tabular-nums">
                  {activity.heartRateSamples.length > 0
                    ? `${activity.heartRateSamples.length} samples`
                    : '0 samples'}
                </span>
              </div>
              <div className="grid h-14 grid-cols-12 items-end gap-1.5 rounded-xl bg-[#F8FAFC] p-2.5">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const offset = 12 - activity.heartRateSamples.length;
                  const sample = idx >= offset ? activity.heartRateSamples[idx - offset] : null;
                  const isLatest = sample !== null && idx === 11;
                  const pct =
                    sample !== null
                      ? Math.max(15, Math.min(100, ((sample - 45) / (155 - 45)) * 100))
                      : 12;
                  return (
                    <div
                      key={idx}
                      title={sample !== null ? `${sample} bpm` : 'No sample'}
                      className={`w-full rounded-sm transition-all ${
                        sample === null
                          ? 'bg-[#E2E8F0]'
                          : isLatest
                          ? 'bg-[#DC2626]'
                          : 'bg-[#FCA5A5]'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: SpO2 */}
          <div className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-[#0891B2]" />
                  <h3 className="text-base font-semibold text-[#0F172A]">SpO2</h3>
                </div>
                <span className="font-mono text-xs text-[#64748B] tabular-nums">
                  {activity.spo2UpdatedAt
                    ? `Updated ${activity.spo2UpdatedAt}`
                    : 'Waiting for sensor'}
                </span>
              </div>

              <div className="mt-5 flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
                    {activity.latestSpo2 !== null ? activity.latestSpo2 : '--'}
                  </span>
                  <span className="text-sm font-medium text-[#64748B]">%</span>
                </div>
                <span className={`text-xs font-semibold ${spo2Status.colorClass}`}>
                  {spo2Status.label}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3 text-xs text-[#64748B] tabular-nums">
                <span>
                  Min:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {spo2Stats ? `${spo2Stats.min}%` : '--'}
                  </strong>
                </span>
                <span>
                  Avg:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {spo2Stats ? `${spo2Stats.avg}%` : '--'}
                  </strong>
                </span>
                <span>
                  Max:{' '}
                  <strong className="font-mono font-semibold text-[#0F172A]">
                    {spo2Stats ? `${spo2Stats.max}%` : '--'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Recent SpO2 Samples Bar Strip */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#64748B]">
                <span>Recent Readings</span>
                <span className="font-mono tabular-nums">
                  {activity.spo2Samples.length > 0
                    ? `${activity.spo2Samples.length} samples`
                    : '0 samples'}
                </span>
              </div>
              <div className="grid h-14 grid-cols-12 items-end gap-1.5 rounded-xl bg-[#F8FAFC] p-2.5">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const offset = 12 - activity.spo2Samples.length;
                  const sample = idx >= offset ? activity.spo2Samples[idx - offset] : null;
                  const isLatest = sample !== null && idx === 11;
                  const pct =
                    sample !== null
                      ? Math.max(15, Math.min(100, ((sample - 85) / (100 - 85)) * 100))
                      : 12;
                  return (
                    <div
                      key={idx}
                      title={sample !== null ? `${sample}% SpO2` : 'No sample'}
                      className={`w-full rounded-sm transition-all ${
                        sample === null
                          ? 'bg-[#E2E8F0]'
                          : isLatest
                          ? 'bg-[#0891B2]'
                          : 'bg-[#67E8F9]'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
