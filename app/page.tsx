'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Play, Square, Mic, MicOff, Timer, Mic2, Send } from 'lucide-react';
import { VoiceAnalyzer } from '@/src/audio/VoiceAnalyzer';
import { EngineState } from '@/src/engine/types';
import { PitchModule } from '@/src/components/modules/PitchModule';
import { DynamicRangeModule } from '@/src/components/modules/DynamicRangeModule';
import { AirflowModule } from '@/src/components/modules/AirflowModule';
import { SustainModule } from '@/src/components/modules/SustainModule';
import { CalibrationBanner } from '@/src/components/CalibrationBanner';
import { DebugPanel } from '@/src/components/DebugPanel';
import { SessionSummaryPanel, SessionSummary } from '@/src/components/SessionSummaryPanel';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';
import { BottomPiano } from '@/src/components/BottomPiano';
import { AssistedPianoRoll } from '@/src/components/AssistedPianoRoll';
import { AssistedGuide } from '@/src/audio/assistedGuide';
import {
  AssistedConfig,
  EXERCISE_OPTIONS,
  DEFAULT_ASSISTED_CONFIG,
  clampBpm,
  clampTranspose,
  evaluateAssistedFollow,
  getExerciseSequence
} from '@/src/engine/assistedPractice';
import { getCalibrationState, startCalibration } from '@/src/engine/calibration';
import {
  getEngineSettings,
  getAvailablePresets,
  applyPreset,
  getCurrentPreset,
  EnginePreset
} from '@/src/engine/engineSettings';

interface TelemetryFrame {
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
  assistedExercise?: string;
  assistedTranspose?: number;
}

interface TelemetrySession {
  id: number;
  timestamp: string;
  preset: string;
  practiceMode: 'free' | 'assisted';
  assistedProfile?: AssistedConfig['voiceProfile'];
  assistedBpm?: number;
  assistedExercise?: string;
  assistedTranspose?: number;
  assistedFollowAccuracy?: number;
  durationSeconds: number;
  voicedRatio: number;
  avgPitchHz: number;
  pitchStdHz: number;
  avgBreathiness: number;
}

const ASSISTED_CONFIG_KEY = 'voice-trainer-assisted-config';

