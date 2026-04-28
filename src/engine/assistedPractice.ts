export type AssistedVoiceProfile = 'male' | 'female';
export type AssistedExerciseId = 'three_tone' | 'five_tone' | 'octave' | 'mixed_octave' | 'long_arpeggio';

export interface AssistedConfig {
  voiceProfile: AssistedVoiceProfile;
  bpm: number;
  exerciseId: AssistedExerciseId;
  transposeSemitones: number;
  guideVolume: number;
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
  transposeSemitones: 0,
  guideVolume: 100
};

const REST_TOKEN = 'Rest';

const PROFILE_BASE_TRANSPOSE: Record<AssistedVoiceProfile, number> = {
  male: 0,
  female: 9
};

const THREE_TONE_MALE_SEQUENCE = `C2 - D2 - E2 - D2 - C2 - C#2 - Rest - C#2 - D#2 - F2 - D#2 - C#2 - D2 - Rest - D2 - E2 - F#2 - E2 - D2 - D#2 - Rest - D#2 - F2 - G2 - F2 - D#2 - E2 - Rest - E2 - F#2 - G#2 - F#2 - E2 - F2 - Rest - F2 - G2 - A2 - G2 - F2 - F#2 - Rest - F#2 - G#2 - A#2 - G#2 - F#2 - G2 - Rest - G2 - A2 - B2 - A2 - G2 - G#2 - Rest - G#2 - A#2 - C3 - A#2 - G#2 - A2 - Rest - A2 - B2 - C#3 - B2 - A2 - A#2 - Rest - A#2 - C3 - D3 - C3 - A#2 - B2 - Rest - B2 - C#3 - D#3 - C#3 - B2 - C3 - Rest - C3 - D3 - E3 - D3 - C3 - C#3 - Rest - C#3 - D#3 - F3 - D#3 - C#3 - D3 - Rest - D3 - E3 - F#3 - E3 - D3 - D#3 - Rest - D#3 - F3 - G3 - F3 - D#3 - E3 - Rest - E3 - F#3 - G#3 - F#3 - E3 - F3 - Rest - F3 - G3 - A3 - G3 - F3 - F#3 - Rest - F#3 - G#3 - A#3 - G#3 - F#3 - G3 - Rest - G3 - A3 - B3 - A3 - G3 - G#3 - Rest - G#3 - A#3 - C4 - A#3 - G#3 - A3 - Rest - A3 - B3 - C#4 - B3 - A3 - A#3 - Rest - A#3 - C4 - D4 - C4 - A#3 - B3 - Rest - B3 - C#4 - D#4 - C#4 - B3 - C4 - Rest - C4 - D4 - E4 - D4 - C4 - C#4 - Rest - C#4 - D#4 - F4 - D#4 - C#4 - D4 - Rest - D4 - E4 - F#4 - E4 - D4 - D#4 - Rest - D#4 - F4 - G4 - F4 - D#4 - E4 - Rest - E4 - F#4 - G#4 - F#4 - E4 - F4 - Rest - F4 - G4 - A4 - G4 - F4 - F#4 - Rest - F#4 - G#4 - A#4 - G#4 - F#4 - G4 - Rest - G4 - A4 - B4 - A4 - G4 - G#4 - Rest - G#4 - A#4 - C5 - A#4 - G#4 - A4 - Rest - A4 - B4 - C#5 - B4 - A4 - A#4 - Rest - A#4 - C5 - D5 - C5 - A#4 - B4 - Rest - B4 - C#5 - D#5 - C#5 - B4 - C5 - Rest - C5 - D5 - E5 - D5 - C5 - B4 - Rest - B4 - C#5 - D#5 - C#5 - B4 - A#4 - Rest - A#4 - C5 - D5 - C5 - A#4 - A4 - Rest - A4 - B4 - C#5 - B4 - A4 - G#4 - Rest - G#4 - A#4 - C5 - A#4 - G#4 - G4 - Rest - G4 - A4 - B4 - A4 - G4 - F#4 - Rest - F#4 - G#4 - A#4 - G#4 - F#4 - F4 - Rest - F4 - G4 - A4 - G4 - F4 - E4 - Rest - E4 - F#4 - G#4 - F#4 - E4 - D#4 - Rest - D#4 - F4 - G4 - F4 - D#4 - D4 - Rest - D4 - E4 - F#4 - E4 - D4 - C#4 - Rest - C#4 - D#4 - F4 - D#4 - C#4 - C4 - Rest - C4 - D4 - E4 - D4 - C4 - B3 - Rest - B3 - C#4 - D#4 - C#4 - B3 - A#3 - Rest - A#3 - C4 - D4 - C4 - A#3 - A3 - Rest - A3 - B3 - C#4 - B3 - A3 - G#3 - Rest - G#3 - A#3 - C4 - A#3 - G#3 - G3 - Rest - G3 - A3 - B3 - A3 - G3 - F#3 - Rest - F#3 - G#3 - A#3 - G#3 - F#3 - F3 - Rest - F3 - G3 - A3 - G3 - F3 - E3 - Rest - E3 - F#3 - G#3 - F#3 - E3 - D#3 - Rest - D#3 - F3 - G3 - F3 - D#3 - D3 - Rest - D3 - E3 - F#3 - E3 - D3 - C#3 - Rest - C#3 - D#3 - F3 - D#3 - C#3 - C3 - Rest - C3 - D3 - E3 - D3 - C3 - B2 - Rest - B2 - C#3 - D#3 - C#3 - B2 - A#2 - Rest - A#2 - C3 - D3 - C3 - A#2 - A2 - Rest - A2 - B2 - C#3 - B2 - A2 - G#2 - Rest - G#2 - A#2 - C3 - A#2 - G#2 - G2 - Rest - G2 - A2 - B2 - A2 - G2 - F#2 - Rest - F#2 - G#2 - A#2 - G#2 - F#2 - F2 - Rest - F2 - G2 - A2 - G2 - F2 - E2 - Rest - E2 - F#2 - G#2 - F#2 - E2 - D#2 - Rest - D#2 - F2 - G2 - F2 - D#2 - D2 - Rest - D2 - E2 - F#2 - E2 - D2 - C#2 - Rest - C#2 - D#2 - F2 - D#2 - C#2 - C2 - Rest - C2 - D2 - E2 - D2 - C2`;

