'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, MicOff, Timer, Mic2 } from 'lucide-react';
import { VoiceAnalyzer } from '@/src/audio/VoiceAnalyzer';
import { EngineState } from '@/src/engine/types';
import { PitchModule } from '@/src/components/modules/PitchModule';
import { DynamicRangeModule } from '@/src/components/modules/DynamicRangeModule';
import { AirflowModule } from '@/src/components/modules/AirflowModule';
import { SustainModule } from '@/src/components/modules/SustainModule';
import { ScaleModule } from '@/src/components/modules/ScaleModule';
import { CalibrationBanner } from '@/src/components/CalibrationBanner';
import { DebugPanel } from '@/src/components/DebugPanel';
import { SessionSummaryPanel, SessionSummary } from '@/src/components/SessionSummaryPanel';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';
import { BottomPiano } from '@/src/components/BottomPiano';
import { getCalibrationState, startCalibration } from '@/src/engine/calibration';
import {
  getEngineSettings,
  updateEngineSettings,
  getAvailablePresets,
  applyPreset,
  getCurrentPreset,
  EnginePreset
} from '@/src/engine/engineSettings';
import { COMMON_SCALES, getScaleDefinition } from '@/src/engine/scaleAnalysis';

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
  scaleInKey?: boolean;
  scaleMatch?: number;
  rangeLowHz?: number;
  rangeHighHz?: number;
  rangeLowNote?: string;
  rangeHighNote?: string;
  dynamicRangeDb?: number;
  loudnessStdDb?: number;
  sustainSeconds?: number;
  isSustaining?: boolean;
}

