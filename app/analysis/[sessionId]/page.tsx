'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSessionArtifact } from '@/src/analysis/storage';
import { PracticeTelemetryFrame, SessionArtifact, VoiceSessionAnalysisReport } from '@/src/analysis/types';

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

function readBrowserCachedArtifact(sessionId: number): SessionArtifact | null {
  if (typeof window === 'undefined') return null;

  const key = 'voice-trainer-report-' + sessionId;

  try {
    const sessionRaw = window.sessionStorage.getItem(key);
    if (sessionRaw) {
      return JSON.parse(sessionRaw) as SessionArtifact;
    }
  } catch {
    // ignore and try localStorage
  }

  try {
    const localRaw = window.localStorage.getItem(key);
    if (localRaw) {
      return JSON.parse(localRaw) as SessionArtifact;
    }
  } catch {
    // ignore and continue
  }

  return null;
}

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Very strong';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Getting there';
  return 'Needs work';
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-sky-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-rose-600';
}

const defaultScores = {
  pitch: 0,
  breathiness_control: 0,
  sustain: 0,
  dynamic_control: 0,
  follow_accuracy: 0,
};

function getReportPayload(data: Partial<VoiceSessionAnalysisReport> | null | undefined) {
  const report = (data as { report?: Partial<VoiceSessionAnalysisReport> } | null | undefined)?.report ?? data ?? {};
  const scores = report?.scores ?? (data as { scores?: typeof defaultScores } | null | undefined)?.scores ?? defaultScores;

  return {
    report,
    scores,
    strengths: Array.isArray(report?.strengths) ? report.strengths : [],
    issues: Array.isArray(report?.issues) ? report.issues : [],
    priorityImprovements: Array.isArray(report?.priority_improvements) ? report.priority_improvements : [],
    suggestedExercises: Array.isArray(report?.suggested_exercises) ? report.suggested_exercises : [],
    evidence: Array.isArray(report?.evidence) ? report.evidence : [],
  };
}

function isValidVideoUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('http');
}

function getVideoMimeType(url: string, fallbackPath?: string): string | undefined {
  const source = `${url} ${fallbackPath ?? ''}`.toLowerCase();

  if (source.includes('.mov')) return 'video/quicktime';
  if (source.includes('.webm')) return 'video/webm';
  if (source.includes('.ogg') || source.includes('.ogv')) return 'video/ogg';
  return 'video/mp4';
}

