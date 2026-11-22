import { useState } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import {
  formatProtocolLabel,
  resolveProtocolVersion,
  type ProtocolPreference,
} from '../protocol/feeaCodec';
import type { PacketLogEntry, WatchRuntimeState } from '../types/fitlink';

interface DeviceProtocolViewProps {
  watch: WatchRuntimeState;
  packetLog: PacketLogEntry[];
  onChangeProtocolPreference: (pref: ProtocolPreference) => void;
  onChangeMtuSize: (mtu: number) => void;
  onChangeWriteDelay: (delayMs: number) => void;
  onClearPacketLog: () => void;
}

export function DeviceProtocolView({
  watch,
  packetLog,
  onChangeProtocolPreference,
  onChangeMtuSize,
  onChangeWriteDelay,
  onClearPacketLog,
}: DeviceProtocolViewProps) {
  const [logFilter, setLogFilter] = useState<'all' | 'tx' | 'rx' | 'system'>('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isDefaultBleTuning = watch.mtuSize === 20 && watch.writeDelayMs === 50;

  const filteredLog =
    logFilter === 'all'
      ? packetLog
      : packetLog.filter((entry) => entry.direction === logFilter);

  const activeProto = formatProtocolLabel(
    resolveProtocolVersion(watch.detectedProtocol, watch.protocolPreference)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Device Info (GATT 0x180A) */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <h3 className="text-base font-semibold text-[#0F172A]">
          Device Information (GATT 0x180A)
        </h3>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-[#64748B]">Manufacturer (0x2A29)</dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#0F172A]">
              {watch.deviceInfo.manufacturer}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Model Number (0x2A24)</dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#0F172A]">
              {watch.deviceInfo.model}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Firmware Revision (0x2A26)</dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#0F172A]">
              {watch.deviceInfo.firmware}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Hardware Revision (0x2A27)</dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#0F172A]">
              {watch.deviceInfo.hardware}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Detected / Active Protocol</dt>
            <dd className="mt-1 text-sm font-medium text-[#0F172A]">
              {formatProtocolLabel(watch.detectedProtocol)} ·{' '}
              <span className="text-[#2563EB]">{activeProto}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">BLE Address / Device ID</dt>
            <dd className="mt-1 truncate font-mono text-sm text-[#475569] tabular-nums">
              {watch.deviceId || '-'}
            </dd>
          </div>
        </dl>
      </section>

      {/* FEEA Protocol & Framing Settings */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <h3 className="text-base font-semibold text-[#0F172A]">
          FEEA Protocol & BLE Framing
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Service 0xFEEA · Write 0xFEE2 (DATA_OUT) · Notify 0xFEE3 (DATA_IN)
        </p>

        <div className="mt-5 space-y-6">
          <div>
            <div className="text-xs font-medium text-[#475569]">Protocol Version Mode</div>
            <div className="mt-2 inline-flex flex-wrap rounded-xl bg-[#F1F5F9] p-1">
              {(
                [
                  { id: 'auto', label: 'Auto-detect' },
                  { id: 'v2', label: 'FEEA V2 (0xFEEA)' },
                  { id: 'v1', label: 'FEEA V1 (0xFEEA 0x10)' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChangeProtocolPreference(option.id)}
                  className={`h-9 rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    watch.protocolPreference === option.id
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 rounded-xl py-1 text-left focus-visible:outline-2 focus-visible:outline-[#2563EB]"
            >
              <div>
                <div className="text-sm font-medium text-[#0F172A]">
                  Advanced BLE Settings
                </div>
                <div className="mt-0.5 font-mono text-xs text-[#64748B] tabular-nums">
                  MTU {watch.mtuSize}B · Write delay {watch.writeDelayMs} ms
                  {isDefaultBleTuning ? ' · Defaults' : ' · Custom'}
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-150 ${
                  advancedOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-5 pt-2">
                <p className="text-xs text-[#64748B]">
                  Defaults (20B chunk, 50 ms delay) are safe for all 0xFEEA watches. Increase write delay if long notifications drop, or raise MTU on newer BLE 5.0 watches.
                </p>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="mtu-slider" className="font-medium text-[#475569]">
                        MTU Chunk Size
                      </label>
                      <span className="font-mono font-medium text-[#0F172A] tabular-nums">
                        {watch.mtuSize} bytes
                      </span>
                    </div>
                    <input
                      id="mtu-slider"
                      type="range"
                      min={20}
                      max={244}
                      step={4}
                      value={watch.mtuSize}
                      onChange={(e) => onChangeMtuSize(Number(e.target.value))}
                      className="mt-2 w-full accent-[#2563EB]"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[11px] text-[#94A3B8] tabular-nums">
                      <span>20B (Safe default)</span>
                      <span>244B (Fast V2)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="delay-slider" className="font-medium text-[#475569]">
                        Inter-Chunk Write Delay
                      </label>
                      <span className="font-mono font-medium text-[#0F172A] tabular-nums">
                        {watch.writeDelayMs} ms
                      </span>
                    </div>
                    <input
                      id="delay-slider"
                      type="range"
                      min={20}
                      max={150}
                      step={10}
                      value={watch.writeDelayMs}
                      onChange={(e) => onChangeWriteDelay(Number(e.target.value))}
                      className="mt-2 w-full accent-[#2563EB]"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[11px] text-[#94A3B8] tabular-nums">
                      <span>20 ms</span>
                      <span>150 ms</span>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    disabled={isDefaultBleTuning}
                    onClick={() => {
                      onChangeMtuSize(20);
                      onChangeWriteDelay(50);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BLE Packet Activity Log */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[#0F172A]">BLE Packet Activity Log</h3>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-[#F1F5F9] p-1">
              {(['all', 'tx', 'rx', 'system'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setLogFilter(dir)}
                  className={`h-7 rounded-lg px-2.5 text-xs font-medium uppercase transition-colors whitespace-nowrap ${
                    logFilter === dir
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearPacketLog}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {filteredLog.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">No packet events in this filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs font-medium text-[#64748B]">
                  <th className="py-2.5 pr-4">Time</th>
                  <th className="py-2.5 pr-4">Dir</th>
                  <th className="py-2.5 pr-4">Action</th>
                  <th className="py-2.5 pr-4">Hex Payload</th>
                  <th className="py-2.5 text-right">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 pr-4 font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {entry.timestamp}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs font-semibold uppercase whitespace-nowrap">
                      <span
                        className={
                          entry.direction === 'tx'
                            ? 'text-[#2563EB]'
                            : entry.direction === 'rx'
                            ? 'text-[#16A34A]'
                            : 'text-[#64748B]'
                        }
                      >
                        {entry.direction}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-medium text-[#0F172A] whitespace-nowrap">
                      {entry.actionLabel}
                    </td>
                    <td className="max-w-md truncate py-2.5 pr-4 font-mono text-xs text-[#475569]">
                      {entry.hexPreview}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {entry.chunkCount}
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
