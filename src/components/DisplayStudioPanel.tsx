import React, { useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Film,
  Image as ImageIcon,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Send,
  Square,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import {
  bytesToHex,
  convertImageDataTo1Bit,
  crc32Hex,
  hexToBytes,
  OLED_HEIGHT,
  OLED_WIDTH,
  packGridToBitmap,
  unpackBitmapToGrid,
} from '../engine/oledEngine';
import {
  BuiltinAnimation,
  EyeExpression,
  MiniCastSettings,
  SavedArtwork,
  TextAlignment,
} from '../types/minicast';

type StudioTab = 'text' | 'image' | 'pixel' | 'animation';

interface DisplayStudioPanelProps {
  settings: MiniCastSettings;
  transferProgress: number | null;
  onSendStaticText: (text: string, align: TextAlignment) => void;
  onSendScrollText: (text: string) => void;
  onClearScreen: () => void;
  onTransmitBitmap: (bytes: Uint8Array, label: string) => Promise<void>;
  onStartAnimation: (anim: BuiltinAnimation) => void;
  onStopAnimation: () => void;
  onRunExpressionStep: (expr: EyeExpression) => void;
}

const ARTWORK_STORAGE_KEY = 'minicast_saved_pixel_art_v1';

const BUILTIN_ANIMATIONS: Array<{ id: BuiltinAnimation; label: string; desc: string }> = [
  { id: 'ORB', label: 'Orbital Pulse', desc: 'Smooth orbital sphere with concentric ring' },
  { id: 'HEARTBEAT', label: 'Heartbeat ECG', desc: 'Live telemetry waveform across 128px' },
  { id: 'AUDIO_BARS', label: 'Spectrum Bars', desc: '16-band reactive OLED bar analyzer' },
  { id: 'STARFIELD', label: 'Starfield Warp', desc: 'Multi-speed parallax pixel starfield' },
];

function createPresetGrid(kind: 'robot' | 'heart' | 'wifi'): Uint8Array {
  const g = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
  const setPx = (x: number, y: number) => {
    if (x >= 0 && x < OLED_WIDTH && y >= 0 && y < OLED_HEIGHT) g[y * OLED_WIDTH + x] = 1;
  };
  if (kind === 'robot') {
    for (let x = 28; x < 100; x++) {
      setPx(x, 12);
      setPx(x, 52);
    }
    for (let y = 12; y <= 52; y++) {
      setPx(28, y);
      setPx(99, y);
    }
    for (let y = 24; y <= 34; y++) {
      for (let x = 42; x <= 52; x++) setPx(x, y);
      for (let x = 76; x <= 86; x++) setPx(x, y);
    }
    for (let x = 48; x <= 80; x += 2) setPx(x, 43);
  } else if (kind === 'heart') {
    for (let y = 0; y < OLED_HEIGHT; y++) {
      for (let x = 0; x < OLED_WIDTH; x++) {
        const nx = (x - 64) / 18;
        const ny = -(y - 34) / 16;
        const eq = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
        if (eq <= 0) setPx(x, y);
      }
    }
  } else {
    for (let r = 8; r <= 32; r += 8) {
      for (let a = -0.85; a <= 0.85; a += 0.03) {
        setPx(Math.round(64 + Math.sin(a) * r), Math.round(48 - Math.cos(a) * r));
      }
    }
    for (let y = 46; y <= 52; y++) {
      for (let x = 61; x <= 67; x++) setPx(x, y);
    }
  }
  return g;
}

export const DisplayStudioPanel: React.FC<DisplayStudioPanelProps> = ({
  settings,
  transferProgress,
  onSendStaticText,
  onSendScrollText,
  onClearScreen,
  onTransmitBitmap,
  onStartAnimation,
  onStopAnimation,
  onRunExpressionStep,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('text');

  // Text Studio state
  const [textInput, setTextInput] = useState('MiniCast Ready');
  const [textAlign, setTextAlign] = useState<TextAlignment>('CENTER');
  const [isScrolling, setIsScrolling] = useState(false);

  // Image Studio state
  const [sourceImgUrl, setSourceImgUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [contrast, setContrast] = useState(1.15);
  const [invertImg, setInvertImg] = useState(false);
  const [ditherImg, setDitherImg] = useState(true);
  const [convertedBytes, setConvertedBytes] = useState<Uint8Array | null>(null);
  const imgPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Pixel Art Studio state
  const [pixelGrid, setPixelGrid] = useState<Uint8Array>(() => createPresetGrid('robot'));
  const [pixelTool, setPixelTool] = useState<'draw' | 'erase'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [artworkName, setArtworkName] = useState('Bot Face');
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>(() => {
    try {
      const raw = localStorage.getItem(ARTWORK_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedArtwork[]) : [];
    } catch {
      return [];
    }
  });
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation Sequence Builder state
  const [sequence, setSequence] = useState<EyeExpression[]>(['HAPPY', 'CURIOUS', 'SURPRISED', 'NEUTRAL']);
  const [isRunningSeq, setIsRunningSeq] = useState(false);

  // Convert uploaded image to 128x64 monochrome buffer
  useEffect(() => {
    if (!sourceImgUrl) return;
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = OLED_WIDTH;
      offscreen.height = OLED_HEIGHT;
      const octx = offscreen.getContext('2d');
      if (!octx) return;

      octx.fillStyle = '#000000';
      octx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);
      const scale = Math.min(OLED_WIDTH / img.width, OLED_HEIGHT / img.height);
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      octx.drawImage(img, Math.round((OLED_WIDTH - dw) / 2), Math.round((OLED_HEIGHT - dh) / 2), dw, dh);

      const imageData = octx.getImageData(0, 0, OLED_WIDTH, OLED_HEIGHT);
      const packed = convertImageDataTo1Bit(imageData.data, threshold, contrast, invertImg, ditherImg);
      setConvertedBytes(packed);

      const pCanvas = imgPreviewRef.current;
      if (pCanvas) {
        const pctx = pCanvas.getContext('2d');
        if (pctx) {
          pctx.fillStyle = '#04060A';
          pctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);
          pctx.fillStyle = '#22D3EE';
          const grid = unpackBitmapToGrid(packed);
          for (let y = 0; y < OLED_HEIGHT; y++) {
            for (let x = 0; x < OLED_WIDTH; x++) {
              if (grid[y * OLED_WIDTH + x]) pctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    };
    img.src = sourceImgUrl;
  }, [sourceImgUrl, threshold, contrast, invertImg, ditherImg]);

  // Draw Pixel Art Editor canvas
  useEffect(() => {
    const c = pixelCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#04060A';
    ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);
    ctx.fillStyle = '#22D3EE';
    for (let y = 0; y < OLED_HEIGHT; y++) {
      for (let x = 0; x < OLED_WIDTH; x++) {
        if (pixelGrid[y * OLED_WIDTH + x]) ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [pixelGrid, activeTab]);

  // Sequence runner
  useEffect(() => {
    if (!isRunningSeq || sequence.length === 0) return;
    let idx = 0;
    onRunExpressionStep(sequence[0]);
    const timer = window.setInterval(() => {
      idx = (idx + 1) % sequence.length;
      onRunExpressionStep(sequence[idx]);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [isRunningSeq, sequence, onRunExpressionStep]);

  const paintAtEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = pixelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(OLED_WIDTH - 1, Math.floor(((e.clientX - rect.left) / rect.width) * OLED_WIDTH)));
    const y = Math.max(0, Math.min(OLED_HEIGHT - 1, Math.floor(((e.clientY - rect.top) / rect.height) * OLED_HEIGHT)));
    setPixelGrid((prev) => {
      const val = pixelTool === 'draw' ? 1 : 0;
      if (prev[y * OLED_WIDTH + x] === val) return prev;
      const next = new Uint8Array(prev);
      next[y * OLED_WIDTH + x] = val;
      return next;
    });
  };

  const handleSaveArtwork = () => {
    const packed = packGridToBitmap(pixelGrid);
    const item: SavedArtwork = {
      id: `${Date.now()}`,
      name: artworkName.trim() || 'Untitled',
      createdAt: new Date().toLocaleTimeString(),
      bitmapHex: bytesToHex(packed),
    };
    const next = [item, ...savedArtworks].slice(0, 8);
    setSavedArtworks(next);
    try {
      localStorage.setItem(ARTWORK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleDeleteArtwork = (id: string) => {
    const next = savedArtworks.filter((a) => a.id !== id);
    setSavedArtworks(next);
    try {
      localStorage.setItem(ARTWORK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  return (
    <div className="space-y-5">
      {/* Studio Sub-navigation */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#1E2534] bg-[#0D1119] p-1 sm:grid-cols-4">
        {(
          [
            { id: 'text', label: 'Text Studio', icon: Type },
            { id: 'image', label: 'Image Studio', icon: ImageIcon },
            { id: 'pixel', label: 'Pixel Art', icon: Pencil },
            { id: 'animation', label: 'Animation', icon: Film },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#171C28] text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* TEXT STUDIO */}
      {activeTab === 'text' && (
        <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Text Studio</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Send static or scrolling messages to the 128 × 64 OLED. Automatically returns to the eye after {settings.customDisplayTimeoutSec}s.
            </p>
          </div>

          <div>
            <label htmlFor="oled-text-input" className="block text-xs font-medium text-slate-300">
              Display Message
            </label>
            <input
              id="oled-text-input"
              type="text"
              maxLength={80}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text for MiniCast OLED..."
              className="mt-1.5 w-full rounded-xl border border-[#232B3D] bg-[#0B0E14] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-slate-300">Alignment</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(['LEFT', 'CENTER', 'RIGHT'] as TextAlignment[]).map((align) => (
                  <button
                    key={align}
                    type="button"
                    disabled={isScrolling}
                    onClick={() => setTextAlign(align)}
                    className={`min-h-[40px] rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                      textAlign === align
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                        : 'border-[#232B3D] bg-[#0D1119] text-slate-300'
                    }`}
                  >
                    {align[0] + align.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300">Motion Mode</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsScrolling(false)}
                  className={`min-h-[40px] rounded-lg border text-xs font-medium transition-colors ${
                    !isScrolling
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                      : 'border-[#232B3D] bg-[#0D1119] text-slate-300'
                  }`}
                >
                  Static
                </button>
                <button
                  type="button"
                  onClick={() => setIsScrolling(true)}
                  className={`min-h-[40px] rounded-lg border text-xs font-medium transition-colors ${
                    isScrolling
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                      : 'border-[#232B3D] bg-[#0D1119] text-slate-300'
                  }`}
                >
                  Scrolling
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() =>
                isScrolling ? onSendScrollText(textInput) : onSendStaticText(textInput, textAlign)
              }
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap"
            >
              <Send className="h-4 w-4" />
              Send to OLED
            </button>
            <button
              type="button"
              onClick={onClearScreen}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#232B3D] bg-[#0D1119] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              Return to Eye
            </button>
          </div>
        </div>
      )}

      {/* IMAGE STUDIO */}
      {activeTab === 'image' && (
        <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Image Studio (1-Bit Monochrome)</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Resizes to 128 × 64, packs 1,024 bytes, validates CRC32, and streams 16 verified SPP chunks.
              </p>
            </div>
            <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/20 whitespace-nowrap">
              <Upload className="h-4 w-4" />
              Choose Image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setSourceImgUrl(String(reader.result));
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          </div>

          {sourceImgUrl ? (
            <>
              <div className="aspect-[2/1] w-full overflow-hidden rounded-xl border border-[#263044] bg-[#04060A] p-2">
                <canvas
                  ref={imgPreviewRef}
                  width={OLED_WIDTH}
                  height={OLED_HEIGHT}
                  className="h-full w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Threshold</span>
                    <span className="font-mono text-cyan-300 tabular-nums">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={232}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="mt-1.5 w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Contrast</span>
                    <span className="font-mono text-cyan-300 tabular-nums">{contrast.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.4}
                    step={0.05}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="mt-1.5 w-full accent-cyan-400"
                  />
                </div>
              </div>

              {settings.isAdvancedMode && (
                <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ditherImg}
                      onChange={(e) => setDitherImg(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    Floyd-Steinberg Dithering
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={invertImg}
                      onChange={(e) => setInvertImg(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    Invert Pixels
                  </label>
                  {convertedBytes && (
                    <span className="font-mono text-slate-400 tabular-nums">
                      CRC32: {crc32Hex(convertedBytes)} · 1024 B
                    </span>
                  )}
                </div>
              )}

              {transferProgress !== null && (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#0B0E14]">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{ width: `${Math.round(transferProgress * 100)}%` }}
                    />
                  </div>
                  <p className="font-mono text-xs text-slate-400 tabular-nums">
                    Transmitting chunks: {Math.round(transferProgress * 100)}%
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={!convertedBytes || transferProgress !== null}
                onClick={() => convertedBytes && onTransmitBitmap(convertedBytes, 'Uploaded Image')}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Cast Monochrome Image
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#263044] bg-[#0B0E14] px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-200">No image selected</p>
              <p className="mt-1 text-xs text-slate-400">
                Upload any PNG, JPG, or icon to convert and preview it at native 128 × 64 OLED resolution.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PIXEL ART STUDIO */}
      {activeTab === 'pixel' && (
        <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-100">128 × 64 Pixel Art Studio</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Draw pixel-by-pixel directly onto the monochrome frame buffer.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setPixelGrid(createPresetGrid('robot'))}
                className="rounded-lg border border-[#232B3D] bg-[#0D1119] px-2.5 py-1.5 text-slate-300 hover:border-cyan-400/50"
              >
                Bot
              </button>
              <button
                type="button"
                onClick={() => setPixelGrid(createPresetGrid('heart'))}
                className="rounded-lg border border-[#232B3D] bg-[#0D1119] px-2.5 py-1.5 text-slate-300 hover:border-cyan-400/50"
              >
                Heart
              </button>
              <button
                type="button"
                onClick={() => setPixelGrid(createPresetGrid('wifi'))}
                className="rounded-lg border border-[#232B3D] bg-[#0D1119] px-2.5 py-1.5 text-slate-300 hover:border-cyan-400/50"
              >
                Signal
              </button>
            </div>
          </div>

          <div className="aspect-[2/1] w-full overflow-hidden rounded-xl border border-[#263044] bg-[#04060A] p-2">
            <canvas
              ref={pixelCanvasRef}
              width={OLED_WIDTH}
              height={OLED_HEIGHT}
              onPointerDown={(e) => {
                setIsDrawing(true);
                paintAtEvent(e);
              }}
              onPointerMove={(e) => {
                if (isDrawing) paintAtEvent(e);
              }}
              onPointerUp={() => setIsDrawing(false)}
              onPointerLeave={() => setIsDrawing(false)}
              className="h-full w-full cursor-crosshair touch-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPixelTool('draw')}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 text-xs font-medium ${
                pixelTool === 'draw'
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                  : 'border-[#232B3D] bg-[#0D1119] text-slate-300'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Draw
            </button>
            <button
              type="button"
              onClick={() => setPixelTool('erase')}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 text-xs font-medium ${
                pixelTool === 'erase'
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                  : 'border-[#232B3D] bg-[#0D1119] text-slate-300'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Erase
            </button>
            <button
              type="button"
              onClick={() =>
                setPixelGrid((prev) => prev.map((v) => (v ? 0 : 1)))
              }
              className="min-h-[40px] rounded-lg border border-[#232B3D] bg-[#0D1119] px-3.5 text-xs font-medium text-slate-300 hover:border-slate-500"
            >
              Invert
            </button>
            <button
              type="button"
              onClick={() => setPixelGrid(new Uint8Array(OLED_WIDTH * OLED_HEIGHT))}
              className="min-h-[40px] rounded-lg border border-[#232B3D] bg-[#0D1119] px-3.5 text-xs font-medium text-slate-300 hover:border-slate-500"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={artworkName}
              onChange={(e) => setArtworkName(e.target.value)}
              placeholder="Artwork title"
              className="min-h-[42px] flex-1 rounded-xl border border-[#232B3D] bg-[#0B0E14] px-3 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveArtwork}
              className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#232B3D] bg-[#171C28] px-4 text-xs font-medium text-slate-200 hover:border-cyan-400/50"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={() => onTransmitBitmap(packGridToBitmap(pixelGrid), `Pixel Art (${artworkName})`)}
              className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-cyan-400 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
            >
              <Send className="h-3.5 w-3.5" />
              Send to MiniCast
            </button>
          </div>

          {savedArtworks.length > 0 && (
            <div className="border-t border-[#1E2534] pt-3">
              <p className="mb-2 text-xs font-medium text-slate-400">Saved Artwork</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {savedArtworks.map((art) => (
                  <div
                    key={art.id}
                    className="flex items-center justify-between rounded-xl border border-[#232B3D] bg-[#0D1119] px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setPixelGrid(unpackBitmapToGrid(hexToBytes(art.bitmapHex)))}
                      className="truncate text-left font-medium text-slate-200 hover:text-cyan-300"
                    >
                      {art.name} · <span className="text-slate-500">{art.createdAt}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArtwork(art.id)}
                      aria-label={`Delete ${art.name}`}
                      className="ml-2 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANIMATION STUDIO */}
      {activeTab === 'animation' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Built-In OLED Animations</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Hardware-rendered procedural animations executed directly on the ESP32.
                </p>
              </div>
              <button
                type="button"
                onClick={onStopAnimation}
                className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#232B3D] bg-[#0D1119] px-3 text-xs font-medium text-slate-200 hover:border-cyan-400/50"
              >
                <Square className="h-3.5 w-3.5" />
                Return to Eye
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {BUILTIN_ANIMATIONS.map((anim) => (
                <button
                  key={anim.id}
                  type="button"
                  onClick={() => {
                    setIsRunningSeq(false);
                    onStartAnimation(anim.id);
                  }}
                  className="flex flex-col items-start rounded-xl border border-[#232B3D] bg-[#0D1119] p-3.5 text-left transition-colors hover:border-cyan-400/60"
                >
                  <span className="text-sm font-semibold text-slate-100">{anim.label}</span>
                  <span className="mt-1 text-xs text-slate-400">{anim.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E2534] bg-[#12161F] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Custom Expression Sequence</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Chain emotional expressions into a rhythmic playback loop (1.5s per step).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRunningSeq((v) => !v)}
                className={`flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-xs font-semibold ${
                  isRunningSeq
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-cyan-400 text-slate-950'
                }`}
              >
                {isRunningSeq ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isRunningSeq ? 'Stop Loop' : 'Play Sequence'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {sequence.map((expr, i) => (
                <button
                  key={`${expr}-${i}`}
                  type="button"
                  title="Click to remove step"
                  onClick={() => setSequence((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-lg border border-[#232B3D] bg-[#0D1119] px-3 py-1.5 font-mono text-xs text-cyan-300 hover:border-rose-400/50 hover:text-rose-300"
                >
                  {i + 1}. {expr} ×
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['HAPPY', 'EXCITED', 'CURIOUS', 'SURPRISED', 'SLEEPY', 'SAD', 'ANGRY', 'NEUTRAL'] as EyeExpression[]).map(
                (expr) => (
                  <button
                    key={expr}
                    type="button"
                    onClick={() => setSequence((prev) => [...prev.slice(-7), expr])}
                    className="rounded-lg border border-[#232B3D] bg-[#171C28] px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
                  >
                    + {expr[0] + expr.slice(1).toLowerCase()}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
