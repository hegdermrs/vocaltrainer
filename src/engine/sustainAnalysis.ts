export interface SustainSettings {
  pitchConfidenceThreshold: number;
  centsTolerance: number;
  minRMSThreshold: number;
}

export interface SustainState {
  currentSeconds: number;
  bestSeconds: number;
  isSustaining: boolean;
  settings: SustainSettings;
}

const DEFAULT_SETTINGS: SustainSettings = {
  pitchConfidenceThreshold: 0.6,
  centsTolerance: 50,
  minRMSThreshold: 0.0025
};

let bestSustainDuration = 0;
let settings: SustainSettings = { ...DEFAULT_SETTINGS };

let lastPitchHz: number | undefined = undefined;
let currentSustainMs = 0;
let offStreakMs = 0;

const START_MIN_MS = 90;
const MAX_GAP_MS = 850;
const START_CONF_MARGIN = 0.05;
const CONTINUE_CONF_MARGIN = 0.2;
const START_CENTS_MARGIN = 10;
const CONTINUE_CENTS_MARGIN = 35;
const START_RMS_MARGIN = 0.9;
const CONTINUE_RMS_MARGIN = 0.35;
const PITCH_DEVIATION_START = 0.08;
const PITCH_DEVIATION_CONTINUE = 0.22;

export function updateSustain(
  pitchConfidence: number | undefined,
  cents: number | undefined,
  rms: number,
  frameDurationMs: number,
  pitchHz: number | undefined
): SustainState {
  const startHasPitch =
    pitchConfidence !== undefined &&
    pitchConfidence >= settings.pitchConfidenceThreshold + START_CONF_MARGIN;
  const continueHasPitch =
    pitchConfidence !== undefined &&
    pitchConfidence >= settings.pitchConfidenceThreshold - CONTINUE_CONF_MARGIN;

  const startInTune =
    cents !== undefined &&
    Math.abs(cents) <= settings.centsTolerance - START_CENTS_MARGIN;
  const continueInTune =
    cents !== undefined &&
    Math.abs(cents) <= settings.centsTolerance + CONTINUE_CENTS_MARGIN;

  const startHasVolume = rms >= settings.minRMSThreshold * START_RMS_MARGIN;
  const continueHasVolume = rms >= settings.minRMSThreshold * CONTINUE_RMS_MARGIN;

  let startPitchStable = true;
  let continuePitchStable = true;
  if (pitchHz !== undefined && lastPitchHz !== undefined && lastPitchHz > 0) {
    const pitchDeviation = Math.abs(pitchHz - lastPitchHz) / lastPitchHz;
    startPitchStable = pitchDeviation < PITCH_DEVIATION_START;
    continuePitchStable = pitchDeviation < PITCH_DEVIATION_CONTINUE;
  }

  const meetsStart = startHasPitch && startInTune && startHasVolume && startPitchStable;
  const meetsContinue =
    continueHasPitch && continueInTune && continueHasVolume && continuePitchStable;

  if (pitchHz !== undefined) {
    lastPitchHz = pitchHz;
  }

  if (currentSustainMs > 0) {
    if (meetsContinue) {
      currentSustainMs += frameDurationMs;
      offStreakMs = 0;
    } else {
      offStreakMs += frameDurationMs;
      if (offStreakMs <= MAX_GAP_MS) {
        // Keep sustain alive during short dropouts.
        currentSustainMs += frameDurationMs;
      } else {
        currentSustainMs = 0;
        offStreakMs = 0;
        lastPitchHz = undefined;
      }
    }
  } else if (meetsStart) {
    currentSustainMs += frameDurationMs;
    offStreakMs = 0;
  } else {
    currentSustainMs = 0;
    offStreakMs = 0;
  }

  const currentSeconds = currentSustainMs / 1000;
  const isSustaining = currentSustainMs >= START_MIN_MS;

  if (isSustaining && currentSeconds > bestSustainDuration) {
    bestSustainDuration = currentSeconds;
  }

  return {
    currentSeconds,
    bestSeconds: bestSustainDuration,
    isSustaining,
    settings: { ...settings }
  };
}

export function setSustainSettings(newSettings: Partial<SustainSettings>): void {
  settings = { ...settings, ...newSettings };
}

export function getSustainSettings(): SustainSettings {
  return { ...settings };
}

export function resetSustainContext(): void {
  bestSustainDuration = 0;
  lastPitchHz = undefined;
  currentSustainMs = 0;
  offStreakMs = 0;
}

export function resetBestSustain(): void {
  bestSustainDuration = 0;
}

