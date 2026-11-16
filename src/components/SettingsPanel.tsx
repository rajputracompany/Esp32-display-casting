import React from 'react';
import { EXPRESSION_META } from '../engine/oledEngine';
import { EyeExpression, MiniCastSettings } from '../types/minicast';

interface SettingsPanelProps {
  settings: MiniCastSettings;
  showPixelGrid: boolean;
  onTogglePixelGrid: () => void;
  onUpdateSettings: (patch: Partial<MiniCastSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  showPixelGrid,
  onTogglePixelGrid,
  onUpdateSettings,
}) => {
  return (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Device & Behaviour</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Configure automatic sleep, wake-up animations, and interface complexity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="device-name-input" className="block text-xs font-medium text-slate-300">
              Bluetooth Device Name
            </label>
            <input
              id="device-name-input"
              type="text"
              value={settings.deviceName}
              onChange={(e) => onUpdateSettings({ deviceName: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#232B3D] bg-[#0B0E14] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="default-expr-select" className="block text-xs font-medium text-slate-300">
              Default Idle Expression
            </label>
            <select
              id="default-expr-select"
              value={settings.defaultExpression}
              onChange={(e) => onUpdateSettings({ defaultExpression: e.target.value as EyeExpression })}
              className="mt-1.5 w-full rounded-xl border border-[#232B3D] bg-[#0B0E14] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {EXPRESSION_META.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 border-t border-[#1E2534] pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-100">Wake-up Animation</span>
              <span className="text-xs text-slate-400">
                Play gentle opening and happy expression when waking from sleep
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.wakeAnimEnabled}
              onChange={(e) => onUpdateSettings({ wakeAnimEnabled: e.target.checked })}
              className="h-4 w-4 accent-cyan-400"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-100">Advanced Engineering Mode</span>
              <span className="text-xs text-slate-400">
                Expose animation timing, OLED contrast (0x81), image dithering, and live SPP packet log
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.isAdvancedMode}
              onChange={(e) => onUpdateSettings({ isAdvancedMode: e.target.checked })}
              className="h-4 w-4 accent-cyan-400"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-100">128 × 64 Sub-Pixel Grid Overlay</span>
              <span className="text-xs text-slate-400">
                Visualize individual monochrome SSD1306 pixels in the simulator
              </span>
            </div>
            <input
              type="checkbox"
              checked={showPixelGrid}
              onChange={onTogglePixelGrid}
              className="h-4 w-4 accent-cyan-400"
            />
          </label>
        </div>
      </div>

      {/* Advanced Power & OLED Hardware Parameters */}
      {settings.isAdvancedMode && (
        <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-5">
          <h3 className="text-base font-semibold text-slate-100">Hardware & Power Parameters</h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Auto-Sleep Timeout</span>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.sleepTimeoutSec}s</span>
              </div>
              <input
                type="range"
                min={10}
                max={180}
                step={5}
                value={settings.sleepTimeoutSec}
                onChange={(e) => onUpdateSettings({ sleepTimeoutSec: Number(e.target.value) })}
                className="mt-1.5 w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Custom Display Return Timeout</span>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.customDisplayTimeoutSec}s</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={settings.customDisplayTimeoutSec}
                onChange={(e) => onUpdateSettings({ customDisplayTimeoutSec: Number(e.target.value) })}
                className="mt-1.5 w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">OLED Contrast (SSD1306 0x81)</span>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.oledContrast} / 255</span>
              </div>
              <input
                type="range"
                min={20}
                max={255}
                value={settings.oledContrast}
                onChange={(e) => onUpdateSettings({ oledContrast: Number(e.target.value) })}
                className="mt-1.5 w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Text Scroll Speed</span>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.scrollSpeed} px/f</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.scrollSpeed}
                onChange={(e) => onUpdateSettings({ scrollSpeed: Number(e.target.value) })}
                className="mt-1.5 w-full accent-cyan-400"
              />
            </div>
          </div>

          <div className="border-t border-[#1E2534] pt-4 text-xs leading-relaxed text-slate-400">
            <strong className="font-semibold text-slate-200">Bluetooth Classic SPP & Sleep Architecture:</strong>{' '}
            On the original ESP32-WROOM-32, Deep Sleep powers off the BT baseband radio and drops the SPP socket.
            MiniCast therefore uses <span className="text-slate-200">Connected Low-Power Sleep</span> (OLED{' '}
            <span className="font-mono text-slate-300">0xAE</span> off + 80 MHz CPU +{' '}
            <span className="font-mono text-slate-300">esp_bt_sleep_enable()</span>), reducing display + CPU draw while keeping Bluetooth responsive to instant wake commands.
          </div>
        </div>
      )}

      {/* About MiniCast */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
        <h3 className="text-base font-semibold text-slate-100">About MiniCast</h3>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="flex justify-between border-b border-[#1E2534] py-2">
            <dt className="text-slate-400">Firmware Protocol</dt>
            <dd className="font-mono text-slate-200 tabular-nums">v1.2.0 (SPP)</dd>
          </div>
          <div className="flex justify-between border-b border-[#1E2534] py-2">
            <dt className="text-slate-400">Microcontroller</dt>
            <dd className="font-mono text-slate-200">ESP32-WROOM-32</dd>
          </div>
          <div className="flex justify-between border-b border-[#1E2534] py-2">
            <dt className="text-slate-400">Display Controller</dt>
            <dd className="font-mono text-slate-200">SSD1306 128×64 I2C (0x3C)</dd>
          </div>
          <div className="flex justify-between border-b border-[#1E2534] py-2">
            <dt className="text-slate-400">I2C Pins & Power</dt>
            <dd className="font-mono text-slate-200">SDA 21 · SCL 22 · 18650 Li-Ion</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
