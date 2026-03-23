import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ThinkificVideoCatalogItem {
  id: string;
  title: string;
  description: string;
  courseTitle: string;
  lessonTitle: string;
  url: string;
  durationMinutes?: number;
  isVocalPractice: boolean;
  searchText: string;
  updatedAt: string;
}

export interface ThinkificVideoCatalogSnapshot {
  syncedAt: string;
  source: 'thinkific';
  items: ThinkificVideoCatalogItem[];
}

export interface ThinkificSyncResult {
  syncedAt: string;
  fetchedCourses: number;
  fetchedLessons: number;
  syncedVideos: number;
  filteredVideos: number;
}

interface ThinkificCourse {
  id: string | number;
  name?: string;
  title?: string;
  description?: string;
  slug?: string;
  url?: string;
  [key: string]: unknown;
}

interface ThinkificChapter {
  id: string | number;
  name?: string;
  title?: string;
  course_id?: string | number;
  [key: string]: unknown;
}

interface ThinkificLesson {
  id: string | number;
  name?: string;
  title?: string;
  description?: string;
  slug?: string;
  url?: string;
  lesson_type?: string;
  content_type?: string;
  duration?: number;
  duration_in_seconds?: number;
  video_duration?: number;
  chapter_id?: string | number;
  course_id?: string | number;
  [key: string]: unknown;
}

const DEFAULT_VOCAL_KEYWORDS = [
  'vocal',
  'voice',
  'sing',
  'singer',
  'breath',
  'breathiness',
  'pitch',
  'scale',
  'warm up',
  'warmup',
  'resonance',
  'support',
  'range',
  'head voice',
  'chest voice',
  'mixed voice',
  'falsetto',
  'sustain',
  'riff',
  'run',
  'vibrato',
  'intonation'
];

const DEFAULT_DENYLIST_KEYWORDS = [
  'bonus',
  'q&a',
  'qa',
  'mindset',
  'welcome',
  'introduction',
  'community',
  'office hours'
];

const CATALOG_PATH = path.join(process.cwd(), '.cache', 'thinkific-video-catalog.json');

function splitKeywords(value: string | undefined, fallback: string[]): string[] {
  const normalized = value
    ?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function getThinkificConfig() {
  const apiKey = process.env.THINKIFIC_API_KEY;
  const subdomain = process.env.THINKIFIC_SUBDOMAIN;
  const apiBase = process.env.THINKIFIC_API_BASE || 'https://api.thinkific.com/api/public/v1';
  const siteUrl = process.env.THINKIFIC_SITE_URL || (subdomain ? `https://${subdomain}.thinkific.com` : '');
  const allowlistCourseKeywords = splitKeywords(process.env.THINKIFIC_ALLOWLIST_COURSE_KEYWORDS, []);
  const vocalKeywords = splitKeywords(process.env.THINKIFIC_VOCAL_KEYWORDS, DEFAULT_VOCAL_KEYWORDS);
  const denylistKeywords = splitKeywords(process.env.THINKIFIC_DENYLIST_KEYWORDS, DEFAULT_DENYLIST_KEYWORDS);

  if (!apiKey || !subdomain) {
    throw new Error('THINKIFIC_API_KEY and THINKIFIC_SUBDOMAIN must be configured.');
  }

  return {
    apiKey,
    subdomain,
    apiBase,
    siteUrl,
    allowlistCourseKeywords,
    vocalKeywords,
    denylistKeywords
  };
}

function textOf(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) => String(part))
    .join(' ')
    .trim();
}

function scoreKeywordMatches(text: string, keywords: string[]): number {
  if (!text) return 0;
  const haystack = text.toLowerCase();
  return keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);
}

function isLikelyVocalPractice(text: string, vocalKeywords: string[], denylistKeywords: string[]): boolean {
  const lower = text.toLowerCase();
  if (denylistKeywords.some((keyword) => lower.includes(keyword))) {
    return false;
  }
  return vocalKeywords.some((keyword) => lower.includes(keyword));
}