const FIVE_TONE_MALE_SEQUENCE = `C2 - D2 - E2 - F2 - G2 - F2 - E2 - D2 - C2 - C#2 - Rest - C#2 - D#2 - F2 - F#2 - G#2 - F#2 - F2 - D#2 - C#2 - D2 - Rest - D2 - E2 - F#2 - G2 - A2 - G2 - F#2 - E2 - D2 - D#2 - Rest - D#2 - F2 - G2 - G#2 - A#2 - G#2 - G2 - F2 - D#2 - E2 - Rest - E2 - F#2 - G#2 - A2 - B2 - A2 - G#2 - F#2 - E2 - F2 - Rest - F2 - G2 - A2 - A#2 - C3 - A#2 - A2 - G2 - F2 - F#2 - Rest - F#2 - G#2 - A#2 - B2 - C#3 - B2 - A#2 - G#2 - F#2 - G2 - Rest - G2 - A2 - B2 - C3 - D3 - C3 - B2 - A2 - G2 - G#2 - Rest - G#2 - A#2 - C3 - C#3 - D#3 - C#3 - C3 - A#2 - G#2 - A2 - Rest - A2 - B2 - C#3 - D3 - E3 - D3 - C#3 - B2 - A2 - A#2 - Rest - A#2 - C3 - D3 - D#3 - F3 - D#3 - D3 - C3 - A#2 - B2 - Rest - B2 - C#3 - D#3 - E3 - F#3 - E3 - D#3 - C#3 - B2 - C3 - Rest - C3 - D3 - E3 - F3 - G3 - F3 - E3 - D3 - C3 - C#3 - Rest - C#3 - D#3 - F3 - F#3 - G#3 - F#3 - F3 - D#3 - C#3 - D3 - Rest - D3 - E3 - F#3 - G3 - A3 - G3 - F#3 - E3 - D3 - D#3 - Rest - D#3 - F3 - G3 - G#3 - A#3 - G#3 - G3 - F3 - D#3 - E3 - Rest - E3 - F#3 - G#3 - A3 - B3 - A3 - G#3 - F#3 - E3 - F3 - Rest - F3 - G3 - A3 - A#3 - C4 - A#3 - A3 - G3 - F3 - F#3 - Rest - F#3 - G#3 - A#3 - B3 - C#4 - B3 - A#3 - G#3 - F#3 - G3 - Rest - G3 - A3 - B3 - C4 - D4 - C4 - B3 - A3 - G3 - G#3 - Rest - G#3 - A#3 - C4 - C#4 - D#4 - C#4 - C4 - A#3 - G#3 - A3 - Rest - A3 - B3 - C#4 - D4 - E4 - D4 - C#4 - B3 - A3 - A#3 - Rest - A#3 - C4 - D4 - D#4 - F4 - D#4 - D4 - C4 - A#3 - B3 - Rest - B3 - C#4 - D#4 - E4 - F#4 - E4 - D#4 - C#4 - B3 - C4 - Rest - C4 - D4 - E4 - F4 - G4 - F4 - E4 - D4 - C4 - C#4 - Rest - C#4 - D#4 - F4 - F#4 - G#4 - F#4 - F4 - D#4 - C#4 - D4 - Rest - D4 - E4 - F#4 - G4 - A4 - G4 - F#4 - E4 - D4 - D#4 - Rest - D#4 - F4 - G4 - G#4 - A#4 - G#4 - G4 - F4 - D#4 - E4 - Rest - E4 - F#4 - G#4 - A4 - B4 - A4 - G#4 - F#4 - E4 - F4 - Rest - F4 - G4 - A4 - A#4 - C5 - A#4 - A4 - G4 - F4 - F#4 - Rest - F#4 - G#4 - A#4 - B4 - C#5 - B4 - A#4 - G#4 - F#4 - G4 - Rest - G4 - A4 - B4 - C5 - D5 - C5 - B4 - A4 - G4 - G#4 - Rest - G#4 - A#4 - C5 - C#5 - D#5 - C#5 - C5 - A#4 - G#4 - A4 - Rest - A4 - B4 - C#5 - D5 - E5 - D5 - C#5 - B4 - A4 - G#4 - Rest - G#4 - A#4 - C5 - C#5 - D#5 - C#5 - C5 - A#4 - G#4 - G4 - Rest - G4 - A4 - B4 - C5 - D5 - C5 - B4 - A4 - G4 - F#4 - Rest - F#4 - G#4 - A#4 - B4 - C#5 - B4 - A#4 - G#4 - F#4 - F4 - Rest - F4 - G4 - A4 - A#4 - C5 - A#4 - A4 - G4 - F4 - E4 - Rest - E4 - F#4 - G#4 - A4 - B4 - A4 - G#4 - F#4 - E4 - D#4 - Rest - D#4 - F4 - G4 - G#4 - A#4 - G#4 - G4 - F4 - D#4 - D4 - Rest - D4 - E4 - F#4 - G4 - A4 - G4 - F#4 - E4 - D4 - C#4 - Rest - C#4 - D#4 - F4 - F#4 - G#4 - F#4 - F4 - D#4 - C#4 - C4 - Rest - C4 - D4 - E4 - F4 - G4 - F4 - E4 - D4 - C4 - B3 - Rest - B3 - C#4 - D#4 - E4 - F#4 - E4 - D#4 - C#4 - B3 - A#3 - Rest - A#3 - C4 - D4 - D#4 - F4 - D#4 - D4 - C4 - A#3 - A3 - Rest - A3 - B3 - C#4 - D4 - E4 - D4 - C#4 - B3 - A3 - G#3 - Rest - G#3 - A#3 - C4 - C#4 - D#4 - C#4 - C4 - A#3 - G#3 - G3 - Rest - G3 - A3 - B3 - C4 - D4 - C4 - B3 - A3 - G3 - F#3 - Rest - F#3 - G#3 - A#3 - B3 - C#4 - B3 - A#3 - G#3 - F#3 - F3 - Rest - F3 - G3 - A3 - A#3 - C4 - A#3 - A3 - G3 - F3 - E3 - Rest - E3 - F#3 - G#3 - A3 - B3 - A3 - G#3 - F#3 - E3 - D#3 - Rest - D#3 - F3 - G3 - G#3 - A#3 - G#3 - G3 - F3 - D#3 - D3 - Rest - D3 - E3 - F#3 - G3 - A3 - G3 - F#3 - E3 - D3 - C#3 - Rest - C#3 - D#3 - F3 - F#3 - G#3 - F#3 - F3 - D#3 - C#3 - C3 - Rest - C3 - D3 - E3 - F3 - G3 - F3 - E3 - D3 - C3 - B2 - Rest - B2 - C#3 - D#3 - E3 - F#3 - E3 - D#3 - C#3 - B2 - A#2 - Rest - A#2 - C3 - D3 - D#3 - F3 - D#3 - D3 - C3 - A#2 - A2 - Rest - A2 - B2 - C#3 - D3 - E3 - D3 - C#3 - B2 - A2 - G#2 - Rest - G#2 - A#2 - C3 - C#3 - D#3 - C#3 - C3 - A#2 - G#2 - G2 - Rest - G2 - A2 - B2 - C3 - D3 - C3 - B2 - A2 - G2 - F#2 - Rest - F#2 - G#2 - A#2 - B2 - C#3 - B2 - A#2 - G#2 - F#2 - F2 - Rest - F2 - G2 - A2 - A#2 - C3 - A#2 - A2 - G2 - F2 - E2 - Rest - E2 - F#2 - G#2 - A2 - B2 - A2 - G#2 - F#2 - E2 - D#2 - Rest - D#2 - F2 - G2 - G#2 - A#2 - G#2 - G2 - F2 - D#2 - D2 - Rest - D2 - E2 - F#2 - G2 - A2 - G2 - F#2 - E2 - D2 - C#2 - Rest - C#2 - D#2 - F2 - F#2 - G#2 - F#2 - F2 - D#2 - C#2 - C2 - Rest - C2 - D2 - E2 - F2 - G2 - F2 - E2 - D2 - C2`;

