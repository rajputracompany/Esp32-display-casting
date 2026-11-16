import React, { useEffect, useRef } from 'react';
import {
  BuiltinAnimation,
  ConnectionStatus,
  CustomDisplayMode,
  DeviceState,
  EyeExpression,
  MiniCastSettings,
  TextAlignment,
} from '../types/minicast';
import {
  drawCustomOledMode,
  drawMonochromeEyeFrame,
  EyeParams,
  OLED_HEIGHT,
  OLED_WIDTH,
  presetForExpression,
} from '../engine/oledEngine';

interface OledViewportProps {
  connectionStatus: ConnectionStatus;
  deviceState: DeviceState;
  displayMode: CustomDisplayMode;
  expression: EyeExpression;
  manualGazeX: number | null;
  manualGazeUntil: number;
  blinkTriggerCount: number;
  wakeTriggerCount: number;
  sleepTriggerCount: number;
  customText: string;
  textAlign: TextAlignment;
  bitmapBytes: Uint8Array | null;
  activeAnim: BuiltinAnimation;
  settings: MiniCastSettings;
  batteryPercent: number;
  batteryMv: number;
  showPixelGrid: boolean;
  onTapOled: () => void;
}

export const OledViewport: React.FC<OledViewportProps> = ({
  connectionStatus,
  deviceState,
  displayMode,
  expression,
  manualGazeX,
  manualGazeUntil,
  blinkTriggerCount,
  wakeTriggerCount,
  sleepTriggerCount,
  customText,
  textAlign,
  bitmapBytes,
  activeAnim,
  settings,
  batteryPercent,
  batteryMv,
  showPixelGrid,
  onTapOled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable animation state matching ESP32 EyeRenderer.cpp
  const stateRef = useRef<{
    current: EyeParams;
    gazeX: number;
    gazeY: number;
    targetGazeX: number;
    targetGazeY: number;
    nextSaccadeMs: number;
    nextBlinkMs: number;
    doubleBlink: number;
    blinking: boolean;
    blinkStartMs: number;
    scrollOffset: number;
    animPhase: number;
    sleepStartMs: number | null;
    wakeStartMs: number | null;
  }>({
    current: { ...presetForExpression('NEUTRAL'), topLid: 1.0 },
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    nextSaccadeMs: 1200,
    nextBlinkMs: 2200,
    doubleBlink: 0,
    blinking: false,
    blinkStartMs: 0,
    scrollOffset: 0,
    animPhase: 0,
    sleepStartMs: null,
    wakeStartMs: null,
  });

  useEffect(() => {
    if (blinkTriggerCount > 0) {
      stateRef.current.blinking = true;
      stateRef.current.blinkStartMs = performance.now();
    }
  }, [blinkTriggerCount]);

  useEffect(() => {
    if (wakeTriggerCount > 0) {
      stateRef.current.current.topLid = 1.0;
      stateRef.current.wakeStartMs = performance.now();
      stateRef.current.sleepStartMs = null;
    }
  }, [wakeTriggerCount]);

  useEffect(() => {
    if (sleepTriggerCount > 0) {
      stateRef.current.sleepStartMs = performance.now();
      stateRef.current.wakeStartMs = null;
    }
  }, [sleepTriggerCount]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const renderLoop = (now: number) => {
      const dt = Math.min(50, Math.max(8, now - lastTime));
      lastTime = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const st = stateRef.current;
          const target = { ...presetForExpression(expression) };

          if (deviceState === 'SLEEP_ANIMATION') {
            if (!st.sleepStartMs) st.sleepStartMs = now;
            const p = Math.min(1, (now - st.sleepStartMs) / 1100);
            target.topLid = 0.55 + 0.45 * p;
            target.bottomLid = 0.15 + 0.25 * p;
          } else {
            st.sleepStartMs = null;
          }

          if (deviceState === 'IDLE_EYE' || deviceState === 'WAKE_ANIMATION') {
            if (now >= st.nextBlinkMs && !st.blinking) {
              st.blinking = true;
              st.blinkStartMs = now;
              if (st.doubleBlink === 0 && Math.random() < 0.22) {
                st.doubleBlink = 1;
                st.nextBlinkMs = now + 280;
              } else {
                st.doubleBlink = 0;
                st.nextBlinkMs = now + 2200 + Math.random() * 3800;
              }
            }

            if (now >= st.nextSaccadeMs && now >= manualGazeUntil) {
              const r = Math.random();
              if (r < 0.35) {
                st.targetGazeX = 0;
                st.targetGazeY = 0;
              } else {
                st.targetGazeX = (Math.random() * 1.7 - 0.85);
                st.targetGazeY = (Math.random() * 0.9 - 0.45);
              }
              st.nextSaccadeMs = now + 900 + Math.random() * 2300;
            }
          }

          const lerpRate = (0.06 + settings.animationSpeed * 0.022) * (dt / 16.67);
          const a = Math.min(0.65, Math.max(0.04, lerpRate));
          const lerp = (x: number, y: number) => x + (y - x) * a;

          st.current.width = lerp(st.current.width, target.width);
          st.current.height = lerp(st.current.height, target.height);
          st.current.cornerRadius = lerp(st.current.cornerRadius, target.cornerRadius);
          st.current.topLid = lerp(st.current.topLid, target.topLid);
          st.current.bottomLid = lerp(st.current.bottomLid, target.bottomLid);
          st.current.upperSlant = lerp(st.current.upperSlant, target.upperSlant);
          st.current.pupilRadius = lerp(st.current.pupilRadius, target.pupilRadius);
          st.current.bounceY = lerp(st.current.bounceY, target.bounceY);

          const hasManualGaze = manualGazeX !== null && now < manualGazeUntil;
          const gxTarget = hasManualGaze ? manualGazeX : st.targetGazeX + target.pupilX * 0.4;
          const gyTarget = hasManualGaze ? 0 : st.targetGazeY + target.pupilY * 0.4;
          st.gazeX = st.gazeX + (Math.max(-1, Math.min(1, gxTarget)) - st.gazeX) * Math.min(0.75, a * 1.4);
          st.gazeY = st.gazeY + (Math.max(-1, Math.min(1, gyTarget)) - st.gazeY) * Math.min(0.75, a * 1.4);

          let blinkAmount = 0;
          if (st.blinking) {
            const elapsed = now - st.blinkStartMs;
            if (elapsed >= 190) {
              st.blinking = false;
            } else {
              blinkAmount = elapsed < 95 ? elapsed / 95 : 1 - (elapsed - 95) / 95;
            }
          }

          if (deviceState === 'CUSTOM_DISPLAY' && displayMode !== 'EYE') {
            st.scrollOffset += (settings.scrollSpeed * 0.85) * (dt / 16.67);
            st.animPhase += (0.06 * (settings.animationSpeed / 5)) * (dt / 16.67);
            drawCustomOledMode(ctx, displayMode, {
              text: customText,
              align: textAlign,
              scrollOffset: st.scrollOffset,
              bitmapBytes,
              animName: activeAnim,
              animPhase: st.animPhase,
              contrast: settings.oledContrast,
            });
          } else {
            drawMonochromeEyeFrame(
              ctx,
              st.current,
              expression,
              st.gazeX,
              st.gazeY,
              blinkAmount,
              now,
              settings.oledContrast,
              deviceState === 'LOW_POWER_SLEEP'
            );
          }
        }
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    expression,
    deviceState,
    displayMode,
    manualGazeX,
    manualGazeUntil,
    customText,
    textAlign,
    bitmapBytes,
    activeAnim,
    settings.animationSpeed,
    settings.oledContrast,
    settings.scrollSpeed,
  ]);

  const stateReadable =
    deviceState === 'LOW_POWER_SLEEP'
      ? 'Low-Power Sleep (OLED Off)'
      : deviceState === 'SLEEP_ANIMATION'
        ? 'Entering Sleep'
        : deviceState === 'WAKE_ANIMATION'
          ? 'Waking Up'
          : deviceState === 'CUSTOM_DISPLAY'
            ? `Custom Display (${displayMode})`
            : 'Idle Robotic Eye';

  return (
    <section
      aria-label="Live 128 by 64 OLED hardware viewport"
      className="rounded-2xl border border-[#1E2534] bg-[#11151E] p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            SSD1306 128 × 64 Monochrome OLED
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
            <span>GPIO 21 SDA</span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
            <span>GPIO 22 SCL</span>
            <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
            <span>{stateReadable}</span>
          </p>
        </div>

        <div className="text-right font-mono text-xs text-slate-400 tabular-nums">
          <span>{batteryPercent}%</span>
          <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
          <span>{(batteryMv / 1000).toFixed(2)}V</span>
        </div>
      </div>

      {/* Physical OLED module bezel */}
      <button
        type="button"
        onClick={onTapOled}
        title="Tap display to blink or wake MiniCast"
        className="group relative block w-full overflow-hidden rounded-xl border border-[#263044] bg-[#04060A] p-3 text-left transition-colors hover:border-cyan-400/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
      >
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg bg-[#04060A]">
          <canvas
            ref={canvasRef}
            width={OLED_WIDTH}
            height={OLED_HEIGHT}
            className="h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
          {showPixelGrid && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
                backgroundSize: 'calc(100% / 128) calc(100% / 64)',
              }}
            />
          )}
          {deviceState === 'LOW_POWER_SLEEP' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#04060A]/60">
              <span className="text-xs font-medium text-slate-400">
                Display powered down · Tap or send Wake to resume
              </span>
            </div>
          )}
        </div>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="tabular-nums">
          Link:{' '}
          <strong className={connectionStatus === 'CONNECTED' ? 'font-medium text-cyan-300' : 'font-medium text-slate-200'}>
            {connectionStatus === 'CONNECTED'
              ? `${settings.deviceName} (SPP)`
              : connectionStatus === 'PAIRING'
                ? 'Pairing SPP...'
                : 'Local Preview (Disconnected)'}
          </strong>
        </span>
        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
          Expression: {expression}
        </span>
      </div>
    </section>
  );
};