function buildSeries(frames: PracticeTelemetryFrame[], pick: (frame: PracticeTelemetryFrame) => number | undefined, limit = 180) {
  if (frames.length === 0) return [] as number[];
  const step = Math.max(1, Math.ceil(frames.length / limit));
  const sampled: number[] = [];
  for (let index = 0; index < frames.length; index += step) {
    const value = pick(frames[index]);
    sampled.push(typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }
  return sampled;
}

function buildChartPoints(values: number[]) {
  if (values.length === 0) return [] as Array<{ x: number; y: number }>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values.map((value, index) => ({
    x: (index / Math.max(1, values.length - 1)) * 100,
    y: 60 - ((value - min) / range) * 48 - 6,
  }));
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  const commands = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = ((current.x + next.x) / 2).toFixed(2);
    commands.push(
      `C ${controlX} ${current.y.toFixed(2)}, ${controlX} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }

  return commands.join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, linePath: string): string {
  if (!points.length || !linePath) return '';
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return `${linePath} L ${lastPoint.x.toFixed(2)} 60 L ${firstPoint.x.toFixed(2)} 60 Z`;
}

function slugifyChartId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function TimelineChart({
  title,
  subtitle,
  values,
  stroke,
  fill,
  valueLabel,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  values: number[];
  stroke: string;
  fill: string;
  valueLabel: string;
  emptyLabel: string;
}) {
  const points = useMemo(() => buildChartPoints(values), [values]);
  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(points, linePath), [linePath, points]);
  const latestValue = values.length > 0 ? values[values.length - 1] : null;
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  const chartId = useMemo(() => slugifyChartId(title), [title]);

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Latest</div>
          <div className="mt-1 text-sm font-semibold text-slate-700">{latestValue !== null ? `${latestValue.toFixed(1)} ${valueLabel}` : emptyLabel}</div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4">
        {values.length > 1 ? (
          <svg viewBox="0 0 100 60" className="h-44 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity="0.32" />
                <stop offset="100%" stopColor={fill} stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[12, 24, 36, 48].map((y) => (
              <line
                key={`${chartId}-grid-${y}`}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="0.6"
                strokeDasharray="2 3"
              />
            ))}
            <path d={areaPath} fill={`url(#${chartId}-fill)`} />
            <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            {latestPoint && (
              <>
                <circle cx={latestPoint.x} cy={latestPoint.y} r="2.8" fill="white" stroke={stroke} strokeWidth="1.4" />
                <circle cx={latestPoint.x} cy={latestPoint.y} r="1.2" fill={stroke} />
              </>
            )}
          </svg>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-slate-400">{emptyLabel}</div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>Session start</span>
        <span>Session end</span>
      </div>
    </section>
  );
}

function CoachScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-4xl font-bold ${scoreColor(score)}`}>{Math.round(score)}</div>
      <div className="mt-1 text-sm text-slate-600">{scoreLabel(score)}</div>
    </div>
  );
}

function DetailCallout({ title, body, tone }: { title: string; body: string; tone: 'emerald' | 'amber' | 'sky' }) {
  const tones = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    sky: 'border-sky-100 bg-sky-50 text-sky-900',
  };

  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</div>
      <p className="mt-3 text-sm leading-7">{body}</p>
    </div>
  );
}

export default function AnalysisPage() {
  const params = useParams<{ sessionId: string }>();
  const [artifact, setArtifact] = useState<SessionArtifact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const sessionId = Number(params?.sessionId);
      if (!Number.isFinite(sessionId)) {
        setLoading(false);
        return;
      }

      const cachedArtifact = readBrowserCachedArtifact(sessionId);
      if (cachedArtifact) {
        if (!cancelled) {
          setArtifact(cachedArtifact);
          setLoading(false);
        }
        return;
      }

      const nextArtifact = await getSessionArtifact(sessionId);
      if (!cancelled) {
        setArtifact(nextArtifact ?? null);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const derived = useMemo(() => {
    if (!artifact) return null;
    const frames = artifact.payload.frames;
    return {
      loudness: buildSeries(frames, (frame) => frame.rms ? frame.rms * 1000 : 0),
      breathiness: buildSeries(frames, (frame) => frame.breathiness),
      pitchConfidence: buildSeries(frames, (frame) => frame.pitchConfidence ? frame.pitchConfidence * 100 : 0),
      sustain: buildSeries(frames, (frame) => frame.sustainSeconds),
      durationLabel: formatClock(artifact.payload.metrics.durationSeconds),
      followPercent: Math.round((artifact.payload.summary.assistedFollowAccuracy ?? artifact.payload.metrics.assistedFollowAccuracy ?? 0) * 100),
    };
  }, [artifact]);

  const handleDownloadFullData = useCallback(() => {
    if (!artifact || typeof window === 'undefined') return;

    const serializableArtifact = {
      ...artifact,
      recording: artifact.recording
        ? {
            ...artifact.recording,
            blob: undefined,
          }
        : undefined,
    };

    const blob = new Blob([JSON.stringify(serializableArtifact, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `voice-trainer-session-${artifact.id}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }, [artifact]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-600">Loading analysis...</div>;
  }

  if (!artifact) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-2xl font-semibold text-slate-900">Analysis not found</div>
          <p className="mt-2 text-sm text-slate-600">
            We could not find a saved AI analysis for this session yet.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Back to trainer</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { report, scores, strengths, issues, priorityImprovements, suggestedExercises, evidence } = getReportPayload(artifact.analysisReport);
  const strongestArea = strengths[0];
  const mainIssue = issues[0];
  const nextStep = priorityImprovements[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-sm text-slate-500">AI Session Analysis</div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Your coaching recap</h1>
              <p className="mt-2 text-sm text-slate-600">
                Session from {formatDate(artifact.timestamp)} in {artifact.payload.practiceMode} mode.
              </p>
              {report ? (
                <p className="mt-5 text-lg leading-8 text-slate-800">{report?.summary ?? 'No summary available yet.'}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{artifact.analysisStatus}</Badge>
              <Badge variant="outline">{artifact.payload.preset}</Badge>
              <Button variant="outline" onClick={handleDownloadFullData}>Download full data JSON</Button>
              <Button asChild variant="outline">
                <Link href="/">Back</Link>
              </Button>
            </div>
          </div>
        </div>

        {!report ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            This session exists, but the AI report has not completed yet.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <DetailCallout
                title="Strongest area"
                body={strongestArea ? `${strongestArea.title}: ${strongestArea.detail}` : 'The AI report did not return a standout strength for this session yet.'}
                tone="emerald"
              />
              <DetailCallout
                title="Main focus"
                body={mainIssue ? `${mainIssue.title}: ${mainIssue.detail}` : 'No main issue was flagged for this session.'}
                tone="amber"
              />
              <DetailCallout
                title="Practice this next"
                body={nextStep ? `${nextStep.title}: ${nextStep.action}` : 'No next step was returned yet. Re-run the analysis if needed.'}
                tone="sky"
              />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">What to do next</h2>
                  <p className="mt-1 text-sm text-slate-600">Use these as your next practice steps instead of trying to fix everything at once.</p>
                </div>
                <Badge variant="secondary">Start here</Badge>
              </div>
              <div className="mt-4 space-y-4">
                {priorityImprovements.map((improvement, improvementIndex) => {
                  const lessons = Array.isArray(improvement?.recommended_lessons)
                    ? improvement.recommended_lessons
                    : [];

                  return (
                    <section key={`${improvement?.title ?? 'improvement'}-${improvementIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-slate-900">{improvement?.title ?? 'Improvement'}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-700"><span className="font-medium">Do this:</span> {improvement?.action ?? ''}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700"><span className="font-medium">Why it matters:</span> {improvement?.why ?? ''}</p>

                      {lessons.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended lessons</h4>
                          <div className="mt-3 space-y-3">
                            {lessons.map((lesson, lessonIndex) => {
                              const videoUrl = isValidVideoUrl(lesson?.video_url)
                                ? lesson.video_url
                                : null;

                              return (
                                <div key={`${improvementIndex}-${lessonIndex}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <h5 className="font-medium text-slate-900">{lesson?.title ?? 'Recommended lesson'}</h5>
                                  <p className="mt-1 text-sm leading-6 text-slate-700">{lesson?.reason ?? ''}</p>

                                  {videoUrl ? (
                                    <div>
                                      <video
                                        controls
                                        preload="metadata"
                                        style={{ width: '100%', maxWidth: '720px', borderRadius: '12px', display: 'block', marginTop: '12px' }}
                                      >
                                        <source src={videoUrl} type={getVideoMimeType(videoUrl, lesson?.dropbox_path)} />
                                        Your browser does not support the video tag.
                                      </video>

                                      <a
                                        href={videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: 'inline-block', marginTop: '8px' }}
                                        className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
                                      >
                                        Open video in new tab
                                      </a>
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-500">Dropbox link pending</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Suggested practice plan</h2>
              <p className="mt-1 text-sm text-slate-600">A simple session plan you can use right away.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {suggestedExercises.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="font-semibold text-sky-900">{item.name}</div>
                    <div className="mt-1 text-sm leading-6 text-sky-900/80">{item.reason}</div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-900/70">
                      {item.duration_minutes} minute practice block
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Quick scores</h2>
              <p className="mt-1 text-sm text-slate-600">A fast summary of the main areas, without making the report feel like a dashboard.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CoachScoreCard label="Pitch" score={scores.pitch} />
                <CoachScoreCard label="Breath control" score={scores.breathiness_control} />
                <CoachScoreCard label="Sustain" score={scores.sustain} />
                <CoachScoreCard label={artifact.payload.practiceMode === 'assisted' ? 'Follow accuracy' : 'Dynamic control'} score={artifact.payload.practiceMode === 'assisted' ? scores.follow_accuracy : scores.dynamic_control} />
              </div>
            </section>

            <Accordion type="multiple" defaultValue={['session-snapshot']} className="space-y-4">
              <AccordionItem value="session-snapshot" className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
                <AccordionTrigger className="text-left hover:no-underline">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Session snapshot</div>
                    <div className="text-sm font-normal text-slate-600">A few practical stats from this session.</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Session length</div>
                      <div className="mt-2 font-semibold">{derived?.durationLabel ?? '-'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Best note hold</div>
                      <div className="mt-2 font-semibold">{artifact.payload.summary.maxSustainSeconds.toFixed(1)}s</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Tuning accuracy</div>
                      <div className="mt-2 font-semibold">{Math.round(artifact.payload.summary.tuningAccuracy * 100)}%</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Pitch stability</div>
                      <div className="mt-2 font-semibold">{Math.round(artifact.payload.summary.avgStability * 100)}%</div>
                    </div>
                    {artifact.payload.practiceMode === 'assisted' && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2 xl:col-span-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Follow accuracy</div>
                        <div className="mt-2 font-semibold">{derived?.followPercent ?? 0}%</div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {derived && (
                <AccordionItem value="detailed-charts" className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Detailed charts</div>
                      <div className="text-sm font-normal text-slate-600">Open the full visual breakdown only when you want the extra detail.</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <TimelineChart
                        title="Voice energy over time"
                        subtitle="A simple waveform-style view showing where your voice was stronger or lighter."
                        values={derived.loudness}
                        stroke="#2563eb"
                        fill="#bfdbfe"
                        valueLabel="energy"
                        emptyLabel="No loudness data"
                      />
                      <TimelineChart
                        title="Breathiness over time"
                        subtitle="Shows where the tone sounded cleaner versus more airy during the session."
                        values={derived.breathiness}
                        stroke="#ea580c"
                        fill="#fed7aa"
                        valueLabel="%"
                        emptyLabel="No breathiness data"
                      />
                      <TimelineChart
                        title="Pitch confidence over time"
                        subtitle="Shows how clearly the app could lock onto your sung note across the session."
                        values={derived.pitchConfidence}
                        stroke="#16a34a"
                        fill="#bbf7d0"
                        valueLabel="%"
                        emptyLabel="No pitch data"
                      />
                      <TimelineChart
                        title="Sustain timeline"
                        subtitle="Shows where you held notes longer and where the sound dropped away more quickly."
                        values={derived.sustain}
                        stroke="#7c3aed"
                        fill="#ddd6fe"
                        valueLabel="s"
                        emptyLabel="No sustain data"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="deeper-coaching-notes" className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
                <AccordionTrigger className="text-left hover:no-underline">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Deeper coaching notes</div>
                    <div className="text-sm font-normal text-slate-600">Open this when you want the full strengths and issues list.</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <section>
                      <h3 className="text-lg font-semibold text-slate-900">What went well</h3>
                      <div className="mt-4 space-y-4">
                        {strengths.map((item, index) => (
                          <div key={`${item?.title ?? 'strength'}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                            <div className="font-semibold text-emerald-900">{item?.title ?? 'Strength'}</div>
                            <div className="mt-1 text-sm leading-6 text-emerald-900/80">{item?.detail ?? ''}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold text-slate-900">What still needs work</h3>
                      <div className="mt-4 space-y-4">
                        {issues.map((item, index) => (
                          <div key={`${item?.title ?? 'issue'}-${index}`} className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-rose-900">{item?.title ?? 'Issue'}</div>
                              <Badge variant="outline" className="capitalize">{item?.severity ?? 'low'}</Badge>
                            </div>
                            <div className="mt-1 text-sm leading-6 text-rose-900/80">{item?.detail ?? ''}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="evidence-moments" className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
                <AccordionTrigger className="text-left hover:no-underline">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Moments worth noticing</div>
                    <div className="text-sm font-normal text-slate-600">Specific timestamps the report highlighted.</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {evidence.map((item, index) => (
                      <div key={`${item.timestamp_seconds}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{item.label}</div>
                          <Badge variant="outline">{item.timestamp_seconds.toFixed(1)}s</Badge>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">{item.observation}</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {artifact.transcript && (
                <AccordionItem value="transcript" className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Transcript</div>
                      <div className="text-sm font-normal text-slate-600">Open only if you want the raw spoken or sung text context.</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{artifact.transcript}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </>
        )}
      </div>
    </div>
  );
}