const OCTAVE_MALE_SEQUENCE = `C2 - D2 - E2 - F2 - G2 - A2 - B2 - C3 - B2 - A2 - G2 - F2 - E2 - D2 - C2 - C#2 - Rest - C#2 - D#2 - F2 - F#2 - G#2 - A#2 - C3 - C#3 - C3 - A#2 - G#2 - F#2 - F2 - D#2 - C#2 - D2 - Rest - D2 - E2 - F#2 - G2 - A2 - B2 - C#3 - D3 - C#3 - B2 - A2 - G2 - F#2 - E2 - D2 - D#2 - Rest - D#2 - F2 - G2 - G#2 - A#2 - C3 - D3 - D#3 - D3 - C3 - A#2 - G#2 - G2 - F2 - D#2 - E2 - Rest - E2 - F#2 - G#2 - A2 - B2 - C#3 - D#3 - E3 - D#3 - C#3 - B2 - A2 - G#2 - F#2 - E2 - F2 - Rest - F2 - G2 - A2 - A#2 - C3 - D3 - E3 - F3 - E3 - D3 - C3 - A#2 - A2 - G2 - F2 - F#2 - Rest - F#2 - G#2 - A#2 - B2 - C#3 - D#3 - F3 - F#3 - F3 - D#3 - C#3 - B2 - A#2 - G#2 - F#2 - G2 - Rest - G2 - A2 - B2 - C3 - D3 - E3 - F#3 - G3 - F#3 - E3 - D3 - C3 - B2 - A2 - G2 - G#2 - Rest - G#2 - A#2 - C3 - C#3 - D#3 - F3 - G3 - G#3 - G3 - F3 - D#3 - C#3 - C3 - A#2 - G#2 - A2 - Rest - A2 - B2 - C#3 - D3 - E3 - F#3 - G#3 - A3 - G#3 - F#3 - E3 - D3 - C#3 - B2 - A2 - A#2 - Rest - A#2 - C3 - D3 - D#3 - F3 - G3 - A3 - A#3 - A3 - G3 - F3 - D#3 - D3 - C3 - A#2 - B2 - Rest - B2 - C#3 - D#3 - E3 - F#3 - G#3 - A#3 - B3 - A#3 - G#3 - F#3 - E3 - D#3 - C#3 - B2 - C3 - Rest - C3 - D3 - E3 - F3 - G3 - A3 - B3 - C4 - B3 - A3 - G3 - F3 - E3 - D3 - C3 - C#3 - Rest - C#3 - D#3 - F3 - F#3 - G#3 - A#3 - C4 - C#4 - C4 - A#3 - G#3 - F#3 - F3 - D#3 - C#3 - D3 - Rest - D3 - E3 - F#3 - G3 - A3 - B3 - C#4 - D4 - C#4 - B3 - A3 - G3 - F#3 - E3 - D3 - D#3 - Rest - D#3 - F3 - G3 - G#3 - A#3 - C4 - D4 - D#4 - D4 - C4 - A#3 - G#3 - G3 - F3 - D#3 - E3 - Rest - E3 - F#3 - G#3 - A3 - B3 - C#4 - D#4 - E4 - D#4 - C#4 - B3 - A3 - G#3 - F#3 - E3 - F3 - Rest - F3 - G3 - A3 - A#3 - C4 - D4 - E4 - F4 - E4 - D4 - C4 - A#3 - A3 - G3 - F3 - F#3 - Rest - F#3 - G#3 - A#3 - B3 - C#4 - D#4 - F4 - F#4 - F4 - D#4 - C#4 - B3 - A#3 - G#3 - F#3 - G3 - Rest - G3 - A3 - B3 - C4 - D4 - E4 - F#4 - G4 - F#4 - E4 - D4 - C4 - B3 - A3 - G3 - G#3 - Rest - G#3 - A#3 - C4 - C#4 - D#4 - F4 - G4 - G#4 - G4 - F4 - D#4 - C#4 - C4 - A#3 - G#3 - A3 - Rest - A3 - B3 - C#4 - D4 - E4 - F#4 - G#4 - A4 - G#4 - F#4 - E4 - D4 - C#4 - B3 - A3 - A#3 - Rest - A#3 - C4 - D4 - D#4 - F4 - G4 - A4 - A#4 - A4 - G4 - F4 - D#4 - D4 - C4 - A#3 - B3 - Rest - B3 - C#4 - D#4 - E4 - F#4 - G#4 - A#4 - B4 - A#4 - G#4 - F#4 - E4 - D#4 - C#4 - B3 - C4 - Rest - C4 - D4 - E4 - F4 - G4 - A4 - B4 - C5 - B4 - A4 - G4 - F4 - E4 - D4 - C4 - C#4 - Rest - C#4 - D#4 - F4 - F#4 - G#4 - A#4 - C5 - C#5 - C5 - A#4 - G#4 - F#4 - F4 - D#4 - C#4 - D4 - Rest - D4 - E4 - F#4 - G4 - A4 - B4 - C#5 - D5 - C#5 - B4 - A4 - G4 - F#4 - E4 - D4 - D#4 - Rest - D#4 - F4 - G4 - G#4 - A#4 - C5 - D5 - D#5 - D5 - C5 - A#4 - G#4 - G4 - F4 - D#4 - E4 - Rest - E4 - F#4 - G#4 - A4 - B4 - C#5 - D#5 - E5 - D#5 - C#5 - B4 - A4 - G#4 - F#4 - E4 - D#4 - Rest - D#4 - F4 - G4 - G#4 - A#4 - C5 - D5 - D#5 - D5 - C5 - A#4 - G#4 - G4 - F4 - D#4 - D4 - Rest - D4 - E4 - F#4 - G4 - A4 - B4 - C#5 - D5 - C#5 - B4 - A4 - G4 - F#4 - E4 - D4 - C#4 - Rest - C#4 - D#4 - F4 - F#4 - G#4 - A#4 - C5 - C#5 - C5 - A#4 - G#4 - F#4 - F4 - D#4 - C#4 - C4 - Rest - C4 - D4 - E4 - F4 - G4 - A4 - B4 - C5 - B4 - A4 - G4 - F4 - E4 - D4 - C4 - B3 - Rest - B3 - C#4 - D#4 - E4 - F#4 - G#4 - A#4 - B4 - A#4 - G#4 - F#4 - E4 - D#4 - C#4 - B3 - A#3 - Rest - A#3 - C4 - D4 - D#4 - F4 - G4 - A4 - A#4 - A4 - G4 - F4 - D#4 - D4 - C4 - A#3 - A3 - Rest - A3 - B3 - C#4 - D4 - E4 - F#4 - G#4 - A4 - G#4 - F#4 - E4 - D4 - C#4 - B3 - A3 - G#3 - Rest - G#3 - A#3 - C4 - C#4 - D#4 - F4 - G4 - G#4 - G4 - F4 - D#4 - C#4 - C4 - A#3 - G#3 - G3 - Rest - G3 - A3 - B3 - C4 - D4 - E4 - F#4 - G4 - F#4 - E4 - D4 - C4 - B3 - A3 - G3 - F#3 - Rest - F#3 - G#3 - A#3 - B3 - C#4 - D#4 - F4 - F#4 - F4 - D#4 - C#4 - B3 - A#3 - G#3 - F#3 - F3 - Rest - F3 - G3 - A3 - A#3 - C4 - D4 - E4 - F4 - E4 - D4 - C4 - A#3 - A3 - G3 - F3 - E3 - Rest - E3 - F#3 - G#3 - A3 - B3 - C#4 - D#4 - E4 - D#4 - C#4 - B3 - A3 - G#3 - F#3 - E3 - D#3 - Rest - D#3 - F3 - G3 - G#3 - A#3 - C4 - D4 - D#4 - D4 - C4 - A#3 - G#3 - G3 - F3 - D#3 - D3 - Rest - D3 - E3 - F#3 - G3 - A3 - B3 - C#4 - D4 - C#4 - B3 - A3 - G3 - F#3 - E3 - D3 - C#3 - Rest - C#3 - D#3 - F3 - F#3 - G#3 - A#3 - C4 - C#4 - C4 - A#3 - G#3 - F#3 - F3 - D#3 - C#3 - C3 - Rest - C3 - D3 - E3 - F3 - G3 - A3 - B3 - C4 - B3 - A3 - G3 - F3 - E3 - D3 - C3 - B2 - Rest - B2 - C#3 - D#3 - E3 - F#3 - G#3 - A#3 - B3 - A#3 - G#3 - F#3 - E3 - D#3 - C#3 - B2 - A#2 - Rest - A#2 - C3 - D3 - D#3 - F3 - G3 - A3 - A#3 - A3 - G3 - F3 - D#3 - D3 - C3 - A#2 - A2 - Rest - A2 - B2 - C#3 - D3 - E3 - F#3 - G#3 - A3 - G#3 - F#3 - E3 - D3 - C#3 - B2 - A2 - G#2 - Rest - G#2 - A#2 - C3 - C#3 - D#3 - F3 - G3 - G#3 - G3 - F3 - D#3 - C#3 - C3 - A#2 - G#2 - G2 - Rest - G2 - A2 - B2 - C3 - D3 - E3 - F#3 - G3 - F#3 - E3 - D3 - C3 - B2 - A2 - G2 - F#2 - Rest - F#2 - G#2 - A#2 - B2 - C#3 - D#3 - F3 - F#3 - F3 - D#3 - C#3 - B2 - A#2 - G#2 - F#2 - F2 - Rest - F2 - G2 - A2 - A#2 - C3 - D3 - E3 - F3 - E3 - D3 - C3 - A#2 - A2 - G2 - F2 - E2 - Rest - E2 - F#2 - G#2 - A2 - B2 - C#3 - D#3 - E3 - D#3 - C#3 - B2 - A2 - G#2 - F#2 - E2 - D#2 - Rest - D#2 - F2 - G2 - G#2 - A#2 - C3 - D3 - D#3 - D3 - C3 - A#2 - G#2 - G2 - F2 - D#2 - D2 - Rest - D2 - E2 - F#2 - G2 - A2 - B2 - C#3 - D3 - C#3 - B2 - A2 - G2 - F#2 - E2 - D2 - C#2 - Rest - C#2 - D#2 - F2 - F#2 - G#2 - A#2 - C3 - C#3 - C3 - A#2 - G#2 - F#2 - F2 - D#2 - C#2 - C2 - Rest - C2 - D2 - E2 - F2 - G2 - A2 - B2 - C3 - B2 - A2 - G2 - F2 - E2 - D2 - C2`;

