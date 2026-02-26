export type ScaleType = 'major' | 'minor';

export interface ScaleDefinition {
  id: string;
  label: string;
  root: string;
  type: ScaleType;
}

export const COMMON_SCALES: ScaleDefinition[] = [
  { id: 'c_major', label: 'C Major', root: 'C', type: 'major' },
  { id: 'g_major', label: 'G Major', root: 'G', type: 'major' },
  { id: 'd_major', label: 'D Major', root: 'D', type: 'major' },
  { id: 'a_major', label: 'A Major', root: 'A', type: 'major' },
  { id: 'e_major', label: 'E Major', root: 'E', type: 'major' },
  { id: 'f_major', label: 'F Major', root: 'F', type: 'major' },
  { id: 'bb_major', label: 'Bb Major', root: 'Bb', type: 'major' },
  { id: 'eb_major', label: 'Eb Major', root: 'Eb', type: 'major' },
  { id: 'a_minor', label: 'A Minor', root: 'A', type: 'minor' },
  { id: 'e_minor', label: 'E Minor', root: 'E', type: 'minor' },
  { id: 'd_minor', label: 'D Minor', root: 'D', type: 'minor' },
  { id: 'g_minor', label: 'G Minor', root: 'G', type: 'minor' },
  { id: 'c_minor', label: 'C Minor', root: 'C', type: 'minor' },
  { id: 'f_minor', label: 'F Minor', root: 'F', type: 'minor' }
];

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

const NOTE_TO_PC: Record<string, number> = {
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

interface ScaleSample {
  inScale: boolean;
  timestamp: number;
}

const SCALE_WINDOW_MS = 2000;
const scaleSamples: ScaleSample[] = [];
let lastMatch = 0;
const MIN_SAMPLES_FOR_MATCH = 5;

export function getScaleDefinition(scaleId: string): ScaleDefinition | null {
  return COMMON_SCALES.find((s) => s.id === scaleId) ?? null;
}

export function isNoteInScale(noteName: string, scaleId: string): boolean {
  const scale = getScaleDefinition(scaleId);
  if (!scale) return false;

  const notePc = noteNameToPitchClass(noteName);
  if (notePc === null) return false;

  const rootPc = NOTE_TO_PC[scale.root];
  const intervals = scale.type === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const scalePcs = intervals.map((i) => (rootPc + i) % 12);

  return scalePcs.includes(notePc);
}

export function addScaleSample(inScale: boolean): void {
  const now = Date.now();
  scaleSamples.push({ inScale, timestamp: now });
  const cutoff = now - SCALE_WINDOW_MS;
  while (scaleSamples.length > 0 && scaleSamples[0].timestamp < cutoff) {
    scaleSamples.shift();
  }
}

export function getScaleMatch(): number {
  if (scaleSamples.length === 0) return lastMatch;
  if (scaleSamples.length < MIN_SAMPLES_FOR_MATCH) return lastMatch;
  const inCount = scaleSamples.filter((s) => s.inScale).length;
  lastMatch = inCount / scaleSamples.length;
  return lastMatch;
}

export function resetScaleContext(): void {
  scaleSamples.length = 0;
  lastMatch = 0;
}

function noteNameToPitchClass(noteName: string): number | null {
  if (!noteName) return null;
  const match = noteName.match(/^([A-G])([#b]?)/);
  if (!match) return null;
  const name = `${match[1]}${match[2] ?? ''}`;
  return NOTE_TO_PC[name] ?? null;
}
