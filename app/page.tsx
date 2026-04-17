'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Play, Square, Mic, MicOff, Timer, Mic2, Send } from 'lucide-react';
import { PitchModule } from '@/src/components/modules/PitchModule';
import { DynamicRangeModule } from '@/src/components/modules/DynamicRangeModule';
import { AirflowModule } from '@/src/components/modules/AirflowModule';
import { SustainModule } from '@/src/components/modules/SustainModule';
import { CalibrationBanner } from '@/src/components/CalibrationBanner';
import { DebugPanel } from '@/src/components/DebugPanel';
import { SessionSummaryPanel } from '@/src/components/SessionSummaryPanel';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';
import { BottomPiano } from '@/src/components/BottomPiano';
import { AssistedPianoRoll } from '@/src/components/AssistedPianoRoll';
import { useAssistedPractice } from '@/src/hooks/useAssistedPractice';
import { useSessionAnalysis } from '@/src/hooks/useSessionAnalysis';
import { useVoiceSession } from '@/src/hooks/useVoiceSession';
import { AssistedConfig, EXERCISE_OPTIONS, clampBpm, clampTranspose } from '@/src/engine/assistedPractice';
import { applyPreset, EnginePreset, getAvailablePresets } from '@/src/engine/engineSettings';

type AnalysisNotice = {
  state: 'processing' | 'ready' | 'error';
  message: string;
  sessionId?: number;
};

