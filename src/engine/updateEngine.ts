import { EngineState, createEmptyState } from './types';
import { detectPitch, resetPitchDetectionContext, frequencyToNoteNameAndCents } from './pitchDetection';
import {
  addPitchForStability,
  calculatePitchStability,
  resetStabilityContext,
  calculateVibratoMetrics
} from './stabilityAnalysis';
import { addVolumeForConsistency, calculateVolumeConsistency, resetVolumeConsistencyContext } from './volumeAnalysis';
import { preprocessFrame } from './framePreprocessing';
import { addCalibrationSample, getNoiseGate, isCalibrationActive, resetCalibration } from './calibration';
import { calculateBreathiness, getBreathinessDebug, resetBreathinessContext } from './breathinessAnalysis';
import { updateSustain, resetSustainContext } from './sustainAnalysis';
import { getEngineSettings } from './engineSettings';
import { addScaleSample, getScaleDefinition, getScaleMatch, isNoteInScale, resetScaleContext } from './scaleAnalysis';
import { addRangeSample, getDynamicRangeStats, resetDynamicRangeContext } from './dynamicRangeAnalysis';

interface UpdateContext {
  pitchHistory: number[];
  volumeHistory: number[];
  displayPitchHistory: number[];
  lastDisplayPitch: number | undefined;
}

const context: UpdateContext = {
  pitchHistory: [],
  volumeHistory: [],
  displayPitchHistory: [],
  lastDisplayPitch: undefined
};

const MAX_PITCH_HISTORY = 30;
const MAX_VOLUME_HISTORY = 50;
const MIN_DISPLAY_WINDOW = 5;
const MAX_DISPLAY_WINDOW = 15;

export function updateEngine(
  frame: Float32Array,
  sampleRate: number,
  previousState: EngineState = createEmptyState(),
  analyserNode: AnalyserNode | null = null
): EngineState {
  const settings = getEngineSettings();
  const newState: EngineState = { ...previousState };

  const rms = calculateRMS(frame);
  newState.rms = rms;

  if (isCalibrationActive()) {
    addCalibrationSample(rms);
  }

  const noiseGate = isCalibrationActive() ? getNoiseGate() : settings.noiseGateRMS;
  const preprocessed = preprocessFrame(frame, noiseGate);
  newState.isVoiced = preprocessed.isVoiced;

  let pitch = null;
  if (settings.modules.pitch && preprocessed.isVoiced) {
    pitch = detectPitch(preprocessed.normalized, sampleRate, settings.smoothingAmount);
  }

  if (pitch && pitch.confidence >= settings.pitchConfidenceThreshold) {
    newState.pitchDetected = true;
    const displayWindow = getDisplayWindow(settings.smoothingAmount);
    context.displayPitchHistory.push(pitch.frequency);
    if (context.displayPitchHistory.length > displayWindow) {
      context.displayPitchHistory.shift();
    }

    let displayPitch: number;
    if (context.displayPitchHistory.length >= Math.min(5, displayWindow)) {
      const sorted = [...context.displayPitchHistory].sort((a, b) => a - b);
      displayPitch = sorted[Math.floor(sorted.length / 2)];
    } else {
      displayPitch = pitch.frequency;
    }

    if (context.lastDisplayPitch !== undefined) {
      const alpha = getDisplayAlpha(settings.smoothingAmount);
      displayPitch = alpha * displayPitch + (1 - alpha) * context.lastDisplayPitch;
    }
    context.lastDisplayPitch = displayPitch;

    const { noteName, cents } = frequencyToNoteNameAndCents(displayPitch);

    newState.pitchHz = displayPitch;
    newState.noteName = noteName;
    newState.cents = cents;
    newState.pitchConfidence = pitch.confidence;

    const scaleDef = getScaleDefinition(settings.scaleId);
    if (scaleDef) {
      const inScale = isNoteInScale(noteName, settings.scaleId);
      addScaleSample(inScale);
      newState.scaleMatch = getScaleMatch();
      newState.scaleInKey = inScale;
      newState.scaleLabel = scaleDef.label;
    }

    context.pitchHistory.push(displayPitch);
    if (context.pitchHistory.length > MAX_PITCH_HISTORY) {
      context.pitchHistory.shift();
    }

    if (settings.modules.stability) {
      addPitchForStability(displayPitch, pitch.confidence);
      newState.pitchStability = calculatePitchStability();
    }

    if (!newState.rangeLowHz || displayPitch < newState.rangeLowHz) {
      newState.rangeLowHz = displayPitch;
      newState.rangeLowNote = noteName;
    }
    if (!newState.rangeHighHz || displayPitch > newState.rangeHighHz) {
      newState.rangeHighHz = displayPitch;
      newState.rangeHighNote = noteName;
    }
  } else {
    context.displayPitchHistory = [];
    context.lastDisplayPitch = undefined;
    newState.pitchHz = undefined;
    newState.noteName = undefined;
    newState.cents = undefined;
    newState.pitchConfidence = undefined;
    newState.pitchDetected = false;
    newState.scaleInKey = undefined;
  }

  if (settings.modules.sustain) {
    const frameDurationMs = (frame.length / sampleRate) * 1000;
    const sustainState = updateSustain(
      newState.pitchConfidence,
      newState.cents,
      rms,
      frameDurationMs,
      newState.pitchHz
    );

    newState.sustainSeconds = sustainState.currentSeconds;
    newState.isSustaining = sustainState.isSustaining;
    newState.bestSustainSeconds = sustainState.bestSeconds;
  }

  if (settings.modules.volume) {
    context.volumeHistory.push(rms);
    if (context.volumeHistory.length > MAX_VOLUME_HISTORY) {
      context.volumeHistory.shift();
    }

    addVolumeForConsistency(rms);
    newState.volumeConsistency = calculateVolumeConsistency();
    addRangeSample(rms, newState.isVoiced ?? false);
    const rangeStats = getDynamicRangeStats();
    newState.dynamicRangeDb = rangeStats?.dynamicRangeDb;
    newState.loudnessStdDb = rangeStats?.loudnessStdDb;
  }

  if (settings.modules.breathiness) {
    newState.breathiness = calculateBreathiness(frame, sampleRate);
    newState.breathinessDebug = getBreathinessDebug();
  }

  if (settings.modules.stability) {
    const vibrato = calculateVibratoMetrics();
    newState.vibratoRateHz = vibrato?.rateHz;
    newState.vibratoDepthCents = vibrato?.depthCents;
  } else {
    newState.vibratoRateHz = undefined;
    newState.vibratoDepthCents = undefined;
  }

  return newState;
}

function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function getDisplayWindow(smoothingAmount: number): number {
  const amount = clamp(smoothingAmount, 0, 1);
  const window = Math.round(MIN_DISPLAY_WINDOW + amount * (MAX_DISPLAY_WINDOW - MIN_DISPLAY_WINDOW));
  return window % 2 === 0 ? window + 1 : window;
}

function getDisplayAlpha(smoothingAmount: number): number {
  const amount = clamp(smoothingAmount, 0, 1);
  return 0.9 - amount * 0.5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resetEngineContext(): void {
  context.pitchHistory = [];
  context.volumeHistory = [];
  context.displayPitchHistory = [];
  context.lastDisplayPitch = undefined;
  resetPitchDetectionContext();
  resetStabilityContext();
  resetVolumeConsistencyContext();
  resetCalibration();
  resetBreathinessContext();
  resetScaleContext();
  resetDynamicRangeContext();
  resetSustainContext();
}