interface TelemetrySession {
  id: number;
  timestamp: string;
  preset: string;
  scaleId: string;
  durationSeconds: number;
  voicedRatio: number;
  avgPitchHz: number;
  pitchStdHz: number;
  avgBreathiness: number;
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
  const [viewMode, setViewMode] = useState<'detailed' | 'simple'>('detailed');
  const [preset, setPreset] = useState<EnginePreset | 'custom'>(() => getCurrentPreset() ?? 'custom');
  const [scaleId, setScaleId] = useState(() => getEngineSettings().scaleId);
  const [telemetrySessions, setTelemetrySessions] = useState<TelemetrySession[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const analyzerRef = useRef<VoiceAnalyzer | null>(null);
  const calibrationCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const calibrationTimer = useRef<NodeJS.Timeout | null>(null);
  const calibrationStartedCapture = useRef(false);
  const stabilitySumRef = useRef(0);
  const stabilityCountRef = useRef(0);
  const inTuneFramesRef = useRef(0);
  const totalPitchFramesRef = useRef(0);
  const maxSustainRef = useRef(0);
  const inScaleFramesRef = useRef(0);
  const totalScaleFramesRef = useRef(0);
  const telemetryFramesRef = useRef<TelemetryFrame[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const voicedFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const pitchSumRef = useRef(0);
  const pitchSumSqRef = useRef(0);
  const pitchCountRef = useRef(0);
  const breathSumRef = useRef(0);
  const breathCountRef = useRef(0);

  useEffect(() => {
    analyzerRef.current = new VoiceAnalyzer();
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
        const parsed = JSON.parse(raw) as SessionSummary[];
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((s) => ({
            ...s,
            scaleAccuracy: typeof s.scaleAccuracy === 'number' ? s.scaleAccuracy : 0
          }));
          setSessionSummaries(
            normalized
              .filter(
                (s) =>
                  typeof s.maxSustainSeconds === 'number' &&
                  typeof s.tuningAccuracy === 'number' &&
                  typeof s.scaleAccuracy === 'number'
              )
              .sort((a, b) => b.id - a.id)
          );
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
    inScaleFramesRef.current = 0;
    totalScaleFramesRef.current = 0;
    telemetryFramesRef.current = [];
    sessionStartRef.current = Date.now();
    voicedFramesRef.current = 0;
    totalFramesRef.current = 0;
    pitchSumRef.current = 0;
    pitchSumSqRef.current = 0;
    pitchCountRef.current = 0;
    breathSumRef.current = 0;
    breathCountRef.current = 0;
  };

  const handleStart = async () => {
    if (!analyzerRef.current) return;

    resetSessionAccumulators();

    try {
      setCalibrationMessage(null);
      await analyzerRef.current.start((state) => {
        setEngineState(state);
        recordTelemetry(state);

        totalFramesRef.current += 1;
        if (state.isVoiced) {
          voicedFramesRef.current += 1;
        }
        if (state.pitchHz !== undefined) {
          pitchSumRef.current += state.pitchHz;
          pitchSumSqRef.current += state.pitchHz * state.pitchHz;
          pitchCountRef.current += 1;
        }
        if (state.breathiness !== undefined) {
          breathSumRef.current += state.breathiness;
          breathCountRef.current += 1;
        }

        if (state.pitchStability !== undefined) {
          stabilitySumRef.current += state.pitchStability;
          stabilityCountRef.current += 1;
        }

        if (state.cents !== undefined && state.pitchConfidence !== undefined) {
          totalPitchFramesRef.current += 1;
          const isInTune = Math.abs(state.cents) <= 50;
          if (isInTune) {
            inTuneFramesRef.current += 1;
          }
        }

        if (state.scaleInKey !== undefined) {
          totalScaleFramesRef.current += 1;
          if (state.scaleInKey) {
            inScaleFramesRef.current += 1;
          }
        }

        if (state.bestSustainSeconds !== undefined) {
          if (state.bestSustainSeconds > maxSustainRef.current) {
            maxSustainRef.current = state.bestSustainSeconds;
          }
        }
      }, selectedDeviceId || undefined);
      setIsActive(true);
      setAnalyserNode(analyzerRef.current.getAnalyserNode());
    } catch (error) {
      console.error('Failed to start voice analyzer:', error);
      alert('Failed to access microphone. Please grant permission and try again.');
    }
  };

  const handleStop = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
      setIsActive(false);
      const stabilitySamples = stabilityCountRef.current;
      const avgStability =
        stabilitySamples > 0 ? stabilitySumRef.current / stabilitySamples : 0;
      const tuningFrames = totalPitchFramesRef.current;
      const tuningAccuracy =
        tuningFrames > 0 ? inTuneFramesRef.current / tuningFrames : 0;
      const scaleFrames = totalScaleFramesRef.current;
      const scaleAccuracy =
        scaleFrames > 0 ? inScaleFramesRef.current / scaleFrames : 0;
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
        scaleAccuracy
      };

      const nextSessions = [summary, ...sessionSummaries].slice(0, 20);
      setSessionSummaries(nextSessions);

      const telemetrySession = {
        id: summary.id,
        timestamp: summary.timestamp,
        preset,
        scaleId,
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
              scaleId,
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
    const targetId =
      sessionId === 'latest'
        ? telemetrySessions[0]?.id
        : sessionId;
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
      scaleInKey: state.scaleInKey,
      scaleMatch: state.scaleMatch,
      rangeLowHz: state.rangeLowHz,
      rangeHighHz: state.rangeHighHz,
      rangeLowNote: state.rangeLowNote,
      rangeHighNote: state.rangeHighNote,
      dynamicRangeDb: state.dynamicRangeDb,
      loudnessStdDb: state.loudnessStdDb,
      sustainSeconds: state.sustainSeconds,
      isSustaining: state.isSustaining
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 pb-48">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center relative">
              <div className="absolute left-0 top-0 flex items-center gap-2">
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
                    getEngineSettings();
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
                <span className="text-xs text-muted-foreground">Scale</span>
                <select
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                  value={scaleId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setScaleId(value);
                    const scaleDef = getScaleDefinition(value);
                    if (scaleDef) {
                      updateEngineSettings({ scaleId: value });
                    }
                  }}
                >
                  {COMMON_SCALES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Voice Trainer
              </h1>
              <div className="absolute right-0 top-0">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-slate-600">
                    <span className="font-medium">Mic</span>{' '}
                    <span
                      className={
                        inputLevel >= 70 ? 'text-red-600' :
                        inputLevel >= 40 ? 'text-amber-600' :
                        inputLevel > 0 ? 'text-green-600' :
                        'text-slate-400'
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
                  <button
                    className="text-xs px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 transition"
                    onClick={() => setViewMode(viewMode === 'detailed' ? 'simple' : 'detailed')}
                  >
                    {viewMode === 'detailed' ? 'Simplified UI' : 'Detailed UI'}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-slate-600 text-lg">
              Real-time voice analysis and training tool
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 mb-8">
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
                  <span className={practiceMode === 'assisted' ? 'text-slate-900' : ''}>
                    Assisted
                  </span>
                  <span className={practiceMode === 'free' ? 'text-slate-900' : ''}>
                    Free
                  </span>
                </span>
              </button>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isActive ? (
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="gap-3 px-12 py-8 text-2xl"
                >
                  <Play className="h-7 w-7" />
                  {practiceMode === 'assisted' ? 'Start Assisted Practice' : 'Start Free Practice'}
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-3 px-10 py-7 text-xl"
                  >
                    <Square className="h-6 w-6" />
                    Stop Session
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      handleStop();
                      setTimeout(() => handleSendTelemetry('latest'), 0);
                    }}
                    className="gap-3 px-10 py-7 text-xl"
                  >
                    Stop & Send to AI
                  </Button>
                </>
              )}

            </div>

            <div className="flex items-center gap-2">
              {isActive ? (
                <>
                  <Mic className="h-5 w-5 text-green-600 animate-pulse" />
                  <Badge variant="default" className="bg-green-600">
                    Recording ({practiceMode === 'assisted' ? 'Assisted' : 'Free'})
                  </Badge>
                </>
              ) : (
                <>
                  <MicOff className="h-5 w-5 text-slate-400" />
                  <Badge variant="secondary">
                    Inactive
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCalibrate}
                    className="gap-2 ml-2"
                  >
                    <Timer className="h-4 w-4" />
                    Calibrate (5s)
                  </Button>
                </>
              )}
            </div>