function loadAssistedConfig(): AssistedConfig {
  try {
    if (typeof window === 'undefined') return DEFAULT_ASSISTED_CONFIG;
    const raw = window.localStorage.getItem(ASSISTED_CONFIG_KEY);
    if (!raw) return DEFAULT_ASSISTED_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AssistedConfig>;
    return {
      voiceProfile: parsed.voiceProfile === 'female' ? 'female' : 'male',
      bpm: clampBpm(parsed.bpm ?? DEFAULT_ASSISTED_CONFIG.bpm),
      exerciseId:
        parsed.exerciseId === 'siren' ||
        parsed.exerciseId === 'thirds' ||
        parsed.exerciseId === 'fifths'
          ? parsed.exerciseId
          : 'sustain',
      transposeSemitones: clampTranspose(parsed.transposeSemitones ?? 0)
    };
  } catch {
    return DEFAULT_ASSISTED_CONFIG;
  }
}

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'free' | 'assisted'>('free');
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState(0);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);
  const [noiseGate, setNoiseGate] = useState(0.005);
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const [preset, setPreset] = useState<EnginePreset | 'custom'>(() => getCurrentPreset() ?? 'custom');
  const [telemetrySessions, setTelemetrySessions] = useState<TelemetrySession[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [assistedConfig, setAssistedConfig] = useState<AssistedConfig>(DEFAULT_ASSISTED_CONFIG);
  const [assistedTargetNote, setAssistedTargetNote] = useState<string | undefined>(undefined);
  const [assistedFollowStatus, setAssistedFollowStatus] =
    useState<'on-target' | 'near' | 'off' | 'no-pitch'>('no-pitch');
  const [assistedFollowAccuracy, setAssistedFollowAccuracy] = useState(0);
  const analyzerRef = useRef<VoiceAnalyzer | null>(null);
  const guideRef = useRef<AssistedGuide | null>(null);
  const practiceModeRef = useRef<'free' | 'assisted'>('free');
  const assistedTargetRef = useRef<string | undefined>(undefined);
  const calibrationCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const calibrationTimer = useRef<NodeJS.Timeout | null>(null);
  const calibrationStartedCapture = useRef(false);
  const stabilitySumRef = useRef(0);
  const stabilityCountRef = useRef(0);
  const inTuneFramesRef = useRef(0);
  const totalPitchFramesRef = useRef(0);
  const maxSustainRef = useRef(0);
  const telemetryFramesRef = useRef<TelemetryFrame[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const voicedFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const pitchSumRef = useRef(0);
  const pitchSumSqRef = useRef(0);
  const pitchCountRef = useRef(0);
  const breathSumRef = useRef(0);
  const breathCountRef = useRef(0);
  const assistedEligibleFramesRef = useRef(0);
  const assistedHitFramesRef = useRef(0);

  useEffect(() => {
    practiceModeRef.current = practiceMode;
  }, [practiceMode]);

  useEffect(() => {
    assistedTargetRef.current = assistedTargetNote;
  }, [assistedTargetNote]);

  useEffect(() => {
    analyzerRef.current = new VoiceAnalyzer();
    guideRef.current = new AssistedGuide();
    guideRef.current.setOnTargetChange((state) => {
      setAssistedTargetNote(state.targetNoteName);
    });
    setAssistedConfig(loadAssistedConfig());

    const initDevices = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((d) => d.kind === 'audioinput');
          setAudioDevices(inputs);
          if (!selectedDeviceId && inputs.length > 0) {
            setSelectedDeviceId(inputs[0].deviceId);
          }
        }
      } catch {
        // ignore device enumeration failures
      }
    };
    initDevices();
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('voice-trainer-sessions')
          : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Array<
          SessionSummary & { scaleAccuracy?: number; practiceMode?: 'free' | 'assisted'; assistedFollowAccuracy?: number }
        >;
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((s) => ({
              ...s,
              practiceMode: s.practiceMode ?? 'free',
              assistedFollowAccuracy:
                typeof s.assistedFollowAccuracy === 'number'
                  ? s.assistedFollowAccuracy
                  : typeof s.scaleAccuracy === 'number'
                    ? s.scaleAccuracy
                    : 0
            }))
            .filter(
              (s) =>
                typeof s.maxSustainSeconds === 'number' &&
                typeof s.tuningAccuracy === 'number' &&
                typeof s.assistedFollowAccuracy === 'number'
            )
            .sort((a, b) => b.id - a.id);
          setSessionSummaries(normalized);
        }
      }
    } catch {
      // ignore malformed storage
    }

    try {
      const rawTelemetry =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('voice-trainer-telemetry')
          : null;
      if (rawTelemetry) {
        const parsed = JSON.parse(rawTelemetry) as TelemetrySession[];
        if (Array.isArray(parsed)) {
          setTelemetrySessions(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }

    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.stop();
      }
      if (guideRef.current) {
        guideRef.current.stop();
      }
      if (calibrationCheckInterval.current) {
        clearInterval(calibrationCheckInterval.current);
      }
      if (calibrationTimer.current) {
        clearInterval(calibrationTimer.current);
      }
    };
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!analyserNode || !isActive) {
      setInputLevel(0);
      return;
    }

    let animationId: number;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const updateLevel = () => {
      analyserNode.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
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

  const resetSessionAccumulators = () => {
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
    assistedEligibleFramesRef.current = 0;
    assistedHitFramesRef.current = 0;
    setAssistedFollowStatus('no-pitch');
    setAssistedFollowAccuracy(0);
  };

  const persistAssistedConfig = (config: AssistedConfig) => {
    setAssistedConfig(config);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ASSISTED_CONFIG_KEY, JSON.stringify(config));
      }
    } catch {
      // Ignore storage errors.
    }
  };

  const updateAssistedConfig = (next: AssistedConfig) => {
    const normalized: AssistedConfig = {
      voiceProfile: next.voiceProfile,
      bpm: clampBpm(next.bpm),
      exerciseId: next.exerciseId,
      transposeSemitones: clampTranspose(next.transposeSemitones)
    };
    persistAssistedConfig(normalized);
    if (isActive && practiceModeRef.current === 'assisted' && guideRef.current) {
      guideRef.current.updateConfig(normalized);
    }
  };

  const startSession = async () => {
    if (!analyzerRef.current) return;
    resetSessionAccumulators();

    try {
      setCalibrationMessage(null);
      await analyzerRef.current.start((state) => {
        const settings = getEngineSettings();
        const nextState: EngineState = { ...state };
        if (practiceModeRef.current === 'assisted') {
          nextState.assistedTargetNote = assistedTargetRef.current;
          const follow = evaluateAssistedFollow(
            state.noteName,
            state.pitchHz,
            state.pitchConfidence,
            assistedTargetRef.current,
            settings.pitchConfidenceThreshold,
            settings.centsTolerance
          );
          nextState.assistedFollowHit = follow.hit;
          setAssistedFollowStatus(follow.status);
          if (follow.eligible) {
            assistedEligibleFramesRef.current += 1;
            if (follow.hit) assistedHitFramesRef.current += 1;
          }
          const currentAccuracy =
            assistedEligibleFramesRef.current > 0
              ? assistedHitFramesRef.current / assistedEligibleFramesRef.current
              : 0;
          nextState.assistedFollowAccuracy = currentAccuracy;
          setAssistedFollowAccuracy(currentAccuracy);
        } else {
          nextState.assistedTargetNote = undefined;
          nextState.assistedFollowHit = undefined;
          nextState.assistedFollowAccuracy = undefined;
        }

        setEngineState(nextState);
        recordTelemetry(nextState);

        totalFramesRef.current += 1;
        if (nextState.isVoiced) {
          voicedFramesRef.current += 1;
        }
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
          const isInTune = Math.abs(nextState.cents) <= 50;
          if (isInTune) {
            inTuneFramesRef.current += 1;
          }
        }

        if (nextState.bestSustainSeconds !== undefined) {
          if (nextState.bestSustainSeconds > maxSustainRef.current) {
            maxSustainRef.current = nextState.bestSustainSeconds;
          }
        }
      }, selectedDeviceId || undefined);

      if (practiceModeRef.current === 'assisted' && guideRef.current) {
        await guideRef.current.start(assistedConfig);
      }
      setIsActive(true);
      setAnalyserNode(analyzerRef.current.getAnalyserNode());
    } catch (error) {
      console.error('Failed to start voice analyzer:', error);
      alert('Failed to access microphone. Please grant permission and try again.');
    }
  };

  const handleStart = async () => {
    practiceModeRef.current = practiceMode;
    updateAssistedConfig(assistedConfig);
    await startSession();
  };

  const handleStop = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      if (guideRef.current) {
        guideRef.current.stop();
      }
      setAssistedTargetNote(undefined);
      setAssistedFollowStatus('no-pitch');
      setIsActive(false);
      const stabilitySamples = stabilityCountRef.current;
      const avgStability =
        stabilitySamples > 0 ? stabilitySumRef.current / stabilitySamples : 0;
      const tuningFrames = totalPitchFramesRef.current;
      const tuningAccuracy =
        tuningFrames > 0 ? inTuneFramesRef.current / tuningFrames : 0;
      const followAccuracy =
        assistedEligibleFramesRef.current > 0
          ? assistedHitFramesRef.current / assistedEligibleFramesRef.current
          : 0;
      const sessionStart = sessionStartRef.current ?? Date.now();
      const durationSeconds = Math.max(0, (Date.now() - sessionStart) / 1000);
      const voicedRatio =
        totalFramesRef.current > 0 ? voicedFramesRef.current / totalFramesRef.current : 0;
      const avgPitchHz =
        pitchCountRef.current > 0 ? pitchSumRef.current / pitchCountRef.current : 0;
      const pitchVariance =
        pitchCountRef.current > 0
          ? pitchSumSqRef.current / pitchCountRef.current - avgPitchHz * avgPitchHz
          : 0;
      const pitchStdHz = Math.sqrt(Math.max(0, pitchVariance));
      const avgBreathiness =
        breathCountRef.current > 0 ? breathSumRef.current / breathCountRef.current : 0;

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

      const telemetrySession = {
        id: summary.id,
        timestamp: summary.timestamp,
        preset,
        practiceMode,
        assistedProfile: practiceMode === 'assisted' ? assistedConfig.voiceProfile : undefined,
        assistedBpm: practiceMode === 'assisted' ? assistedConfig.bpm : undefined,
        assistedExercise: practiceMode === 'assisted' ? assistedConfig.exerciseId : undefined,
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
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'voice-trainer-sessions',
            JSON.stringify(nextSessions)
          );
          window.localStorage.setItem(
            'voice-trainer-telemetry',
            JSON.stringify(nextTelemetrySessions)
          );
          window.localStorage.setItem(
            `voice-trainer-telemetry-${summary.id}`,
            JSON.stringify({
              id: summary.id,
              timestamp: summary.timestamp,
              preset,
              practiceMode,
              assistedConfig: practiceMode === 'assisted' ? assistedConfig : undefined,
              frames: telemetryFramesRef.current
            })
          );
        }
      } catch {
        // ignore storage failures
      }

      resetSessionAccumulators();
      setEngineState(null);
      setAnalyserNode(null);
      setShowCalibration(false);
      if (calibrationCheckInterval.current) {
        clearInterval(calibrationCheckInterval.current);
        calibrationCheckInterval.current = null;
      }
      if (calibrationTimer.current) {
        clearInterval(calibrationTimer.current);
        calibrationTimer.current = null;
      }
    }
  };

  const handleSendTelemetry = (sessionId: number | 'latest') => {
    if (typeof window === 'undefined') return;
    let targetId: number | undefined;
    if (sessionId === 'latest') {
      try {
        const rawIndex = window.localStorage.getItem('voice-trainer-telemetry');
        if (rawIndex) {
          const parsed = JSON.parse(rawIndex) as TelemetrySession[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            targetId = parsed[0].id;
          }
        }
      } catch {
        // ignore parse failure and fall back to state
      }
      if (!targetId) {
        targetId = telemetrySessions[0]?.id;
      }
    } else {
      targetId = sessionId;
    }
    if (!targetId) {
      alert('No telemetry session available.');
      return;
    }
    const raw = window.localStorage.getItem(`voice-trainer-telemetry-${targetId}`);
    if (!raw) {
      alert('Telemetry data not found for that session.');
      return;
    }
    // Placeholder for future AI upload
    window.localStorage.setItem('voice-trainer-last-ai-payload', raw);
    alert('Telemetry payload prepared (stored locally).');
  };

  const handleStopAndSend = () => {
    handleStop();
    setTimeout(() => {
      handleSendTelemetry('latest');
    }, 50);
  };

  const handleCalibrate = async () => {
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

    if (calibrationTimer.current) {
      clearInterval(calibrationTimer.current);
    }
    calibrationTimer.current = setInterval(() => {
      setCalibrationSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);

    if (calibrationCheckInterval.current) {
      clearInterval(calibrationCheckInterval.current);
    }
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
        }
        setTimeout(() => setCalibrationMessage(null), 2000);
      }
    }, 50);
  };

  const recordTelemetry = (state: EngineState) => {
    telemetryFramesRef.current.push({
      t: Date.now(),
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
      assistedMode: practiceModeRef.current === 'assisted',
      assistedTargetNote: state.assistedTargetNote,
      assistedHit: state.assistedFollowHit,
      assistedExercise: practiceModeRef.current === 'assisted' ? assistedConfig.exerciseId : undefined,
      assistedTranspose: practiceModeRef.current === 'assisted' ? assistedConfig.transposeSemitones : undefined
    });
  };

  const assistedSequence = getExerciseSequence(assistedConfig);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 pb-36">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <div className="flex flex-col gap-4 md:gap-2">
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                Voice Trainer
              </h1>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <span className="text-xs text-muted-foreground">Preset</span>
                  <select
                    className="h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                    value={preset}
                    onChange={(e) => {
                      const value = e.target.value as EnginePreset | 'custom';
                      if (value === 'custom') {
                        setPreset('custom');
                        return;
                      }
                      applyPreset(value);
                      setPreset(value);
                    }}
                  >
                    <option value="custom">Custom</option>
                    {getAvailablePresets().map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-center gap-2 md:justify-end">
                  <div className="text-[11px] text-slate-600">
                    <span className="font-medium">Mic</span>{' '}
                    <span
                      className={
                        inputLevel >= 70
                          ? 'text-red-600'
                          : inputLevel >= 40
                            ? 'text-amber-600'
                            : inputLevel > 0
                              ? 'text-green-600'
                              : 'text-slate-400'
                      }
                    >
                      {inputLevel.toFixed(0)}%
                    </span>
                  </div>
                  <select
                    className="h-7 max-w-[160px] rounded border border-slate-200 bg-white px-2 text-[11px]"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                  >
                    {audioDevices.length === 0 && <option value="">Default mic</option>}
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || 'Microphone'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-lg text-slate-600">Real-time voice analysis and training tool</p>
          </div>

          <div className="mb-8 flex flex-col items-center gap-4">
            {!isActive && (
              <button
                className="relative h-10 w-40 rounded-full bg-slate-200 transition"
                onClick={() => setPracticeMode(practiceMode === 'assisted' ? 'free' : 'assisted')}
                aria-label="Toggle practice mode"
              >
                <span
                  className={`absolute top-1 h-8 w-20 rounded-full bg-white shadow transition-all ${
                    practiceMode === 'assisted' ? 'left-1' : 'left-[80px]'
                  }`}
                />
                <span className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-slate-600">
                  <span className={practiceMode === 'assisted' ? 'text-slate-900' : ''}>Assisted</span>
                  <span className={practiceMode === 'free' ? 'text-slate-900' : ''}>Free</span>
                </span>
              </button>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isActive ? (
                <Button size="lg" onClick={handleStart} className="gap-3 px-12 py-8 text-2xl">
                  <Play className="h-7 w-7" />
                  {practiceMode === 'assisted' ? 'Start Assisted Practice' : 'Start Free Practice'}
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="destructive" onClick={handleStop} className="gap-3 px-10 py-7 text-xl">
                    <Square className="h-6 w-6" />
                    Stop Session
                  </Button>
                  <Button size="lg" onClick={handleStopAndSend} className="gap-3 px-10 py-7 text-xl">
                    <Send className="h-6 w-6" />
                    Stop and Send to AI
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isActive ? (
                <>
                  <Mic className="h-5 w-5 animate-pulse text-green-600" />
                  <Badge variant="default" className="bg-green-600">
                    Recording ({practiceMode === 'assisted' ? 'Assisted' : 'Free'})
                  </Badge>
                </>
              ) : (
                <>
                  <MicOff className="h-5 w-5 text-slate-400" />
                  <Badge variant="secondary">Inactive</Badge>
                  <Button size="sm" variant="outline" onClick={handleCalibrate} className="ml-2 gap-2">
                    <Timer className="h-4 w-4" />
                    Calibrate (5s)
                  </Button>
                </>
              )}
            </div>

            {practiceMode === 'assisted' && (
              <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="mb-1 font-semibold text-slate-800">Assisted Practice</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">Voice Profile</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={assistedConfig.voiceProfile === 'male' ? 'default' : 'outline'}
                        onClick={() => updateAssistedConfig({ ...assistedConfig, voiceProfile: 'male' })}
                      >
                        Male
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={assistedConfig.voiceProfile === 'female' ? 'default' : 'outline'}
                        onClick={() => updateAssistedConfig({ ...assistedConfig, voiceProfile: 'female' })}
                      >
                        Female
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">Exercise</div>
                    <select
                      className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm"
                      value={assistedConfig.exerciseId}
                      onChange={(e) =>
                        updateAssistedConfig({
                          ...assistedConfig,
                          exerciseId: e.target.value as AssistedConfig['exerciseId']
                        })
                      }
                    >
                      {EXERCISE_OPTIONS.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Tempo (BPM)</span>
                      <span>{assistedConfig.bpm}</span>
                    </div>
                    <Slider
                      min={30}
                      max={244}
                      step={1}
                      value={[assistedConfig.bpm]}
                      onValueChange={(values) =>
                        updateAssistedConfig({ ...assistedConfig, bpm: clampBpm(values[0]) })
                      }
                    />
                    <Input
                      className="h-8 w-24"
                      type="number"
                      min={30}
                      max={244}
                      value={assistedConfig.bpm}
                      onChange={(e) =>
                        updateAssistedConfig({ ...assistedConfig, bpm: clampBpm(Number(e.target.value)) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Transpose</span>
                      <span>{assistedConfig.transposeSemitones > 0 ? '+' : ''}{assistedConfig.transposeSemitones}</span>
                    </div>
                    <Slider
                      min={-12}
                      max={12}
                      step={1}
                      value={[assistedConfig.transposeSemitones]}
                      onValueChange={(values) =>
                        updateAssistedConfig({
                          ...assistedConfig,
                          transposeSemitones: clampTranspose(values[0])
                        })
                      }
                    />
                    <div className="text-xs text-slate-500">Guide: {assistedSequence.label}</div>
                  </div>
                </div>
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="mb-1 font-medium text-slate-700">
                    Guide {isActive && practiceMode === 'assisted' ? 'running' : 'stopped'}
                  </div>
                  {assistedSequence.notes.join(' - ')}
                </div>
              </div>
            )}
          </div>

          {(showCalibration || calibrationMessage) && (
            <div className="mx-auto mb-6 max-w-2xl">
              {showCalibration ? (
                <CalibrationBanner progress={calibrationProgress} secondsLeft={calibrationSecondsLeft} />
              ) : (
                <div className="text-center text-sm text-slate-600">{calibrationMessage}</div>
              )}
            </div>
          )}

          {isActive && !showCalibration && (
            <div className="mx-auto mb-6 max-w-2xl">
              <DebugPanel currentRMS={engineState?.rms ?? 0} noiseGate={noiseGate} />
            </div>
          )}

          {isActive && practiceMode === 'assisted' && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  Target: <span className="font-semibold">{assistedTargetNote ?? '-'}</span>
                </div>
                <div>
                  You (detected): <span className="font-semibold text-orange-600">{engineState?.noteName ?? '-'}</span>
                </div>
                <div>
                  BPM: <span className="font-semibold">{assistedConfig.bpm}</span>
                </div>
                <div>
                  Follow: <span className="font-semibold">{Math.round(assistedFollowAccuracy * 100)}%</span>
                </div>
                <div>
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      assistedFollowStatus === 'on-target'
                        ? 'text-green-600'
                        : assistedFollowStatus === 'near'
                          ? 'text-amber-600'
                          : assistedFollowStatus === 'off'
                            ? 'text-red-600'
                            : 'text-slate-500'
                    }`}
                  >
                    {assistedFollowStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <PitchModule state={engineState} />
            <DynamicRangeModule state={engineState} />
            <AirflowModule state={engineState} />
            <SustainModule state={engineState} />
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic2 className="h-5 w-5" />
                  <div className="text-lg font-semibold">Vocal Range</div>
                </div>
                <InfoTooltip text="Tracks your lowest and highest notes in this session. Wider range indicates flexibility." />
              </div>
              <div className="mb-4 text-xs text-slate-500">Lowest and highest notes in this session</div>
              <div className="text-center text-6xl font-bold tracking-tight text-slate-800">
                {engineState?.rangeLowNote ?? '-'}
                <span className="mx-2 text-slate-400">to</span>
                {engineState?.rangeHighNote ?? '-'}
              </div>
              <div className="mt-2 text-center text-sm text-slate-500">
                {engineState?.rangeLowHz ? `${engineState.rangeLowHz.toFixed(1)} Hz` : '-'} to{' '}
                {engineState?.rangeHighHz ? `${engineState.rangeHighHz.toFixed(1)} Hz` : '-'}
              </div>
            </div>
          </div>

          {practiceMode === 'assisted' && (
            <div className="mb-6">
              <AssistedPianoRoll
                isActive={isActive}
                targetNoteName={assistedTargetNote}
                detectedNoteName={engineState?.noteName}
              />
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-center">
              <button
                className="rounded border border-slate-200 bg-white px-3 py-2 text-xs transition hover:bg-slate-50"
                onClick={() => setShowSummary((prev) => !prev)}
              >
                {showSummary ? 'Hide Session Summary' : 'Show Session Summary'}
              </button>
            </div>
            {showSummary && (
              <div className="mt-4">
                <SessionSummaryPanel sessions={sessionSummaries} />
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomPiano
        noteName={engineState?.noteName}
        targetNoteName={assistedTargetNote}
        playDetectedAudio={practiceMode !== 'assisted'}
      />
    </div>
  );
}
