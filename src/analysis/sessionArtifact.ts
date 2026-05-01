import {
  PracticeEvidenceMoment,
  PracticeKeyAnalysis,
  PracticeKeyContext,
  PracticeKeyMoment,
  PracticeSegmentSummary,
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
  keyContext?: PracticeKeyContext;
  assistedConfig?: AssistedConfig;
  summary: PracticeSessionSummary;
  metrics: PracticeTelemetrySession;
  frames: PracticeTelemetryFrame[];
  recording?: RecordingMetadata & { blob?: Blob };
}

const AI_FRAME_LIMIT = 120;
const SEGMENT_TARGET_COUNT = 24;
const MIN_SEGMENT_MS = 15000;
const EVIDENCE_LIMIT = 14;
const SESSION_SCHEMA_VERSION = 2;
const KEY_ANALYSIS_CONFIDENCE_THRESHOLD = 0.75;
const KEY_MOMENT_LIMIT = 10;
const NOTE_PITCH_CLASS: Record<string, number> = {
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
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

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
    inKey: frame.inKey,
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

function noteNameToPitchClass(noteName: string | undefined): number | null {
  if (!noteName) return null;
  const match = noteName.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const [, note, accidental] = match;
  return NOTE_PITCH_CLASS[`${note}${accidental}`] ?? null;
}

function getAllowedPitchClasses(keyContext: PracticeKeyContext | undefined): Set<number> | null {
  if (!keyContext?.enabled) return null;
  const rootPitchClass = NOTE_PITCH_CLASS[keyContext.root];
  if (rootPitchClass === undefined) return null;
  const intervals = keyContext.scale === 'minor' ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  return new Set(intervals.map((interval) => (rootPitchClass + interval) % 12));
}

function annotateFramesWithKeyContext(
  frames: PracticeTelemetryFrame[],
  keyContext: PracticeKeyContext | undefined
): PracticeTelemetryFrame[] {
  const allowedPitchClasses = getAllowedPitchClasses(keyContext);
  if (!allowedPitchClasses) return frames;

  return frames.map((frame) => {
    const pitchClass = noteNameToPitchClass(frame.noteName);
    const isConfidentPitchFrame =
      frame.pitchDetected &&
      typeof frame.noteName === 'string' &&
      typeof frame.pitchConfidence === 'number' &&
      frame.pitchConfidence >= KEY_ANALYSIS_CONFIDENCE_THRESHOLD;

    return {
      ...frame,
      inKey: isConfidentPitchFrame && pitchClass !== null ? allowedPitchClasses.has(pitchClass) : undefined
    };
  });
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

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topNotes(frames: PracticeTelemetryFrame[]): string[] {
  const counts = new Map<string, number>();
  for (const frame of frames) {
    if (!frame.noteName) continue;
    counts.set(frame.noteName, (counts.get(frame.noteName) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([note]) => note);
}

function topNotesFromFrames(frames: PracticeTelemetryFrame[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const frame of frames) {
    if (!frame.noteName) continue;
    counts.set(frame.noteName, (counts.get(frame.noteName) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([note]) => note);
}

function buildKeyAnalysis(
  frames: PracticeTelemetryFrame[],
  keyContext: PracticeKeyContext | undefined
): PracticeKeyAnalysis | undefined {
  if (!keyContext?.enabled) return undefined;

  const analyzableFrames = frames.filter(
    (frame) =>
      frame.pitchDetected &&
      typeof frame.noteName === 'string' &&
      typeof frame.pitchConfidence === 'number' &&
      frame.pitchConfidence >= KEY_ANALYSIS_CONFIDENCE_THRESHOLD
  );

  if (!analyzableFrames.length) {
    return {
      inKeyRatio: 0,
      outOfKeyFrameCount: 0,
      mostCommonInKeyNotes: [],
      mostCommonOutOfKeyNotes: [],
      outOfKeyMoments: []
    };
  }

  const inKeyFrames = analyzableFrames.filter((frame) => frame.inKey === true);
  const outOfKeyFrames = analyzableFrames.filter((frame) => frame.inKey === false);

  const outOfKeyMoments: PracticeKeyMoment[] = [];
  for (const frame of outOfKeyFrames) {
    const timestampSeconds = roundNumber(frame.t / 1000, 2) ?? 0;
    const isNearExisting = outOfKeyMoments.some((moment) => Math.abs(moment.timestampSeconds - timestampSeconds) < 8);
    if (isNearExisting) continue;
    outOfKeyMoments.push({
      timestampSeconds,
      noteName: frame.noteName ?? 'Unknown note',
      reason: `Outside selected ${keyContext.root} ${keyContext.scale} key`
    });
    if (outOfKeyMoments.length >= KEY_MOMENT_LIMIT) break;
  }

  return {
    inKeyRatio: roundNumber(inKeyFrames.length / analyzableFrames.length, 3) ?? 0,
    outOfKeyFrameCount: outOfKeyFrames.length,
    mostCommonInKeyNotes: topNotesFromFrames(inKeyFrames),
    mostCommonOutOfKeyNotes: topNotesFromFrames(outOfKeyFrames),
    outOfKeyMoments
  };
}

function formatSegmentLabel(startSeconds: number, endSeconds: number): string {
  return `${startSeconds.toFixed(0)}s-${endSeconds.toFixed(0)}s`;
}

function buildSegmentSummaries(frames: PracticeTelemetryFrame[], durationSeconds: number): PracticeSegmentSummary[] {
  if (!frames.length || durationSeconds <= 0) return [];

  const durationMs = durationSeconds * 1000;
  const segmentMs = Math.max(MIN_SEGMENT_MS, Math.ceil(durationMs / SEGMENT_TARGET_COUNT));
  const segments: PracticeSegmentSummary[] = [];

  for (let startMs = 0; startMs < durationMs; startMs += segmentMs) {
    const endMs = Math.min(durationMs, startMs + segmentMs);
    const segmentFrames = frames.filter((frame) => frame.t >= startMs && frame.t < endMs);
    if (!segmentFrames.length) continue;

    const voicedFrames = segmentFrames.filter((frame) => frame.voiced);
    const pitchFrames = segmentFrames.filter((frame) => frame.pitchDetected && typeof frame.pitchHz === 'number');
    const confidenceValues = pitchFrames
      .map((frame) => frame.pitchConfidence)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const pitchValues = pitchFrames
      .map((frame) => frame.pitchHz)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const breathinessValues = segmentFrames
      .map((frame) => frame.breathiness)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const maxSustainSeconds = Math.max(
      0,
      ...segmentFrames
        .map((frame) => frame.sustainSeconds)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    );
    const assistedEligible = segmentFrames.filter((frame) => typeof frame.assistedHit === 'boolean');
    const assistedHits = assistedEligible.filter((frame) => frame.assistedHit).length;

    segments.push({
      startSeconds: roundNumber(startMs / 1000, 2) ?? 0,
      endSeconds: roundNumber(endMs / 1000, 2) ?? 0,
      label: formatSegmentLabel(startMs / 1000, endMs / 1000),
      voicedRatio: roundNumber(voicedFrames.length / segmentFrames.length, 3) ?? 0,
      avgPitchHz: roundNumber(average(pitchValues), 2),
      avgPitchConfidence: roundNumber(average(confidenceValues), 3),
      avgBreathiness: roundNumber(average(breathinessValues), 3),
      maxSustainSeconds: roundNumber(maxSustainSeconds, 3) ?? 0,
      followAccuracy:
        assistedEligible.length > 0 ? roundNumber(assistedHits / assistedEligible.length, 3) : undefined,
      keyNotes: topNotes(segmentFrames)
    });
  }

  return segments;
}

function buildEvidenceMoments(
  frames: PracticeTelemetryFrame[],
  durationSeconds: number,
  practiceMode: 'free' | 'assisted'
): PracticeEvidenceMoment[] {
  if (!frames.length) return [];

  const candidates: Array<PracticeEvidenceMoment & { score: number }> = [];
  const voicedFrames = frames.filter((frame) => frame.voiced);
  const sustainFrames = frames.filter((frame) => (frame.sustainSeconds ?? 0) >= 1.5);
  const breathyFrames = frames.filter((frame) => (frame.breathiness ?? 0) >= 0.18);
  const unstableFrames = frames.filter((frame) => Math.abs(frame.cents ?? 0) >= 35);
  const confidentFrames = frames.filter((frame) => (frame.pitchConfidence ?? 0) >= 0.85 && frame.pitchDetected);
  const missedAssistedFrames =
    practiceMode === 'assisted'
      ? frames.filter((frame) => frame.assistedHit === false && frame.assistedTargetNote)
      : [];

  const addCandidate = (
    frame: PracticeTelemetryFrame | undefined,
    label: string,
    observation: string,
    severity: 'low' | 'medium' | 'high',
    score: number
  ) => {
    if (!frame) return;
    const timestampSeconds = roundNumber(frame.t / 1000, 2) ?? 0;
    candidates.push({ timestampSeconds, label, observation, severity, score });
  };

  const bestSustainFrame = sustainFrames.sort((a, b) => (b.sustainSeconds ?? 0) - (a.sustainSeconds ?? 0))[0];
  addCandidate(
    bestSustainFrame,
    'Longest held note',
    'A strong sustained note happened here. This is a useful reference point for breath support and steadiness.',
    'low',
    (bestSustainFrame?.sustainSeconds ?? 0) * 10
  );

  const breathiestFrame = breathyFrames.sort((a, b) => (b.breathiness ?? 0) - (a.breathiness ?? 0))[0];
  addCandidate(
    breathiestFrame,
    'Airier tone moment',
    'Your tone sounded more airy here. This is a good spot to review for cleaner breath control.',
    'medium',
    (breathiestFrame?.breathiness ?? 0) * 100
  );

  const leastStableFrame = unstableFrames.sort((a, b) => Math.abs(b.cents ?? 0) - Math.abs(a.cents ?? 0))[0];
  addCandidate(
    leastStableFrame,
    'Pitch drift',
    'This moment shows more pitch movement than usual, so it is useful for pitch-matching practice.',
    'medium',
    Math.abs(leastStableFrame?.cents ?? 0)
  );

  const clearestPitchFrame = confidentFrames.sort((a, b) => (b.pitchConfidence ?? 0) - (a.pitchConfidence ?? 0))[0];
  addCandidate(
    clearestPitchFrame,
    'Clear note lock',
    'The app had a very confident pitch lock here, which often means the note was clearer and more settled.',
    'low',
    (clearestPitchFrame?.pitchConfidence ?? 0) * 100
  );

  const firstVoiceFrame = voicedFrames[0];
  addCandidate(
    firstVoiceFrame,
    'Early voice entry',
    'This is one of the first clear singing moments in the session and helps show how the voice settled in.',
    'low',
    durationSeconds - (firstVoiceFrame?.t ?? 0) / 1000
  );

  const assistedMissFrame = missedAssistedFrames.sort((a, b) => (b.pitchConfidence ?? 0) - (a.pitchConfidence ?? 0))[0];
  addCandidate(
    assistedMissFrame,
    'Guide mismatch',
    'The guided target and your sung note separated here, making it a helpful follow-accuracy checkpoint.',
    'medium',
    (assistedMissFrame?.pitchConfidence ?? 0) * 100
  );

  const deduped: PracticeEvidenceMoment[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const closeToExisting = deduped.some((moment) => Math.abs(moment.timestampSeconds - candidate.timestampSeconds) < 8);
    if (closeToExisting) continue;
    deduped.push({
      timestampSeconds: candidate.timestampSeconds,
      label: candidate.label,
      observation: candidate.observation,
      severity: candidate.severity
    });
    if (deduped.length >= EVIDENCE_LIMIT) break;
  }

  return deduped.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

function buildPayload(
  params: FinalizePracticeSessionParams,
  frames: PracticeTelemetryFrame[],
  aiFrameCount: number,
  options?: {
    segmentSummaries?: PracticeSegmentSummary[];
    evidenceMoments?: PracticeEvidenceMoment[];
    keyAnalysis?: PracticeKeyAnalysis;
  }
): PracticeSessionPayload {
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
    keyContext: params.practiceMode === 'free' ? params.keyContext : undefined,
    keyAnalysis: params.practiceMode === 'free' ? options?.keyAnalysis : undefined,
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
    segmentSummaries: options?.segmentSummaries,
    evidenceMoments: options?.evidenceMoments,
    recording
  };
}

function validateArtifact(payload: PracticeSessionPayload): { readyForAnalysis: boolean; issues: string[] } {
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
  const normalizedFrames = annotateFramesWithKeyContext(normalizeFrames(params.frames), params.keyContext);
  const aiFrames = buildAiFrames(normalizedFrames, AI_FRAME_LIMIT);
  const segmentSummaries = buildSegmentSummaries(normalizedFrames, params.metrics.durationSeconds);
  const evidenceMoments = buildEvidenceMoments(normalizedFrames, params.metrics.durationSeconds, params.practiceMode);
  const keyAnalysis = buildKeyAnalysis(normalizedFrames, params.keyContext);

  const payload = buildPayload(params, normalizedFrames, aiFrames.length, {
    keyAnalysis
  });
  const aiPayload = buildPayload(params, aiFrames, aiFrames.length, {
    segmentSummaries,
    evidenceMoments,
    keyAnalysis
  });
  const validation = validateArtifact(aiPayload);

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