const MIXED_OCTAVE_MALE_SEQUENCE = `C2 - G2 - E2 - C3 - G2 - E2 - C2 - G2 - E2 - C3 - G2 - E2 - C2 - C#2 - Rest - C#2 - G#2 - F2 - C#3 - G#2 - F2 - C#2 - G#2 - F2 - C#3 - G#2 - F2 - C#2 - D2 - Rest - D2 - A2 - F#2 - D3 - A2 - F#2 - D2 - A2 - F#2 - D3 - A2 - F#2 - D2 - D#2 - Rest - D#2 - A#2 - G2 - D#3 - A#2 - G2 - D#2 - A#2 - G2 - D#3 - A#2 - G2 - D#2 - E2 - Rest - E2 - B2 - G#2 - E3 - B2 - G#2 - E2 - B2 - G#2 - E3 - B2 - G#2 - E2 - F2 - Rest - F2 - C3 - A2 - F3 - C3 - A2 - F2 - C3 - A2 - F3 - C3 - A2 - F2 - F#2 - Rest - F#2 - C#3 - A#2 - F#3 - C#3 - A#2 - F#2 - C#3 - A#2 - F#3 - C#3 - A#2 - F#2 - G2 - Rest - G2 - D3 - B2 - G3 - D3 - B2 - G2 - D3 - B2 - G3 - D3 - B2 - G2 - G#2 - Rest - G#2 - D#3 - C3 - G#3 - D#3 - C3 - G#2 - D#3 - C3 - G#3 - D#3 - C3 - G#2 - A2 - Rest - A2 - E3 - C#3 - A3 - E3 - C#3 - A2 - E3 - C#3 - A3 - E3 - C#3 - A2 - A#2 - Rest - A#2 - F3 - D3 - A#3 - F3 - D3 - A#2 - F3 - D3 - A#3 - F3 - D3 - A#2 - B2 - Rest - B2 - F#3 - D#3 - B3 - F#3 - D#3 - B2 - F#3 - D#3 - B3 - F#3 - D#3 - B2 - C3 - Rest - C3 - G3 - E3 - C4 - G3 - E3 - C3 - G3 - E3 - C4 - G3 - E3 - C3 - C#3 - Rest - C#3 - G#3 - F3 - C#4 - G#3 - F3 - C#3 - G#3 - F3 - C#4 - G#3 - F3 - C#3 - D3 - Rest - D3 - A3 - F#3 - D4 - A3 - F#3 - D3 - A3 - F#3 - D4 - A3 - F#3 - D3 - D#3 - Rest - D#3 - A#3 - G3 - D#4 - A#3 - G3 - D#3 - A#3 - G3 - D#4 - A#3 - G3 - D#3 - E3 - Rest - E3 - B3 - G#3 - E4 - B3 - G#3 - E3 - B3 - G#3 - E4 - B3 - G#3 - E3 - F3 - Rest - F3 - C4 - A3 - F4 - C4 - A3 - F3 - C4 - A3 - F4 - C4 - A3 - F3 - F#3 - Rest - F#3 - C#4 - A#3 - F#4 - C#4 - A#3 - F#3 - C#4 - A#3 - F#4 - C#4 - A#3 - F#3 - G3 - Rest - G3 - D4 - B3 - G4 - D4 - B3 - G3 - D4 - B3 - G4 - D4 - B3 - G3 - G#3 - Rest - G#3 - D#4 - C4 - G#4 - D#4 - C4 - G#3 - D#4 - C4 - G#4 - D#4 - C4 - G#3 - A3 - Rest - A3 - E4 - C#4 - A4 - E4 - C#4 - A3 - E4 - C#4 - A4 - E4 - C#4 - A3 - A#3 - Rest - A#3 - F4 - D4 - A#4 - F4 - D4 - A#3 - F4 - D4 - A#4 - F4 - D4 - A#3 - B3 - Rest - B3 - F#4 - D#4 - B4 - F#4 - D#4 - B3 - F#4 - D#4 - B4 - F#4 - D#4 - B3 - C4 - Rest - C4 - G4 - E4 - C5 - G4 - E4 - C4 - G4 - E4 - C5 - G4 - E4 - C4 - C#4 - Rest - C#4 - G#4 - F4 - C#5 - G#4 - F4 - C#4 - G#4 - F4 - C#5 - G#4 - F4 - C#4 - D4 - Rest - D4 - A4 - F#4 - D5 - A4 - F#4 - D4 - A4 - F#4 - D5 - A4 - F#4 - D4 - D#4 - Rest - D#4 - A#4 - G4 - D#5 - A#4 - G4 - D#4 - A#4 - G4 - D#5 - A#4 - G4 - D#4 - E4 - Rest - E4 - B4 - G#4 - E5 - B4 - G#4 - E4 - B4 - G#4 - E5 - B4 - G#4 - E4 - D#4 - Rest - D#4 - A#4 - G4 - D#5 - A#4 - G4 - D#4 - A#4 - G4 - D#5 - A#4 - G4 - D#4 - D4 - Rest - D4 - A4 - F#4 - D5 - A4 - F#4 - D4 - A4 - F#4 - D5 - A4 - F#4 - D4 - C#4 - Rest - C#4 - G#4 - F4 - C#5 - G#4 - F4 - C#4 - G#4 - F4 - C#5 - G#4 - F4 - C#4 - C4 - Rest - C4 - G4 - E4 - C5 - G4 - E4 - C4 - G4 - E4 - C5 - G4 - E4 - C4 - B3 - Rest - B3 - F#4 - D#4 - B4 - F#4 - D#4 - B3 - F#4 - D#4 - B4 - F#4 - D#4 - B3 - A#3 - Rest - A#3 - F4 - D4 - A#4 - F4 - D4 - A#3 - F4 - D4 - A#4 - F4 - D4 - A#3 - A3 - Rest - A3 - E4 - C#4 - A4 - E4 - C#4 - A3 - E4 - C#4 - A4 - E4 - C#4 - A3 - G#3 - Rest - G#3 - D#4 - C4 - G#4 - D#4 - C4 - G#3 - D#4 - C4 - G#4 - D#4 - C4 - G#3 - G3 - Rest - G3 - D4 - B3 - G4 - D4 - B3 - G3 - D4 - B3 - G4 - D4 - B3 - G3 - F#3 - Rest - F#3 - C#4 - A#3 - F#4 - C#4 - A#3 - F#3 - C#4 - A#3 - F#4 - C#4 - A#3 - F#3 - F3 - Rest - F3 - C4 - A3 - F4 - C4 - A3 - F3 - C4 - A3 - F4 - C4 - A3 - F3 - E3 - Rest - E3 - B3 - G#3 - E4 - B3 - G#3 - E3 - B3 - G#3 - E4 - B3 - G#3 - E3 - D#3 - Rest - D#3 - A#3 - G3 - D#4 - A#3 - G3 - D#3 - A#3 - G3 - D#4 - A#3 - G3 - D#3 - D3 - Rest - D3 - A3 - F#3 - D4 - A3 - F#3 - D3 - A3 - F#3 - D4 - A3 - F#3 - D3 - C#3 - Rest - C#3 - G#3 - F3 - C#4 - G#3 - F3 - C#3 - G#3 - F3 - C#4 - G#3 - F3 - C#3 - C3 - Rest - C3 - G3 - E3 - C4 - G3 - E3 - C3 - G3 - E3 - C4 - G3 - E3 - C3 - B2 - Rest - B2 - F#3 - D#3 - B3 - F#3 - D#3 - B2 - F#3 - D#3 - B3 - F#3 - D#3 - B2 - A#2 - Rest - A#2 - F3 - D3 - A#3 - F3 - D3 - A#2 - F3 - D3 - A#3 - F3 - D3 - A#2 - A2 - Rest - A2 - E3 - C#3 - A3 - E3 - C#3 - A2 - E3 - C#3 - A3 - E3 - C#3 - A2 - G#2 - Rest - G#2 - D#3 - C3 - G#3 - D#3 - C3 - G#2 - D#3 - C3 - G#3 - D#3 - C3 - G#2 - G2 - Rest - G2 - D3 - B2 - G3 - D3 - B2 - G2 - D3 - B2 - G3 - D3 - B2 - G2 - F#2 - Rest - F#2 - C#3 - A#2 - F#3 - C#3 - A#2 - F#2 - C#3 - A#2 - F#3 - C#3 - A#2 - F#2 - F2 - Rest - F2 - C3 - A2 - F3 - C3 - A2 - F2 - C3 - A2 - F3 - C3 - A2 - F2 - E2 - Rest - E2 - B2 - G#2 - E3 - B2 - G#2 - E2 - B2 - G#2 - E3 - B2 - G#2 - E2 - D#2 - Rest - D#2 - A#2 - G2 - D#3 - A#2 - G2 - D#2 - A#2 - G2 - D#3 - A#2 - G2 - D#2 - D2 - Rest - D2 - A2 - F#2 - D3 - A2 - F#2 - D2 - A2 - F#2 - D3 - A2 - F#2 - D2 - C#2 - Rest - C#2 - G#2 - F2 - C#3 - G#2 - F2 - C#2 - G#2 - F2 - C#3 - G#2 - F2 - C#2 - C2 - Rest - C2 - G2 - E2 - C3 - G2 - E2 - C2 - G2 - E2 - C3 - G2 - E2 - C2`;

