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
  centsTolerance: 25,
  minRMSThreshold: 0.005
};

let sustainStartTime: number | null = null;
let bestSustainDuration = 0;
let settings: SustainSettings = { ...DEFAULT_SETTINGS };

let lastPitchHz: number | undefined = undefined;
const PITCH_DEVIATION_TOLERANCE = 0.08;
let framesSinceStart = 0;

export function updateSustain(
  pitchConfidence: number | undefined,
  cents: number | undefined,
  rms: number,
  frameDurationMs: number,
  pitchHz: number | undefined
): SustainState {
  const hasPitch = pitchConfidence !== undefined && pitchConfidence >= settings.pitchConfidenceThreshold;
  const isInTune = cents !== undefined && Math.abs(cents) <= settings.centsTolerance;
  const hasVolume = rms >= settings.minRMSThreshold;

  let isPitchStable = true;
  if (pitchHz !== undefined && lastPitchHz !== undefined) {
    const pitchDeviation = Math.abs(pitchHz - lastPitchHz) / lastPitchHz;
    isPitchStable = pitchDeviation < PITCH_DEVIATION_TOLERANCE;
  }

  const meetsConditions = hasPitch && isInTune && hasVolume;

  let currentSeconds = 0;
  let isSustaining = false;

  if (meetsConditions) {
    if (sustainStartTime === null) {
      sustainStartTime = Date.now();
      framesSinceStart = 0;
    } else {
      framesSinceStart++;
    }

    const elapsed = (Date.now() - sustainStartTime) / 1000;

    if (framesSinceStart >= 3 && elapsed >= 0.1) {
      currentSeconds = elapsed;
      isSustaining = true;

      if (currentSeconds > bestSustainDuration) {
        bestSustainDuration = currentSeconds;
      }
    }

    if (pitchHz !== undefined) {
      lastPitchHz = pitchHz;
    }
  } else {
    sustainStartTime = null;
    currentSeconds = 0;
    isSustaining = false;
    lastPitchHz = undefined;
    framesSinceStart = 0;
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
  sustainStartTime = null;
  bestSustainDuration = 0;
  lastPitchHz = undefined;
  framesSinceStart = 0;
}

export function resetBestSustain(): void {
  bestSustainDuration = 0;
}
