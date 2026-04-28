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
  startedAt?: string;
  stoppedAt?: string;
}

export interface PracticeSessionMeta {
  schemaVersion: number;
  startedAt: string;
  stoppedAt: string;
  durationSeconds: number;
  frameCount: number;
  voicedFrameCount: number;
  pitchFrameCount: number;
  aiFrameCount: number;
}

export interface PracticeSegmentSummary {
  startSeconds: number;
  endSeconds: number;
  label: string;
  voicedRatio: number;
  avgPitchHz?: number;
  avgPitchConfidence?: number;
  avgBreathiness?: number;
  maxSustainSeconds: number;
  followAccuracy?: number;
  keyNotes: string[];
}

export interface PracticeEvidenceMoment {
  timestampSeconds: number;
  label: string;
  observation: string;
  severity: 'low' | 'medium' | 'high';
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
    guideVolume: number;
  };
  summary: PracticeSessionSummary;
  metrics: PracticeTelemetrySession;
  sessionMeta?: PracticeSessionMeta;
  frames: PracticeTelemetryFrame[];
  segmentSummaries?: PracticeSegmentSummary[];
  evidenceMoments?: PracticeEvidenceMoment[];
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
    recommended_lessons?: Array<{
      id: string;
      title: string;
      dropbox_path?: string;
      dropbox_url?: string;
      video_url?: string;
      reason: string;
      duration_minutes?: number | null;
    }>;
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
  aiPayload?: PracticeSessionPayload;
  recording?: RecordingMetadata & {
    blob?: Blob;
  };
  analysisStatus: SessionAnalysisStatus;
  validation?: {
    readyForAnalysis: boolean;
    issues: string[];
  };
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
