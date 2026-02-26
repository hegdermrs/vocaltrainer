const MIN_RMS = 0.0002;
const EMA_ALPHA = 0.2;
const HOLD_DECAY = 0.97;

export interface BreathinessDebug {
  rms: number;
  periodicity: number;
  zcr: number;
  rawScore: number;
  smoothedScore: number;
}

let lastDebug: BreathinessDebug = {
  rms: 0,
  periodicity: 0,
  zcr: 0,
  rawScore: 0,
  smoothedScore: 0
};
let lastSmoothed = 0;
let lastHeld = 0;

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
    const heldBreathiness = lastHeld * HOLD_DECAY;
    lastHeld = heldBreathiness;
    lastSmoothed = heldBreathiness;
    lastDebug = {
      ...lastDebug,
      rms,
      rawScore: 0,
      smoothedScore: heldBreathiness
    };
    return Math.max(0, Math.min(1, heldBreathiness));
  }

  const periodicity = calculatePeriodicity(centered, sampleRate);
  const zcr = calculateZCR(centered);

  const aperiodicityScore = clamp(1 - periodicity, 0, 1);
  const zcrScore = clamp((zcr - 0.015) / 0.12, 0, 1);

  const rawScore = clamp(
    aperiodicityScore * 0.85 + zcrScore * 0.15,
    0,
    1
  );

  const boosted = clamp((rawScore - 0.08) / 0.6, 0, 1);
  const breathinessScore = Math.pow(boosted, 0.6);

  const smoothedBreathiness = EMA_ALPHA * breathinessScore + (1 - EMA_ALPHA) * lastSmoothed;
  lastSmoothed = smoothedBreathiness;
  const heldBreathiness = Math.max(smoothedBreathiness, lastHeld * HOLD_DECAY);
  lastHeld = heldBreathiness;

  lastDebug = {
    rms,
    periodicity,
    zcr,
    rawScore: breathinessScore,
    smoothedScore: heldBreathiness
  };

  return Math.max(0, Math.min(1, heldBreathiness));
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

function calculateZCR(buffer: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    const prev = buffer[i - 1];
    const curr = buffer[i];
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings++;
    }
  }
  return crossings / (buffer.length - 1);
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

export function resetBreathinessContext(): void {
  lastSmoothed = 0;
  lastHeld = 0;
}

export function getBreathinessDebug(): BreathinessDebug {
  return { ...lastDebug };
}
