import type { SoundCue } from '../engine/types';

const SOUND_FREQUENCIES: Record<SoundCue, number> = {
  'attack-hit': 440,
  'attack-miss': 220,
  'monster-hit': 165,
  'monster-kill': 660,
  pickup: 523,
  spell: 784,
  trap: 196,
  bump: 150,
  save: 330,
  win: 880,
  escape: 698
};

export class AudioEngine {
  private context: AudioContext | null = null;

  playAll(cues: SoundCue[]) {
    for (const cue of cues) {
      this.play(cue);
    }
  }

  private play(cue: SoundCue) {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    this.context ??= new AudioCtor();

    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = cue === 'spell' || cue === 'win' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(SOUND_FREQUENCIES[cue], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }
}
