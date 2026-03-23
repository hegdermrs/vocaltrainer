'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionArtifact, listSessionArtifacts, saveSessionArtifact } from '@/src/analysis/storage';
import { SessionArtifact, SessionArtifactIndexItem, SessionAnalysisStatus } from '@/src/analysis/types';

function cacheReportInSessionStorage(artifact: SessionArtifact) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`voice-trainer-report-${artifact.id}`, JSON.stringify(artifact));
  } catch {
    // Ignore sessionStorage failures and fall back to IndexedDB only.
  }
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
    if (!artifact.recording?.blob) {
      alert('This session does not have a saved audio recording to upload. Please record a new session and try again.');
      return;
    }

    setAnalysisBusyId(targetId);
    try {
      let workingArtifact: SessionArtifact = {
        ...artifact,
        analysisStatus: 'uploading',
        errorMessage: undefined,
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(workingArtifact);

      const formData = new FormData();
      const fileName = `session-${artifact.id}.${artifact.recording.mimeType.includes('mp4') ? 'm4a' : 'webm'}`;
      const audioFile = new File([artifact.recording.blob], fileName, { type: artifact.recording.mimeType });
      formData.append('audio', audioFile);
      formData.append('session_json', JSON.stringify(artifact.payload));

      workingArtifact = {
        ...workingArtifact,
        analysisStatus: nextStatus(workingArtifact.analysisStatus),
        updatedAt: new Date().toISOString()
      };
      await persistArtifact(workingArtifact);

      const response = await fetch('/api/analyze-session', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
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
        ...artifact,
        payload: data.normalizedSession ?? artifact.payload,
        transcript: data.transcript,
        analysisReport: data.report,
        analysisStatus: 'complete',
        recording: artifact.recording
          ? {
              ...artifact.recording,
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
        ...artifact,
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
