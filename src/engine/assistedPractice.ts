export type AssistedVoiceProfile = 'male' | 'female';
export type AssistedExerciseId = 'three_tone' | 'five_tone' | 'octave' | 'mixed_octave' | 'long_arpeggio';

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
  { id: 'three_tone', label: '3 Tone Scale', description: 'Three-note scale pattern moving across the full range.' },
  { id: 'five_tone', label: '5 Tone Scale', description: 'Five-note scale pattern moving across the full range.' },
  { id: 'octave', label: 'Octave Scale', description: 'Full octave scale pattern across the full range.' },
  { id: 'mixed_octave', label: 'Mixed Octave Scale', description: 'Scale tones mixed with octave jumps across the full range.' },
  { id: 'long_arpeggio', label: 'Long Arpeggio', description: 'Extended arpeggio pattern sweeping the full range.' }
];

export const DEFAULT_ASSISTED_CONFIG: AssistedConfig = {
  voiceProfile: 'male',
  bpm: 80,
  exerciseId: 'three_tone',
  transposeSemitones: 0
};

const PROFILE_RANGES: Record<AssistedVoiceProfile, { low: number; high: number; label: string }> = {
  male: {
    low: noteNameToMidi('C2') ?? 36,
    high: noteNameToMidi('E5') ?? 76,
    label: 'C2-E5'
  },
  female: {
    low: noteNameToMidi('A3') ?? 57,
    high: noteNameToMidi('C6') ?? 84,
    label: 'A3-C6'
  }
};

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ASSISTED_CONFIG.bpm;
  return Math.max(30, Math.min(244, Math.round(value)));
}

export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-12, Math.min(12, Math.round(value)));
}

export function getExerciseSequence(config: AssistedConfig): AssistedSequence {
  const range = PROFILE_RANGES[config.voiceProfile];
  const transpose = clampTranspose(config.transposeSemitones);
  const notes = buildPatternAcrossRange(config.exerciseId, range.low, range.high, transpose)
    .map((midi) => midiToNoteName(midi));
  const exerciseLabel = EXERCISE_OPTIONS.find((item) => item.id === config.exerciseId)?.label ?? config.exerciseId;
  const transposeLabel = transpose === 0 ? '' : ` (${transpose > 0 ? '+' : ''}${transpose})`;

  return {
    label: `${exerciseLabel} - ${range.label}${transposeLabel}`,
    notes
  };
}

function buildPatternAcrossRange(
  exerciseId: AssistedExerciseId,
  lowMidi: number,
  highMidi: number,
  transpose: number
): number[] {
  const rootLow = lowMidi + transpose;
  const rootHigh = highMidi + transpose;
  const pattern = getPatternOffsets(exerciseId);
  const maxOffset = Math.max(...pattern);
  const roots: number[] = [];

  for (let root = rootLow; root + maxOffset <= rootHigh; root += 1) {
    roots.push(root);
  }

  if (roots.length === 0) {
    roots.push(Math.max(rootLow, rootHigh - maxOffset));
  }

  return roots.flatMap((root) =>
    pattern
      .map((offset) => root + offset)
      .filter((midi) => midi >= rootLow && midi <= rootHigh)
  );
}

function getPatternOffsets(exerciseId: AssistedExerciseId): number[] {
  switch (exerciseId) {
    case 'three_tone':
      return [0, 2, 4, 2, 0];
    case 'five_tone':
      return [0, 2, 4, 5, 7, 5, 4, 2, 0];
    case 'octave':
      return [...MAJOR_SCALE_INTERVALS, ...[11, 9, 7, 5, 4, 2, 0]];
    case 'mixed_octave':
      return [0, 12, 2, 12, 4, 12, 5, 12, 7, 12, 7, 5, 4, 2, 0];
    case 'long_arpeggio':
      return [0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4, 0];
    default:
      return [0];
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