export default function Home() {
  const [practiceMode, setPracticeMode] = useState<'free' | 'assisted'>('free');
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const [pendingAnalysisId, setPendingAnalysisId] = useState<number | null>(null);
  const assisted = useAssistedPractice();
  const analysis = useSessionAnalysis();
  const voice = useVoiceSession({
    practiceMode,
    assistedConfig: assisted.assistedConfig,
    applyAssistedState: assisted.applyAssistedState,
    commitAssistedUi: assisted.commitFollowUi,
    resetAssistedSession: assisted.resetSessionTracking,
    clearAssistedUi: assisted.clearAssistedUi,
    startGuideIfNeeded: assisted.startGuideIfNeeded,
    stopGuide: assisted.stopGuide,
    persistArtifact: analysis.persistArtifact
  });

  const isAnalyzing = analysis.analysisBusyId !== null;

  const analysisActionLabel = useMemo(() => {
    if (!analysisNotice || analysisNotice.state !== 'processing') {
      return 'Processing your AI report...';
    }
    return analysisNotice.message;
  }, [analysisNotice]);

  const openResultsInNewTab = useCallback((sessionId: number) => {
    window.open(`/analysis/${sessionId}`, '_blank', 'noopener,noreferrer');
  }, []);

  const executeAnalysis = useCallback(async (sessionId: number) => {
    setAnalysisNotice({
      state: 'processing',
      sessionId,
      message: 'Processing your session with AI. This can take a few moments.'
    });

    try {
      const result = await analysis.runAnalysisForSession(sessionId);
      if (!result) {
        setAnalysisNotice(null);
        return;
      }

      if (result.alreadyReady) {
        setAnalysisNotice({
          state: 'ready',
          sessionId: result.sessionId,
          message: 'Your results are already ready.'
        });
        return;
      }

      setAnalysisNotice({
        state: 'ready',
        sessionId: result.sessionId,
        message: 'Your results are ready.'
      });
    } catch (error) {
      setAnalysisNotice({
        state: 'error',
        message: error instanceof Error ? error.message : 'AI analysis failed.'
      });
    }
  }, [analysis]);

  const confirmAndRunAnalysis = useCallback((sessionId: number) => {
    setPendingAnalysisId(sessionId);
  }, []);

  const handleConfirmAnalysis = useCallback(async () => {
    if (pendingAnalysisId === null) {
      return;
    }

    const targetId = pendingAnalysisId;
    setPendingAnalysisId(null);
    await executeAnalysis(targetId);
  }, [executeAnalysis, pendingAnalysisId]);

  const handleAssistedConfigChange = useCallback((next: AssistedConfig) => {
    assisted.updateAssistedConfig(next, {
      restartGuide: voice.isActive && practiceMode === 'assisted'
    });
  }, [assisted, practiceMode, voice.isActive]);

  const handleStopAndSend = useCallback(async () => {
    const artifact = await voice.handleStop();
    if (artifact) {
      await confirmAndRunAnalysis(artifact.id);
    }
  }, [confirmAndRunAnalysis, voice]);

  return (
    <>
      <AlertDialog open={pendingAnalysisId !== null} onOpenChange={(open) => !open && setPendingAnalysisId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send session to AI?</AlertDialogTitle>
            <AlertDialogDescription>
              We’ll send this session's timing data and practice metrics to the AI coach to generate feedback and recommended lessons.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {pendingAnalysisId !== null ? `Session ${pendingAnalysisId} is ready to analyze.` : 'Select a session to continue.'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAnalyzing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isAnalyzing} onClick={(event) => {
              event.preventDefault();
              void handleConfirmAnalysis();
            }}>
              {isAnalyzing ? 'Processing...' : 'Send to AI'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                    value={voice.preset}
                    onChange={(e) => {
                      const value = e.target.value as EnginePreset | 'custom';
                      if (value === 'custom') {
                        voice.setPreset('custom');
                        return;
                      }
                      applyPreset(value);
                      voice.setPreset(value);
                    }}
                  >
                    <option value="custom">Custom</option>
                    {getAvailablePresets().map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-center gap-2 md:justify-end">
                  <div className="text-[11px] text-slate-600">
                    <span className="font-medium">Mic</span>{' '}
                    <span
                      className={
                        voice.inputLevel >= 70
                          ? 'text-red-600'
                          : voice.inputLevel >= 40
                            ? 'text-amber-600'
                            : voice.inputLevel > 0
                              ? 'text-green-600'
                              : 'text-slate-400'
                      }
                    >
                      {voice.inputLevel.toFixed(0)}%
                    </span>
                  </div>
                  <select
                    className="h-7 max-w-[160px] rounded border border-slate-200 bg-white px-2 text-[11px]"
                    value={voice.selectedDeviceId}
                    onChange={(e) => voice.setSelectedDeviceId(e.target.value)}
                  >
                    {voice.audioDevices.length === 0 && <option value="">Default mic</option>}
                    {voice.audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Microphone'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-lg text-slate-600">Real-time voice analysis and training tool</p>
          </div>

          <div className="mb-8 flex flex-col items-center gap-4">
            {!voice.isActive && (
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
              {!voice.isActive ? (
                <Button size="lg" onClick={voice.handleStart} className="gap-3 px-12 py-8 text-2xl">
                  <Play className="h-7 w-7" />
                  {practiceMode === 'assisted' ? 'Start Assisted Practice' : 'Start Free Practice'}
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="destructive" onClick={() => void voice.handleStop()} className="gap-3 px-10 py-7 text-xl">
                    <Square className="h-6 w-6" />
                    Stop Session
                  </Button>
                  <Button size="lg" onClick={handleStopAndSend} className="gap-3 px-10 py-7 text-xl">
                    <Send className="h-6 w-6" />
                    Stop and Analyze with AI
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {voice.isActive ? (
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
                  <Button size="sm" variant="outline" onClick={voice.handleCalibrate} className="ml-2 gap-2">
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
                        variant={assisted.assistedConfig.voiceProfile === 'male' ? 'default' : 'outline'}
                        onClick={() => handleAssistedConfigChange({ ...assisted.assistedConfig, voiceProfile: 'male' })}
                      >
                        Male
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={assisted.assistedConfig.voiceProfile === 'female' ? 'default' : 'outline'}
                        onClick={() => handleAssistedConfigChange({ ...assisted.assistedConfig, voiceProfile: 'female' })}
                      >
                        Female
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">Scale</div>
                    <select
                      className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm"
                      value={assisted.assistedConfig.exerciseId}
                      onChange={(e) =>
                        handleAssistedConfigChange({
                          ...assisted.assistedConfig,
                          exerciseId: e.target.value as AssistedConfig['exerciseId']
                        })
                      }
                    >
                      {EXERCISE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Tempo (BPM)</span>
                      <span>{assisted.assistedConfig.bpm}</span>
                    </div>
                    <Slider
                      min={30}
                      max={244}
                      step={1}
                      value={[assisted.assistedConfig.bpm]}
                      onValueChange={(values) =>
                        handleAssistedConfigChange({ ...assisted.assistedConfig, bpm: clampBpm(values[0]) })
                      }
                    />
                    <Input
                      className="h-8 w-24"
                      type="number"
                      min={30}
                      max={244}
                      value={assisted.assistedConfig.bpm}
                      onChange={(e) =>
                        handleAssistedConfigChange({
                          ...assisted.assistedConfig,
                          bpm: clampBpm(Number(e.target.value))
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Transpose</span>
                      <span>
                        {assisted.assistedConfig.transposeSemitones > 0 ? '+' : ''}
                        {assisted.assistedConfig.transposeSemitones}
                      </span>
                    </div>
                    <Slider
                      min={-12}
                      max={12}
                      step={1}
                      value={[assisted.assistedConfig.transposeSemitones]}
                      onValueChange={(values) =>
                        handleAssistedConfigChange({
                          ...assisted.assistedConfig,
                          transposeSemitones: clampTranspose(values[0])
                        })
                      }
                    />
                    <div className="text-xs text-slate-500">Range: {assisted.assistedSequence.label}</div>
                  </div>
                </div>
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <div className="mb-1 font-medium text-slate-700">
                    Guide {voice.isActive && practiceMode === 'assisted' ? 'running' : 'stopped'}
                  </div>
                  {assisted.assistedSequence.notes.join(' - ')}
                </div>
              </div>
            )}
          </div>

          {(voice.showCalibration || voice.calibrationMessage) && (
            <div className="mx-auto mb-6 max-w-2xl">
              {voice.showCalibration ? (
                <CalibrationBanner progress={voice.calibrationProgress} secondsLeft={voice.calibrationSecondsLeft} />
              ) : (
                <div className="text-center text-sm text-slate-600">{voice.calibrationMessage}</div>
              )}
            </div>
          )}

          {voice.isActive && !voice.showCalibration && (
            <div className="mx-auto mb-6 max-w-2xl">
              <DebugPanel currentRMS={voice.engineState?.rms ?? 0} noiseGate={voice.noiseGate} />
            </div>
          )}

          {voice.isActive && practiceMode === 'assisted' && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  Target: <span className="font-semibold">{assisted.assistedTargetNote ?? '-'}</span>
                </div>
                <div>
                  You (detected): <span className="font-semibold text-orange-600">{voice.engineState?.noteName ?? '-'}</span>
                </div>
                <div>
                  BPM: <span className="font-semibold">{assisted.assistedConfig.bpm}</span>
                </div>
                <div>
                  Follow: <span className="font-semibold">{Math.round(assisted.assistedFollowAccuracy * 100)}%</span>
                </div>
                <div>
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      assisted.assistedFollowStatus === 'on-target'
                        ? 'text-green-600'
                        : assisted.assistedFollowStatus === 'near'
                          ? 'text-amber-600'
                          : assisted.assistedFollowStatus === 'off'
                            ? 'text-red-600'
                            : 'text-slate-500'
                    }`}
                  >
                    {assisted.assistedFollowStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <PitchModule state={voice.engineState} />
            <DynamicRangeModule state={voice.engineState} />
            <AirflowModule state={voice.engineState} />
            <SustainModule state={voice.engineState} />
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
                {voice.engineState?.rangeLowNote ?? '-'}
                <span className="mx-2 text-slate-400">to</span>
                {voice.engineState?.rangeHighNote ?? '-'}
              </div>
              <div className="mt-2 text-center text-sm text-slate-500">
                {voice.engineState?.rangeLowHz ? `${voice.engineState.rangeLowHz.toFixed(1)} Hz` : '-'} to{' '}
                {voice.engineState?.rangeHighHz ? `${voice.engineState.rangeHighHz.toFixed(1)} Hz` : '-'}
              </div>
            </div>
          </div>

          {practiceMode === 'assisted' && (
            <div className="mb-6">
              <AssistedPianoRoll
                isActive={voice.isActive}
                targetNoteName={assisted.assistedTargetNote}
                detectedNoteName={voice.engineState?.noteName}
              />
            </div>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">AI Analysis</div>
                <div className="text-sm text-slate-600">
                  Send the timed session data to AI for a coaching report.
                </div>
              </div>
              {!voice.isActive && analysis.recentAnalysisArtifacts[0] && !analysis.recentAnalysisArtifacts[0].hasReport && analysis.recentAnalysisArtifacts[0].hasAudio && (
                <Button
                  onClick={() => void confirmAndRunAnalysis(analysis.recentAnalysisArtifacts[0].id)}
                  disabled={isAnalyzing}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {analysis.analysisBusyId === analysis.recentAnalysisArtifacts[0].id ? 'Processing...' : 'Analyze Latest Session'}
                </Button>
              )}
            </div>
            {analysisNotice && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                  analysisNotice.state === 'processing'
                    ? 'border-sky-200 bg-sky-50 text-sky-900'
                    : analysisNotice.state === 'ready'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">
                      {analysisNotice.state === 'processing'
                        ? 'Processing'
                        : analysisNotice.state === 'ready'
                          ? 'Results ready'
                          : 'Analysis failed'}
                    </div>
                    <div className="mt-1">{analysisNotice.state === 'processing' ? analysisActionLabel : analysisNotice.message}</div>
                  </div>
                  {analysisNotice.state === 'ready' && analysisNotice.sessionId && (
                    <Button variant="outline" onClick={() => analysisNotice.sessionId && openResultsInNewTab(analysisNotice.sessionId)}>
                      Open results in new tab
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {analysis.recentAnalysisArtifacts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No AI-ready session saved yet. Record a practice session first.
                </div>
              ) : (
                analysis.recentAnalysisArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {new Date(artifact.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        {artifact.practiceMode} mode - status: {artifact.analysisStatus}
                      </div>
                      {artifact.reportSummary && (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-600">{artifact.reportSummary}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {artifact.hasReport ? (
                        <Button variant="outline" onClick={() => analysis.openAnalysisReport(artifact.id)}>
                          View report
                        </Button>
                      ) : artifact.hasAudio ? (
                        <Button
                          variant="outline"
                          onClick={() => void confirmAndRunAnalysis(artifact.id)}
                          disabled={isAnalyzing}
                        >
                          {analysis.analysisBusyId === artifact.id ? 'Processing...' : 'Analyze with AI'}
                        </Button>
                      ) : (
                        <Badge variant="outline">Audio uploaded and removed</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-center">
              <button
                className="rounded border border-slate-200 bg-white px-3 py-2 text-xs transition hover:bg-slate-50"
                onClick={() => voice.setShowSummary((prev) => !prev)}
              >
                {voice.showSummary ? 'Hide Session Summary' : 'Show Session Summary'}
              </button>
            </div>
            {voice.showSummary && (
              <div className="mt-4">
                <SessionSummaryPanel sessions={voice.sessionSummaries} />
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomPiano
        noteName={voice.engineState?.noteName}
        targetNoteName={assisted.assistedTargetNote}
        playDetectedAudio={practiceMode !== 'assisted'}
      />
    </div>
    </>
  );
}















