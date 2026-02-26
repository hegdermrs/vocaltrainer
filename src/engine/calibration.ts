import { updateEngineSettings } from './engineSettings';

interface CalibrationSample {
  rms: number;
  timestamp: number;
}

const CALIBRATION_DURATION_MS = 5000;
const calibrationSamples: CalibrationSample[] = [];
let calibrationStartTime: number | null = null;
let isCalibrating = false;
let noiseGate = 0.002;

export interface CalibrationState {
  isCalibrating: boolean;
  progress: number;
  noiseGate: number;
  meanRMS: number;
  stdDevRMS: number;
}

export function startCalibration(): void {
  calibrationSamples.length = 0;
  calibrationStartTime = Date.now();
  isCalibrating = true;
  noiseGate = 0.002;
}

export function addCalibrationSample(rms: number): void {
  if (!isCalibrating || !calibrationStartTime) return;

  calibrationSamples.push({
    rms,
    timestamp: Date.now()
  });

  const elapsed = Date.now() - calibrationStartTime;
  if (elapsed >= CALIBRATION_DURATION_MS) {
    finishCalibration();
  }
}

function finishCalibration(): void {
  if (calibrationSamples.length === 0) {
    noiseGate = 0.002;
    isCalibrating = false;
    return;
  }

  const rmsValues = calibrationSamples.map(s => s.rms).sort((a, b) => a - b);
  const median = getPercentile(rmsValues, 0.5);
  const absDeviations = rmsValues.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = getPercentile(absDeviations, 0.5);
  const calculatedGate = median + 3 * mad;
  noiseGate = Math.max(0.0005, Math.min(0.015, calculatedGate));

  updateEngineSettings({ noiseGateRMS: noiseGate });

  isCalibrating = false;
}

export function getCalibrationState(): CalibrationState {
  const progress = calibrationStartTime && isCalibrating
    ? Math.min(100, ((Date.now() - calibrationStartTime) / CALIBRATION_DURATION_MS) * 100)
    : 100;

  const rmsValues = calibrationSamples.map(s => s.rms);
  const mean = rmsValues.length > 0
    ? rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length
    : 0;

  const variance = rmsValues.length > 0
    ? rmsValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rmsValues.length
    : 0;
  const stdDev = Math.sqrt(variance);

  return {
    isCalibrating,
    progress,
    noiseGate,
    meanRMS: mean,
    stdDevRMS: stdDev
  };
}

function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const idx = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * percentile)));
  return values[idx];
}

export function getNoiseGate(): number {
  return noiseGate;
}

export function setNoiseGate(value: number): void {
  noiseGate = value;
  updateEngineSettings({ noiseGateRMS: value });
}

export function isCalibrationActive(): boolean {
  return isCalibrating;
}

export function resetCalibration(): void {
  calibrationSamples.length = 0;
  calibrationStartTime = null;
  isCalibrating = false;
  noiseGate = 0.002;
}
