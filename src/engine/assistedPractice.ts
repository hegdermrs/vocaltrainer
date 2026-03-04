export type AssistedVoiceProfile = 'male' | 'female';
export type AssistedExerciseId = 'sustain' | 'siren' | 'thirds' | 'fifths';

export interface AssistedConfig {
  voiceProfile: AssistedVoiceProfile;
  bpm: number;
  exerciseId: AssistedExerciseId;
  transposeSemitones: number;
}

export interface AssistedExerciseDefinition {
  id: AssistedExerciseId;
  label: string;
  description: string;
}

export interface AssistedSequence {
  label: string;
  notes: string[];
}

export const EXERCISE_OPTIONS: AssistedExerciseDefinition[] = [
  { id: 'sustain', label: 'Sustain', description: 'Repeat tonic note holds.' },
  { id: 'siren', label: 'Siren', description: 'Stepwise glide up and down an octave.' },
  { id: 'thirds', label: '3rds', description: 'Diatonic third interval drill.' },
  { id: 'fifths', label: '5ths', description: 'Diatonic fifth interval drill.' }
];

export const DEFAULT_ASSISTED_CONFIG: AssistedConfig = {
  voiceProfile: 'male',
  bpm: 80,
  exerciseId: 'sustain',
  transposeSemitones: 0
};

const PROFILE_TONIC_MIDI: Record<AssistedVoiceProfile, number> = {
  male: 48, // C3
  female: 55 // G3
};

const PROFILE_KEY_LABEL: Record<AssistedVoiceProfile, string> = {
  male: 'C',
  female: 'G'
};

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ASSISTED_CONFIG.bpm;
  return Math.max(30, Math.min(244, Math.round(value)));
}

export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-12, Math.min(12, Math.round(value)));
}

export function getExerciseSequence(config: AssistedConfig): AssistedSequence {
  const tonicMidi = PROFILE_TONIC_MIDI[config.voiceProfile] + clampTranspose(config.transposeSemitones);
  const notes = buildExerciseMidi(config.exerciseId, tonicMidi).map((midi) => midiToNoteName(midi));
  const keyRoot = PROFILE_KEY_LABEL[config.voiceProfile];
  const transposeLabel =
    config.transposeSemitones === 0 ? '' : ` (${config.transposeSemitones > 0 ? '+' : ''}${config.transposeSemitones})`;
  const exerciseLabel = EXERCISE_OPTIONS.find((item) => item.id === config.exerciseId)?.label ?? config.exerciseId;
  return {
    label: `${exerciseLabel} - ${keyRoot} profile${transposeLabel}`,
    notes
  };
}

function buildExerciseMidi(exerciseId: AssistedExerciseId, tonicMidi: number): number[] {
  const major = [0, 2, 4, 5, 7, 9, 11, 12];
  switch (exerciseId) {
    case 'sustain':
      return Array.from({ length: 8 }, () => tonicMidi);
    case 'siren': {
      const up = major.map((offset) => tonicMidi + offset);
      const down = [...major].reverse().slice(1).map((offset) => tonicMidi + offset);
      return [...up, ...down];
    }
    case 'thirds': {
      const idx = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 7, 5, 3, 1, 0];
      return idx.map((i) => tonicMidi + major[i]);
    }
    case 'fifths': {
      const idx = [0, 4, 1, 5, 2, 6, 3, 7, 4, 7, 3, 6, 2, 5, 1, 4, 0];
      return idx.map((i) => tonicMidi + major[i]);
    }
    default:
      return [tonicMidi];
  }
}

export function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const letter = match[1];
  const accidental = match[2] || '';
  const octave = Number(match[3]);
  const key = `${letter}${accidental}`;
  const map: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11
  };
  const pitchClass = map[key];
  if (pitchClass === undefined) return null;
  return (octave + 1) * 12 + pitchClass;
}

export function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function evaluateAssistedFollow(
  userNoteName: string | undefined,
  userPitchHz: number | undefined,
  userPitchConfidence: number | undefined,
  targetNoteName: string | undefined,
  confidenceThreshold: number,
  centsTolerance: number
): { eligible: boolean; hit: boolean; status: 'on-target' | 'near' | 'off' | 'no-pitch' } {
  if (!targetNoteName) {
    return { eligible: false, hit: false, status: 'no-pitch' };
  }
  if (!userNoteName || !userPitchHz || userPitchConfidence === undefined) {
    return { eligible: false, hit: false, status: 'no-pitch' };
  }
  if (userPitchConfidence < confidenceThreshold) {
    return { eligible: false, hit: false, status: 'no-pitch' };
  }

  const userMidi = noteNameToMidi(userNoteName);
  const targetMidi = noteNameToMidi(targetNoteName);
  if (userMidi === null || targetMidi === null) {
    return { eligible: false, hit: false, status: 'no-pitch' };
  }

  const targetFreq = midiToFrequency(targetMidi);
  const cents = 1200 * Math.log2(userPitchHz / targetFreq);
  const semitoneDelta = Math.abs(userMidi - targetMidi);
  const absCents = Math.abs(cents);

  if (semitoneDelta === 0 && absCents <= centsTolerance) {
    return { eligible: true, hit: true, status: 'on-target' };
  }
  if (semitoneDelta <= 1 && absCents <= Math.max(centsTolerance, 75)) {
    return { eligible: true, hit: false, status: 'near' };
  }
  return { eligible: true, hit: false, status: 'off' };
}