            {!isActive && practiceMode === 'assisted' && (
              <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-800 mb-1">Assisted Practice</div>
                Select a video/audio track to sing along. (Database integration coming next.)
              </div>
            )}

          </div>

          {(showCalibration || calibrationMessage) && (
            <div className="mb-6 max-w-2xl mx-auto">
              {showCalibration ? (
                <CalibrationBanner
                  progress={calibrationProgress}
                  secondsLeft={calibrationSecondsLeft}
                />
              ) : (
                <div className="text-center text-sm text-slate-600">
                  {calibrationMessage}
                </div>
              )}
            </div>
          )}

          {isActive && !showCalibration && viewMode === 'detailed' && (
            <div className="mb-6 max-w-2xl mx-auto">
              <DebugPanel currentRMS={engineState?.rms ?? 0} noiseGate={noiseGate} />
            </div>
          )}

          {viewMode === 'detailed' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <PitchModule state={engineState} />
              <ScaleModule state={engineState} />
              <DynamicRangeModule state={engineState} />
              <AirflowModule state={engineState} />
              <SustainModule state={engineState} />
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-5 w-5" />
                    <div className="text-lg font-semibold">Vocal Range</div>
                  </div>
                  <InfoTooltip text="Tracks your lowest and highest notes in this session. Wider range indicates flexibility." />
                </div>
                <div className="text-xs text-slate-500 mb-4">Lowest and highest notes in this session</div>
                <div className="text-center text-6xl font-bold tracking-tight text-slate-800">
                  {engineState?.rangeLowNote ?? '—'}
                  <span className="mx-2 text-slate-400">→</span>
                  {engineState?.rangeHighNote ?? '—'}
                </div>
                <div className="mt-2 text-center text-sm text-slate-500">
                  {engineState?.rangeLowHz ? `${engineState.rangeLowHz.toFixed(1)} Hz` : '—'} to{' '}
                  {engineState?.rangeHighHz ? `${engineState.rangeHighHz.toFixed(1)} Hz` : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="text-xs text-slate-500 mb-2">Pitch</div>
                <div
                  className={`text-7xl font-bold tracking-tight ${
                    engineState?.cents !== undefined
                      ? Math.abs(engineState.cents) <= 5
                        ? 'text-green-600'
                        : Math.abs(engineState.cents) <= 20
                          ? 'text-amber-500'
                          : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                >
                  {engineState?.noteName ?? '—'}
                </div>
                <div className="mt-3 flex items-center justify-between text-xl">
                  <span>
                    {engineState?.cents !== undefined
                      ? `${engineState.cents > 0 ? '+' : ''}${engineState.cents}¢`
                      : 'No pitch'}
                  </span>
                  <span className="text-sm text-slate-500">
                    {engineState?.pitchHz ? `${engineState.pitchHz.toFixed(1)} Hz` : '—'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="text-xs text-slate-500 mb-2">Scale Meter</div>
                <div
                  className={`text-4xl font-semibold ${
                    engineState?.scaleMatch !== undefined
                      ? Math.round(engineState.scaleMatch * 100) >= 80
                        ? 'text-green-600'
                        : Math.round(engineState.scaleMatch * 100) >= 60
                          ? 'text-amber-500'
                          : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                >
                  {engineState?.scaleMatch !== undefined
                    ? `${Math.round(engineState.scaleMatch * 100)}%`
                    : '—'}
                </div>
                <div className="mt-2 text-sm text-slate-500 flex items-center justify-between">
                  <span>{engineState?.scaleLabel ?? 'Scale not set'}</span>
                  <span className={engineState?.scaleInKey ? 'text-green-600' : 'text-red-600'}>
                    {engineState?.scaleInKey === undefined ? '—' : engineState.scaleInKey ? 'in' : 'out'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="text-xs text-slate-500 mb-2">Dynamic Range</div>
                <div
                  className={`text-center text-5xl font-bold ${
                    engineState?.dynamicRangeDb !== undefined
                      ? engineState.dynamicRangeDb < 6
                        ? 'text-amber-600'
                        : engineState.dynamicRangeDb < 12
                          ? 'text-green-600'
                          : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                >
                  {engineState?.dynamicRangeDb !== undefined
                    ? engineState.dynamicRangeDb < 6
                      ? 'Too flat'
                      : engineState.dynamicRangeDb < 12
                        ? 'Balanced'
                        : 'Too wide'
                    : '—'}
                </div>
                <div className="mt-1 text-center text-sm text-slate-500">
                  {engineState?.dynamicRangeDb !== undefined
                    ? `${engineState.dynamicRangeDb.toFixed(1)} dB`
                    : '—'}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="text-xs text-slate-500 mb-2">Breathiness</div>
                <div
                  className={`text-center text-5xl font-semibold ${
                    engineState?.breathiness !== undefined
                      ? engineState.breathiness < 0.3
                        ? 'text-green-600'
                        : engineState.breathiness < 0.6
                          ? 'text-amber-600'
                          : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                >
                  {engineState?.breathiness !== undefined
                    ? engineState.breathiness < 0.3
                      ? 'Clean'
                      : engineState.breathiness < 0.6
                        ? 'Moderate'
                        : 'Breathy'
                    : '—'}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="text-xs text-slate-500 mb-2">Note Sustain</div>
                <div className="text-4xl font-semibold">
                  {(engineState?.sustainSeconds ?? 0).toFixed(1)}s
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-5 w-5" />
                    <div className="text-lg font-semibold">Vocal Range</div>
                  </div>
                  <InfoTooltip text="Tracks your lowest and highest notes in this session. Wider range indicates flexibility." />
                </div>
                <div className="text-xs text-slate-500 mb-4">Lowest and highest notes in this session</div>
                <div className="text-center text-5xl font-bold tracking-tight text-slate-800">
                  {engineState?.rangeLowNote ?? '—'}
                  <span className="mx-2 text-slate-400">→</span>
                  {engineState?.rangeHighNote ?? '—'}
                </div>
                <div className="mt-2 text-center text-sm text-slate-500">
                  {engineState?.rangeLowHz ? `${engineState.rangeLowHz.toFixed(1)} Hz` : '—'} to{' '}
                  {engineState?.rangeHighHz ? `${engineState.rangeHighHz.toFixed(1)} Hz` : '—'}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-center">
              <button
                className="text-xs px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50 transition"
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

          <div className="mt-8 text-center text-sm text-slate-500">
            <p>Click "Start Session" to begin analyzing your voice in real-time.</p>
            <p>Toggle individual modules on or off to focus on specific aspects.</p>
          </div>
        </div>
      </div>
      <BottomPiano noteName={engineState?.noteName} />
    </div>
  );
}
