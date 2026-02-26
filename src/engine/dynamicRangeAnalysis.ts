export interface DynamicRangeStats {
  p10Rms: number;
  p90Rms: number;
  dynamicRangeDb: number;
  loudnessStdDb: number;
}

interface RangeSample {
  rms: number;
  timestamp: number;
}

const RANGE_WINDOW_MS = 8000;
const rangeBuffer: RangeSample[] = [];

export function addRangeSample(rms: number, isVoiced: boolean): void {
  if (!isVoiced) return;
  const now = Date.now();
  rangeBuffer.push({ rms, timestamp: now });
  const cutoff = now - RANGE_WINDOW_MS;
  while (rangeBuffer.length > 0 && rangeBuffer[0].timestamp < cutoff) {
    rangeBuffer.shift();
  }
}

export function getDynamicRangeStats(): DynamicRangeStats | null {
  if (rangeBuffer.length < 10) return null;

  const rmsValues = rangeBuffer.map((s) => s.rms).filter((v) => v > 0.00001).sort((a, b) => a - b);
  if (rmsValues.length < 5) return null;

  const p10 = percentile(rmsValues, 0.1);
  const p90 = percentile(rmsValues, 0.9);
  const safeP10 = Math.max(p10, 0.00001);
  const safeP90 = Math.max(p90, safeP10);

  const dynamicRangeDb = 20 * Math.log10(safeP90 / safeP10);

  const dbValues = rmsValues.map((v) => 20 * Math.log10(Math.max(v, 0.00001)));
  const meanDb = dbValues.reduce((sum, v) => sum + v, 0) / dbValues.length;
  const variance = dbValues.reduce((sum, v) => sum + Math.pow(v - meanDb, 2), 0) / dbValues.length;
  const loudnessStdDb = Math.sqrt(variance);

  return {
    p10Rms: p10,
    p90Rms: p90,
    dynamicRangeDb,
    loudnessStdDb
  };
}

export function resetDynamicRangeContext(): void {
  rangeBuffer.length = 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const idx = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * p)));
  return values[idx];
}
