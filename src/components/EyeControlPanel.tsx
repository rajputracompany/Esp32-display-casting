import React from 'react';
import { ArrowLeft, ArrowRight, CircleDot, Eye, Moon, Sun, Sparkles } from 'lucide-react';
import { EXPRESSION_META } from '../engine/oledEngine';
import { EyeExpression, MiniCastSettings } from '../types/minicast';

interface EyeControlPanelProps {
  selectedExpression: EyeExpression;
  isIdleEnabled: boolean;
  settings: MiniCastSettings;
  onSelectExpression: (expr: EyeExpression) => void;
  onBlink: () => void;
  onLook: (dir: 'LEFT' | 'CENTER' | 'RIGHT') => void;
  onWake: () => void;
  onSleep: () => void;
  onToggleIdle: () => void;
  onUpdateSettings: (patch: Partial<MiniCastSettings>) => void;
}

export const EyeControlPanel: React.FC<EyeControlPanelProps> = ({
  selectedExpression,
  isIdleEnabled,
  settings,
  onSelectExpression,
  onBlink,
  onLook,
  onWake,
  onSleep,
  onToggleIdle,
  onUpdateSettings,
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Gaze & Action Controls */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-100">Gaze & Power State</h3>
          <span className="text-xs text-slate-400">
            Smooth parametric transitions
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onLook('LEFT')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" />
            Look Left
          </button>
          <button
            type="button"
            onClick={() => onLook('CENTER')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
          >
            <CircleDot className="h-4 w-4" />
            Center
          </button>
          <button
            type="button"
            onClick={() => onLook('RIGHT')}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 whitespace-nowrap"
          >
            Look Right
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={onBlink}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap"
          >
            <Eye className="h-4 w-4" />
            Blink
          </button>
          <button
            type="button"
            onClick={onWake}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#171C28] px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:border-cyan-400/50 whitespace-nowrap"
          >
            <Sun className="h-4 w-4 text-cyan-300" />
            Wake Up
          </button>
          <button
            type="button"
            onClick={onSleep}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#171C28] px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:border-cyan-400/50 whitespace-nowrap"
          >
            <Moon className="h-4 w-4 text-slate-300" />
            Sleep
          </button>
          <button
            type="button"
            onClick={onToggleIdle}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              isIdleEnabled
                ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                : 'border-[#232B3D] bg-[#171C28] text-slate-300'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {isIdleEnabled ? 'Idle On' : 'Idle Off'}
          </button>
        </div>
      </div>

      {/* Emotional Expressions Grid */}
      <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Emotional Expressions</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Select a mood to smoothly morph eyelid geometry, pupil dilation, and brow angle.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPRESSION_META.map((item) => {
            const active = selectedExpression === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectExpression(item.id)}
                className={`group flex min-h-[84px] flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : 'border-[#232B3D] bg-[#0D1119] hover:border-slate-600'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-sm font-semibold ${active ? 'text-cyan-300' : 'text-slate-100'}`}>
                    {item.label}
                  </span>
                  <MiniExpressionGlyph expression={item.id} active={active} />
                </div>
                <span className="mt-2 text-xs leading-snug text-slate-400">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Timing Controls */}
      {settings.isAdvancedMode && (
        <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
          <h3 className="text-base font-semibold text-slate-100">Animation Timing & Sleep Policy</h3>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="anim-speed" className="font-medium text-slate-200">
                  Transition Speed
                </label>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.animationSpeed} / 10</span>
              </div>
              <input
                id="anim-speed"
                type="range"
                min={1}
                max={10}
                value={settings.animationSpeed}
                onChange={(e) => onUpdateSettings({ animationSpeed: Number(e.target.value) })}
                className="mt-2 w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sleep-timeout" className="font-medium text-slate-200">
                  Inactivity Sleep Timeout
                </label>
                <span className="font-mono text-cyan-300 tabular-nums">{settings.sleepTimeoutSec}s</span>
              </div>
              <input
                id="sleep-timeout"
                type="range"
                min={10}
                max={180}
                step={5}
                value={settings.sleepTimeoutSec}
                onChange={(e) => onUpdateSettings({ sleepTimeoutSec: Number(e.target.value) })}
                className="mt-2 w-full accent-cyan-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniExpressionGlyph: React.FC<{ expression: EyeExpression; active: boolean }> = ({
  expression,
  active,
}) => {
  const stroke = active ? '#22D3EE' : '#64748B';
  return (
    <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true">
      {expression === 'SLEEPY' && (
        <path d="M2 7 Q12 12 22 7" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      )}
      {expression === 'HAPPY' && (
        <path d="M2 9 Q12 1 22 9" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      )}
      {expression === 'ANGRY' && (
        <>
          <line x1="2" y1="3" x2="12" y2="6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="3" x2="12" y2="6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3" fill={stroke} />
        </>
      )}
      {expression === 'SAD' && (
        <>
          <line x1="2" y1="6" x2="12" y2="3" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="6" x2="12" y2="3" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3" fill={stroke} />
        </>
      )}
      {(expression === 'NEUTRAL' || expression === 'EXCITED' || expression === 'CURIOUS' || expression === 'SURPRISED') && (
        <>
          <rect x="3" y="2" width="18" height="10" rx="5" fill="none" stroke={stroke} strokeWidth="1.6" />
          <circle
            cx={expression === 'CURIOUS' ? 15 : 12}
            cy="7"
            r={expression === 'SURPRISED' ? 1.8 : expression === 'EXCITED' ? 3.2 : 2.5}
            fill={stroke}
          />
        </>
      )}
    </svg>
  );
};
