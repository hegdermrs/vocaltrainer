export interface EngineState {
  pitchHz?: number;
  noteName?: string;
  cents?: number;
  pitchConfidence?: number;
  pitchStability?: number;
  vibratoRateHz?: number;
  vibratoDepthCents?: number;
  isVoiced?: boolean;
  pitchDetected?: boolean;
  rms?: number;
  volumeConsistency?: number;
  breathiness?: number;
  breathinessDebug?: {
    rms: number;
    periodicity: number;
    zcr: number;
    rawScore: number;
    smoothedScore: number;
  };
  scaleMatch?: number;
  scaleInKey?: boolean;
  scaleLabel?: string;
  dynamicRangeDb?: number;
  loudnessStdDb?: number;
  rangeLowHz?: number;
  rangeHighHz?: number;
  rangeLowNote?: string;
  rangeHighNote?: string;
  sustainSeconds?: number;
  bestSustainSeconds?: number;
  isSustaining?: boolean;
}

export function createEmptyState(): EngineState {
  return {
    pitchHz: undefined,
    noteName: undefined,
    cents: undefined,
    pitchConfidence: undefined,
    pitchStability: undefined,
    vibratoRateHz: undefined,
    vibratoDepthCents: undefined,
    isVoiced: undefined,
    pitchDetected: undefined,
    rms: undefined,
    volumeConsistency: undefined,
    breathiness: undefined,
    breathinessDebug: undefined,
    scaleMatch: undefined,
    scaleInKey: undefined,
    scaleLabel: undefined,
    rangeLowHz: undefined,
    rangeHighHz: undefined,
    rangeLowNote: undefined,
    rangeHighNote: undefined,
    dynamicRangeDb: undefined,
    loudnessStdDb: undefined,
    sustainSeconds: undefined,
    bestSustainSeconds: 0,
    isSustaining: false
  };
}
