'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { History, Mic, Mic2, MicOff, Pause, Play, Send, Settings2, Square, Timer } from 'lucide-react';
import { PitchModule } from '@/src/components/modules/PitchModule';
import { DynamicRangeModule } from '@/src/components/modules/DynamicRangeModule';
import { AirflowModule } from '@/src/components/modules/AirflowModule';
import { SustainModule } from '@/src/components/modules/SustainModule';
import { CalibrationBanner } from '@/src/components/CalibrationBanner';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';
import { BottomPiano } from '@/src/components/BottomPiano';
import { AssistedPianoRoll } from '@/src/components/AssistedPianoRoll';
import { useAssistedPractice } from '@/src/hooks/useAssistedPractice';
import { useSessionAnalysis } from '@/src/hooks/useSessionAnalysis';
import { useVoiceSession } from '@/src/hooks/useVoiceSession';
import { AssistedConfig, EXERCISE_OPTIONS, clampBpm, clampGuideVolume, clampTranspose } from '@/src/engine/assistedPractice';
import { applyPreset, EnginePreset, getAvailablePresets } from '@/src/engine/engineSettings';

type AnalysisNotice = {
  state: 'processing' | 'ready' | 'error';
  message: string;
  sessionId?: number;
  startedAt?: number;
};

export default function Home() {
  const [practiceMode, setPracticeMode] = useState<'free' | 'assisted'>('free');
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const [pendingAnalysisId, setPendingAnalysisId] = useState<number | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [showExercisePattern, setShowExercisePattern] = useState(false);
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
  const analysisDialogOpen = pendingAnalysisId !== null || analysisNotice !== null;
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const latestAnalysisArtifact = analysis.recentAnalysisArtifacts[0] ?? null;
  const pastAnalysisArtifacts = analysis.recentAnalysisArtifacts.slice(1);

  useEffect(() => {
    if (analysisNotice?.state !== 'processing' || !analysisNotice.startedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [analysisNotice]);

  const processingCountdown = useMemo(() => {
    if (analysisNotice?.state !== 'processing' || !analysisNotice.startedAt) {
      return null;
    }

    const estimatedSeconds = 50;
    const elapsedSeconds = Math.floor((countdownNow - analysisNotice.startedAt) / 1000);
    const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);

    return {
      remainingSeconds,
      isWaiting: remainingSeconds === 0
    };
  }, [analysisNotice, countdownNow]);

  useEffect(() => {
    if (resumeCountdown === null) {
      return;
    }

    if (resumeCountdown <= 0) {
      assisted.resumeGuide();
      setResumeCountdown(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      setResumeCountdown((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [assisted.resumeGuide, resumeCountdown]);

  useEffect(() => {
    if (!voice.isActive || practiceMode !== 'assisted') {
      setResumeCountdown(null);
    }
  }, [practiceMode, voice.isActive]);

  const analysisActionLabel = useMemo(() => {
    if (!analysisNotice || analysisNotice.state !== 'processing') {
      return 'Processing your AI report...';
    }
    if (processingCountdown?.isWaiting) {
      return 'Waiting for AI results...';
    }
    if (processingCountdown) {
      return `Estimated time remaining: ${processingCountdown.remainingSeconds}s`;
    }
    return analysisNotice.message;
  }, [analysisNotice, processingCountdown]);

  const openResultsInNewTab = useCallback((sessionId: number) => {
    window.open(`/analysis/${sessionId}`, '_blank', 'noopener,noreferrer');
  }, []);

  const resetAnalysisDialog = useCallback(() => {
    if (isAnalyzing) {
      return;
    }

    setPendingAnalysisId(null);
    setAnalysisNotice(null);
  }, [isAnalyzing]);

  const executeAnalysis = useCallback(async (sessionId: number) => {
    setAnalysisNotice({
      state: 'processing',
      sessionId,
      message: 'Processing your session with AI. This can take a few moments.',
      startedAt: Date.now()
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
  }, [assisted.updateAssistedConfig, practiceMode, voice.isActive]);

  const handlePauseAssistedGuide = useCallback(() => {
    setResumeCountdown(null);
    assisted.pauseGuide();
  }, [assisted.pauseGuide]);

  const handleResumeAssistedGuide = useCallback(() => {
    setResumeCountdown(3);
  }, []);

  const handleStopAndSend = useCallback(async () => {
    setResumeCountdown(null);
    const artifact = await voice.handleStop();
    if (artifact) {
      await confirmAndRunAnalysis(artifact.id);
    }
  }, [confirmAndRunAnalysis, voice]);

  const renderArtifactCard = useCallback((artifact: (typeof analysis.recentAnalysisArtifacts)[number], compact = false) => (
    <div
      key={artifact.id}
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 ${compact ? '' : 'sm:flex-row sm:items-center sm:justify-between'}`}
    >
      <div className="min-w-0">
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
      <div className="flex flex-wrap gap-2">
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
  ), [analysis, confirmAndRunAnalysis, isAnalyzing]);

  return (
    <>
      <AlertDialog open={analysisDialogOpen} onOpenChange={(open) => !open && resetAnalysisDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAnalysisId !== null && !analysisNotice
                ? 'Send session to AI?'
                : analysisNotice?.state === 'processing'
                  ? 'Processing your report'
                  : analysisNotice?.state === 'ready'
                    ? 'Results ready'
                    : analysisNotice?.state === 'error'
                      ? 'Analysis failed'
                      : 'AI analysis'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAnalysisId !== null && !analysisNotice
                ? "We'll send this session's timing data and practice metrics to the AI coach to generate feedback and recommended lessons."
                : analysisNotice?.state === 'processing'
                  ? `${analysisNotice.message} ${processingCountdown?.isWaiting ? 'Waiting for a response now.' : ''}`.trim()
                  : analysisNotice?.message ?? 'Review the AI analysis status for this session.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              analysisNotice?.state === 'processing'
                ? 'border-sky-200 bg-sky-50 text-sky-900'
                : analysisNotice?.state === 'ready'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : analysisNotice?.state === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {pendingAnalysisId !== null && !analysisNotice
              ? `Session ${pendingAnalysisId} is ready to analyze.`
              : analysisNotice?.state === 'processing'
                ? analysisActionLabel
                : analysisNotice?.message ?? 'Select a session to continue.'}
          </div>
          <AlertDialogFooter>
            {pendingAnalysisId !== null && !analysisNotice ? (
              <>
                <AlertDialogCancel disabled={isAnalyzing}>Cancel</AlertDialogCancel>
                <Button disabled={isAnalyzing} onClick={() => void handleConfirmAnalysis()}>
                  Send to AI
                </Button>
              </>
            ) : analysisNotice?.state === 'processing' ? (
              <Button disabled>{processingCountdown?.isWaiting ? 'Waiting...' : 'Processing...'}</Button>
            ) : analysisNotice?.state === 'ready' && analysisNotice.sessionId ? (
              <>
                <Button variant="outline" onClick={resetAnalysisDialog}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    openResultsInNewTab(analysisNotice.sessionId!);
                    resetAnalysisDialog();
                  }}
                >
                  Open results in new tab
                </Button>
              </>
            ) : analysisNotice?.state === 'error' ? (
              <Button onClick={resetAnalysisDialog}>Close</Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 pb-36">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                Voice Trainer
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {practiceMode === 'assisted' ? 'Assisted practice' : 'Free practice'}
                </Badge>
                <Badge variant="secondary">Real-time coaching</Badge>
              </div>
              <p className="max-w-2xl text-balance text-sm text-slate-600 md:text-base">
                Start with one button. The detailed setup lives below, so the practice flow stays clear and easy to follow.
              </p>
            </div>
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
                  {practiceMode === 'assisted' && (
                    assisted.isGuidePaused ? (
                      <Button size="lg" variant="secondary" onClick={handleResumeAssistedGuide} className="gap-3 px-10 py-7 text-xl" disabled={resumeCountdown !== null}>
                        <Play className="h-6 w-6" />
                        {resumeCountdown !== null ? `Resuming in ${resumeCountdown}...` : 'Resume Guided Practice'}
                      </Button>
                    ) : (
                      <Button size="lg" variant="outline" onClick={handlePauseAssistedGuide} className="gap-3 px-10 py-7 text-xl" disabled={resumeCountdown !== null}>
                        <Pause className="h-6 w-6" />
                        Pause Guided Practice
                      </Button>
                    )
                  )}
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

            <div className="flex flex-wrap items-center justify-center gap-2">
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
                </>
              )}
              {practiceMode === 'assisted' && (
                <Badge variant="outline" className="capitalize">
                  {EXERCISE_OPTIONS.find((option) => option.id === assisted.assistedConfig.exerciseId)?.label ?? 'Guided exercise'}
                </Badge>
              )}
            </div>

            <div className="w-full max-w-3xl">
              <Accordion type="multiple" defaultValue={practiceMode === 'assisted' ? ['practice-settings'] : []} className="rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
                <AccordionItem value="practice-settings" className="border-none">
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-slate-100 p-2 text-slate-700">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Practice settings</div>
                        <div className="text-xs font-normal text-slate-500">
                          Adjust your setup, microphone, and guided exercise options when you need them.
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Session setup</div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Preset</label>
                        <select
                          className="mb-3 h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm"
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
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>Calibration</span>
                          <Button size="sm" variant="outline" onClick={voice.handleCalibrate} className="gap-2">
                            <Timer className="h-4 w-4" />
                            Calibrate (5s)
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Microphone</div>
                        <div className="mb-2 text-xs text-slate-600">
                          Input level:{' '}
                          <span
                            className={
                              voice.inputLevel >= 70
                                ? 'font-semibold text-red-600'
                                : voice.inputLevel >= 40
                                  ? 'font-semibold text-amber-600'
                                  : voice.inputLevel > 0
                                    ? 'font-semibold text-green-600'
                                    : 'font-semibold text-slate-400'
                            }
                          >
                            {voice.inputLevel.toFixed(0)}%
                          </span>
                        </div>
                        <select
                          className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm"
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

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2 xl:col-span-1">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Practice note</div>
                        <p className="text-sm leading-6 text-slate-600">
                          Free mode keeps the visual feedback simple. Assisted mode adds the guided exercise, target note, and follow tracking.
                        </p>
                      </div>
                    </div>

                    {practiceMode === 'assisted' && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Guided practice</div>
                            <div className="text-xs text-slate-500">
                              Pick your exercise here, then keep the live screen focused on singing.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">Range: {assisted.assistedSequence.label}</Badge>
                            <Badge variant="outline">
                              Guide: {resumeCountdown !== null ? `Resuming in ${resumeCountdown}` : assisted.isGuidePaused ? 'Paused' : voice.isActive ? 'Running' : 'Stopped'}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-slate-500">Voice profile</div>
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
                            <div className="text-xs font-medium text-slate-500">Exercise</div>
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
                        </div>

                        <Accordion type="single" collapsible className="mt-4 rounded-lg border border-slate-200 bg-white px-4">
                          <AccordionItem value="guided-more" className="border-none">
                            <AccordionTrigger className="py-3 text-sm hover:no-underline">More guided options</AccordionTrigger>
                            <AccordionContent className="pb-2">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                                    <span>Guide volume</span>
                                    <span>{assisted.assistedConfig.guideVolume}%</span>
                                  </div>
                                  <Slider
                                    min={0}
                                    max={150}
                                    step={1}
                                    value={[assisted.assistedConfig.guideVolume]}
                                    onValueChange={(values) =>
                                      handleAssistedConfigChange({
                                        ...assisted.assistedConfig,
                                        guideVolume: clampGuideVolume(values[0])
                                      })
                                    }
                                  />
                                  <div className="text-xs text-slate-500">Boost the guided piano on phones and smaller speakers.</div>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                                <div>
                                  <div className="text-xs font-medium text-slate-700">Exercise pattern</div>
                                  <div className="text-xs text-slate-500">Keep the note pattern tucked away unless you want to inspect it.</div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setShowExercisePattern((current) => !current)}>
                                  {showExercisePattern ? 'Hide exercise pattern' : 'Show exercise pattern'}
                                </Button>
                              </div>
                              {showExercisePattern && (
                                <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                  {assisted.assistedSequence.notes.join(' - ')}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
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
                  Guide:{' '}
                  <span className="font-semibold text-slate-700">
                    {resumeCountdown !== null
                      ? `Resuming in ${resumeCountdown}`
                      : assisted.isGuidePaused
                        ? 'Paused'
                        : 'Running'}
                  </span>
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">AI analysis</div>
                <div className="text-sm text-slate-600">
                  Focus on the latest session first. Older reports stay tucked away until you need them.
                </div>
              </div>
              {!voice.isActive && latestAnalysisArtifact && !latestAnalysisArtifact.hasReport && latestAnalysisArtifact.hasAudio && (
                <Button
                  onClick={() => void confirmAndRunAnalysis(latestAnalysisArtifact.id)}
                  disabled={isAnalyzing}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {analysis.analysisBusyId === latestAnalysisArtifact.id ? 'Processing...' : 'Analyze latest session'}
                </Button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {!latestAnalysisArtifact ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No AI-ready session saved yet. Record a practice session first.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest session</div>
                  {renderArtifactCard(latestAnalysisArtifact, true)}
                </div>
              )}

              {pastAnalysisArtifacts.length > 0 && (
                <Accordion type="single" collapsible className="rounded-lg border border-slate-200 bg-slate-50 px-4">
                  <AccordionItem value="past-analyses" className="border-none">
                    <AccordionTrigger className="py-3 text-sm hover:no-underline">
                      <div className="flex items-center gap-3">
                        <History className="h-4 w-4 text-slate-500" />
                        <span>Past analyses ({pastAnalysisArtifacts.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4">
                      {pastAnalysisArtifacts.map((artifact) => renderArtifactCard(artifact))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </div>
        </div>
      </div>
      <BottomPiano
        noteName={voice.engineState?.noteName}
        targetNoteName={assisted.assistedTargetNote}
        playDetectedAudio={false}
      />
    </div>
    </>
  );
}


























