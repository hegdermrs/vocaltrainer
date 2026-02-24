export interface EngineState {
  pitchHz?: number;
  noteName?: string;
  cents?: number;
  pitchConfidence?: number;
  pitchStability?: number;
  vibratoRateHz?: number;
  vibratoDepthCents?: number;
  rms?: number;
  volumeConsistency?: number;
  breathiness?: number;
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
    rms: undefined,
    volumeConsistency: undefined,
    breathiness: undefined,
    sustainSeconds: undefined,
    bestSustainSeconds: 0,
    isSustaining: false
  };
}
