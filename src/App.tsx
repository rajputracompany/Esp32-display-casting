import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bluetooth, Cpu, Eye, Home, Moon, Settings, Smile, Sun, Tv } from 'lucide-react';
import { BluetoothModal } from './components/BluetoothModal';
import { DeliverablesExplorer } from './components/DeliverablesExplorer';
import { DisplayStudioPanel } from './components/DisplayStudioPanel';
import { EyeControlPanel } from './components/EyeControlPanel';
import { OledViewport } from './components/OledViewport';
import { SettingsPanel } from './components/SettingsPanel';
import { bytesToHex, crc32Hex, xorChecksumHex } from './engine/oledEngine';
import {
  BuiltinAnimation,
  ConnectionStatus,
  CustomDisplayMode,
  DeviceState,
  EyeExpression,
  MiniCastSettings,
  NavTab,
  PacketLogEntry,
  TextAlignment,
} from './types/minicast';

const DEFAULT_SETTINGS: MiniCastSettings = {
  deviceName: 'ESP32-MiniCast',
  isAdvancedMode: false,
  sleepTimeoutSec: 45,
  customDisplayTimeoutSec: 20,
  wakeAnimEnabled: true,
  defaultExpression: 'NEUTRAL',
  animationSpeed: 6,
  oledContrast: 215,
  scrollSpeed: 3,
  defaultMode: 'EYE',
};

