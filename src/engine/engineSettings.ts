export interface EngineSettings {
  noiseGateRMS: number;
  pitchConfidenceThreshold: number;
  centsTolerance: number;
  smoothingAmount: number;
  scaleId: string;
  modules: {
    pitch: boolean;
    stability: boolean;
    volume: boolean;
    breathiness: boolean;
    sustain: boolean;
  };
}

export type EnginePreset = 'quiet' | 'noisy' | 'whisper' | 'belting' | 'iphone';

const PRESETS: Record<EnginePreset, Partial<EngineSettings>> = {
  quiet: {
    noiseGateRMS: 0.0015,
    pitchConfidenceThreshold: 0.5,
    centsTolerance: 50,
    smoothingAmount: 0.3
  },
  noisy: {
    noiseGateRMS: 0.0035,
    pitchConfidenceThreshold: 0.6,
    centsTolerance: 50,
    smoothingAmount: 0.5
  },
  whisper: {
    noiseGateRMS: 0.001,
    pitchConfidenceThreshold: 0.55,
    centsTolerance: 50,
    smoothingAmount: 0.4
  },
  belting: {
    noiseGateRMS: 0.0025,
    pitchConfidenceThreshold: 0.5,
    centsTolerance: 50,
    smoothingAmount: 0.25
  },
  iphone: {
    noiseGateRMS: 0.003,
    pitchConfidenceThreshold: 0.55,
    centsTolerance: 50,
    smoothingAmount: 0.5
  }
};

const DEFAULT_SETTINGS: EngineSettings = {
  noiseGateRMS: 0.002,
  pitchConfidenceThreshold: 0.5,
  centsTolerance: 50,
  smoothingAmount: 0.3,
  scaleId: 'c_major',
  modules: {
    pitch: true,
    stability: true,
    volume: true,
    breathiness: true,
    sustain: true
  }
};

let settings: EngineSettings = { ...DEFAULT_SETTINGS, modules: { ...DEFAULT_SETTINGS.modules } };
let currentPreset: EnginePreset | null = null;

export function getEngineSettings(): EngineSettings {
  return {
    ...settings,
    modules: { ...settings.modules }
  };
}

export function updateEngineSettings(newSettings: Partial<EngineSettings>): void {
  settings = {
    ...settings,
    ...newSettings,
    modules: newSettings.modules ? { ...settings.modules, ...newSettings.modules } : settings.modules
  };
  currentPreset = null;
}

export function resetEngineSettings(): void {
  settings = { ...DEFAULT_SETTINGS, modules: { ...DEFAULT_SETTINGS.modules } };
  currentPreset = null;
}

export function isModuleEnabled(module: keyof EngineSettings['modules']): boolean {
  return settings.modules[module];
}

export function applyPreset(preset: EnginePreset): void {
  const presetValues = PRESETS[preset];
  settings = {
    ...settings,
    ...presetValues,
    modules: { ...settings.modules }
  };
  currentPreset = preset;
}

export function getCurrentPreset(): EnginePreset | null {
  return currentPreset;
}

export function getAvailablePresets(): { id: EnginePreset; label: string }[] {
  return [
    { id: 'quiet', label: 'Quiet room' },
    { id: 'noisy', label: 'Noisy room' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'belting', label: 'Belting' },
    { id: 'iphone', label: 'iPhone mic' }
  ];
}
