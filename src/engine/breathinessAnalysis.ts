const MIN_RMS = 0.00008;
const ATTACK_ALPHA = 0.55;
const RELEASE_ALPHA = 0.4;
const HOLD_DECAY = 0.95;
const MAX_BREATHINESS = 0.5; // 50%
const FLATNESS_MIN_HZ = 150;
const FLATNESS_MAX_HZ = 8000;
const HF_SPLIT_HZ = 2500;
const GOERTZEL_BANDS = 40;

export interface BreathinessDebug {
  rms: number;
  spectralFlatness: number;
  hfNoiseRatio: number;
  periodicity: number;
  periodicityDrift: number;
  harmonicSNR: number;
  bandContrast: number;
  rawScore: number;
  smoothedScore: number;
}

let lastDebug: BreathinessDebug = {
  rms: 0,
  spectralFlatness: 0,
  hfNoiseRatio: 0,
  periodicity: 0,
  periodicityDrift: 0,
  harmonicSNR: 0,
  bandContrast: 0,
  rawScore: 0,
  smoothedScore: 0
};
let lastSmoothed = 0;
let lastHeld = 0;
let lastPeriodicity = 0;

export function calculateBreathiness(
  frame: Float32Array | null,
  sampleRate: number
): number {
  if (!frame || frame.length === 0) {
    return 0;
  }

  const centered = centerFrame(frame);
  const rms = calculateRMS(centered);
  if (rms < MIN_RMS) {
    const decayed = lastSmoothed * HOLD_DECAY;
    lastHeld = decayed;
    lastSmoothed = decayed;
    lastDebug = {
      ...lastDebug,
      rms,
      rawScore: 0,
      smoothedScore: decayed
    };
    return clamp(decayed, 0, MAX_BREATHINESS);
  }

  const periodicity = calculatePeriodicity(centered, sampleRate);
  const spectral = calculateSpectralStats(centered, sampleRate);

  const periodicityDrift = Math.abs(periodicity - lastPeriodicity);
  lastPeriodicity = periodicity;
  const pitchInstability = clamp((1 - periodicity) * 0.8 + periodicityDrift * 0.2, 0, 1);
  const harmonicSNR = clamp((periodicity - 0.15) / 0.75, 0, 1);
  const bandContrast = clamp((1 - spectral.flatness) * 0.7 + (1 - spectral.hfNoiseRatio) * 0.3, 0, 1);

  const hfNoiseScore = clamp((spectral.hfNoiseRatio - 0.14) / 0.48, 0, 1);
  const stabilityScore = clamp((pitchInstability - 0.08) / 0.75, 0, 1);
  const baseScore = clamp(stabilityScore * 0.8 + hfNoiseScore * 0.2, 0, 1);
  const rawScore = clamp(baseScore, 0, 1);
  const normalized = clamp((rawScore - 0.01) / 0.99, 0, 1);
  const breathinessPercent = mapToBreathinessPercent(normalized);
  const breathinessScore = breathinessPercent / 100;

  const alpha = breathinessScore > lastSmoothed ? ATTACK_ALPHA : RELEASE_ALPHA;
  const smoothedBreathiness = alpha * breathinessScore + (1 - alpha) * lastSmoothed;
  lastSmoothed = smoothedBreathiness;
  const holdValue = lastHeld * HOLD_DECAY;
  const heldBreathiness =
    breathinessScore < lastSmoothed ? smoothedBreathiness : Math.max(smoothedBreathiness, holdValue);
  lastHeld = heldBreathiness;

  lastDebug = {
    rms,
    spectralFlatness: spectral.flatness,
    hfNoiseRatio: spectral.hfNoiseRatio,
    periodicity,
    periodicityDrift,
    harmonicSNR,
    bandContrast,
    rawScore,
    smoothedScore: heldBreathiness
  };

  return clamp(heldBreathiness, 0, MAX_BREATHINESS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function centerFrame(buffer: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < buffer.length; i++) {
    mean += buffer[i];
  }
  mean /= buffer.length;
  const centered = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    centered[i] = buffer[i] - mean;
  }
  return centered;
}

function calculatePeriodicity(buffer: Float32Array, sampleRate: number): number {
  const minFreq = 80;
  const maxFreq = 1000;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);
  let maxCorr = 0;

  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let energy1 = 0;
    let energy2 = 0;
    const limit = buffer.length - lag;
    for (let i = 0; i < limit; i++) {
      const a = buffer[i];
      const b = buffer[i + lag];
      sum += a * b;
      energy1 += a * a;
      energy2 += b * b;
    }
    const denom = Math.sqrt(energy1 * energy2) + 1e-12;
    const corr = sum / denom;
    if (corr > maxCorr) {
      maxCorr = corr;
    }
  }

  return clamp(maxCorr, 0, 1);
}

function calculateSpectralStats(
  buffer: Float32Array,
  sampleRate: number
): { flatness: number; hfNoiseRatio: number } {
  const minHz = FLATNESS_MIN_HZ;
  const maxHz = Math.min(FLATNESS_MAX_HZ, sampleRate * 0.5 - 100);
  const bandCount = GOERTZEL_BANDS;
  const mags = new Float32Array(bandCount);
  const eps = 1e-12;

  let sum = 0;
  let logSum = 0;
  let hfSum = 0;

  for (let i = 0; i < bandCount; i++) {
    const t = i / (bandCount - 1);
    const freq = minHz + t * (maxHz - minHz);
    const mag = Math.sqrt(goertzelPower(buffer, sampleRate, freq) + eps);
    mags[i] = mag;
    sum += mag;
    logSum += Math.log(mag + eps);
    if (freq >= HF_SPLIT_HZ) {
      hfSum += mag;
    }
  }

  const mean = sum / bandCount;
  const gMean = Math.exp(logSum / bandCount);
  const flatness = clamp(gMean / (mean + eps), 0, 1);
  const hfNoiseRatio = clamp(hfSum / (sum + eps), 0, 1);

  return { flatness, hfNoiseRatio };
}

function goertzelPower(buffer: Float32Array, sampleRate: number, frequency: number): number {
  const normalizedFreq = (2 * Math.PI * frequency) / sampleRate;
  const coeff = 2 * Math.cos(normalizedFreq);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  const n = buffer.length;

  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1))); // Hann
    s0 = buffer[i] * w + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

export function resetBreathinessContext(): void {
  lastSmoothed = 0;
  lastHeld = 0;
  lastPeriodicity = 0;
}

export function getBreathinessDebug(): BreathinessDebug {
  return { ...lastDebug };
}

function mapToBreathinessPercent(normalized: number): number {
  const n = clamp(normalized, 0, 1);
  if (n <= 0.24) {
    const lowBand = Math.pow(n / 0.24, 1.15) * 9;
    return clamp(lowBand, 0, 9);
  }
  const highBand = 9 + Math.pow((n - 0.24) / 0.76, 1.05) * 41;
  return clamp(highBand, 9, 50);
}
