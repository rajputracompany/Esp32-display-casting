export type NavTab = 'overview' | 'eye' | 'studio' | 'settings' | 'code';

export type EyeExpression =
  | 'NEUTRAL'
  | 'HAPPY'
  | 'EXCITED'
  | 'CURIOUS'
  | 'SLEEPY'
  | 'SURPRISED'
  | 'SAD'
  | 'ANGRY';

export type DeviceState =
  | 'BOOT'
  | 'WAKE_ANIMATION'
  | 'IDLE_EYE'
  | 'CUSTOM_DISPLAY'
  | 'INACTIVITY_TIMEOUT'
  | 'SLEEP_ANIMATION'
  | 'LOW_POWER_SLEEP';

export type CustomDisplayMode = 'EYE' | 'TEXT' | 'SCROLL' | 'IMAGE' | 'ANIM';

export type TextAlignment = 'LEFT' | 'CENTER' | 'RIGHT';

export type BuiltinAnimation = 'ORB' | 'HEARTBEAT' | 'AUDIO_BARS' | 'STARFIELD';

export type ConnectionStatus = 'DISCONNECTED' | 'PAIRING' | 'CONNECTED';

export interface MiniCastSettings {
  deviceName: string;
  isAdvancedMode: boolean;
  sleepTimeoutSec: number;
  customDisplayTimeoutSec: number;
  wakeAnimEnabled: boolean;
  defaultExpression: EyeExpression;
  animationSpeed: number; // 1..10
  oledContrast: number; // 0..255
  scrollSpeed: number; // 1..10
  defaultMode: 'EYE' | 'TEXT';
}

export interface PacketLogEntry {
  id: number;
  timestamp: string;
  direction: 'TX' | 'RX';
  payload: string;
}

export interface SavedArtwork {
  id: string;
  name: string;
  createdAt: string;
  bitmapHex: string; // 1024 bytes as hex
}

export interface ProjectFileEntry {
  category: 'android' | 'firmware';
  relativePath: string;
  content: string;
  sizeBytes: number;
}
