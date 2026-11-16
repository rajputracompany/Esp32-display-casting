import { BuiltinAnimation, EyeExpression, TextAlignment } from '../types/minicast';

export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
export const FRAME_BYTES = (OLED_WIDTH * OLED_HEIGHT) / 8; // 1024 bytes

export interface EyeParams {
  width: number;
  height: number;
  cornerRadius: number;
  topLid: number;
  bottomLid: number;
  upperSlant: number;
  pupilX: number;
  pupilY: number;
  pupilRadius: number;
  bounceY: number;
}

export const EXPRESSION_META: Array<{
  id: EyeExpression;
  label: string;
  description: string;
}> = [
  { id: 'NEUTRAL', label: 'Neutral', description: 'Calm natural blink and idle gaze' },
  { id: 'HAPPY', label: 'Happy', description: 'Warm curved lower squint' },
  { id: 'EXCITED', label: 'Excited', description: 'Wide bright alert iris' },
  { id: 'CURIOUS', label: 'Curious', description: 'Attentive tilted side glance' },
  { id: 'SLEEPY', label: 'Sleepy', description: 'Heavy drooping eyelids' },
  { id: 'SURPRISED', label: 'Surprised', description: 'Tall wide sclera, pinpoint pupil' },
  { id: 'SAD', label: 'Sad', description: 'Softly drooping outer brow corners' },
  { id: 'ANGRY', label: 'Angry', description: 'Sharply angled furrowed brow' },
];

export function presetForExpression(expr: EyeExpression): EyeParams {
  switch (expr) {
    case 'HAPPY':
      return { width: 76, height: 42, cornerRadius: 18, topLid: 0.06, bottomLid: 0.44, upperSlant: 0, pupilX: 0, pupilY: -0.1, pupilRadius: 8.5, bounceY: -2 };
    case 'EXCITED':
      return { width: 82, height: 50, cornerRadius: 22, topLid: 0, bottomLid: 0.28, upperSlant: 0, pupilX: 0, pupilY: -0.15, pupilRadius: 11.5, bounceY: -3 };
    case 'CURIOUS':
      return { width: 70, height: 44, cornerRadius: 16, topLid: 0.04, bottomLid: 0.02, upperSlant: 0.22, pupilX: 0.35, pupilY: -0.2, pupilRadius: 9.5, bounceY: -1 };
    case 'SLEEPY':
      return { width: 72, height: 34, cornerRadius: 14, topLid: 0.56, bottomLid: 0.12, upperSlant: 0.1, pupilX: 0, pupilY: 0.25, pupilRadius: 7.5, bounceY: 3 };
    case 'SURPRISED':
      return { width: 86, height: 54, cornerRadius: 25, topLid: 0, bottomLid: 0, upperSlant: 0, pupilX: 0, pupilY: 0, pupilRadius: 6, bounceY: -2 };
    case 'SAD':
      return { width: 68, height: 38, cornerRadius: 16, topLid: 0.22, bottomLid: 0.08, upperSlant: 0.62, pupilX: -0.15, pupilY: 0.3, pupilRadius: 9, bounceY: 3 };
    case 'ANGRY':
      return { width: 74, height: 38, cornerRadius: 12, topLid: 0.24, bottomLid: 0.06, upperSlant: -0.72, pupilX: 0, pupilY: 0.05, pupilRadius: 7.5, bounceY: 1 };
    case 'NEUTRAL':
    default:
      return { width: 70, height: 42, cornerRadius: 16, topLid: 0.04, bottomLid: 0.02, upperSlant: 0, pupilX: 0, pupilY: 0, pupilRadius: 9.5, bounceY: 0 };
  }
}

