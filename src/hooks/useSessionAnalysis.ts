'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionArtifact, listSessionArtifacts, saveSessionArtifact } from '@/src/analysis/storage';
import { SessionArtifact, SessionArtifactIndexItem, SessionAnalysisStatus } from '@/src/analysis/types';
import { getSupabaseBrowserBucket, getSupabaseBrowserClient } from '@/src/lib/supabaseBrowser';

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

function buildStoragePath(sessionId: number, mimeType: string): string {
  const extension =
    mimeType.includes('mp4')
      ? 'm4a'
      : mimeType.includes('mpeg')
        ? 'mp3'
        : mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

  return `practice-sessions/${sessionId}/${Date.now()}.${extension}`;
}

async function uploadRecordingToSupabase(artifact: SessionArtifact): Promise<{ bucket: string; path: string; uploadedAt: string; }> {
  const recording = artifact.recording;
  if (!recording?.blob) {
    throw new Error('This session does not have a saved audio recording to upload. Please record a new session and try again.');
  }

  const supabase = getSupabaseBrowserClient();
  const bucket = getSupabaseBrowserBucket();
  const path = buildStoragePath(artifact.id, recording.mimeType);
  const file = new File([recording.blob], path.split('/').pop() || `session-${artifact.id}.webm`, { type: recording.mimeType });

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: recording.mimeType,
    upsert: false
  });

  if (error) {
    throw new Error(error.message || 'Audio upload failed.');
  }

  return {
    bucket,
    path,
    uploadedAt: new Date().toISOString()
  };
}

function nextStatus(current: SessionAnalysisStatus): SessionAnalysisStatus {
  switch (current) {
    case 'uploading':
      return 'transcribing';
    case 'transcribing':
      return 'analyzing';
    default:
      return current;
  }
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
    if (!artifact.recording?.blob && !artifact.recording?.storagePath) {
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

      if (!workingArtifact.recording?.storagePath) {
        const uploaded = await uploadRecordingToSupabase(workingArtifact);
        workingArtifact = {
          ...workingArtifact,
          recording: workingArtifact.recording
            ? {
                ...workingArtifact.recording,
                storageBucket: uploaded.bucket,
                storagePath: uploaded.path,
                uploadedAt: uploaded.uploadedAt
              }
            : workingArtifact.recording,
          updatedAt: new Date().toISOString()
        };
        await persistArtifact(workingArtifact);
      }

      workingArtifact = {
        ...workingArtifact,
        analysisStatus: nextStatus(workingArtifact.analysisStatus),
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(workingArtifact);

      const response = await fetch('/api/analyze-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_json: artifact.payload,
          storage_bucket: workingArtifact.recording?.storageBucket,
          storage_path: workingArtifact.recording?.storagePath,
          mime_type: artifact.recording?.mimeType
        })
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new Error(data?.error || 'AI analysis failed.');
      }

      workingArtifact = {
        ...workingArtifact,
        analysisStatus: nextStatus(workingArtifact.analysisStatus),
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(workingArtifact);

      const completedArtifact: SessionArtifact = {
        ...workingArtifact,
        payload: data.normalizedSession ?? artifact.payload,
        transcript: data.transcript,
        analysisReport: data.report,
        analysisStatus: 'complete',
        recording: workingArtifact.recording
          ? {
              ...workingArtifact.recording,
              blob: undefined,
              storageBucket: undefined,
              storagePath: undefined,
              uploadedAt: undefined
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
