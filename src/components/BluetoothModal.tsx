import React from 'react';
import { Bluetooth, Check, Loader2, X } from 'lucide-react';
import { ConnectionStatus } from '../types/minicast';

interface BluetoothDeviceOption {
  name: string;
  mac: string;
  rssi: number;
  firmware: string;
}

const SIMULATED_PAIRED_DEVICES: BluetoothDeviceOption[] = [
  { name: 'ESP32-MiniCast', mac: '24:6F:28:A9:14:E2', rssi: -52, firmware: 'v1.2.0' },
  { name: 'MiniCast-Desk-Unit', mac: '3C:71:BF:44:91:08', rssi: -68, firmware: 'v1.2.0' },
];

const ONBOARDING_STEPS = [
  { step: '01', title: 'Turn on MiniCast', desc: 'Power your ESP32 DevKit V1 over USB or the 18650 battery pack.' },
  { step: '02', title: 'Enable Bluetooth', desc: 'Open Bluetooth on your phone and pair once with ESP32-MiniCast.' },
  { step: '03', title: 'Select your device', desc: 'Pick your paired MiniCast controller from the list below.' },
  { step: '04', title: 'Connect over SPP', desc: 'Establishes a low-latency Bluetooth Classic RFCOMM link.' },
  { step: '05', title: 'Control & Cast', desc: 'Animate the robotic eye or cast text, photos, and pixel art.' },
];

interface BluetoothModalProps {
  isOpen: boolean;
  connectionStatus: ConnectionStatus;
  connectedDeviceName: string;
  onClose: () => void;
  onConnectDevice: (name: string) => void;
  onDisconnect: () => void;
}

export const BluetoothModal: React.FC<BluetoothModalProps> = ({
  isOpen,
  connectionStatus,
  connectedDeviceName,
  onClose,
  onConnectDevice,
  onDisconnect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#232B3D] bg-[#12161F] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bt-modal-title" className="text-lg font-semibold text-slate-100">
              Bluetooth Classic SPP Connection
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Connect to your ESP32-WROOM-32 MiniCast display or test the interactive simulator.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connection dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          {SIMULATED_PAIRED_DEVICES.map((dev) => {
            const isConnected = connectionStatus === 'CONNECTED' && connectedDeviceName === dev.name;
            const isPairing = connectionStatus === 'PAIRING';

            return (
              <div
                key={dev.mac}
                className="flex items-center justify-between gap-4 rounded-xl border border-[#232B3D] bg-[#0D1119] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span className="truncate text-sm font-medium text-slate-100">{dev.name}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-400 tabular-nums">
                    {dev.mac} · {dev.rssi} dBm · FW {dev.firmware}
                  </p>
                </div>

                {isConnected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="min-h-[40px] shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPairing}
                    onClick={() => onConnectDevice(dev.name)}
                    className="flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isPairing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Connecting
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t border-[#1E2534] pt-5">
          <h3 className="text-xs font-semibold text-slate-300">
            First-Time Setup Guide
          </h3>
          <ol className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ONBOARDING_STEPS.map((item) => (
              <li key={item.step} className="text-xs leading-relaxed text-slate-400">
                <span className="font-mono font-medium text-cyan-400">{item.step}.</span>{' '}
                <strong className="font-medium text-slate-200">{item.title}:</strong> {item.desc}
              </li>
            ))}
          </ol>
        </div>

        {connectionStatus === 'CONNECTED' && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              RFCOMM SPP link active with {connectedDeviceName}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-semibold text-emerald-300 underline-offset-2 hover:underline"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
