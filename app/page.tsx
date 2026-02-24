'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic, MicOff } from 'lucide-react';
import { VoiceAnalyzer } from '@/src/audio/VoiceAnalyzer';
import { EngineState } from '@/src/engine/types';
import { PitchModule } from '@/src/components/modules/PitchModule';
import { StabilityModule } from '@/src/components/modules/StabilityModule';
import { VolumeModule } from '@/src/components/modules/VolumeModule';
import { AirflowModule } from '@/src/components/modules/AirflowModule';
import { SustainModule } from '@/src/components/modules/SustainModule';
import { TargetTrainerModule } from '@/src/components/modules/TargetTrainerModule';
import { InputLevelMeter } from '@/src/components/InputLevelMeter';
import { CalibrationBanner } from '@/src/components/CalibrationBanner';
import { DebugPanel } from '@/src/components/DebugPanel';
import { SettingsPanel } from '@/src/components/SettingsPanel';
import { SessionSummaryPanel, SessionSummary } from '@/src/components/SessionSummaryPanel';
import { getCalibrationState } from '@/src/engine/calibration';

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [noiseGate, setNoiseGate] = useState(0.005);
  const [sessionSummaries, setSessionSummaries] = useState<SessionSummary[]>([]);
  const analyzerRef = useRef<VoiceAnalyzer | null>(null);
  const calibrationCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const stabilitySumRef = useRef(0);
  const stabilityCountRef = useRef(0);
  const inTuneFramesRef = useRef(0);
  const totalPitchFramesRef = useRef(0);
  const maxSustainRef = useRef(0);

  useEffect(() => {
    analyzerRef.current = new VoiceAnalyzer();
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('voice-trainer-sessions')
          : null;
      if (raw) {
        const parsed = JSON.parse(raw) as SessionSummary[];
        if (Array.isArray(parsed)) {
          setSessionSummaries(
            parsed
              .filter(
                (s) =>
                  typeof s.maxSustainSeconds === 'number' &&
                  typeof s.avgStability === 'number' &&
                  typeof s.tuningAccuracy === 'number'
              )
              .sort((a, b) => b.id - a.id)
          );
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
    };
  }, []);

  const resetSessionAccumulators = () => {
    stabilitySumRef.current = 0;
    stabilityCountRef.current = 0;
    inTuneFramesRef.current = 0;
    totalPitchFramesRef.current = 0;
    maxSustainRef.current = 0;
  };

  const handleStart = async () => {
    if (!analyzerRef.current) return;

    resetSessionAccumulators();

    try {
      await analyzerRef.current.start((state) => {
        setEngineState(state);

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

        if (state.bestSustainSeconds !== undefined) {
          if (state.bestSustainSeconds > maxSustainRef.current) {
            maxSustainRef.current = state.bestSustainSeconds;
          }
        }
      });
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

      const summary: SessionSummary = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        maxSustainSeconds: maxSustainRef.current,
        avgStability,
        tuningAccuracy
      };

      const nextSessions = [summary, ...sessionSummaries].slice(0, 20);
      setSessionSummaries(nextSessions);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'voice-trainer-sessions',
            JSON.stringify(nextSessions)
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
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Voice Trainer
            </h1>
            <p className="text-slate-600 text-lg">
              Real-time voice analysis and training tool
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              {!isActive ? (
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="gap-2"
                >
                  <Play className="h-5 w-5" />
                  Start Session
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="gap-2"
                >
                  <Square className="h-5 w-5" />
                  Stop Session
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isActive ? (
                <>
                  <Mic className="h-5 w-5 text-green-600 animate-pulse" />
                  <Badge variant="default" className="bg-green-600">
                    Recording
                  </Badge>
                </>
              ) : (
                <>
                  <MicOff className="h-5 w-5 text-slate-400" />
                  <Badge variant="secondary">
                    Inactive
                  </Badge>
                </>
              )}
            </div>

            <div className="w-full max-w-md">
              <InputLevelMeter analyserNode={analyserNode} isActive={isActive} />
            </div>
          </div>

          {showCalibration && (
            <div className="mb-6 max-w-2xl mx-auto">
              <CalibrationBanner progress={calibrationProgress} />
            </div>
          )}

          {isActive && !showCalibration && (
            <div className="mb-6 max-w-2xl mx-auto">
              <DebugPanel currentRMS={engineState?.rms ?? 0} noiseGate={noiseGate} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <PitchModule state={engineState} />
            <StabilityModule state={engineState} />
            <VolumeModule state={engineState} />
            <AirflowModule state={engineState} />
            <SustainModule state={engineState} />
            <TargetTrainerModule state={engineState} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
            <div className="max-w-2xl w-full">
              <SettingsPanel isRecording={isActive} />
            </div>
            <div className="w-full">
              <SessionSummaryPanel sessions={sessionSummaries} />
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-slate-500">
            <p>Click "Start Session" to begin analyzing your voice in real-time.</p>
            <p>Toggle individual modules on or off to focus on specific aspects.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
