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
import { calculateBreathiness, resetBreathinessContext } from './breathinessAnalysis';
import { updateSustain, resetSustainContext } from './sustainAnalysis';
import { getEngineSettings } from './engineSettings';

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
const DISPLAY_PITCH_SMOOTHING = 10;

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

  let pitch = null;
  if (settings.modules.pitch && preprocessed.isVoiced) {
    pitch = detectPitch(preprocessed.normalized, sampleRate);
  }

  if (pitch && pitch.confidence >= settings.pitchConfidenceThreshold) {
    context.displayPitchHistory.push(pitch.frequency);
    if (context.displayPitchHistory.length > DISPLAY_PITCH_SMOOTHING) {
      context.displayPitchHistory.shift();
    }

    let displayPitch: number;
    if (context.displayPitchHistory.length >= 5) {
      const sorted = [...context.displayPitchHistory].sort((a, b) => a - b);
      displayPitch = sorted[Math.floor(sorted.length / 2)];
    } else {
      displayPitch = pitch.frequency;
    }

    if (context.lastDisplayPitch !== undefined) {
      const alpha = 0.7;
      displayPitch = alpha * displayPitch + (1 - alpha) * context.lastDisplayPitch;
    }
    context.lastDisplayPitch = displayPitch;

    const { noteName, cents } = frequencyToNoteNameAndCents(displayPitch);

    newState.pitchHz = displayPitch;
    newState.noteName = noteName;
    newState.cents = cents;
    newState.pitchConfidence = pitch.confidence;

    context.pitchHistory.push(displayPitch);
    if (context.pitchHistory.length > MAX_PITCH_HISTORY) {
      context.pitchHistory.shift();
    }

    if (settings.modules.stability) {
      addPitchForStability(displayPitch, pitch.confidence);
      newState.pitchStability = calculatePitchStability();
    }
  } else {
    context.displayPitchHistory = [];
    context.lastDisplayPitch = undefined;
    newState.pitchHz = undefined;
    newState.noteName = undefined;
    newState.cents = undefined;
    newState.pitchConfidence = undefined;
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
  }

  if (settings.modules.breathiness) {
    newState.breathiness = calculateBreathiness(analyserNode, sampleRate);
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
  resetSustainContext();
}
