import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  PracticeSessionPayload,
  VoiceSessionAnalysisReport
} from '@/src/analysis/types';
import { selectThinkificCandidates } from '@/src/server/thinkificCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const frameSchema = z.object({
  t: z.number(),
  rms: z.number().optional(),
  voiced: z.boolean().optional(),
  pitchDetected: z.boolean().optional(),
  pitchHz: z.number().optional(),
  pitchConfidence: z.number().optional(),
  cents: z.number().optional(),
  noteName: z.string().optional(),
  breathiness: z.number().optional(),
  volumeConsistency: z.number().optional(),
  rangeLowHz: z.number().optional(),
  rangeHighHz: z.number().optional(),
  rangeLowNote: z.string().optional(),
  rangeHighNote: z.string().optional(),
  dynamicRangeDb: z.number().optional(),
  loudnessStdDb: z.number().optional(),
  sustainSeconds: z.number().optional(),
  isSustaining: z.boolean().optional(),
  assistedMode: z.boolean(),
  assistedTargetNote: z.string().optional(),
  assistedHit: z.boolean().optional(),
  assistedScale: z.string().optional(),
  assistedTranspose: z.number().optional()
});

const payloadSchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  preset: z.string(),
  practiceMode: z.enum(['free', 'assisted']),
  assistedConfig: z.object({
    voiceProfile: z.enum(['male', 'female']),
    bpm: z.number(),
    exerciseId: z.string(),
    transposeSemitones: z.number()
  }).optional(),
  summary: z.object({
    id: z.number(),
    timestamp: z.string(),
    maxSustainSeconds: z.number(),
    avgStability: z.number(),
    tuningAccuracy: z.number(),
    practiceMode: z.enum(['free', 'assisted']),
    assistedFollowAccuracy: z.number().optional()
  }),
  metrics: z.object({
    id: z.number(),
    timestamp: z.string(),
    preset: z.string(),
    practiceMode: z.enum(['free', 'assisted']),
    assistedProfile: z.enum(['male', 'female']).optional(),
    assistedBpm: z.number().optional(),
    assistedScale: z.string().optional(),
    assistedTranspose: z.number().optional(),
    assistedFollowAccuracy: z.number().optional(),
    durationSeconds: z.number(),
    voicedRatio: z.number(),
    avgPitchHz: z.number(),
    pitchStdHz: z.number(),
    avgBreathiness: z.number()
  }),
  frames: z.array(frameSchema),
  recording: z.object({
    mimeType: z.string(),
    sizeBytes: z.number(),
    durationSeconds: z.number()
  }).optional()
});

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' }
        },
        required: ['title', 'detail']
      }
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['title', 'detail', 'severity']
      }
    },
    priority_improvements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          action: { type: 'string' },
          why: { type: 'string' },
          recommended_videos: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                url: { type: 'string' },
                reason: { type: 'string' },
                duration_minutes: { type: 'number' },
                course_title: { type: 'string' }
              },
              required: ['id', 'title', 'url', 'reason', 'duration_minutes', 'course_title']
            }
          }
        },
        required: ['title', 'action', 'why', 'recommended_videos']
      }
    },
    suggested_exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          reason: { type: 'string' },
          duration_minutes: { type: 'number' }
        },
        required: ['name', 'reason', 'duration_minutes']
      }
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          timestamp_seconds: { type: 'number' },
          label: { type: 'string' },
          observation: { type: 'string' }
        },
        required: ['timestamp_seconds', 'label', 'observation']
      }
    },
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pitch: { type: 'number' },
        breathiness_control: { type: 'number' },
        sustain: { type: 'number' },
        dynamic_control: { type: 'number' },
        follow_accuracy: { type: 'number' }
      },
      required: ['pitch', 'breathiness_control', 'sustain', 'dynamic_control', 'follow_accuracy']
    }
  },
  required: [
    'summary',
    'strengths',
    'issues',
    'priority_improvements',
    'suggested_exercises',
    'evidence',
    'scores'
  ]
} as const;

function computeQuickStats(payload: PracticeSessionPayload) {
  const frames = payload.frames;
  const pitchFrames = frames.filter((frame) => typeof frame.pitchHz === 'number');
  const voicedFrames = frames.filter((frame) => frame.voiced);
  const breathFrames = frames.filter((frame) => typeof frame.breathiness === 'number');
  const sustainFrames = frames.filter((frame) => typeof frame.sustainSeconds === 'number');
  const followFrames = frames.filter((frame) => frame.assistedMode && frame.assistedHit !== undefined);

  const mean = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const max = (values: number[]) => values.length > 0 ? Math.max(...values) : 0;

  return {
    frameCount: frames.length,
    pitchFrameRatio: frames.length > 0 ? pitchFrames.length / frames.length : 0,
    voicedFrameRatio: frames.length > 0 ? voicedFrames.length / frames.length : 0,
    avgBreathiness: mean(breathFrames.map((frame) => frame.breathiness ?? 0)),
    peakBreathiness: max(breathFrames.map((frame) => frame.breathiness ?? 0)),
    peakSustainSeconds: max(sustainFrames.map((frame) => frame.sustainSeconds ?? 0)),
    followHitRatio:
      followFrames.length > 0
        ? followFrames.filter((frame) => frame.assistedHit).length / followFrames.length
        : payload.summary.assistedFollowAccuracy ?? 0
  };
}

