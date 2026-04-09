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

  const extension =
    recording.mimeType.includes('mp4')
      ? 'm4a'
      : recording.mimeType.includes('mpeg')
        ? 'mp3'
        : recording.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

  return new File([recording.blob], `session-${artifact.id}.${extension}`, { type: recording.mimeType });
}

function buildN8nRequestBody(artifact: SessionArtifact): FormData {
  const formData = new FormData();
  const audioFile = buildAudioFile(artifact);

  formData.append('audio', audioFile);
  formData.append('session_id', String(artifact.id));
  formData.append('timestamp', artifact.timestamp);
  formData.append('mime_type', audioFile.type);
  formData.append('session_json', JSON.stringify(artifact.payload));

  return formData;
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

      const response = await fetch(getN8nWebhookUrl(), {
        method: 'POST',
        body: buildN8nRequestBody(artifact)
      });

      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(data?.error || 'AI analysis failed.');
      }

      const result = extractReport(data);

      const completedArtifact: SessionArtifact = {
        ...workingArtifact,
        payload: result.normalizedSession ?? artifact.payload,
        transcript: result.transcript,
        analysisReport: result.report,
        analysisStatus: 'complete',
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
