export interface StabilityResult {
  score: number;
  variance: number;
  trend: 'stable' | 'rising' | 'falling' | 'unstable';
  jitterValues: number[];
}

const STABILITY_BUFFER_SECONDS = 1.5;
const SAMPLES_PER_SECOND = 60;
const MAX_STABILITY_SAMPLES = Math.floor(STABILITY_BUFFER_SECONDS * SAMPLES_PER_SECOND);
const MIN_CONFIDENCE_THRESHOLD = 0.3;

interface PitchSample {
  frequency: number;
  confidence: number;
  timestamp: number;
}

const stabilityBuffer: PitchSample[] = [];

export function addPitchForStability(frequency: number, confidence: number): void {
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return;
  }

  stabilityBuffer.push({
    frequency,
    confidence,
    timestamp: Date.now()
  });

  if (stabilityBuffer.length > MAX_STABILITY_SAMPLES) {
    stabilityBuffer.shift();
  }
}

export function calculatePitchStability(): number {
  if (stabilityBuffer.length < 10) {
    return 0;
  }

  const frequencies = stabilityBuffer.map(s => s.frequency);
  const mean = frequencies.reduce((sum, val) => sum + val, 0) / frequencies.length;
  const variance = frequencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frequencies.length;
  const stdDev = Math.sqrt(variance);

  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  const stability = Math.max(0, Math.min(1, 1 - coefficientOfVariation * 10));

  return stability;
}

export function getStabilityJitterValues(maxSamples: number = 50): number[] {
  if (stabilityBuffer.length < 2) {
    return [];
  }

  const step = Math.max(1, Math.floor(stabilityBuffer.length / maxSamples));
  const samples: number[] = [];

  for (let i = 0; i < stabilityBuffer.length; i += step) {
    samples.push(stabilityBuffer[i].frequency);
  }

  return samples;
}

export function resetStabilityContext(): void {
  stabilityBuffer.length = 0;
}

export interface VibratoMetrics {
  rateHz: number;
  depthCents: number;
}

export function calculateVibratoMetrics(): VibratoMetrics | null {
  if (stabilityBuffer.length < 15) {
    return null;
  }

  const samples = stabilityBuffer.slice(-MAX_STABILITY_SAMPLES);
  if (samples.length < 10) {
    return null;
  }

  const frequencies = samples.map((s) => s.frequency);
  const times = samples.map((s) => s.timestamp / 1000);

  const meanFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
  if (meanFreq <= 0) return null;

  const deltas = frequencies.map((f) => f - meanFreq);

  let zeroCrossings = 0;
  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i - 1] === 0) continue;
    if (deltas[i - 1] < 0 && deltas[i] > 0) {
      zeroCrossings++;
    }
  }

  const durationSeconds = times[times.length - 1] - times[0];
  if (durationSeconds <= 0) return null;

  const rateHz = zeroCrossings / durationSeconds;

  const absDeltas = deltas.map((d) => Math.abs(d));
  const avgAmpHz = absDeltas.reduce((sum, d) => sum + d, 0) / absDeltas.length;

  const upper = meanFreq + avgAmpHz;
  const lower = Math.max(1, meanFreq - avgAmpHz);
  const depthCents = 1200 * Math.log2(upper / lower);

  if (!isFinite(rateHz) || !isFinite(depthCents)) {
    return null;
  }

  return {
    rateHz,
    depthCents
  };
}

export class StabilityAnalyzer {
  private pitchHistory: number[] = [];
  private readonly maxHistory = 30;

  addPitch(frequency: number): void {
    this.pitchHistory.push(frequency);
    if (this.pitchHistory.length > this.maxHistory) {
      this.pitchHistory.shift();
    }
  }

  analyze(): StabilityResult {
    if (this.pitchHistory.length < 5) {
      return {
        score: 0,
        variance: 0,
        trend: 'unstable',
        jitterValues: []
      };
    }

    const mean = this.pitchHistory.reduce((sum, val) => sum + val, 0) / this.pitchHistory.length;

    const variance = this.pitchHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.pitchHistory.length;

    const normalizedVariance = Math.min(variance / 100, 1);
    const score = Math.max(0, 100 - normalizedVariance * 100);

    const firstHalf = this.pitchHistory.slice(0, Math.floor(this.pitchHistory.length / 2));
    const secondHalf = this.pitchHistory.slice(Math.floor(this.pitchHistory.length / 2));

    const firstMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    let trend: 'stable' | 'rising' | 'falling' | 'unstable' = 'stable';
    const difference = secondMean - firstMean;

    if (Math.abs(difference) < 5) {
      trend = 'stable';
    } else if (difference > 10) {
      trend = 'rising';
    } else if (difference < -10) {
      trend = 'falling';
    } else if (variance > 50) {
      trend = 'unstable';
    }

    return { score, variance, trend, jitterValues: this.pitchHistory.slice() };
  }

  reset(): void {
    this.pitchHistory = [];
  }
}