const LONG_ARPEGGIO_MALE_SEQUENCE = `C2 - E2 - G2 - C3 - E3 - G3 - F3 - D3 - B2 - G2 - F2 - D2 - C2 - C#2 - Rest - C#2 - F2 - G#2 - C#3 - F3 - G#3 - F#3 - D#3 - C3 - G#2 - F#2 - D#2 - C#2 - D2 - Rest - D2 - F#2 - A2 - D3 - F#3 - A3 - G3 - E3 - C#3 - A2 - G2 - E2 - D2 - D#2 - Rest - D#2 - G2 - A#2 - D#3 - G3 - A#3 - G#3 - F3 - D3 - A#2 - G#2 - F2 - D#2 - E2 - Rest - E2 - G#2 - B2 - E3 - G#3 - B3 - A3 - F#3 - D#3 - B2 - A2 - F#2 - E2 - F2 - Rest - F2 - A2 - C3 - F3 - A3 - C4 - A#3 - G3 - E3 - C3 - A#2 - G2 - F2 - F#2 - Rest - F#2 - A#2 - C#3 - F#3 - A#3 - C#4 - B3 - G#3 - F3 - C#3 - B2 - G#2 - F#2 - G2 - Rest - G2 - B2 - D3 - G3 - B3 - D4 - C4 - A3 - F#3 - D3 - C3 - A2 - G2 - G#2 - Rest - G#2 - C3 - D#3 - G#3 - C4 - D#4 - C#4 - A#3 - G3 - D#3 - C#3 - A#2 - G#2 - A2 - Rest - A2 - C#3 - E3 - A3 - C#4 - E4 - D4 - B3 - G#3 - E3 - D3 - B2 - A2 - A#2 - Rest - A#2 - D3 - F3 - A#3 - D4 - F4 - D#4 - C4 - A3 - F3 - D#3 - C3 - A#2 - B2 - Rest - B2 - D#3 - F#3 - B3 - D#4 - F#4 - E4 - C#4 - A#3 - F#3 - E3 - C#3 - B2 - C3 - Rest - C3 - E3 - G3 - C4 - E4 - G4 - F4 - D4 - B3 - G3 - F3 - D3 - C3 - C#3 - Rest - C#3 - F3 - G#3 - C#4 - F4 - G#4 - F#4 - D#4 - C4 - G#3 - F#3 - D#3 - C#3 - D3 - Rest - D3 - F#3 - A3 - D4 - F#4 - A4 - G4 - E4 - C#4 - A3 - G3 - E3 - D3 - D#3 - Rest - D#3 - G3 - A#3 - D#4 - G4 - A#4 - G#4 - F4 - D4 - A#3 - G#3 - F3 - D#3 - E3 - Rest - E3 - G#3 - B3 - E4 - G#4 - B4 - A4 - F#4 - D#4 - B3 - A3 - F#3 - E3 - F3 - Rest - F3 - A3 - C4 - F4 - A4 - C5 - A#4 - G4 - E4 - C4 - A#3 - G3 - F3 - F#3 - Rest - F#3 - A#3 - C#4 - F#4 - A#4 - C#5 - B4 - G#4 - F4 - C#4 - B3 - G#3 - F#3 - G3 - Rest - G3 - B3 - D4 - G4 - B4 - D5 - C5 - A4 - F#4 - D4 - C4 - A3 - G3 - G#3 - Rest - G#3 - C4 - D#4 - G#4 - C5 - D#5 - C#5 - A#4 - G4 - D#4 - C#4 - A#3 - G#3 - A3 - Rest - A3 - C#4 - E4 - A4 - C#5 - E5 - D5 - B4 - G#4 - E4 - D4 - B3 - A3 - A#3 - Rest - A#3 - D4 - F4 - A#4 - D5 - F5 - D#5 - C5 - A4 - F4 - D#4 - C4 - A#3 - B3 - Rest - B3 - D#4 - F#4 - B4 - D#5 - F#5 - E5 - C#5 - A#4 - F#4 - E4 - C#4 - B3 - C4 - Rest - C4 - E4 - G4 - C5 - E5 - G5 - F5 - D5 - B4 - G4 - F4 - D4 - C4 - B3 - Rest - B3 - D#4 - F#4 - B4 - D#5 - F#5 - E5 - C#5 - A#4 - F#4 - E4 - C#4 - B3 - A#3 - Rest - A#3 - D4 - F4 - A#4 - D5 - F5 - D#5 - C5 - A4 - F4 - D#4 - C4 - A#3 - A3 - Rest - A3 - C#4 - E4 - A4 - C#5 - E5 - D5 - B4 - G#4 - E4 - D4 - B3 - A3 - G#3 - Rest - G#3 - C4 - D#4 - G#4 - C5 - D#5 - C#5 - A#4 - G4 - D#4 - C#4 - A#3 - G#3 - G3 - Rest - G3 - B3 - D4 - G4 - B4 - D5 - C5 - A4 - F#4 - D4 - C4 - A3 - G3 - F#3 - Rest - F#3 - A#3 - C#4 - F#4 - A#4 - C#5 - B4 - G#4 - F4 - C#4 - B3 - G#3 - F#3 - F3 - Rest - F3 - A3 - C4 - F4 - A4 - C5 - A#4 - G4 - E4 - C4 - A#3 - G3 - F3 - E3 - Rest - E3 - G#3 - B3 - E4 - G#4 - B4 - A4 - F#4 - D#4 - B3 - A3 - F#3 - E3 - D#3 - Rest - D#3 - G3 - A#3 - D#4 - G4 - A#4 - G#4 - F4 - D4 - A#3 - G#3 - F3 - D#3 - D3 - Rest - D3 - F#3 - A3 - D4 - F#4 - A4 - G4 - E4 - C#4 - A3 - G3 - E3 - D3 - C#3 - Rest - C#3 - F3 - G#3 - C#4 - F4 - G#4 - F#4 - D#4 - C4 - G#3 - F#3 - D#3 - C#3 - C3 - Rest - C3 - E3 - G3 - C4 - E4 - G4 - F4 - D4 - B3 - G3 - F3 - D3 - C3 - B2 - Rest - B2 - D#3 - F#3 - B3 - D#4 - F#4 - E4 - C#4 - A#3 - F#3 - E3 - C#3 - B2 - A#2 - Rest - A#2 - D3 - F3 - A#3 - D4 - F4 - D#4 - C4 - A3 - F3 - D#3 - C3 - A#2 - A2 - Rest - A2 - C#3 - E3 - A3 - C#4 - E4 - D4 - B3 - G#3 - E3 - D3 - B2 - A2 - G#2 - Rest - G#2 - C3 - D#3 - G#3 - C4 - D#4 - C#4 - A#3 - G3 - D#3 - C#3 - A#2 - G#2 - G2 - Rest - G2 - B2 - D3 - G3 - B3 - D4 - C4 - A3 - F#3 - D3 - C3 - A2 - G2 - F#2 - Rest - F#2 - A#2 - C#3 - F#3 - A#3 - C#4 - B3 - G#3 - F3 - C#3 - B2 - G#2 - F#2 - F2 - Rest - F2 - A2 - C3 - F3 - A3 - C4 - A#3 - G3 - E3 - C3 - A#2 - G2 - F2 - E2 - Rest - E2 - G#2 - B2 - E3 - G#3 - B3 - A3 - F#3 - D#3 - B2 - A2 - F#2 - E2 - D#2 - Rest - D#2 - G2 - A#2 - D#3 - G3 - A#3 - G#3 - F3 - D3 - A#2 - G#2 - F2 - D#2 - D2 - Rest - D2 - F#2 - A2 - D3 - F#3 - A3 - G3 - E3 - C#3 - A2 - G2 - E2 - D2 - C#2 - Rest - C#2 - F2 - G#2 - C#3 - F3 - G#3 - F#3 - D#3 - C3 - G#2 - F#2 - D#2 - C#2 - C2 - Rest - C2 - E2 - G2 - C3 - E3 - G3 - F3 - D3 - B2 - G2 - F2 - D2 - C2`;

