'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionArtifact, listSessionArtifacts, saveSessionArtifact } from '@/src/analysis/storage';
import { SessionArtifact, SessionArtifactIndexItem, SessionAnalysisStatus, VoiceSessionAnalysisReport } from '@/src/analysis/types';

function cacheReportInSessionStorage(artifact: SessionArtifact) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`voice-trainer-report-${artifact.id}`, JSON.stringify(artifact));
  } catch {
    // Ignore sessionStorage failures and fall back to IndexedDB only.
  }
}

async function parseJsonResponse(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error('The server returned an empty response (status ' + response.status + (response.statusText ? ' ' + response.statusText : '') + ').');
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`The server returned invalid JSON. Response preview: ${raw.slice(0, 200)}`);
  }
}

function normalizeAudioMimeType(mimeType: string): string {
  const normalized = mimeType.split(';')[0]?.trim();
  return normalized || 'audio/webm';
}

function getN8nWebhookUrl(): string {
  const url = process.env.NEXT_PUBLIC_N8N_ANALYZE_WEBHOOK_URL;
  if (!url) {
    throw new Error('AI analysis webhook is not configured yet. Add NEXT_PUBLIC_N8N_ANALYZE_WEBHOOK_URL.');
  }

  return url;
}

function buildAudioFile(artifact: SessionArtifact): File {
  const recording = artifact.recording;
  if (!recording?.blob) {
    throw new Error('This session does not have a saved audio recording to upload. Please record a new session and try again.');
  }

  const normalizedMimeType = normalizeAudioMimeType(recording.mimeType);

  const extension =
    normalizedMimeType.includes('mp4')
      ? 'm4a'
      : normalizedMimeType.includes('mpeg')
        ? 'mp3'
        : normalizedMimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

  return new File([recording.blob], `session-${artifact.id}.${extension}`, { type: normalizedMimeType });
}

function buildMinimalSessionPayload(artifact: SessionArtifact): string {
  return JSON.stringify({
    id: artifact.id,
    timestamp: artifact.timestamp,
    practiceMode: artifact.payload.practiceMode,
    summary: artifact.payload.summary,
    metrics: artifact.payload.metrics,
    frames: []
  });
}

function buildSyntheticAudioFile(artifact: SessionArtifact): File {
  return new File([new Blob(['test audio'], { type: 'audio/webm' })], `session-${artifact.id}.webm`, { type: 'audio/webm' });
}

function buildAnalysisRequestBody(artifact: SessionArtifact): { formData: FormData; audioFile: File; sessionJson: string } {
  const formData = new FormData();
  const audioFile = buildSyntheticAudioFile(artifact);
  const sessionJson = buildMinimalSessionPayload(artifact);

  formData.append('audio', audioFile);
  formData.append('session_id', String(artifact.id));
  formData.append('timestamp', artifact.timestamp);
  formData.append('mime_type', normalizeAudioMimeType(audioFile.type));
  formData.append('session_json', sessionJson);

  return { formData, audioFile, sessionJson };
}

function nextStatus(current: SessionAnalysisStatus): SessionAnalysisStatus {
  switch (current) {
    case 'uploading':
      return 'analyzing';
    default:
      return current;
  }
}

function extractReport(data: any): {
  transcript?: string;
  report: VoiceSessionAnalysisReport;
  normalizedSession?: SessionArtifact['payload'];
} {
  const report = data?.report ?? data?.analysisReport ?? data?.analysis_report;
  if (!report) {
    throw new Error('The analysis webhook did not return a report.');
  }

  return {
    transcript: data?.transcript ?? data?.transcription ?? undefined,
    report,
    normalizedSession: data?.normalizedSession ?? data?.normalized_session ?? undefined
  };
}

