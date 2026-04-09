import {
  PracticeSessionPayload,
  PracticeSessionSummary,
  PracticeTelemetryFrame,
  PracticeTelemetrySession,
  RecordingMetadata,
  SessionArtifact
} from '@/src/analysis/types';
import { AssistedConfig } from '@/src/engine/assistedPractice';

interface FinalizePracticeSessionParams {
  sessionId: number;
  timestamp: string;
  preset: string;
  practiceMode: 'free' | 'assisted';
  assistedConfig?: AssistedConfig;
  summary: PracticeSessionSummary;
  metrics: PracticeTelemetrySession;
  frames: PracticeTelemetryFrame[];
  recording?: RecordingMetadata & { blob?: Blob };
}

const AI_FRAME_LIMIT = 900;
const SESSION_SCHEMA_VERSION = 2;

function roundNumber(value: number | undefined, decimals = 4): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function compactFrame(frame: PracticeTelemetryFrame): PracticeTelemetryFrame {
  return {
    t: Math.max(0, Math.round(frame.t)),
    rms: roundNumber(frame.rms, 5),
    voiced: frame.voiced,
    pitchDetected: frame.pitchDetected,
    pitchHz: roundNumber(frame.pitchHz, 3),
    pitchConfidence: roundNumber(frame.pitchConfidence, 4),
    cents: roundNumber(frame.cents, 2),
    noteName: frame.noteName,
    breathiness: roundNumber(frame.breathiness, 3),
    volumeConsistency: roundNumber(frame.volumeConsistency, 3),
    rangeLowHz: roundNumber(frame.rangeLowHz, 3),
    rangeHighHz: roundNumber(frame.rangeHighHz, 3),
    rangeLowNote: frame.rangeLowNote,
    rangeHighNote: frame.rangeHighNote,
    dynamicRangeDb: roundNumber(frame.dynamicRangeDb, 3),
    loudnessStdDb: roundNumber(frame.loudnessStdDb, 3),
    sustainSeconds: roundNumber(frame.sustainSeconds, 3),
    isSustaining: frame.isSustaining,
    assistedMode: frame.assistedMode,
    assistedTargetNote: frame.assistedTargetNote,
    assistedHit: frame.assistedHit,
    assistedScale: frame.assistedScale,
    assistedTranspose: frame.assistedTranspose
  };
}

function normalizeFrames(frames: PracticeTelemetryFrame[]): PracticeTelemetryFrame[] {
  const normalized: PracticeTelemetryFrame[] = [];
  let previousTime = -1;

  for (const frame of frames) {
    const compact = compactFrame(frame);
    if (compact.t < previousTime) {
      compact.t = previousTime;
    }
    previousTime = compact.t;
    normalized.push(compact);
  }

  return normalized;
}

function isEventFrame(current: PracticeTelemetryFrame, previous: PracticeTelemetryFrame | undefined): boolean {
  if (!previous) return true;

  return (
    current.noteName !== previous.noteName ||
    current.pitchDetected !== previous.pitchDetected ||
    current.isSustaining !== previous.isSustaining ||
    current.assistedTargetNote !== previous.assistedTargetNote ||
    current.assistedHit !== previous.assistedHit ||
    current.voiced !== previous.voiced
  );
}

function limitIndices(indices: number[], maxCount: number): number[] {
  if (indices.length <= maxCount) return indices;
  if (maxCount <= 2) return [indices[0], indices[indices.length - 1]];

  const result: number[] = [indices[0]];
  const interior = indices.slice(1, -1);
  const needed = maxCount - 2;

  for (let i = 0; i < needed; i += 1) {
    const position = Math.floor((i * interior.length) / needed);
    result.push(interior[Math.min(position, interior.length - 1)]);
  }

  result.push(indices[indices.length - 1]);
  return Array.from(new Set(result)).sort((a, b) => a - b);
}

function buildAiFrames(frames: PracticeTelemetryFrame[], maxCount: number): PracticeTelemetryFrame[] {
  if (frames.length <= maxCount) {
    return frames;
  }

  const selected = new Set<number>([0, frames.length - 1]);
  for (let index = 0; index < frames.length; index += 1) {
    if (isEventFrame(frames[index], index > 0 ? frames[index - 1] : undefined)) {
      selected.add(index);
    }
  }

  if (selected.size < maxCount) {
    const evenlyNeeded = maxCount - selected.size;
    for (let i = 0; i < evenlyNeeded; i += 1) {
      const position = Math.floor((i * (frames.length - 1)) / Math.max(1, evenlyNeeded - 1 || 1));
      selected.add(position);
    }
  }

  const sortedIndices = Array.from(selected).sort((a, b) => a - b);
  const limitedIndices = limitIndices(sortedIndices, maxCount);
  return limitedIndices.map((index) => frames[index]);
}

function buildPayload(params: FinalizePracticeSessionParams, frames: PracticeTelemetryFrame[], aiFrameCount: number): PracticeSessionPayload {
  const frameCount = frames.length;
  const voicedFrameCount = frames.filter((frame) => frame.voiced).length;
  const pitchFrameCount = frames.filter((frame) => frame.pitchDetected && typeof frame.pitchHz === 'number').length;
  const recording = params.recording
    ? {
        mimeType: params.recording.mimeType,
        sizeBytes: params.recording.sizeBytes,
        durationSeconds: params.recording.durationSeconds,
        startedAt: params.recording.startedAt,
        stoppedAt: params.recording.stoppedAt
      }
    : undefined;

  return {
    id: params.sessionId,
    timestamp: params.timestamp,
    preset: params.preset,
    practiceMode: params.practiceMode,
    assistedConfig: params.practiceMode === 'assisted' ? params.assistedConfig : undefined,
    summary: params.summary,
    metrics: params.metrics,
    sessionMeta: {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startedAt: params.recording?.startedAt ?? params.timestamp,
      stoppedAt: params.recording?.stoppedAt ?? params.timestamp,
      durationSeconds: params.metrics.durationSeconds,
      frameCount,
      voicedFrameCount,
      pitchFrameCount,
      aiFrameCount
    },
    frames,
    recording
  };
}

function validateArtifact(payload: PracticeSessionPayload, _recording?: RecordingMetadata & { blob?: Blob }): { readyForAnalysis: boolean; issues: string[] } {
  const issues: string[] = [];

  if (payload.frames.length < 12) {
    issues.push('Not enough session data was captured. Please try again.');
  }
  if ((payload.metrics.voicedRatio ?? 0) < 0.03) {
    issues.push('The session contains too little voiced audio for a useful analysis.');
  }

  return {
    readyForAnalysis: issues.length === 0,
    issues
  };
}

export function finalizePracticeSessionArtifact(params: FinalizePracticeSessionParams): SessionArtifact {
  const normalizedFrames = normalizeFrames(params.frames);
  const aiFrames = buildAiFrames(normalizedFrames, AI_FRAME_LIMIT);

  const payload = buildPayload(params, normalizedFrames, aiFrames.length);
  const aiPayload = buildPayload(params, aiFrames, aiFrames.length);
  const validation = validateArtifact(aiPayload, params.recording);

  return {
    id: params.sessionId,
    timestamp: params.timestamp,
    payload,
    aiPayload,
    recording: params.recording,
    analysisStatus: validation.readyForAnalysis ? 'idle' : 'failed',
    validation,
    errorMessage: validation.readyForAnalysis ? undefined : validation.issues.join(' '),
    updatedAt: new Date().toISOString()
  };
}
