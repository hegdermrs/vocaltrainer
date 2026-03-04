import {
  AssistedConfig,
  AssistedExerciseId,
  AssistedVoiceProfile,
  clampBpm,
  clampTranspose,
  getExerciseSequence,
  noteNameToMidi
} from '@/src/engine/assistedPractice';

type SoundfontModule = {
  default?: {
    instrument: (
      context: AudioContext,
      instrumentName: string,
      options: {
        format: string;
        soundfont: string;
        nameToUrl: (name: string, soundfont: string, format: string) => string;
      }
    ) => Promise<{ play: (midi: number, time?: number, options?: { gain?: number; duration?: number }) => any }>;
  };
  instrument?: (
    context: AudioContext,
    instrumentName: string,
    options: {
      format: string;
      soundfont: string;
      nameToUrl: (name: string, soundfont: string, format: string) => string;
    }
  ) => Promise<{ play: (midi: number, time?: number, options?: { gain?: number; duration?: number }) => any }>;
};

export interface AssistedGuideState {
  targetNoteName?: string;
  targetMidi?: number;
  profile: AssistedVoiceProfile;
  exerciseId: AssistedExerciseId;
  transposeSemitones: number;
  bpm: number;
  isRunning: boolean;
}

export class AssistedGuide {
  private audioContext: AudioContext | null = null;
  private instrument: { play: (midi: number, time?: number, options?: { gain?: number; duration?: number }) => any } | null =
    null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sequence: string[] = [];
  private index = 0;
  private state: AssistedGuideState = {
    targetNoteName: undefined,
    targetMidi: undefined,
    profile: 'male',
    exerciseId: 'sustain',
    transposeSemitones: 0,
    bpm: 80,
    isRunning: false
  };
  private onTargetChange: ((state: AssistedGuideState) => void) | null = null;

  setOnTargetChange(listener: (state: AssistedGuideState) => void): void {
    this.onTargetChange = listener;
  }

  getState(): AssistedGuideState {
    return { ...this.state };
  }

  async start(config: AssistedConfig): Promise<void> {
    this.stop();
    await this.ensureInstrument();
    this.applyConfig(config);
    this.restartRunningPattern();
  }

  updateConfig(config: AssistedConfig): void {
    this.applyConfig(config);
    if (this.state.isRunning) {
      this.restartRunningPattern();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isRunning = false;
    this.state.targetNoteName = undefined;
    this.state.targetMidi = undefined;
    this.emit();
  }

  private async ensureInstrument(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.instrument) return;
    const mod = (await import('soundfont-player')) as SoundfontModule;
    const api = mod.default ?? mod;
    if (!api.instrument) {
      throw new Error('soundfont-player instrument API unavailable');
    }
    this.instrument = await api.instrument(this.audioContext, 'acoustic_grand_piano', {
      format: 'mp3',
      soundfont: 'MusyngKite',
      nameToUrl: (name: string, soundfont: string, format: string) =>
        `https://d1pzp51pvbm36p.cloudfront.net/${soundfont}/${name}-${format}.js`
    });
  }

  private startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const stepMs = Math.round(60_000 / this.state.bpm);
    this.timer = setInterval(() => this.playStep(), Math.max(stepMs, 80));
  }

  private playStep(): void {
    if (!this.state.isRunning || !this.sequence.length) return;
    const noteName = this.sequence[this.index];
    const midi = noteNameToMidi(noteName);
    if (midi !== null && this.instrument && this.audioContext) {
      void this.audioContext.resume();
      const beatSeconds = 60 / this.state.bpm;
      this.instrument.play(midi, this.audioContext.currentTime, {
        gain: 0.6,
        duration: Math.max(0.12, beatSeconds * 0.75)
      });
    }
    this.state.targetNoteName = noteName;
    this.state.targetMidi = midi ?? undefined;
    this.emit();
    this.index = (this.index + 1) % this.sequence.length;
  }

  private emit(): void {
    if (this.onTargetChange) {
      this.onTargetChange(this.getState());
    }
  }

  private applyConfig(config: AssistedConfig): void {
    this.state.profile = config.voiceProfile;
    this.state.exerciseId = config.exerciseId;
    this.state.transposeSemitones = clampTranspose(config.transposeSemitones);
    this.state.bpm = clampBpm(config.bpm);
    this.sequence = getExerciseSequence({
      ...config,
      bpm: this.state.bpm,
      transposeSemitones: this.state.transposeSemitones
    }).notes;
  }

  private restartRunningPattern(): void {
    this.index = 0;
    this.state.isRunning = true;
    this.playStep();
    this.startTimer();
  }
}
