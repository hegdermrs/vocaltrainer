import { updateEngineSettings } from './engineSettings';

interface CalibrationSample {
  rms: number;
  timestamp: number;
}

const CALIBRATION_DURATION_MS = 2000;
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

  const rmsValues = calibrationSamples.map(s => s.rms);
  const mean = rmsValues.reduce((sum, val) => sum + val, 0) / rmsValues.length;

  const variance = rmsValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rmsValues.length;
  const stdDev = Math.sqrt(variance);

  const calculatedGate = mean + 2 * stdDev;
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