const STATE_PIPELINE: Array<{ id: DeviceState; label: string }> = [
  { id: 'BOOT', label: 'Boot' },
  { id: 'WAKE_ANIMATION', label: 'Wake' },
  { id: 'IDLE_EYE', label: 'Idle Eye' },
  { id: 'CUSTOM_DISPLAY', label: 'Custom Display' },
  { id: 'SLEEP_ANIMATION', label: 'Sleep Anim' },
  { id: 'LOW_POWER_SLEEP', label: 'Low-Power Sleep' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [settings, setSettings] = useState<MiniCastSettings>(DEFAULT_SETTINGS);

  // Bluetooth connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);

  // ESP32 State Machine
  const [deviceState, setDeviceState] = useState<DeviceState>('IDLE_EYE');
  const [displayMode, setDisplayMode] = useState<CustomDisplayMode>('EYE');
  const [expression, setExpression] = useState<EyeExpression>('NEUTRAL');
  const [isIdleEnabled, setIsIdleEnabled] = useState(true);
  const [manualGazeX, setManualGazeX] = useState<number | null>(null);
  const [manualGazeUntil, setManualGazeUntil] = useState(0);

  const [blinkCount, setBlinkCount] = useState(0);
  const [wakeCount, setWakeCount] = useState(0);
  const [sleepCount, setSleepCount] = useState(0);

  // Custom display payloads
  const [customText, setCustomText] = useState('MiniCast Ready');
  const [textAlign, setTextAlign] = useState<TextAlignment>('CENTER');
  const [bitmapBytes, setBitmapBytes] = useState<Uint8Array | null>(null);
  const [activeAnim, setActiveAnim] = useState<BuiltinAnimation>('ORB');
  const [transferProgress, setTransferProgress] = useState<number | null>(null);

  // Simulated 18650 1200mAh battery telemetry
  const [batteryPercent] = useState(88);
  const [batteryMv] = useState(4040);
  const [showPixelGrid, setShowPixelGrid] = useState(false);

  // SPP Packet Log (Advanced Mode)
  const [packetLog, setPacketLog] = useState<PacketLogEntry[]>([]);
  const packetIdRef = useRef(1);
  const lastActivityRef = useRef<number>(Date.now());
  const customEnteredRef = useRef<number>(0);

  const logPacket = useCallback((direction: 'TX' | 'RX', payload: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setPacketLog((prev) =>
      [{ id: packetIdRef.current++, timestamp, direction, payload }, ...prev].slice(0, 40)
    );
  }, []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const wakeIfNeeded = useCallback(() => {
    markActivity();
    if (deviceState === 'LOW_POWER_SLEEP' || deviceState === 'SLEEP_ANIMATION') {
      setWakeCount((c) => c + 1);
      setDeviceState('WAKE_ANIMATION');
      setTimeout(() => {
        setDeviceState('IDLE_EYE');
        setExpression(settings.defaultExpression);
      }, 900);
    }
  }, [deviceState, markActivity, settings.defaultExpression]);

  // Smart automatic state machine timer (custom display timeout + inactivity sleep)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (deviceState === 'CUSTOM_DISPLAY') {
        if (now - customEnteredRef.current >= settings.customDisplayTimeoutSec * 1000) {
          setDisplayMode('EYE');
          setDeviceState('IDLE_EYE');
          setExpression(settings.defaultExpression);
          logPacket('RX', 'STATE|IDLE_EYE (Display timeout)');
        }
      } else if (deviceState === 'IDLE_EYE') {
        if (now - lastActivityRef.current >= settings.sleepTimeoutSec * 1000) {
          setSleepCount((c) => c + 1);
          setDeviceState('SLEEP_ANIMATION');
          setExpression('SLEEPY');
          logPacket('RX', 'STATE|SLEEP_ANIMATION (Inactivity timeout)');
          setTimeout(() => {
            setDeviceState((curr) => (curr === 'SLEEP_ANIMATION' ? 'LOW_POWER_SLEEP' : curr));
            logPacket('RX', 'STATE|LOW_POWER_SLEEP (SSD1306 0xAE OFF)');
          }, 1200);
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deviceState, settings.customDisplayTimeoutSec, settings.sleepTimeoutSec, settings.defaultExpression, logPacket]);

  const handleConnectDevice = (name: string) => {
    setConnectionStatus('PAIRING');
    setSettings((s) => ({ ...s, deviceName: name }));
    logPacket('TX', `CONNECT|RFCOMM_SPP|${name}`);
    setTimeout(() => {
      setConnectionStatus('CONNECTED');
      logPacket('TX', 'STATUS');
      logPacket(
        'RX',
        `STATUS|STATE=${deviceState}|EXPR=${expression}|MODE=${displayMode}|BATT=${batteryPercent}|VOLT=${batteryMv}|FW=1.2.0`
      );
    }, 650);
  };

  const handleDisconnect = () => {
    setConnectionStatus('DISCONNECTED');
    logPacket('TX', 'DISCONNECT');
  };

  const handleSelectExpression = useCallback(
    (expr: EyeExpression) => {
      wakeIfNeeded();
      setDisplayMode('EYE');
      setDeviceState('IDLE_EYE');
      setExpression(expr);
      logPacket('TX', `EYE|${expr}`);
      logPacket('RX', `OK|EYE|${expr}`);
    },
    [logPacket, wakeIfNeeded]
  );

  const handleBlink = () => {
    wakeIfNeeded();
    setDisplayMode('EYE');
    setDeviceState('IDLE_EYE');
    setBlinkCount((c) => c + 1);
    logPacket('TX', 'EYE|BLINK');
    logPacket('RX', 'OK|EYE|BLINK');
  };

  const handleLook = (dir: 'LEFT' | 'CENTER' | 'RIGHT') => {
    wakeIfNeeded();
    setDisplayMode('EYE');
    setDeviceState('IDLE_EYE');
    const val = dir === 'LEFT' ? -0.9 : dir === 'RIGHT' ? 0.9 : 0;
    setManualGazeX(val);
    setManualGazeUntil(performance.now() + 3500);
    logPacket('TX', `EYE|LOOK_${dir}`);
    logPacket('RX', `OK|EYE|LOOK_${dir}`);
  };

  const handleWake = () => {
    markActivity();
    setDisplayMode('EYE');
    setWakeCount((c) => c + 1);
    setDeviceState('WAKE_ANIMATION');
    setExpression('HAPPY');
    logPacket('TX', 'EYE|WAKE');
    logPacket('RX', 'OK|EYE|WAKE');
    setTimeout(() => {
      setDeviceState('IDLE_EYE');
      setExpression(settings.defaultExpression);
    }, 1100);
  };

  const handleSleep = () => {
    setDisplayMode('EYE');
    setSleepCount((c) => c + 1);
    setDeviceState('SLEEP_ANIMATION');
    setExpression('SLEEPY');
    logPacket('TX', 'EYE|SLEEP');
    logPacket('RX', 'OK|EYE|SLEEP');
    setTimeout(() => {
      setDeviceState((curr) => (curr === 'SLEEP_ANIMATION' ? 'LOW_POWER_SLEEP' : curr));
    }, 1150);
  };

  const handleSendStaticText = (text: string, align: TextAlignment) => {
    wakeIfNeeded();
    const clean = text.replace(/\|/g, ' ').trim() || 'MiniCast';
    setCustomText(clean);
    setTextAlign(align);
    setDisplayMode('TEXT');
    setDeviceState('CUSTOM_DISPLAY');
    customEnteredRef.current = Date.now();
    logPacket('TX', `TEXT|${align}|${clean}`);
    logPacket('RX', 'OK|TEXT');
  };

  const handleSendScrollText = (text: string) => {
    wakeIfNeeded();
    const clean = text.replace(/\|/g, ' ').trim() || 'MiniCast';
    setCustomText(clean);
    setDisplayMode('SCROLL');
    setDeviceState('CUSTOM_DISPLAY');
    customEnteredRef.current = Date.now();
    logPacket('TX', `SCROLL|${settings.scrollSpeed}|${clean}`);
    logPacket('RX', 'OK|SCROLL');
  };

  const handleClearScreen = () => {
    markActivity();
    setDisplayMode('EYE');
    setDeviceState('IDLE_EYE');
    logPacket('TX', 'CLEAR');
    logPacket('RX', 'OK|CLEAR');
  };

  const handleTransmitBitmap = async (bytes: Uint8Array, label: string) => {
    wakeIfNeeded();
    const crc = crc32Hex(bytes);
    logPacket('TX', `IMG_START|128|64|1024|64|${crc} (${label})`);
    logPacket('RX', 'OK|IMG_START');

    const totalChunks = 16;
    for (let i = 0; i < totalChunks; i++) {
      const chunk = bytes.slice(i * 64, i * 64 + 64);
      const hexPreview = bytesToHex(chunk.slice(0, 6)) + '...';
      const xor = xorChecksumHex(chunk);
      if (i === 0 || i === totalChunks - 1) {
        logPacket('TX', `IMG_DATA|${i}|${hexPreview}|${xor}`);
        logPacket('RX', `ACK|${i}`);
      }
      setTransferProgress((i + 1) / totalChunks);
      await new Promise((r) => setTimeout(r, 28));
    }

    logPacket('TX', `IMG_END|${crc}`);
    logPacket('RX', 'OK|IMG_END');
    setBitmapBytes(bytes);
    setDisplayMode('IMAGE');
    setDeviceState('CUSTOM_DISPLAY');
    customEnteredRef.current = Date.now();
    setTransferProgress(null);
  };

  const handleStartAnimation = (anim: BuiltinAnimation) => {
    wakeIfNeeded();
    setActiveAnim(anim);
    setDisplayMode('ANIM');
    setDeviceState('CUSTOM_DISPLAY');
    customEnteredRef.current = Date.now();
    logPacket('TX', `ANIM|${anim}`);
    logPacket('RX', `OK|ANIM|${anim}`);
  };

  const handleStopAnimation = () => {
    markActivity();
    setDisplayMode('EYE');
    setDeviceState('IDLE_EYE');
    logPacket('TX', 'ANIM|STOP');
    logPacket('RX', 'OK|ANIM|STOP');
  };

  const handleUpdateSettings = (patch: Partial<MiniCastSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.animationSpeed !== undefined) logPacket('TX', `CFG|SPEED|${patch.animationSpeed}`);
      if (patch.sleepTimeoutSec !== undefined) logPacket('TX', `CFG|SLEEP_MS|${patch.sleepTimeoutSec * 1000}`);
      if (patch.oledContrast !== undefined) logPacket('TX', `CFG|CONTRAST|${patch.oledContrast}`);
      return next;
    });
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'eye', label: 'Eye Control', icon: Eye },
    { id: 'studio', label: 'Display Studio', icon: Tv },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'code', label: 'Code & Firmware', icon: Cpu },
  ];

  const showLiveOledColumn = activeTab !== 'code';

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 pb-20 md:pb-10">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (5 single-line links) — Zone 3 (1 primary CTA) */}
      <header className="sticky top-0 z-30 border-b border-[#1A2130] bg-[#0B0E14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            ESP32 MiniCast
          </button>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsBtModalOpen(true)}
              className={`flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                connectionStatus === 'CONNECTED'
                  ? 'border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              <Bluetooth className="h-3.5 w-3.5 shrink-0" />
              {connectionStatus === 'CONNECTED' ? settings.deviceName : 'Connect Device'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl px-6 pt-6">
        {/* Workspace Toolbar with Basic / Advanced Switch (kept out of top header per contract) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#181F2D] pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 text-balance">
              {activeTab === 'overview' && 'Interactive Robotic Eye & Wireless OLED'}
              {activeTab === 'eye' && 'Robotic Eye Expression Studio'}
              {activeTab === 'studio' && 'OLED Display Studio'}
              {activeTab === 'settings' && 'Device Configuration'}
              {activeTab === 'code' && 'Android Studio & ESP32 Deliverables'}
            </h1>
            <p className="mt-1 text-xs text-slate-400 tabular-nums">
              <span>ESP32-WROOM-32</span>
              <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
              <span>Bluetooth Classic SPP</span>
              <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
              <span>128 × 64 SSD1306</span>
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#1E2534] bg-[#11151E] p-1">
            <button
              type="button"
              onClick={() => handleUpdateSettings({ isAdvancedMode: false })}
              className={`min-h-[34px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                !settings.isAdvancedMode
                  ? 'bg-[#1D2434] text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Basic Mode
            </button>
            <button
              type="button"
              onClick={() => handleUpdateSettings({ isAdvancedMode: true })}
              className={`min-h-[34px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                settings.isAdvancedMode
                  ? 'bg-[#1D2434] text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Advanced Mode
            </button>
          </div>
        </div>

        {/* Workspace Content */}
        {showLiveOledColumn ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* Persistent Live Hardware OLED Monitor Column */}
            <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-5">
              <OledViewport
                connectionStatus={connectionStatus}
                deviceState={deviceState}
                displayMode={displayMode}
                expression={expression}
                manualGazeX={manualGazeX}
                manualGazeUntil={manualGazeUntil}
                blinkTriggerCount={blinkCount}
                wakeTriggerCount={wakeCount}
                sleepTriggerCount={sleepCount}
                customText={customText}
                textAlign={textAlign}
                bitmapBytes={bitmapBytes}
                activeAnim={activeAnim}
                settings={settings}
                batteryPercent={batteryPercent}
                batteryMv={batteryMv}
                showPixelGrid={showPixelGrid}
                onTapOled={() => {
                  if (deviceState === 'LOW_POWER_SLEEP' || deviceState === 'SLEEP_ANIMATION') {
                    handleWake();
                  } else {
                    handleBlink();
                  }
                }}
              />

              {/* Smart State Machine Pipeline */}
              <div className="rounded-2xl border border-[#1E2534] bg-[#11151E] p-4">
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Automatic Behaviour State</span>
                  <span className="font-mono text-cyan-300">{deviceState}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {STATE_PIPELINE.map((st) => {
                    const active = deviceState === st.id;
                    return (
                      <div
                        key={st.id}
                        className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-cyan-400/70 bg-cyan-400/15 text-cyan-200'
                            : 'border-[#1E2534] bg-[#0B0E14] text-slate-500'
                        }`}
                      >
                        {st.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advanced SPP Packet Log */}
              {settings.isAdvancedMode && (
                <div className="rounded-2xl border border-[#1E2534] bg-[#11151E] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">Bluetooth SPP Packet Log</span>
                    <button
                      type="button"
                      onClick={() => setPacketLog([])}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-[#1A2130] bg-[#080B10] p-2.5 font-mono text-[11px] tabular-nums">
                    {packetLog.length === 0 ? (
                      <p className="text-slate-500">Interact with controls to inspect SPP frames.</p>
                    ) : (
                      packetLog.map((entry) => (
                        <div key={entry.id} className="truncate py-0.5">
                          <span className="text-slate-500">{entry.timestamp}</span>{' '}
                          <span className={entry.direction === 'TX' ? 'text-cyan-400' : 'text-emerald-400'}>
                            {entry.direction}
                          </span>{' '}
                          <span className="text-slate-200">{entry.payload}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Active Tooling Column */}
            <div className="lg:col-span-7">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Connection & Quick Actions */}
                  <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-100">
                          {connectionStatus === 'CONNECTED'
                            ? `Connected to ${settings.deviceName}`
                            : 'Ready to Connect MiniCast'}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {connectionStatus === 'CONNECTED'
                            ? 'Bluetooth Classic SPP link active · Tap quick actions or open a studio.'
                            : 'Preview live on the left, or connect a paired ESP32-MiniCast over Bluetooth SPP.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBtModalOpen(true)}
                        className="min-h-[42px] rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap"
                      >
                        {connectionStatus === 'CONNECTED' ? 'Manage Link' : 'Connect Bluetooth'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <button
                        type="button"
                        onClick={handleBlink}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 text-xs font-medium text-slate-100 hover:border-cyan-400/50"
                      >
                        <Eye className="h-4 w-4 text-cyan-400" />
                        Blink
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectExpression('HAPPY')}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 text-xs font-medium text-slate-100 hover:border-cyan-400/50"
                      >
                        <Smile className="h-4 w-4 text-cyan-400" />
                        Happy
                      </button>
                      <button
                        type="button"
                        onClick={handleWake}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 text-xs font-medium text-slate-100 hover:border-cyan-400/50"
                      >
                        <Sun className="h-4 w-4 text-cyan-400" />
                        Wake Up
                      </button>
                      <button
                        type="button"
                        onClick={handleSleep}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 text-xs font-medium text-slate-100 hover:border-cyan-400/50"
                      >
                        <Moon className="h-4 w-4 text-slate-300" />
                        Sleep
                      </button>
                    </div>
                  </div>

                  {/* Quick Studio Launchers */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('eye')}
                      className="flex flex-col items-start rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 text-left transition-colors hover:border-cyan-400/50"
                    >
                      <span className="text-sm font-semibold text-slate-100">Robotic Eye Expressions</span>
                      <span className="mt-1 text-xs leading-relaxed text-slate-400">
                        Switch between 8 expressive moods, control directional gaze, and tune natural blinking.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="flex flex-col items-start rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 text-left transition-colors hover:border-cyan-400/50"
                    >
                      <span className="text-sm font-semibold text-slate-100">Display Studio</span>
                      <span className="mt-1 text-xs leading-relaxed text-slate-400">
                        Cast custom scrolling text, convert photos to 1-bit monochrome, or draw 128 × 64 pixel art.
                      </span>
                    </button>
                  </div>

                  {/* Consumer Onboarding Checklist */}
                  <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold text-slate-100">Quick-Start Onboarding</h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('code')}
                        className="text-xs font-medium text-cyan-300 hover:underline"
                      >
                        Get Android App & Firmware
                      </button>
                    </div>
                    <ol className="mt-3 space-y-2 text-xs text-slate-400">
                      <li>
                        <span className="font-mono text-cyan-400">1.</span> Turn on MiniCast (ESP32 DevKit V1 + SSD1306 on GPIO 21/22).
                      </li>
                      <li>
                        <span className="font-mono text-cyan-400">2.</span> Enable Bluetooth on your Android phone and pair with <span className="font-mono text-slate-200">ESP32-MiniCast</span>.
                      </li>
                      <li>
                        <span className="font-mono text-cyan-400">3.</span> Select the MiniCast device in the connection dialog.
                      </li>
                      <li>
                        <span className="font-mono text-cyan-400">4.</span> Connect via Bluetooth Classic SPP.
                      </li>
                      <li>
                        <span className="font-mono text-cyan-400">5.</span> Control robotic eye expressions or cast text, photos, and pixel art.
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {activeTab === 'eye' && (
                <EyeControlPanel
                  selectedExpression={expression}
                  isIdleEnabled={isIdleEnabled}
                  settings={settings}
                  onSelectExpression={handleSelectExpression}
                  onBlink={handleBlink}
                  onLook={handleLook}
                  onWake={handleWake}
                  onSleep={handleSleep}
                  onToggleIdle={() => {
                    const next = !isIdleEnabled;
                    setIsIdleEnabled(next);
                    logPacket('TX', next ? 'EYE|IDLE' : 'EYE|IDLE_OFF');
                  }}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}

              {activeTab === 'studio' && (
                <DisplayStudioPanel
                  settings={settings}
                  transferProgress={transferProgress}
                  onSendStaticText={handleSendStaticText}
                  onSendScrollText={handleSendScrollText}
                  onClearScreen={handleClearScreen}
                  onTransmitBitmap={handleTransmitBitmap}
                  onStartAnimation={handleStartAnimation}
                  onStopAnimation={handleStopAnimation}
                  onRunExpressionStep={handleSelectExpression}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPanel
                  settings={settings}
                  showPixelGrid={showPixelGrid}
                  onTogglePixelGrid={() => setShowPixelGrid((v) => !v)}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
            </div>
          </div>
        ) : (
          <DeliverablesExplorer />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (under 15% mobile viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 border-t border-[#1E2534] bg-[#0B0E14]/95 backdrop-blur-md md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active ? 'text-cyan-300' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[64px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>

      <BluetoothModal
        isOpen={isBtModalOpen}
        connectionStatus={connectionStatus}
        connectedDeviceName={settings.deviceName}
        onClose={() => setIsBtModalOpen(false)}
        onConnectDevice={handleConnectDevice}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
