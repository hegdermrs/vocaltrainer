'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceAnalyzer } from '@/src/audio/VoiceAnalyzer';
import { EngineState } from '@/src/engine/types';
import { getCalibrationState, startCalibration } from '@/src/engine/calibration';
import { getCurrentPreset, EnginePreset } from '@/src/engine/engineSettings';
import {
  PracticeSessionPayload,
  PracticeTelemetryFrame,
  PracticeTelemetrySession,
  SessionArtifact
} from '@/src/analysis/types';
import { SessionSummary } from '@/src/components/SessionSummaryPanel';
import { AssistedConfig } from '@/src/engine/assistedPractice';
import { finalizePracticeSessionArtifact } from '@/src/analysis/sessionArtifact';

interface UseVoiceSessionOptions {
  practiceMode: 'free' | 'assisted';
  assistedConfig: AssistedConfig;
  applyAssistedState: (state: EngineState, enabled: boolean) => EngineState;
  commitAssistedUi: () => void;
  resetAssistedSession: () => void;
  clearAssistedUi: () => void;
  startGuideIfNeeded: (enabled: boolean, config: AssistedConfig) => Promise<void>;
  stopGuide: () => void;
  persistArtifact: (artifact: SessionArtifact) => Promise<void>;
}

export function useVoiceSession({
  practiceMode,
  assistedConfig,
  applyAssistedState,
  commitAssistedUi,
  resetAssistedSession,
  clearAssistedUi,
  startGuideIfNeeded,
  stopGuide,
  persistArtifact
}: UseVoiceSessionOptions) {
  const [isActive, setIsActive] = useState(false);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState(0);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);
  const [noiseGate, setNoiseGate] = useState(0.005);
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [telemetrySessions, setTelemetrySessions] = useState<PracticeTelemetrySession[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [preset, setPreset] = useState<EnginePreset | 'custom'>(() => getCurrentPreset() ?? 'custom');

  const analyzerRef = useRef<VoiceAnalyzer | null>(null);
  const calibrationCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const calibrationTimer = useRef<NodeJS.Timeout | null>(null);
  const calibrationStartedCapture = useRef(false);
  const stabilitySumRef = useRef(0);
  const stabilityCountRef = useRef(0);
  const inTuneFramesRef = useRef(0);
  const totalPitchFramesRef = useRef(0);
  const maxSustainRef = useRef(0);
  const telemetryFramesRef = useRef<PracticeTelemetryFrame[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const voicedFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const pitchSumRef = useRef(0);
  const pitchSumSqRef = useRef(0);
  const pitchCountRef = useRef(0);
  const breathSumRef = useRef(0);
  const breathCountRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingMetaRef = useRef<{ startedAt: number; mimeType: string } | null>(null);

  useEffect(() => {
    analyzerRef.current = new VoiceAnalyzer();

    const initDevices = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((device) => device.kind === 'audioinput');
          setAudioDevices(inputs);
          setSelectedDeviceId((current) => current || inputs[0]?.deviceId || '');
        }
      } catch {
        // ignore device enumeration failures
      }
    };

    void initDevices();

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('voice-trainer-sessions') : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Array<SessionSummary & { scaleAccuracy?: number }>;
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => ({
              ...item,
              practiceMode: item.practiceMode ?? 'free',
              assistedFollowAccuracy:
                typeof item.assistedFollowAccuracy === 'number'
                  ? item.assistedFollowAccuracy
                  : typeof item.scaleAccuracy === 'number'
                    ? item.scaleAccuracy
                    : 0
            }))
            .filter(
              (item) =>
                typeof item.maxSustainSeconds === 'number' &&
                typeof item.tuningAccuracy === 'number' &&
                typeof item.assistedFollowAccuracy === 'number'
            )
            .sort((a, b) => b.id - a.id);
          setSessionSummaries(normalized);
        }
      }
    } catch {
      // ignore malformed storage
    }

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('voice-trainer-telemetry') : null;
      if (raw) {
        const parsed = JSON.parse(raw) as PracticeTelemetrySession[];
        if (Array.isArray(parsed)) {
          setTelemetrySessions(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }

    return () => {
      analyzerRef.current?.stop();
      stopGuide();
      if (calibrationCheckInterval.current) clearInterval(calibrationCheckInterval.current);
      if (calibrationTimer.current) clearInterval(calibrationTimer.current);
    };
  }, [stopGuide]);

  useEffect(() => {
    if (!analyserNode || !isActive) {
      setInputLevel(0);
      return;
    }

    let animationId = 0;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const updateLevel = () => {
      analyserNode.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const db = 20 * Math.log10(Math.max(rms, 0.00001));
      const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.67));
      setInputLevel(normalizedLevel);
      animationId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isActive]);

  const resetSessionAccumulators = useCallback(() => {
    stabilitySumRef.current = 0;
    stabilityCountRef.current = 0;
    inTuneFramesRef.current = 0;
    totalPitchFramesRef.current = 0;
    maxSustainRef.current = 0;
    telemetryFramesRef.current = [];
    sessionStartRef.current = Date.now();
    voicedFramesRef.current = 0;
    totalFramesRef.current = 0;
    pitchSumRef.current = 0;
    pitchSumSqRef.current = 0;
    pitchCountRef.current = 0;
    breathSumRef.current = 0;
    breathCountRef.current = 0;
    resetAssistedSession();
  }, [resetAssistedSession]);

  const recordTelemetry = useCallback((state: EngineState) => {
    if (!sessionStartRef.current) return;
    telemetryFramesRef.current.push({
      t: Date.now() - sessionStartRef.current,
      rms: state.rms,
      voiced: state.isVoiced,
      pitchDetected: state.pitchDetected,
      pitchHz: state.pitchHz,
      pitchConfidence: state.pitchConfidence,
      cents: state.cents,
      noteName: state.noteName,
      breathiness: state.breathiness,
      volumeConsistency: state.volumeConsistency,
      rangeLowHz: state.rangeLowHz,
      rangeHighHz: state.rangeHighHz,
      rangeLowNote: state.rangeLowNote,
      rangeHighNote: state.rangeHighNote,
      dynamicRangeDb: state.dynamicRangeDb,
      loudnessStdDb: state.loudnessStdDb,
      sustainSeconds: state.sustainSeconds,
      isSustaining: state.isSustaining,
      assistedMode: practiceMode === 'assisted',
      assistedTargetNote: state.assistedTargetNote,
      assistedHit: state.assistedFollowHit,
      assistedScale: practiceMode === 'assisted' ? assistedConfig.exerciseId : undefined,
      assistedTranspose: practiceMode === 'assisted' ? assistedConfig.transposeSemitones : undefined
    });
  }, [assistedConfig, practiceMode]);

  const getSupportedRecordingMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
  }, []);

  const startSessionRecording = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return;
    const stream = analyzerRef.current?.getMediaStream();
    if (!stream) return;

    try {
      const mimeType = getSupportedRecordingMimeType();
      mediaChunksRef.current = [];
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      recordingMetaRef.current = {
        startedAt: Date.now(),
        mimeType: recorder.mimeType || mimeType || 'audio/webm'
      };
    } catch (error) {
      console.warn('MediaRecorder unavailable for this session.', error);
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
      recordingMetaRef.current = null;
    }
  }, [getSupportedRecordingMimeType]);

  const stopSessionRecording = useCallback(async (): Promise<{ blob?: Blob; mimeType: string; durationSeconds: number; startedAt?: string; stoppedAt?: string }> => {
    const recorder = mediaRecorderRef.current;
    const meta = recordingMetaRef.current;
    const finalize = () => {
      const stoppedAtMs = Date.now();
      const durationSeconds = meta ? Math.max(0, (stoppedAtMs - meta.startedAt) / 1000) : 0;
      const mimeType = meta?.mimeType || recorder?.mimeType || 'audio/webm';
      const blob = mediaChunksRef.current.length > 0 ? new Blob(mediaChunksRef.current, { type: mimeType }) : undefined;
      const startedAt = meta ? new Date(meta.startedAt).toISOString() : undefined;
      const stoppedAt = meta ? new Date(stoppedAtMs).toISOString() : undefined;
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
      recordingMetaRef.current = null;
      return { blob, mimeType, durationSeconds, startedAt, stoppedAt };
    };

    if (!recorder || recorder.state === 'inactive') {
      return finalize();
    }

    return new Promise((resolve) => {
      recorder.onstop = () => resolve(finalize());
      recorder.stop();
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (!analyzerRef.current) return;
    resetSessionAccumulators();

    try {
      setCalibrationMessage(null);
      await analyzerRef.current.start((state) => {
        const nextState = applyAssistedState(state, practiceMode === 'assisted');
        setEngineState(nextState);
        commitAssistedUi();
        recordTelemetry(nextState);

        totalFramesRef.current += 1;
        if (nextState.isVoiced) voicedFramesRef.current += 1;
        if (nextState.pitchHz !== undefined) {
          pitchSumRef.current += nextState.pitchHz;
          pitchSumSqRef.current += nextState.pitchHz * nextState.pitchHz;
          pitchCountRef.current += 1;
        }
        if (nextState.breathiness !== undefined) {
          breathSumRef.current += nextState.breathiness;
          breathCountRef.current += 1;
        }
        if (nextState.pitchStability !== undefined) {
          stabilitySumRef.current += nextState.pitchStability;
          stabilityCountRef.current += 1;
        }
        if (nextState.cents !== undefined && nextState.pitchConfidence !== undefined) {
          totalPitchFramesRef.current += 1;
          if (Math.abs(nextState.cents) <= 50) {
            inTuneFramesRef.current += 1;
          }
        }
        if ((nextState.bestSustainSeconds ?? 0) > maxSustainRef.current) {
          maxSustainRef.current = nextState.bestSustainSeconds ?? 0;
        }
      }, selectedDeviceId || undefined);

      startSessionRecording();
      await startGuideIfNeeded(practiceMode === 'assisted', assistedConfig);
      setIsActive(true);
      setAnalyserNode(analyzerRef.current.getAnalyserNode());
    } catch (error) {
      console.error('Failed to start voice analyzer:', error);
      alert('Failed to access microphone. Please grant permission and try again.');
    }
  }, [
    applyAssistedState,
    assistedConfig,
    commitAssistedUi,
    practiceMode,
    recordTelemetry,
    resetSessionAccumulators,
    selectedDeviceId,
    startGuideIfNeeded,
    startSessionRecording
  ]);

  const handleStop = useCallback(async (): Promise<SessionArtifact | null> => {
    if (!analyzerRef.current) return null;

    const recording = await stopSessionRecording();
    analyzerRef.current.stop();
    stopGuide();
    clearAssistedUi();
    setIsActive(false);

    const avgStability = stabilityCountRef.current > 0 ? stabilitySumRef.current / stabilityCountRef.current : 0;
    const tuningAccuracy = totalPitchFramesRef.current > 0 ? inTuneFramesRef.current / totalPitchFramesRef.current : 0;
    const followAccuracy = engineState?.assistedFollowAccuracy ?? 0;
    const sessionStart = sessionStartRef.current ?? Date.now();
    const durationSeconds = Math.max(0, (Date.now() - sessionStart) / 1000);
    const voicedRatio = totalFramesRef.current > 0 ? voicedFramesRef.current / totalFramesRef.current : 0;
    const avgPitchHz = pitchCountRef.current > 0 ? pitchSumRef.current / pitchCountRef.current : 0;
    const pitchVariance = pitchCountRef.current > 0 ? pitchSumSqRef.current / pitchCountRef.current - avgPitchHz * avgPitchHz : 0;
    const pitchStdHz = Math.sqrt(Math.max(0, pitchVariance));
    const avgBreathiness = breathCountRef.current > 0 ? breathSumRef.current / breathCountRef.current : 0;

    const summary: SessionSummary = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      maxSustainSeconds: maxSustainRef.current,
      avgStability,
      tuningAccuracy,
      practiceMode,
      assistedFollowAccuracy: practiceMode === 'assisted' ? followAccuracy : 0
    };
    const nextSessions = [summary, ...sessionSummaries].slice(0, 20);
    setSessionSummaries(nextSessions);

    const telemetrySession: PracticeTelemetrySession = {
      id: summary.id,
      timestamp: summary.timestamp,
      preset,
      practiceMode,
      assistedProfile: practiceMode === 'assisted' ? assistedConfig.voiceProfile : undefined,
      assistedBpm: practiceMode === 'assisted' ? assistedConfig.bpm : undefined,
      assistedScale: practiceMode === 'assisted' ? assistedConfig.exerciseId : undefined,
      assistedTranspose: practiceMode === 'assisted' ? assistedConfig.transposeSemitones : undefined,
      assistedFollowAccuracy: practiceMode === 'assisted' ? followAccuracy : undefined,
      durationSeconds,
      voicedRatio,
      avgPitchHz,
      pitchStdHz,
      avgBreathiness
    };
    const nextTelemetrySessions = [telemetrySession, ...telemetrySessions].slice(0, 50);
    setTelemetrySessions(nextTelemetrySessions);

    const artifact = finalizePracticeSessionArtifact({
      sessionId: summary.id,
      timestamp: summary.timestamp,
      preset: String(preset),
      practiceMode,
      assistedConfig: practiceMode === 'assisted' ? assistedConfig : undefined,
      summary,
      metrics: telemetrySession,
      frames: telemetryFramesRef.current.slice(),
      recording: recording.blob
        ? {
            blob: recording.blob,
            mimeType: recording.mimeType,
            sizeBytes: recording.blob.size,
            durationSeconds: recording.durationSeconds,
            startedAt: recording.startedAt,
            stoppedAt: recording.stoppedAt
          }
        : undefined
    });

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('voice-trainer-sessions', JSON.stringify(nextSessions));
        window.localStorage.setItem('voice-trainer-telemetry', JSON.stringify(nextTelemetrySessions));
      }
      await persistArtifact(artifact);
    } catch {
      // ignore storage failures
    }

    setEngineState(null);
    setAnalyserNode(null);
    setShowCalibration(false);
    setShowSummary(true);
    if (calibrationCheckInterval.current) {
      clearInterval(calibrationCheckInterval.current);
      calibrationCheckInterval.current = null;
    }
    if (calibrationTimer.current) {
      clearInterval(calibrationTimer.current);
      calibrationTimer.current = null;
    }
    resetSessionAccumulators();

    return artifact;
  }, [
    assistedConfig,
    clearAssistedUi,
    engineState,
    persistArtifact,
    practiceMode,
    preset,
    resetSessionAccumulators,
    sessionSummaries,
    stopGuide,
    stopSessionRecording,
    telemetrySessions
  ]);

  const handleCalibrate = useCallback(async () => {
    if (!analyzerRef.current) {
      analyzerRef.current = new VoiceAnalyzer();
    }

    if (!analyzerRef.current.isActive()) {
      calibrationStartedCapture.current = true;
      try {
        await analyzerRef.current.start((state) => {
          setEngineState(state);
        }, selectedDeviceId || undefined);
      } catch (error) {
        console.error('Failed to start voice analyzer:', error);
        alert('Failed to access microphone. Please grant permission and try again.');
        return;
      }
    } else {
      calibrationStartedCapture.current = false;
    }

    setShowCalibration(true);
    setCalibrationMessage('Calibrating... Do not sing or speak.');
    setCalibrationProgress(0);
    setCalibrationSecondsLeft(5);
    startCalibration();

    if (calibrationTimer.current) clearInterval(calibrationTimer.current);
    calibrationTimer.current = setInterval(() => {
      setCalibrationSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    if (calibrationCheckInterval.current) clearInterval(calibrationCheckInterval.current);
    calibrationCheckInterval.current = setInterval(() => {
      const state = getCalibrationState();
      setCalibrationProgress(state.progress);
      setNoiseGate(state.noiseGate);
      if (state.progress >= 100) {
        setShowCalibration(false);
        setCalibrationMessage('Calibration successful');
        if (calibrationCheckInterval.current) {
          clearInterval(calibrationCheckInterval.current);
          calibrationCheckInterval.current = null;
        }
        if (calibrationTimer.current) {
          clearInterval(calibrationTimer.current);
          calibrationTimer.current = null;
        }
        if (!isActive && calibrationStartedCapture.current && analyzerRef.current) {
          analyzerRef.current.stop();
          setEngineState(null);
          setAnalyserNode(null);
          calibrationStartedCapture.current = false;
        }
        setTimeout(() => setCalibrationMessage(null), 2000);
      }
    }, 100);
  }, [isActive, selectedDeviceId]);

  return {
    isActive,
    engineState,
    analyserNode,
    inputLevel,
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    calibrationProgress,
    showCalibration,
    calibrationSecondsLeft,
    calibrationMessage,
    noiseGate,
    sessionSummaries,
    telemetrySessions,
    showSummary,
    setShowSummary,
    preset,
    setPreset,
    handleStart,
    handleStop,
    handleCalibrate
  };
}
