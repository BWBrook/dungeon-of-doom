const STORAGE_KEY = 'dungeon-of-doom.sensory-preferences.v1';

export interface SensoryPreferences {
  audioEnabled: boolean;
  motionEnabled: boolean;
}

export function defaultSensoryPreferences(media = globalThis.matchMedia): SensoryPreferences {
  const prefersReducedMotion = media?.('(prefers-reduced-motion: reduce)').matches ?? false;

  return {
    audioEnabled: true,
    motionEnabled: !prefersReducedMotion
  };
}

export function parseSensoryPreferences(
  input: string | null,
  fallback: SensoryPreferences = defaultSensoryPreferences()
): SensoryPreferences {
  if (!input) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(input);

    if (!isPreferenceRecord(parsed)) {
      return fallback;
    }

    return {
      audioEnabled: parsed.audioEnabled,
      motionEnabled: parsed.motionEnabled
    };
  } catch {
    return fallback;
  }
}

export function loadSensoryPreferences(storage = globalThis.localStorage): SensoryPreferences {
  return parseSensoryPreferences(storage?.getItem(STORAGE_KEY) ?? null);
}

export function saveSensoryPreferences(
  preferences: SensoryPreferences,
  storage = globalThis.localStorage
): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function isPreferenceRecord(value: unknown): value is SensoryPreferences {
  return (
    typeof value === 'object' &&
    value !== null &&
    'audioEnabled' in value &&
    'motionEnabled' in value &&
    typeof value.audioEnabled === 'boolean' &&
    typeof value.motionEnabled === 'boolean'
  );
}
