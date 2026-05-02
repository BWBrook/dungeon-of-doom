import { EFFECT_COLORS } from './visualCatalog';
import type { VisualEffectKind } from './visualCatalog';

export const EFFECT_DURATION_MS = 620;

export interface VisualEffectState {
  color: string | null;
  intensity: number;
}

export function effectIntensity(effect: VisualEffectKind, elapsedMs: number, motionEnabled: boolean): number {
  if (effect === 'idle') {
    return 0;
  }

  if (!motionEnabled) {
    return 0.62;
  }

  const progress = Math.min(1, Math.max(0, elapsedMs / EFFECT_DURATION_MS));
  const flicker = 0.08 * Math.sin(progress * Math.PI * 7);

  return Math.max(0, Number((1 - progress + flicker).toFixed(3)));
}

export function visualEffectState(
  effect: VisualEffectKind,
  elapsedMs: number,
  motionEnabled: boolean
): VisualEffectState {
  return {
    color: EFFECT_COLORS[effect],
    intensity: effectIntensity(effect, elapsedMs, motionEnabled)
  };
}

