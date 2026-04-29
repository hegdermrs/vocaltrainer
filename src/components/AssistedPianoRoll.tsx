'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { noteNameToMidi } from '@/src/engine/assistedPractice';

interface AssistedPianoRollProps {
  targetNoteName?: string;
  detectedNoteName?: string;
  isActive: boolean;
  followAccuracy?: number;
  detectedClassName?: string;
  followClassName?: string;
  historyMs?: number;
}

interface RollPoint {
  t: number;
  midi: number;
}

const MIN_MIDI = 36; // C2
const MAX_MIDI = 84; // C6

export const AssistedPianoRoll = memo(function AssistedPianoRoll({
  targetNoteName,
  detectedNoteName,
  isActive,
  followAccuracy,
  detectedClassName = 'text-slate-900',
  followClassName = 'text-slate-900',
  historyMs = 6000,
}: AssistedPianoRollProps) {
  const [targetPoints, setTargetPoints] = useState<RollPoint[]>([]);
  const [detectedPoints, setDetectedPoints] = useState<RollPoint[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((prev) => prev + 1), 80);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setTargetPoints([]);
      setDetectedPoints([]);
      return;
    }

    const now = Date.now();
    const targetMidi = targetNoteName ? noteNameToMidi(targetNoteName) : null;
    if (targetMidi !== null) {
      setTargetPoints((prev) => [...prev, { t: now, midi: targetMidi }]);
    }
  }, [isActive, targetNoteName]);

  useEffect(() => {
    if (!isActive) return;

    const now = Date.now();
    const detectedMidi = detectedNoteName ? noteNameToMidi(detectedNoteName) : null;
    if (detectedMidi !== null) {
      setDetectedPoints((prev) => [...prev, { t: now, midi: detectedMidi }]);
    }
  }, [detectedNoteName, isActive]);

  useEffect(() => {
    const cutoff = Date.now() - historyMs;
    setTargetPoints((prev) => prev.filter((point) => point.t >= cutoff));
    setDetectedPoints((prev) => prev.filter((point) => point.t >= cutoff));
  }, [historyMs, tick]);

  const targetPolyline = useMemo(() => toPolyline(targetPoints, historyMs), [historyMs, targetPoints, tick]);
  const detectedPolyline = useMemo(() => toPolyline(detectedPoints, historyMs), [detectedPoints, historyMs, tick]);
  const latestTarget = targetPoints[targetPoints.length - 1] ?? null;
  const latestDetected = detectedPoints[detectedPoints.length - 1] ?? null;
  const isMatched = useMemo(() => {
    if (!latestTarget || !latestDetected) return false;
    if (Math.abs(latestTarget.t - latestDetected.t) > 250) return false;
    return Math.abs(latestTarget.midi - latestDetected.midi) <= 0.5;
  }, [latestDetected, latestTarget]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900">Guided Practice</div>
          <div className="text-xs text-slate-500">Target vs your note</div>
        </div>
        <div className={`text-xs font-semibold ${isMatched ? 'text-emerald-600' : 'text-slate-500'}`}>
          {isMatched ? 'Matched' : 'Following'}
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target</div>
            <div className="mt-0.5 text-xl font-bold text-slate-900">{targetNoteName ?? '-'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">You</div>
            <div className={`mt-0.5 text-xl font-bold ${detectedClassName}`}>{detectedNoteName ?? '-'}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Follow</div>
            <div className={`mt-0.5 text-xl font-bold ${followClassName}`}>
              {followAccuracy !== undefined ? `${Math.round(followAccuracy * 100)}%` : '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
          <span>Target</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          <span>You</span>
        </div>
      </div>

      <svg viewBox="0 0 100 60" className="h-20 w-full rounded-lg border border-slate-100 bg-slate-50" preserveAspectRatio="none">
        {[10, 20, 30, 40, 50].map((y) => (
          <line
            key={`grid-${y}`}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="0.6"
            strokeDasharray="2 3"
          />
        ))}
        {targetPolyline && (
          <polyline
            points={targetPolyline}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {detectedPolyline && (
          <polyline
            points={detectedPolyline}
            fill="none"
            stroke="#f97316"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {latestTarget && (
          <circle cx={toX(latestTarget.t, historyMs).toFixed(2)} cy={toY(latestTarget.midi).toFixed(2)} r="1.8" fill="#0284c7" />
        )}
        {latestDetected && (
          <circle cx={toX(latestDetected.t, historyMs).toFixed(2)} cy={toY(latestDetected.midi).toFixed(2)} r="1.8" fill="#f97316" />
        )}
      </svg>
    </div>
  );
});

function toPolyline(points: RollPoint[], historyMs: number): string | null {
  if (points.length < 2) return null;
  const now = Date.now();
  const mapped = points
    .filter((point) => now - point.t <= historyMs)
    .map((point) => `${toX(point.t, historyMs).toFixed(2)},${toY(point.midi).toFixed(2)}`);
  return mapped.length >= 2 ? mapped.join(' ') : null;
}

function toX(timestamp: number, historyMs: number): number {
  const age = Date.now() - timestamp;
  return 100 - (age / historyMs) * 100;
}

function toY(midi: number): number {
  const normalized = (clamp(midi, MIN_MIDI, MAX_MIDI) - MIN_MIDI) / (MAX_MIDI - MIN_MIDI);
  return 54 - normalized * 48;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
