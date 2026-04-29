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
  guideVolume: number;
  isRunning: boolean;
  isPaused: boolean;
}

const DESKTOP_GUIDE_GAIN = 0.95;
const MOBILE_GUIDE_GAIN = 1.15;

function getGuidePlaybackGain(volumePercent: number): number {
  if (typeof navigator === 'undefined') return DESKTOP_GUIDE_GAIN * (volumePercent / 100);
  const ua = navigator.userAgent.toLowerCase();
  const baseGain = /android|iphone|ipad|ipod|mobile/.test(ua) ? MOBILE_GUIDE_GAIN : DESKTOP_GUIDE_GAIN;
  return baseGain * (volumePercent / 100);
}

export class AssistedGuide {
  private audioContext: AudioContext | null = null;
  private instrument: { play: (midi: number, time?: number, options?: { gain?: number; duration?: number }) => any } | null =
    null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sequence: string[] = [];
  private index = 0;
  private currentStepIndex: number | null = null;
  private state: AssistedGuideState = {
    targetNoteName: undefined,
    targetMidi: undefined,
    profile: 'male',
    exerciseId: 'three_tone',
    transposeSemitones: 0,
    bpm: 80,
    guideVolume: 100,
    isRunning: false,
    isPaused: false
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
    const nextTranspose = clampTranspose(config.transposeSemitones);
    const nextBpm = clampBpm(config.bpm);
    const requiresSequenceRestart =
      this.state.profile !== config.voiceProfile ||
      this.state.exerciseId !== config.exerciseId ||
      this.state.transposeSemitones !== nextTranspose;
    const bpmChanged = this.state.bpm !== nextBpm;
    const wasPaused = this.state.isPaused;

    this.applyConfig(config);

    if (!this.state.isRunning && !this.state.isPaused) {
      this.emit();
      return;
    }

    if (requiresSequenceRestart) {
      this.index = 0;
      this.currentStepIndex = null;
      if (wasPaused) {
        this.state.targetNoteName = undefined;
        this.state.targetMidi = undefined;
        this.emit();
        return;
      }
      this.restartRunningPattern();
      return;
    }

    if (bpmChanged && this.state.isRunning) {
      this.startTimer();
    }

    this.emit();
  }

  pause(): void {
    if (!this.state.isRunning) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isRunning = false;
    this.state.isPaused = true;
    this.state.targetNoteName = undefined;
    this.state.targetMidi = undefined;
    this.emit();
  }

  resume(): void {
    if (!this.state.isPaused || !this.sequence.length) return;
    this.state.isPaused = false;
    this.state.isRunning = true;
    const resumeIndex = this.currentStepIndex ?? this.index;
    this.playStep(resumeIndex);
    this.startTimer();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.index = 0;
    this.currentStepIndex = null;
    this.state.isRunning = false;
    this.state.isPaused = false;
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

  private playStep(stepIndex = this.index): void {
    if (!this.state.isRunning || !this.sequence.length) return;
    const safeIndex = ((stepIndex % this.sequence.length) + this.sequence.length) % this.sequence.length;
    const noteName = this.sequence[safeIndex];
    const midi = noteNameToMidi(noteName);
    const isRest = noteName === 'Rest' || midi === null;
    if (!isRest && this.instrument && this.audioContext) {
      void this.audioContext.resume();
      const beatSeconds = 60 / this.state.bpm;
      this.instrument.play(midi, this.audioContext.currentTime, {
        gain: getGuidePlaybackGain(this.state.guideVolume),
        duration: Math.max(0.16, beatSeconds * 0.9)
      });
    }
    this.state.targetNoteName = isRest ? undefined : noteName;
    this.state.targetMidi = isRest ? undefined : midi ?? undefined;
    this.currentStepIndex = safeIndex;
    this.emit();
    this.index = (safeIndex + 1) % this.sequence.length;
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
    this.state.guideVolume = config.guideVolume;
    this.sequence = getExerciseSequence({
      ...config,
      bpm: this.state.bpm,
      transposeSemitones: this.state.transposeSemitones
    }).notes;
  }

  private restartRunningPattern(): void {
    this.index = 0;
    this.currentStepIndex = null;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.playStep();
    this.startTimer();
  }
}