function normalizeDurationMinutes(lesson: ThinkificLesson): number | undefined {
  const rawSeconds = [lesson.duration_in_seconds, lesson.video_duration, lesson.duration]
    .find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (!rawSeconds || rawSeconds <= 0) return undefined;
  if (rawSeconds <= 30) return Math.max(1, Math.round(rawSeconds));
  return Math.max(1, Math.round(rawSeconds / 60));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildLessonUrl(siteUrl: string, course: ThinkificCourse, lesson: ThinkificLesson): string {
  if (typeof lesson.url === 'string' && lesson.url.startsWith('http')) return lesson.url;
  if (typeof lesson.url === 'string' && lesson.url.startsWith('/')) return `${siteUrl}${lesson.url}`;
  const courseSlug = typeof course.slug === 'string' && course.slug ? course.slug : slugify(course.title || course.name || String(course.id));
  const lessonSlug = typeof lesson.slug === 'string' && lesson.slug ? lesson.slug : slugify(lesson.title || lesson.name || String(lesson.id));
  return siteUrl ? `${siteUrl}/courses/${courseSlug}/lectures/${lessonSlug}` : lessonSlug;
}

async function fetchPaginatedCollection<T>(
  endpoint: string,
  recordKeyCandidates: string[]
): Promise<T[]> {
  const { apiKey, subdomain, apiBase } = getThinkificConfig();
  const headers = {
    'X-Auth-API-Key': apiKey,
    'X-Auth-Subdomain': subdomain,
    'Content-Type': 'application/json'
  };

  const results: T[] = [];
  let page = 1;

  while (page < 50) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await fetch(`${apiBase}${endpoint}${separator}limit=250&page=${page}`, {
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      if (page === 1) {
        throw new Error(`Thinkific request failed for ${endpoint}: ${response.status} ${response.statusText}`);
      }
      break;
    }

    const json = await response.json() as Record<string, unknown>;
    const records = recordKeyCandidates
      .map((key) => json[key])
      .find((value) => Array.isArray(value)) as T[] | undefined;

    if (!records || records.length === 0) {
      break;
    }

    results.push(...records);
    if (records.length < 250) {
      break;
    }
    page += 1;
  }

  return results;
}

async function fetchCourses(): Promise<ThinkificCourse[]> {
  return fetchPaginatedCollection<ThinkificCourse>('/courses', ['items', 'courses']);
}

async function fetchChapters(courseId: string | number): Promise<ThinkificChapter[]> {
  try {
    return await fetchPaginatedCollection<ThinkificChapter>(`/chapters?course_id=${courseId}`, ['items', 'chapters']);
  } catch {
    return [];
  }
}

async function fetchLessonsByChapter(chapterId: string | number): Promise<ThinkificLesson[]> {
  try {
    return await fetchPaginatedCollection<ThinkificLesson>(`/lessons?chapter_id=${chapterId}`, ['items', 'lessons']);
  } catch {
    return [];
  }
}

async function fetchLessonsByCourse(courseId: string | number): Promise<ThinkificLesson[]> {
  try {
    return await fetchPaginatedCollection<ThinkificLesson>(`/lessons?course_id=${courseId}`, ['items', 'lessons']);
  } catch {
    return [];
  }
}

function dedupeCatalogItems(items: ThinkificVideoCatalogItem[]): ThinkificVideoCatalogItem[] {
  const map = new Map<string, ThinkificVideoCatalogItem>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export async function syncThinkificVideoCatalog(): Promise<ThinkificSyncResult> {
  const config = getThinkificConfig();
  const courses = await fetchCourses();
  const allItems: ThinkificVideoCatalogItem[] = [];
  let fetchedLessons = 0;
  let filteredVideos = 0;
  const syncedAt = new Date().toISOString();

  for (const course of courses) {
    const courseTitle = course.title || course.name || `Course ${course.id}`;
    const courseText = textOf(courseTitle, course.description);
    if (
      config.allowlistCourseKeywords.length > 0
      && !config.allowlistCourseKeywords.some((keyword) => courseText.toLowerCase().includes(keyword))
    ) {
      continue;
    }

    const chapters = await fetchChapters(course.id);
    const chapterMap = new Map<string, ThinkificChapter>();
    chapters.forEach((chapter) => chapterMap.set(String(chapter.id), chapter));

    const lessonPool = chapters.length > 0
      ? (await Promise.all(chapters.map((chapter) => fetchLessonsByChapter(chapter.id)))).flat()
      : await fetchLessonsByCourse(course.id);

    fetchedLessons += lessonPool.length;

    for (const lesson of lessonPool) {
      const lessonTitle = lesson.title || lesson.name || `Lesson ${lesson.id}`;
      const chapter = lesson.chapter_id ? chapterMap.get(String(lesson.chapter_id)) : undefined;
      const chapterTitle = chapter?.title || chapter?.name || '';
      const description = typeof lesson.description === 'string' ? lesson.description : '';
      const searchText = textOf(courseTitle, chapterTitle, lessonTitle, description);
      const isVocalPractice = isLikelyVocalPractice(searchText, config.vocalKeywords, config.denylistKeywords);
      if (!isVocalPractice) {
        filteredVideos += 1;
        continue;
      }

      allItems.push({
        id: String(lesson.id),
        title: lessonTitle,
        description,
        courseTitle,
        lessonTitle,
        url: buildLessonUrl(config.siteUrl, course, lesson),
        durationMinutes: normalizeDurationMinutes(lesson),
        isVocalPractice,
        searchText,
        updatedAt: syncedAt
      });
    }
  }

  const snapshot: ThinkificVideoCatalogSnapshot = {
    syncedAt,
    source: 'thinkific',
    items: dedupeCatalogItems(allItems)
  };

  await mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

  return {
    syncedAt,
    fetchedCourses: courses.length,
    fetchedLessons,
    syncedVideos: snapshot.items.length,
    filteredVideos
  };
}

export async function readThinkificVideoCatalog(): Promise<ThinkificVideoCatalogSnapshot> {
  try {
    const raw = await readFile(CATALOG_PATH, 'utf8');
    return JSON.parse(raw) as ThinkificVideoCatalogSnapshot;
  } catch {
    return {
      syncedAt: '',
      source: 'thinkific',
      items: []
    };
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildIntentKeywords(payload: { metrics: { avgBreathiness: number; assistedFollowAccuracy?: number; pitchStdHz: number; avgPitchHz: number; }; summary: { maxSustainSeconds: number; tuningAccuracy: number; }; frames: Array<{ breathiness?: number; sustainSeconds?: number; noteName?: string; }>; }, transcript: string): string[] {
  const keywords = new Set<string>(tokenize(transcript));

  if (payload.summary.tuningAccuracy < 0.7) {
    ['pitch', 'intonation', 'tuning', 'scale', 'ear training'].forEach((word) => keywords.add(word));
  }
  if (payload.metrics.avgBreathiness > 20 || payload.frames.some((frame) => (frame.breathiness ?? 0) > 28)) {
    ['breath', 'support', 'airflow', 'clean tone'].forEach((word) => keywords.add(word));
  }
  if (payload.summary.maxSustainSeconds < 3) {
    ['sustain', 'long notes', 'breath support'].forEach((word) => keywords.add(word));
  }
  if ((payload.metrics.assistedFollowAccuracy ?? 1) < 0.75) {
    ['follow', 'matching pitch', 'interval', 'scale'].forEach((word) => keywords.add(word));
  }
  if (payload.metrics.pitchStdHz > 25) {
    ['stability', 'steady tone', 'control'].forEach((word) => keywords.add(word));
  }
  if (payload.metrics.avgPitchHz > 0 && payload.frames.some((frame) => String(frame.noteName || '').includes('5'))) {
    ['range', 'upper range', 'head voice'].forEach((word) => keywords.add(word));
  }

  return Array.from(keywords);
}

export async function selectThinkificCandidates(input: {
  payload: {
    metrics: {
      avgBreathiness: number;
      assistedFollowAccuracy?: number;
      pitchStdHz: number;
      avgPitchHz: number;
    };
    summary: {
      maxSustainSeconds: number;
      tuningAccuracy: number;
    };
    frames: Array<{ breathiness?: number; sustainSeconds?: number; noteName?: string }>;
  };
  transcript: string;
  limit?: number;
}): Promise<ThinkificVideoCatalogItem[]> {
  const snapshot = await readThinkificVideoCatalog();
  if (snapshot.items.length === 0) return [];

  const keywords = buildIntentKeywords(input.payload, input.transcript);
  const ranked = snapshot.items
    .map((item) => {
      const keywordScore = scoreKeywordMatches(item.searchText, keywords);
      const titleBoost = scoreKeywordMatches(item.title, keywords) * 2;
      const courseBoost = scoreKeywordMatches(item.courseTitle, keywords);
      return {
        item,
        score: keywordScore + titleBoost + courseBoost
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, input.limit ?? 24)
    .map((entry) => entry.item);

  return ranked.length > 0 ? ranked : snapshot.items.slice(0, input.limit ?? 24);
}