const EXPLICIT_MALE_SEQUENCE_TEXT: Record<AssistedExerciseId, string> = {
  three_tone: THREE_TONE_MALE_SEQUENCE,
  five_tone: FIVE_TONE_MALE_SEQUENCE,
  octave: OCTAVE_MALE_SEQUENCE,
  mixed_octave: MIXED_OCTAVE_MALE_SEQUENCE,
  long_arpeggio: LONG_ARPEGGIO_MALE_SEQUENCE
};

export function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ASSISTED_CONFIG.bpm;
  return Math.max(30, Math.min(244, Math.round(value)));
}

export function clampTranspose(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-12, Math.min(12, Math.round(value)));
}

export function clampGuideVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ASSISTED_CONFIG.guideVolume;
  return Math.max(0, Math.min(150, Math.round(value)));
}

export function getExerciseSequence(config: AssistedConfig): AssistedSequence {
  const transpose = clampTranspose(config.transposeSemitones);
  const notes = buildSequenceNotes(config.exerciseId, config.voiceProfile, transpose);
  const exerciseLabel = EXERCISE_OPTIONS.find((item) => item.id === config.exerciseId)?.label ?? config.exerciseId;
  const rangeLabel = buildSequenceRangeLabel(notes);
  const transposeLabel = transpose === 0 ? '' : ` (${transpose > 0 ? '+' : ''}${transpose})`;

  return {
    label: `${exerciseLabel} - ${rangeLabel}${transposeLabel}`,
    notes
  };
}