export function crc32Hex(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function xorChecksumHex(bytes: Uint8Array): string {
  let x = 0;
  for (let i = 0; i < bytes.length; i++) {
    x ^= bytes[i];
  }
  return (x & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return arr;
}

export function packGridToBitmap(grid: Uint8Array): Uint8Array {
  const out = new Uint8Array(FRAME_BYTES);
  for (let y = 0; y < OLED_HEIGHT; y++) {
    for (let x = 0; x < OLED_WIDTH; x++) {
      if (grid[y * OLED_WIDTH + x]) {
        const byteIdx = y * (OLED_WIDTH / 8) + (x >> 3);
        const mask = 0x80 >> (x & 7);
        out[byteIdx] |= mask;
      }
    }
  }
  return out;
}

export function unpackBitmapToGrid(bytes: Uint8Array): Uint8Array {
  const grid = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
  for (let y = 0; y < OLED_HEIGHT; y++) {
    for (let x = 0; x < OLED_WIDTH; x++) {
      const byteIdx = y * (OLED_WIDTH / 8) + (x >> 3);
      const mask = 0x80 >> (x & 7);
      grid[y * OLED_WIDTH + x] = (bytes[byteIdx] & mask) !== 0 ? 1 : 0;
    }
  }
  return grid;
}

export function convertImageDataTo1Bit(
  rgba: Uint8ClampedArray,
  threshold: number,
  contrast: number,
  invert: boolean,
  dither: boolean
): Uint8Array {
  const gray = new Float32Array(OLED_WIDTH * OLED_HEIGHT);
  for (let i = 0; i < OLED_WIDTH * OLED_HEIGHT; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3] / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a;
    const adj = Math.max(0, Math.min(255, (lum - 128) * contrast + 128));
    gray[i] = invert ? 255 - adj : adj;
  }

  const grid = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
  for (let y = 0; y < OLED_HEIGHT; y++) {
    for (let x = 0; x < OLED_WIDTH; x++) {
      const idx = y * OLED_WIDTH + x;
      const oldVal = gray[idx];
      const isOn = oldVal >= threshold;
      const newVal = isOn ? 255 : 0;
      grid[idx] = isOn ? 1 : 0;

      if (dither) {
        const err = oldVal - newVal;
        if (x + 1 < OLED_WIDTH) gray[idx + 1] += err * (7 / 16);
        if (y + 1 < OLED_HEIGHT) {
          if (x > 0) gray[idx + OLED_WIDTH - 1] += err * (3 / 16);
          gray[idx + OLED_WIDTH] += err * (5 / 16);
          if (x + 1 < OLED_WIDTH) gray[idx + OLED_WIDTH + 1] += err * (1 / 16);
        }
      }
    }
  }
  return packGridToBitmap(grid);
}

/**
 * Renders 128x64 monochrome buffer onto a 128x64 offscreen ImageData for crisp pixel-exact scaling
 */
export function drawMonochromeEyeFrame(
  ctx: CanvasRenderingContext2D,
  current: EyeParams,
  targetExpr: EyeExpression,
  gazeX: number,
  gazeY: number,
  blinkAmount: number,
  nowMs: number,
  contrast: number,
  displayOff: boolean
) {
  ctx.fillStyle = '#04060A';
  ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);

  if (displayOff) return;

  const alpha = Math.max(0.18, contrast / 255);
  const phosphor = `rgba(34, 211, 238, ${alpha.toFixed(2)})`;
  const highlight = `rgba(224, 247, 250, ${Math.min(1, alpha + 0.1).toFixed(2)})`;

  const breathe = Math.sin(nowMs * 0.0022) * 1.0;
  const cx = Math.round(64 + gazeX * 7);
  const cy = Math.round(32 + current.bounceY + breathe + gazeY * 3.5);
  const w = Math.round(current.width);
  const h = Math.round(current.height);
  const r = Math.max(2, Math.min(Math.floor(Math.min(w, h) / 2), Math.round(current.cornerRadius)));
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);

  // Sclera rounded rect
  ctx.fillStyle = phosphor;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, r);
  ctx.fill();

  // Pupil + specular dot
  const px = Math.round(cx + gazeX * w * 0.18);
  const py = Math.round(cy + gazeY * h * 0.16);
  const pr = Math.round(current.pupilRadius);
  if (pr >= 3) {
    ctx.fillStyle = '#04060A';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(px - Math.floor(pr / 3), py - Math.floor(pr / 3), Math.max(1, Math.floor(pr / 3)), 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyelids
  const effTop = Math.min(1, Math.max(0, current.topLid + blinkAmount * (1 - current.topLid)));
  const effBot = Math.min(1, Math.max(0, current.bottomLid + blinkAmount * 0.15));
  const topCut = Math.round(h * effTop);
  const botCut = Math.round(h * effBot);

  ctx.fillStyle = '#04060A';
  if (topCut > 0) {
    ctx.fillRect(x0 - 2, y0 - 4, w + 4, topCut + 4);
  }
  if (botCut > 0) {
    ctx.fillRect(x0 - 2, y0 + h - botCut, w + 4, botCut + 4);
  }

  // Brow slant
  if (Math.abs(current.upperSlant) > 0.05) {
    const slantDrop = Math.round(current.upperSlant * 13);
    const topLineY = y0 + topCut;
    ctx.fillStyle = '#04060A';
    ctx.beginPath();
    if (slantDrop < 0) {
      const dip = -slantDrop;
      ctx.moveTo(x0, topLineY - 2);
      ctx.lineTo(cx, topLineY + dip);
      ctx.lineTo(x0 + w, topLineY - 2);
    } else {
      ctx.moveTo(x0, topLineY - 2);
      ctx.lineTo(x0, topLineY + slantDrop);
      ctx.lineTo(cx, topLineY - 2);
      ctx.moveTo(x0 + w, topLineY - 2);
      ctx.lineTo(x0 + w, topLineY + slantDrop);
      ctx.lineTo(cx, topLineY - 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (targetExpr === 'HAPPY' && blinkAmount < 0.2 && effTop < 0.3) {
    ctx.fillStyle = '#04060A';
    ctx.beginPath();
    ctx.arc(cx, y0 + h + 6, Math.max(4, Math.floor(w / 2) - 4), 0, Math.PI * 2);
    ctx.fill();
  }

  if (effTop + effBot >= 0.94) {
    ctx.fillStyle = phosphor;
    ctx.fillRect(x0 + 8, cy, w - 16, 2);
  }
}

export function drawCustomOledMode(
  ctx: CanvasRenderingContext2D,
  mode: 'TEXT' | 'SCROLL' | 'IMAGE' | 'ANIM',
  options: {
    text: string;
    align: TextAlignment;
    scrollOffset: number;
    bitmapBytes: Uint8Array | null;
    animName: BuiltinAnimation;
    animPhase: number;
    contrast: number;
  }
) {
  ctx.fillStyle = '#04060A';
  ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT);

  const alpha = Math.max(0.18, options.contrast / 255);
  const phosphor = `rgba(34, 211, 238, ${alpha.toFixed(2)})`;
  ctx.fillStyle = phosphor;
  ctx.strokeStyle = phosphor;

  if (mode === 'TEXT') {
    const isShort = options.text.length <= 13;
    ctx.font = `${isShort ? 'bold 13px' : '10px'} "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    let x = 6;
    if (options.align === 'CENTER') {
      ctx.textAlign = 'center';
      x = 64;
    } else if (options.align === 'RIGHT') {
      ctx.textAlign = 'right';
      x = 122;
    } else {
      ctx.textAlign = 'left';
    }
    const lines = wrapText(ctx, options.text || ' ', 116);
    const lineHeight = isShort ? 16 : 13;
    const startY = 32 - ((lines.length - 1) * lineHeight) / 2;
    lines.slice(0, 4).forEach((line, idx) => {
      ctx.fillText(line, x, startY + idx * lineHeight);
    });
  } else if (mode === 'SCROLL') {
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const textW = ctx.measureText(options.text || ' ').width;
    const x = OLED_WIDTH - (options.scrollOffset % (OLED_WIDTH + textW + 24));
    ctx.fillText(options.text || ' ', x, 32);
  } else if (mode === 'IMAGE' && options.bitmapBytes) {
    const grid = unpackBitmapToGrid(options.bitmapBytes);
    for (let y = 0; y < OLED_HEIGHT; y++) {
      for (let x = 0; x < OLED_WIDTH; x++) {
        if (grid[y * OLED_WIDTH + x]) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  } else if (mode === 'ANIM') {
    const p = options.animPhase;
    if (options.animName === 'ORB') {
      const x = Math.round(64 + Math.cos(p) * 44);
      const y = Math.round(32 + Math.sin(p * 1.7) * 18);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
    } else if (options.animName === 'HEARTBEAT') {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < OLED_WIDTH; x++) {
        let phase = (x * 0.09 - p * 2) % (Math.PI * 2);
        if (phase < 0) phase += Math.PI * 2;
        let y = 32;
        if (phase > 2.5 && phase < 2.9) y = 14;
        else if (phase >= 2.9 && phase < 3.2) y = 50;
        else if (phase >= 3.2 && phase < 3.6) y = 24;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (options.animName === 'AUDIO_BARS') {
      for (let i = 0; i < 16; i++) {
        const h = Math.round(8 + (Math.sin(p * 2 + i * 0.65) + 1) * 24);
        ctx.fillRect(i * 8 + 1, 64 - h, 6, h);
      }
    } else {
      for (let i = 0; i < 24; i++) {
        const sx = Math.floor((i * 37 + p * 18 * ((i % 3) + 1)) % OLED_WIDTH);
        const sy = (i * 19) % OLED_HEIGHT;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
