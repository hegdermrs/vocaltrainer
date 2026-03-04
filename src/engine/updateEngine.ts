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
import { addRangeSample, getDynamicRangeStats, resetDynamicRangeContext } from './dynamicRangeAnalysis';

interface UpdateContext {
  pitchHistory: number[];
  volumeHistory: number[];
  displayPitchHistory: number[];
  lastDisplayPitch: number | undefined;
  displayedNoteName: string | undefined;
  pendingNoteName: string | undefined;
  pendingNoteFrames: number;
}

const context: UpdateContext = {
  pitchHistory: [],
  volumeHistory: [],
  displayPitchHistory: [],
  lastDisplayPitch: undefined,
  displayedNoteName: undefined,
  pendingNoteName: undefined,
  pendingNoteFrames: 0
};

const MAX_PITCH_HISTORY = 30;
const MAX_VOLUME_HISTORY = 50;
const MIN_DISPLAY_WINDOW = 5;
const MAX_DISPLAY_WINDOW = 15;
const NOTE_SWITCH_CONFIRM_FRAMES = 4;
const BOUNDARY_CENTS_BLOCK = 50; // quarter-tone tolerance
const EXTRA_CONFIDENCE_FOR_SWITCH = 0.08;

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

    const rawNote = frequencyToNoteNameAndCents(displayPitch);
    const stabilizedNoteName = stabilizeDetectedNote(
      rawNote.noteName,
      rawNote.cents,
      pitch.confidence,
      settings.pitchConfidenceThreshold
    );
    const stabilized = frequencyToNoteNameAndCents(displayPitch);
    if (stabilized.noteName !== stabilizedNoteName) {
      const targetMidi = noteNameToMidi(stabilizedNoteName);
      if (targetMidi !== null) {
        const targetFreq = midiToFrequency(targetMidi);
        stabilized.cents = Math.round(1200 * Math.log2(displayPitch / targetFreq));
      }
      stabilized.noteName = stabilizedNoteName;
    }

    newState.pitchHz = displayPitch;
    newState.noteName = stabilized.noteName;
    newState.cents = stabilized.cents;
    newState.pitchConfidence = pitch.confidence;

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
      newState.rangeLowNote = stabilized.noteName;
    }
    if (!newState.rangeHighHz || displayPitch > newState.rangeHighHz) {
      newState.rangeHighHz = displayPitch;
      newState.rangeHighNote = stabilized.noteName;
    }
  } else {
    context.displayPitchHistory = [];
    context.lastDisplayPitch = undefined;
    context.displayedNoteName = undefined;
    context.pendingNoteName = undefined;
    context.pendingNoteFrames = 0;
    newState.pitchHz = undefined;
    newState.noteName = undefined;
    newState.cents = undefined;
    newState.pitchConfidence = undefined;
    newState.pitchDetected = false;
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
  context.displayedNoteName = undefined;
  context.pendingNoteName = undefined;
  context.pendingNoteFrames = 0;
  resetPitchDetectionContext();
  resetStabilityContext();
  resetVolumeConsistencyContext();
  resetCalibration();
  resetBreathinessContext();
  resetDynamicRangeContext();
  resetSustainContext();
}

function stabilizeDetectedNote(
  nextNoteName: string,
  cents: number,
  confidence: number,
  baseConfidenceThreshold: number
): string {
  const current = context.displayedNoteName;
  if (!current) {
    context.displayedNoteName = nextNoteName;
    context.pendingNoteName = undefined;
    context.pendingNoteFrames = 0;
    return nextNoteName;
  }

  if (nextNoteName === current) {
    context.pendingNoteName = undefined;
    context.pendingNoteFrames = 0;
    return current;
  }

  // Prevent fast toggles near note boundaries and low-confidence transitions.
  if (
    Math.abs(cents) >= BOUNDARY_CENTS_BLOCK ||
    confidence < baseConfidenceThreshold + EXTRA_CONFIDENCE_FOR_SWITCH
  ) {
    context.pendingNoteName = undefined;
    context.pendingNoteFrames = 0;
    return current;
  }

  if (context.pendingNoteName !== nextNoteName) {
    context.pendingNoteName = nextNoteName;
    context.pendingNoteFrames = 1;
    return current;
  }

  context.pendingNoteFrames += 1;
  if (context.pendingNoteFrames < NOTE_SWITCH_CONFIRM_FRAMES) {
    return current;
  }

  context.displayedNoteName = nextNoteName;
  context.pendingNoteName = undefined;
  context.pendingNoteFrames = 0;
  return nextNoteName;
}

function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const letter = match[1];
  const accidental = match[2] || '';
  const octave = Number(match[3]);
  const name = `${letter}${accidental}`;
  const pcMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11
  };
  const pc = pcMap[name];
  if (pc === undefined) return null;
  return (octave + 1) * 12 + pc;
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
