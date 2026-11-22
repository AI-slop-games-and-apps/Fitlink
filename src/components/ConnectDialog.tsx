import { Bluetooth, BluetoothSearching, Watch, X } from 'lucide-react';
import { isWebBluetoothSupported } from '../protocol/watchController';
import { MaterialSwitch } from './MaterialSwitch';

interface ConnectDialogProps {
  open: boolean;
  isConnecting: boolean;
  showAllBleDevices: boolean;
  onToggleShowAll: (showAll: boolean) => void;
  onClose: () => void;
  onPairWebBluetooth: () => void;
  onPairVirtual: (variant: 'v2' | 'v1') => void;
}

export function ConnectDialog({
  open,
  isConnecting,
  showAllBleDevices,
  onToggleShowAll,
  onClose,
  onPairWebBluetooth,
  onPairVirtual,
}: ConnectDialogProps) {
  if (!open) return null;

  const btSupported = isWebBluetoothSupported();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="connect-dialog-title"
              className="text-lg font-semibold text-[#0F172A]"
            >
              Connect Watch
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              Pair a compatible BLE watch over GATT service 0xFEEA.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-y border-[#E2E8F0] py-4">
          <div>
            <div className="text-sm font-medium text-[#0F172A]">
              Show all BLE devices
            </div>
            <div className="text-xs text-[#64748B]">
              Include peripherals that do not advertise 0xFEEA
            </div>
          </div>
          <MaterialSwitch
            checked={showAllBleDevices}
            onChange={onToggleShowAll}
            label="Show all BLE devices"
          />
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            disabled={!btSupported || isConnecting}
            onClick={onPairWebBluetooth}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            {isConnecting ? (
              <BluetoothSearching className="h-4 w-4 animate-pulse" />
            ) : (
              <Bluetooth className="h-4 w-4" />
            )}
            <span>
              {isConnecting ? 'Pairing...' : 'Scan Bluetooth Devices'}
            </span>
          </button>

          {!btSupported && (
            <p className="text-xs text-[#D97706]">
              Browser Bluetooth unavailable here. Use Chrome/Edge over HTTPS or test with a simulated watch below.
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-[#E2E8F0] pt-5">
          <div className="text-xs font-medium text-[#64748B]">
            Simulated 0xFEEA Devices (for preview without hardware)
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Watch className="h-4 w-4 shrink-0 text-[#475569]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#0F172A]">
                    Watch V2 Demo
                  </div>
                  <div className="truncate font-mono text-xs text-[#64748B] tabular-nums">
                    FEEA V2 · C4:7C:8D:6A:19:E2
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => onPairVirtual('v2')}
                className="h-9 shrink-0 rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F1F5F9] whitespace-nowrap"
              >
                Pair V2
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F8FAFC] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Watch className="h-4 w-4 shrink-0 text-[#475569]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#0F172A]">
                    Watch V1 Demo
                  </div>
                  <div className="truncate font-mono text-xs text-[#64748B] tabular-nums">
                    FEEA V1 · D8:2A:4F:11:09:B4
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => onPairVirtual('v1')}
                className="h-9 shrink-0 rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F1F5F9] whitespace-nowrap"
              >
                Pair V1
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
