import type { SoundCue } from '../engine/types';

export interface AudioCueProfile {
  frequency: number;
  wave: OscillatorType;
  durationMs: number;
  peakGain: number;
  secondFrequency?: number;
}

export const AUDIO_CUE_PROFILES: Record<SoundCue, AudioCueProfile> = {
  'attack-hit': { frequency: 392, secondFrequency: 523, wave: 'square', durationMs: 130, peakGain: 0.045 },
  'attack-miss': { frequency: 196, secondFrequency: 174, wave: 'sawtooth', durationMs: 100, peakGain: 0.032 },
  'monster-hit': { frequency: 146, secondFrequency: 123, wave: 'square', durationMs: 170, peakGain: 0.05 },
  'monster-kill': { frequency: 523, secondFrequency: 784, wave: 'triangle', durationMs: 220, peakGain: 0.052 },
  pickup: { frequency: 587, secondFrequency: 740, wave: 'triangle', durationMs: 160, peakGain: 0.04 },
  spell: { frequency: 659, secondFrequency: 988, wave: 'sine', durationMs: 240, peakGain: 0.045 },
  trap: { frequency: 164, secondFrequency: 110, wave: 'sawtooth', durationMs: 190, peakGain: 0.05 },
  bump: { frequency: 130, wave: 'square', durationMs: 90, peakGain: 0.03 },
  save: { frequency: 330, secondFrequency: 440, wave: 'triangle', durationMs: 180, peakGain: 0.036 },
  win: { frequency: 659, secondFrequency: 1046, wave: 'triangle', durationMs: 300, peakGain: 0.052 },
  escape: { frequency: 523, secondFrequency: 698, wave: 'triangle', durationMs: 210, peakGain: 0.045 }
};

type AudioContextFactory = () => AudioContext | null;

export class AudioEngine {
  private context: AudioContext | null = null;
  private enabled = true;

  constructor(private readonly createContext: AudioContextFactory = createBrowserAudioContext) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  playAll(cues: SoundCue[]) {
    if (!this.enabled) {
      return;
    }

    for (const cue of cues) {
      this.play(cue);
    }
  }

  private play(cue: SoundCue) {
    this.context ??= this.createContext();

    const context = this.context;
    const profile = AUDIO_CUE_PROFILES[cue];

    if (!context) {
      return;
    }

    void context.resume?.();

    this.playTone(context, profile.frequency, profile, 0);

    if (profile.secondFrequency !== undefined) {
      this.playTone(context, profile.secondFrequency, profile, profile.durationMs * 0.42);
    }
  }

  private playTone(context: AudioContext, frequency: number, profile: AudioCueProfile, delayMs: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime + delayMs / 1000;
    const duration = profile.durationMs / 1000;

    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.peakGain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

function createBrowserAudioContext(): AudioContext | null {
  const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return AudioCtor ? new AudioCtor() : null;
}