function buildSequenceNotes(
  exerciseId: AssistedExerciseId,
  voiceProfile: AssistedVoiceProfile,
  transpose: number
): string[] {
  const baseSequence = parseSequenceText(EXPLICIT_MALE_SEQUENCE_TEXT[exerciseId]);
  const profileTranspose = PROFILE_BASE_TRANSPOSE[voiceProfile];
  return transposeSequenceTokens(baseSequence, profileTranspose + transpose);
}

function parseSequenceText(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s*-\s*/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function transposeSequenceTokens(tokens: string[], semitones: number): string[] {
  if (semitones === 0) return [...tokens];

  return tokens.map((token) => {
    if (token === REST_TOKEN) return REST_TOKEN;
    const midi = noteNameToMidi(token);
    if (midi === null) return token;
    return midiToNoteName(midi + semitones);
  });
}

function buildSequenceRangeLabel(notes: string[]): string {
  const midiNotes = notes
    .map((note) => noteNameToMidi(note))
    .filter((midi): midi is number => midi !== null);

  if (midiNotes.length === 0) {
    return 'Rest only';
  }

  const low = Math.min(...midiNotes);
  const high = Math.max(...midiNotes);
  return `${midiToNoteName(low)}-${midiToNoteName(high)}`;
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
  if (!targetNoteName || targetNoteName === REST_TOKEN) {
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




