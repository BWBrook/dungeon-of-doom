import { describe, expect, test } from 'vitest';

import type { BaseTileKind, Facing, SoundCue } from '../engine/types';
import { AUDIO_CUE_PROFILES, AudioEngine } from '../ui/audio';
import {
  defaultSensoryPreferences,
  loadSensoryPreferences,
  parseSensoryPreferences,
  saveSensoryPreferences
} from '../ui/sensoryPreferences';
import { effectIntensity, visualEffectState } from '../ui/visualEffects';
import { EFFECT_COLORS, HERO_GLYPHS, TILE_VISUALS, VISUAL_EFFECTS } from '../ui/visualCatalog';

const BASE_TILE_KINDS: BaseTileKind[] = [
  'floor',
  'wall',
  'vase',
  'chest',
  'idol',
  'entrance',
  'exit',
  'trap',
  'safe',
  'relic'
];

const FACING_VALUES: Facing[] = ['N', 'E', 'S', 'W'];

const SOUND_CUES: SoundCue[] = [
  'attack-hit',
  'attack-miss',
  'monster-hit',
  'monster-kill',
  'pickup',
  'spell',
  'trap',
  'bump',
  'save',
  'win',
  'escape'
];

describe('visual identity catalog', () => {
  test('covers every base tile and facing glyph', () => {
    for (const tile of BASE_TILE_KINDS) {
      expect(TILE_VISUALS[tile].glyph.length).toBeGreaterThan(0);
      expect(TILE_VISUALS[tile].lit.length).toBeGreaterThan(0);
      expect(TILE_VISUALS[tile].ink.length).toBeGreaterThan(0);
    }

    for (const facing of FACING_VALUES) {
      expect(HERO_GLYPHS[facing].length).toBe(1);
    }
  });

  test('covers every visual effect', () => {
    for (const effect of VISUAL_EFFECTS) {
      expect(EFFECT_COLORS).toHaveProperty(effect);
      expect(visualEffectState(effect, 0, true).intensity).toBeGreaterThanOrEqual(0);
    }
  });

  test('fades effects deterministically and becomes static without motion', () => {
    expect(effectIntensity('spell', 0, true)).toBeGreaterThan(effectIntensity('spell', 520, true));
    expect(effectIntensity('idle', 0, true)).toBe(0);
    expect(effectIntensity('damage', 0, false)).toBe(effectIntensity('damage', 520, false));
  });
});

describe('sensory preferences', () => {
  test('defaults motion from reduced-motion media preference', () => {
    const media = ((query: string) => ({
      matches: query.includes('reduce')
    })) as typeof matchMedia;

    expect(defaultSensoryPreferences(media)).toEqual({
      audioEnabled: true,
      motionEnabled: false
    });
  });

  test('parses bad storage safely and round-trips valid preferences', () => {
    const fallback = { audioEnabled: false, motionEnabled: true };
    const storage = createMemoryStorage();

    expect(parseSensoryPreferences('not-json', fallback)).toEqual(fallback);
    saveSensoryPreferences({ audioEnabled: false, motionEnabled: false }, storage);
    expect(loadSensoryPreferences(storage)).toEqual({ audioEnabled: false, motionEnabled: false });
    expect(storage.getItem('dungeon-of-doom.sensory-preferences.v1')).toContain('audioEnabled');
  });
});

describe('audio cue identity', () => {
  test('covers every engine sound cue with generated cue metadata', () => {
    for (const cue of SOUND_CUES) {
      expect(AUDIO_CUE_PROFILES[cue].frequency).toBeGreaterThan(0);
      expect(AUDIO_CUE_PROFILES[cue].durationMs).toBeGreaterThan(0);
      expect(AUDIO_CUE_PROFILES[cue].peakGain).toBeGreaterThan(0);
    }
  });

  test('does not request an audio context while disabled', () => {
    let contextRequests = 0;
    const engine = new AudioEngine(() => {
      contextRequests += 1;
      return null;
    });

    engine.setEnabled(false);
    engine.playAll(['save']);

    expect(contextRequests).toBe(0);
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
