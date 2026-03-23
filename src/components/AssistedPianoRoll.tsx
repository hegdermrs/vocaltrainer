'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { noteNameToMidi } from '@/src/engine/assistedPractice';

interface AssistedPianoRollProps {
  targetNoteName?: string;
  detectedNoteName?: string;
  isActive: boolean;
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
  historyMs = 6000
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
  }, [targetNoteName, isActive]);

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
    setTargetPoints((prev) => prev.filter((p) => p.t >= cutoff));
    setDetectedPoints((prev) => prev.filter((p) => p.t >= cutoff));
  }, [tick, historyMs]);

  const targetPolyline = useMemo(
    () => toPolyline(targetPoints, historyMs, 0),
    [targetPoints, historyMs, tick]
  );
  const detectedPolyline = useMemo(
    () => toPolyline(detectedPoints, historyMs, 1),
    [detectedPoints, historyMs, tick]
  );
  const overlap = useMemo(() => {
    const targetLast = targetPoints[targetPoints.length - 1];
    const detectedLast = detectedPoints[detectedPoints.length - 1];
    if (!targetLast || !detectedLast) return false;
    if (Math.abs(targetLast.t - detectedLast.t) > 250) return false;
    return Math.abs(targetLast.midi - detectedLast.midi) <= 0;
  }, [targetPoints, detectedPoints]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Assisted Piano Roll</span>
        <span className={overlap ? 'text-green-600 font-medium' : ''}>{overlap ? 'Matched now' : 'Following'}</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-[120px] w-full rounded border border-slate-100 bg-slate-50">
        <line x1="0" y1="50" x2="100" y2="50" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" />
        <text x="1" y="6" fontSize="4" fill="#64748b">
          Target
        </text>
        <text x="1" y="56" fontSize="4" fill="#64748b">
          You
        </text>
        {targetPolyline && (
          <polyline
            points={targetPolyline}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {detectedPolyline && (
          <polyline
            points={detectedPolyline}
            fill="none"
            stroke="#f97316"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
});

function toPolyline(points: RollPoint[], historyMs: number, lane: 0 | 1): string | null {
  if (points.length < 2) return null;
  const now = Date.now();
  const laneTop = lane === 0 ? 4 : 54;
  const laneHeight = 42;
  const mapped = points
    .filter((p) => now - p.t <= historyMs)
    .map((p) => {
      const age = now - p.t;
      const x = 100 - (age / historyMs) * 100;
      const yNorm = (clamp(p.midi, MIN_MIDI, MAX_MIDI) - MIN_MIDI) / (MAX_MIDI - MIN_MIDI);
      const y = laneTop + (1 - yNorm) * laneHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
  return mapped.length >= 2 ? mapped.join(' ') : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