export function useSessionAnalysis() {
  const router = useRouter();
  const [analysisArtifacts, setAnalysisArtifacts] = useState<SessionArtifactIndexItem[]>([]);
  const [analysisBusyId, setAnalysisBusyId] = useState<number | null>(null);

  const refreshArtifacts = useCallback(async () => {
    try {
      const items = await listSessionArtifacts();
      setAnalysisArtifacts(items);
    } catch {
      // ignore browser storage failures
    }
  }, []);

  useEffect(() => {
    void refreshArtifacts();
  }, [refreshArtifacts]);

  const persistArtifact = useCallback(async (artifact: SessionArtifact) => {
    try {
      await saveSessionArtifact(artifact);
      await refreshArtifacts();
    } catch {
      cacheReportInSessionStorage(artifact);
    }
  }, [refreshArtifacts]);

  const openAnalysisReport = useCallback((sessionId: number) => {
    router.push(`/analysis/${sessionId}`);
  }, [router]);

  const recentAnalysisArtifacts = useMemo(() => analysisArtifacts.slice(0, 6), [analysisArtifacts]);

  const runAnalysisForSession = useCallback(async (sessionId: number | 'latest') => {
    const targetId = sessionId === 'latest' ? analysisArtifacts[0]?.id : sessionId;
    if (!targetId) {
      alert('No recorded session is available to analyze yet.');
      return;
    }

    const artifact = await getSessionArtifact(targetId);
    if (!artifact) {
      alert('We could not find the saved session payload for that recording.');
      return;
    }
    if (artifact.analysisReport) {
      openAnalysisReport(targetId);
      return;
    }
    if (artifact.validation && !artifact.validation.readyForAnalysis) {
      alert(artifact.validation.issues.join(' '));
      return;
    }
    if (!artifact.recording?.blob) {
      alert('This session does not have a saved audio recording to upload. Please record a new session and try again.');
      return;
    }

    setAnalysisBusyId(targetId);
    let workingArtifact: SessionArtifact = {
      ...artifact,
      analysisStatus: 'uploading',
      errorMessage: undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      await persistArtifact(workingArtifact);

      workingArtifact = {
        ...workingArtifact,
        analysisStatus: nextStatus(workingArtifact.analysisStatus),
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(workingArtifact);

      const requestBody = buildAnalysisRequestBody(artifact);
      console.log('[AI upload debug]', {
        sessionId: artifact.id,
        audioSizeBytes: requestBody.audioFile.size,
        audioMimeType: requestBody.audioFile.type,
        sessionJsonLength: requestBody.sessionJson.length,
        rawFrameCount: artifact.payload.frames.length,
        aiFrameCount: artifact.aiPayload?.frames.length ?? artifact.payload.frames.length,
        minimalMode: true,
        syntheticAudioMode: true,
        validation: artifact.validation
      });

      const response = await fetch(getN8nWebhookUrl(), {
        method: 'POST',
        body: requestBody.formData
      });

      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(data?.error || 'AI analysis failed.');
      }

      const result = extractReport(data);

      const normalizedPayload = result.normalizedSession ?? artifact.aiPayload ?? artifact.payload;
      const completedArtifact: SessionArtifact = {
        ...workingArtifact,
        payload: artifact.payload,
        aiPayload: normalizedPayload,
        transcript: result.transcript,
        analysisReport: result.report,
        analysisStatus: 'complete',
        validation: { readyForAnalysis: true, issues: [] },
        recording: workingArtifact.recording
          ? {
              ...workingArtifact.recording,
              blob: undefined
            }
          : undefined,
        errorMessage: undefined,
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(completedArtifact);
      cacheReportInSessionStorage(completedArtifact);
      openAnalysisReport(targetId);
    } catch (error) {
      await persistArtifact({
        ...workingArtifact,
        analysisStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'AI analysis failed.',
        updatedAt: new Date().toISOString()
      });
      alert(error instanceof Error ? error.message : 'AI analysis failed.');
    } finally {
      setAnalysisBusyId(null);
    }
  }, [analysisArtifacts, openAnalysisReport, persistArtifact]);

  return {
    analysisArtifacts,
    analysisBusyId,
    recentAnalysisArtifacts,
    persistArtifact,
    runAnalysisForSession,
    openAnalysisReport
  };
}
