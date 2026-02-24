export interface VolumeResult {
  level: number;
  db: number;
  category: 'silent' | 'quiet' | 'moderate' | 'loud' | 'very loud';
  rms: number;
}

const VOLUME_BUFFER_SECONDS = 2;
const SAMPLES_PER_SECOND = 60;
const MAX_VOLUME_SAMPLES = Math.floor(VOLUME_BUFFER_SECONDS * SAMPLES_PER_SECOND);

interface VolumeSample {
  rms: number;
  timestamp: number;
}

const volumeBuffer: VolumeSample[] = [];

export function analyzeVolume(buffer: Float32Array): VolumeResult {
  const rms = Math.sqrt(
    buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length
  );

  const db = 20 * Math.log10(Math.max(rms, 0.00001));

  const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.67));

  let category: VolumeResult['category'] = 'silent';
  if (normalizedLevel < 10) {
    category = 'silent';
  } else if (normalizedLevel < 30) {
    category = 'quiet';
  } else if (normalizedLevel < 60) {
    category = 'moderate';
  } else if (normalizedLevel < 85) {
    category = 'loud';
  } else {
    category = 'very loud';
  }

  return {
    level: normalizedLevel,
    db,
    category,
    rms
  };
}

export function addVolumeForConsistency(rms: number): void {
  volumeBuffer.push({
    rms,
    timestamp: Date.now()
  });

  if (volumeBuffer.length > MAX_VOLUME_SAMPLES) {
    volumeBuffer.shift();
  }
}

export function calculateVolumeConsistency(): number {
  if (volumeBuffer.length < 5) {
    return 0;
  }

  const recentSamples = volumeBuffer.slice(-60);
  const rmsValues = recentSamples.map(s => s.rms).filter(v => v > 0.0001);

  if (rmsValues.length < 5) {
    return 0;
  }

  const mean = rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length;

  if (mean < 0.0001) return 0;

  const variance = rmsValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rmsValues.length;
  const stdDev = Math.sqrt(variance);

  const coefficientOfVariation = stdDev / mean;

  const consistency = Math.max(0, Math.min(1, 1 - coefficientOfVariation * 1.2));

  return consistency;
}

export function resetVolumeConsistencyContext(): void {
  volumeBuffer.length = 0;
}

export class VolumeTracker {
  private volumeHistory: number[] = [];
  private readonly maxHistory = 50;

  addVolume(level: number): void {
    this.volumeHistory.push(level);
    if (this.volumeHistory.length > this.maxHistory) {
      this.volumeHistory.shift();
    }
  }

  getAverage(): number {
    if (this.volumeHistory.length === 0) return 0;
    return this.volumeHistory.reduce((sum, val) => sum + val, 0) / this.volumeHistory.length;
  }

  getConsistency(): number {
    if (this.volumeHistory.length < 2) return 0;

    const avg = this.getAverage();
    const variance = this.volumeHistory.reduce(
      (sum, val) => sum + Math.pow(val - avg, 2),
      0
    ) / this.volumeHistory.length;

    return Math.max(0, 100 - Math.sqrt(variance));
  }

  reset(): void {
    this.volumeHistory = [];
  }
}
