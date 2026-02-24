export interface PitchResult {
  frequency: number;
  confidence: number;
  note: string;
  cents: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MIN_CLARITY = 0.4;
const MIN_FREQ = 80;
const MAX_FREQ = 1000;
const SMALL_CUTOFF = 0.25;

const pitchHistory: number[] = [];
const MEDIAN_WINDOW = 7;

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult | null {
  const nsdf = calculateNSDF(buffer);

  const peaks = findPeaks(nsdf, SMALL_CUTOFF);

  if (peaks.length === 0) {
    return null;
  }

  const bestPeak = selectBestPeak(peaks, nsdf);

  if (!bestPeak || nsdf[bestPeak] < MIN_CLARITY) {
    return null;
  }

  const refinedLag = parabolicInterpolation(nsdf, bestPeak);

  const rawFrequency = sampleRate / refinedLag;

  if (rawFrequency < MIN_FREQ || rawFrequency > MAX_FREQ) {
    return null;
  }

  pitchHistory.push(rawFrequency);
  if (pitchHistory.length > MEDIAN_WINDOW) {
    pitchHistory.shift();
  }

  let smoothedFrequency: number;

  if (pitchHistory.length >= 3) {
    const sorted = [...pitchHistory].sort((a, b) => a - b);
    smoothedFrequency = sorted[Math.floor(sorted.length / 2)];
  } else {
    smoothedFrequency = rawFrequency;
  }

  const clarity = nsdf[bestPeak];

  const { noteName, cents } = frequencyToNoteNameAndCents(smoothedFrequency);

  return {
    frequency: smoothedFrequency,
    confidence: clarity,
    note: noteName,
    cents
  };
}

function calculateNSDF(buffer: Float32Array): Float32Array {
  const bufferSize = buffer.length;
  const maxLag = Math.floor(bufferSize / 2);
  const nsdf = new Float32Array(maxLag);

  const autocorr = new Float32Array(maxLag);
  const energy = new Float32Array(maxLag);

  for (let lag = 0; lag < maxLag; lag++) {
    let sum = 0;
    let energyLeft = 0;
    let energyRight = 0;

    for (let i = 0; i < bufferSize - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
      energyLeft += buffer[i] * buffer[i];
      energyRight += buffer[i + lag] * buffer[i + lag];
    }

    autocorr[lag] = sum;
    energy[lag] = (energyLeft + energyRight) / 2;
  }

  for (let lag = 0; lag < maxLag; lag++) {
    if (energy[lag] > 0) {
      nsdf[lag] = 2 * autocorr[lag] / energy[lag];
    } else {
      nsdf[lag] = 0;
    }
  }

  return nsdf;
}

function findPeaks(nsdf: Float32Array, threshold: number): number[] {
  const peaks: number[] = [];

  const minLag = 10;

  for (let i = minLag; i < nsdf.length - 1; i++) {
    if (nsdf[i] > threshold) {
      if (nsdf[i] > nsdf[i - 1] && nsdf[i] >= nsdf[i + 1]) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

function selectBestPeak(peaks: number[], nsdf: Float32Array): number | null {
  if (peaks.length === 0) return null;

  let bestPeak = peaks[0];
  let bestClarity = nsdf[peaks[0]];

  for (let i = 1; i < peaks.length; i++) {
    const peak = peaks[i];
    const clarity = nsdf[peak];

    if (clarity > bestClarity) {
      bestPeak = peak;
      bestClarity = clarity;
    }
  }

  return bestPeak;
}

function parabolicInterpolation(nsdf: Float32Array, peak: number): number {
  if (peak < 1 || peak >= nsdf.length - 1) {
    return peak;
  }

  const alpha = nsdf[peak - 1];
  const beta = nsdf[peak];
  const gamma = nsdf[peak + 1];

  const offset = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);

  if (isNaN(offset) || !isFinite(offset)) {
    return peak;
  }

  return peak + offset;
}

export function frequencyToNoteNameAndCents(frequencyHz: number): { noteName: string; cents: number } {
  const midiNote = 12 * Math.log2(frequencyHz / 440) + 69;
  const roundedNote = Math.round(midiNote);
  const cents = Math.round((midiNote - roundedNote) * 100);

  const noteIndex = ((roundedNote % 12) + 12) % 12;
  const octave = Math.floor(roundedNote / 12) - 1;
  const noteName = `${NOTE_NAMES[noteIndex]}${octave}`;

  return { noteName, cents };
}

export function resetPitchDetectionContext(): void {
  pitchHistory.length = 0;
}
