export type SessionAnalysisStatus =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'complete'
  | 'failed';

export interface PracticeSessionSummary {
  id: number;
  timestamp: string;
  maxSustainSeconds: number;
  avgStability: number;
  tuningAccuracy: number;
  practiceMode: 'free' | 'assisted';
  assistedFollowAccuracy?: number;
}

export interface PracticeTelemetryFrame {
  t: number;
  rms?: number;
  voiced?: boolean;
  pitchDetected?: boolean;
  pitchHz?: number;
  pitchConfidence?: number;
  cents?: number;
  noteName?: string;
  breathiness?: number;
  volumeConsistency?: number;
  rangeLowHz?: number;
  rangeHighHz?: number;
  rangeLowNote?: string;
  rangeHighNote?: string;
  dynamicRangeDb?: number;
  loudnessStdDb?: number;
  sustainSeconds?: number;
  isSustaining?: boolean;
  assistedMode: boolean;
  assistedTargetNote?: string;
  assistedHit?: boolean;
  assistedScale?: string;
  assistedTranspose?: number;
}

export interface PracticeTelemetrySession {
  id: number;
  timestamp: string;
  preset: string;
  practiceMode: 'free' | 'assisted';
  assistedProfile?: 'male' | 'female';
  assistedBpm?: number;
  assistedScale?: string;
  assistedTranspose?: number;
  assistedFollowAccuracy?: number;
  durationSeconds: number;
  voicedRatio: number;
  avgPitchHz: number;
  pitchStdHz: number;
  avgBreathiness: number;
}

export interface RecordingMetadata {
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
}

export interface PracticeSessionPayload {
  id: number;
  timestamp: string;
  preset: string;
  practiceMode: 'free' | 'assisted';
  assistedConfig?: {
    voiceProfile: 'male' | 'female';
    bpm: number;
    exerciseId: string;
    transposeSemitones: number;
  };
  summary: PracticeSessionSummary;
  metrics: PracticeTelemetrySession;
  frames: PracticeTelemetryFrame[];
  recording?: RecordingMetadata;
}

export interface VoiceSessionAnalysisReport {
  summary: string;
  strengths: Array<{
    title: string;
    detail: string;
  }>;
  issues: Array<{
    title: string;
    detail: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  priority_improvements: Array<{
    title: string;
    action: string;
    why: string;
  }>;
  suggested_exercises: Array<{
    name: string;
    reason: string;
    duration_minutes: number;
  }>;
  evidence: Array<{
    timestamp_seconds: number;
    label: string;
    observation: string;
  }>;
  scores: {
    pitch: number;
    breathiness_control: number;
    sustain: number;
    dynamic_control: number;
    follow_accuracy: number;
  };
}

export interface SessionArtifact {
  id: number;
  timestamp: string;
  payload: PracticeSessionPayload;
  recording?: RecordingMetadata & {
    blob?: Blob;
  };
  analysisStatus: SessionAnalysisStatus;
  transcript?: string;
  analysisReport?: VoiceSessionAnalysisReport;
  errorMessage?: string;
  updatedAt: string;
}

export interface SessionArtifactIndexItem {
  id: number;
  timestamp: string;
  practiceMode: 'free' | 'assisted';
  analysisStatus: SessionAnalysisStatus;
  hasAudio: boolean;
  hasReport: boolean;
  reportSummary?: string;
}
