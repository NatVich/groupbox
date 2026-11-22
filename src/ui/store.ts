/** Settings for this device (not per player), kept in this browser only. */
import type { Skin } from './art';

export interface DeviceSettings {
  /** Look of the game: fruit friends or retro pixel arcade. */
  skin?: Skin;
  muted: boolean;
  /** Ask for a second tap before popping (off by default: one tap pops). */
  twoTap: boolean;
  /** Family this device belongs to. */
  familyCode?: string;
  /** Last player picked on this device. */
  playerId?: string;
}

const KEY = 'groupbox-device-v1';
const LEGACY_KEY = 'groupbox-save-v1';

export function loadSettings(): DeviceSettings {
  const base: DeviceSettings = { muted: false, twoTap: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
    // Carry over settings from the single-player version.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const l = JSON.parse(legacy);
      return { ...base, muted: !!l.muted, twoTap: !!l.twoTap };
    }
  } catch {
    /* storage unavailable: play without saving */
  }
  return base;
}

export function saveSettings(s: DeviceSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Progress from the single-player version, if any, so the first profile can keep it. */
export function legacyProgress(): { levelStars: Record<string, number>; levelBest: Record<string, number>; calmBest: number } | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const l = JSON.parse(raw);
    const hasAny = l.calmBest > 0 || Object.keys(l.levelStars ?? {}).length > 0;
    return hasAny ? { levelStars: l.levelStars ?? {}, levelBest: l.levelBest ?? {}, calmBest: l.calmBest ?? 0 } : null;
  } catch {
    return null;
  }
}

export function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