function buildAnalysisPrompt(
  payload: PracticeSessionPayload,
  transcript: string,
  recommendedVideos: Awaited<ReturnType<typeof selectThinkificCandidates>>
): string {
  const stats = computeQuickStats(payload);
  const compactFrames = payload.frames.slice(0, 2400);

  return [
    'You are a warm, practical vocal coach writing for a student, not an audio engineer.',
    'Return only structured coaching data that is specific, evidence-based, and easy to understand.',
    'Use plain English. Avoid jargon, formulas, signal-processing terms, and technical diagnostics unless absolutely necessary.',
    'Frame the report like a lesson recap: what went well, what needs work, and what to practice next.',
    'Every strength and issue should feel understandable to a singer after one read.',
    'Keep the tone supportive, direct, and actionable.',
    'Ground your comments in the transcript, timestamps, and telemetry.',
    'Use evidence timestamps when possible.',
    'Do not mention missing telemetry unless it materially limits your confidence.',
    'Prefer concrete next steps over generic encouragement.',
    'For suggested_exercises, choose short, practical drills. duration_minutes should usually be between 3 and 12.',
    'For each priority improvement, include 0 to 2 recommended_videos chosen only from the provided Thinkific candidates.',
    'Only use exact video ids, titles, course titles, durations, and urls from the candidate list. Do not invent or modify links.',
    'Use recommended_videos only when they directly help with that improvement. If nothing fits, return an empty array.',
    'For scores, think of them as student-friendly coaching scores from 0 to 100.',
    '',
    'Thinkific recommendation candidates:',
    JSON.stringify(recommendedVideos),
    '',
    'Session summary:',
    JSON.stringify(payload.summary),
    '',
    'Session metrics:',
    JSON.stringify(payload.metrics),
    '',
    'Derived quick stats:',
    JSON.stringify(stats),
    '',
    'Transcript:',
    transcript || '[no transcript available]',
    '',
    'Timed telemetry JSON:',
    JSON.stringify(compactFrames)
  ].join('\n');
}

function safeJsonParse<T>(raw: string, label: string): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label} was empty.`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.slice(0, 200);
    throw new Error(
      `${label} was not valid JSON.${preview ? ` Response preview: ${preview}` : ''}`
    );
  }
}
function extractOutputText(response: any): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text;
      }
    }
  }
  return '';
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const sessionJson = formData.get('session_json');

    if (!(audioFile instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 });
    }
    if (typeof sessionJson !== 'string') {
      return NextResponse.json({ error: 'session_json is required.' }, { status: 400 });
    }
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file exceeds the 25 MB limit.' }, { status: 400 });
    }

    const normalizedPayload = payloadSchema.parse(
      safeJsonParse<PracticeSessionPayload>(sessionJson, 'session_json')
    ) as PracticeSessionPayload;
    const client = new OpenAI({ apiKey });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'
    });
    const transcript = typeof transcription === 'string' ? transcription : transcription.text ?? '';
    const thinkificCandidates = await selectThinkificCandidates({
      payload: normalizedPayload,
      transcript,
      limit: 24
    });

    const analysisResponse = await client.responses.create({
      model: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4.1-mini',
      input: buildAnalysisPrompt(normalizedPayload, transcript, thinkificCandidates),
      text: {
        format: {
          type: 'json_schema',
          name: 'voice_session_analysis_report',
          schema: reportSchema,
          strict: true
        }
      }
    });

    const outputText = extractOutputText(analysisResponse);
    if (!outputText) {
      throw new Error('The analysis model did not return structured output.');
    }

    const report = safeJsonParse<VoiceSessionAnalysisReport>(outputText, 'analysis model output');

    return NextResponse.json({
      sessionId: normalizedPayload.id,
      transcript,
      report,
      normalizedSession: normalizedPayload
    });
  } catch (error) {
    console.error('AI session analysis failed:', error);
    const message = error instanceof z.ZodError
      ? `Invalid session payload: ${error.issues[0]?.message ?? 'unknown schema error'}`
      : error instanceof Error
        ? error.message
        : 'Unknown analysis failure';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

