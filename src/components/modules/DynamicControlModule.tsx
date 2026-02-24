'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { EngineState } from '@/src/engine/types';
import { Volume2, Waves } from 'lucide-react';

interface DynamicControlModuleProps {
  state: EngineState | null;
}

type SegmentType = 'soft' | 'loud';

interface PatternSegment {
  type: SegmentType;
  durationSeconds: number;
}

const DEFAULT_PATTERN: PatternSegment[] = [
  { type: 'soft', durationSeconds: 2 },
  { type: 'loud', durationSeconds: 2 },
  { type: 'soft', durationSeconds: 2 },
  { type: 'loud', durationSeconds: 2 }
];

export function DynamicControlModule({ state }: DynamicControlModuleProps) {
  const [pattern] = useState<PatternSegment[]>(DEFAULT_PATTERN);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [targetSoft, setTargetSoft] = useState(25);
  const [targetLoud, setTargetLoud] = useState(75);
  const [tolerance, setTolerance] = useState(15);

  const lastTimestampRef = useRef<number | null>(null);
  const matchingFramesRef = useRef(0);
  const totalFramesRef = useRef(0);

  useEffect(() => {
    if (!running) {
      lastTimestampRef.current = null;
      return;
    }

    const handleFrame = (timestamp: number) => {
      if (!running) return;
      if (lastTimestampRef.current == null) {
        lastTimestampRef.current = timestamp;
      }
      const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      setElapsed((prev) => {
        let next = prev + deltaSeconds;
        const totalPatternDuration = pattern.reduce(
          (sum, seg) => sum + seg.durationSeconds,
          0
        );
        if (next > totalPatternDuration) {
          next -= totalPatternDuration;
        }
        return next;
      });

      requestAnimationFrame(handleFrame);
    };

    const id = requestAnimationFrame(handleFrame);
    return () => cancelAnimationFrame(id);
  }, [running, pattern]);

  useEffect(() => {
    if (!running || !state) return;

    const rms = state.rms ?? 0;
    const db = 20 * Math.log10(Math.max(rms, 0.00001));
    const level = Math.max(0, Math.min(100, (db + 60) * 1.67));

    const totalPatternDuration = pattern.reduce(
      (sum, seg) => sum + seg.durationSeconds,
      0
    );
    const timeInCycle = elapsed % totalPatternDuration;

    let accumulated = 0;
    let currentSegment: PatternSegment | null = null;

    for (const seg of pattern) {
      if (timeInCycle >= accumulated && timeInCycle < accumulated + seg.durationSeconds) {
        currentSegment = seg;
        break;
      }
      accumulated += seg.durationSeconds;
    }

    const target =
      currentSegment?.type === 'soft'
        ? targetSoft
        : currentSegment?.type === 'loud'
          ? targetLoud
          : null;

    if (target != null) {
      const inRange = Math.abs(level - target) <= tolerance;
      totalFramesRef.current += 1;
      if (inRange) {
        matchingFramesRef.current += 1;
      }
      const rawScore =
        totalFramesRef.current > 0
          ? (matchingFramesRef.current / totalFramesRef.current) * 100
          : 0;
      setScore(rawScore);
    }
  }, [elapsed, running, state, pattern, targetSoft, targetLoud, tolerance]);

  const handleToggle = () => {
    if (running) {
      setRunning(false);
    } else {
      matchingFramesRef.current = 0;
      totalFramesRef.current = 0;
      setScore(0);
      setElapsed(0);
      lastTimestampRef.current = null;
      setRunning(true);
    }
  };

  const totalDuration = pattern.reduce(
    (sum, seg) => sum + seg.durationSeconds,
    0
  );
  const timeInCycle = elapsed % totalDuration;

  let accumulated = 0;
  let currentSegment: PatternSegment | null = null;
  let currentIndex = 0;

  pattern.forEach((seg, index) => {
    if (currentSegment) return;
    if (timeInCycle >= accumulated && timeInCycle < accumulated + seg.durationSeconds) {
      currentSegment = seg;
      currentIndex = index;
      return;
    }
    accumulated += seg.durationSeconds;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            <CardTitle>Dynamic Control</CardTitle>
          </div>
          <Button size="sm" variant={running ? 'outline' : 'default'} onClick={handleToggle}>
            {running ? 'Stop Exercise' : 'Start Exercise'}
          </Button>
        </div>
        <CardDescription>
          Follow the soft / loud pattern to practice volume control
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Score:</span>
          <span className="text-2xl font-semibold tabular-nums">
            {score.toFixed(0)}
            <span className="ml-1 text-xs text-muted-foreground">%</span>
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(Math.max(score, 5), 100)}%` }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current segment:</span>
            <span className="text-sm font-medium">
              {currentSegment ? (currentSegment.type === 'soft' ? 'Soft' : 'Loud') : '—'}
            </span>
          </div>
          <div className="flex gap-1 text-xs items-center text-muted-foreground">
            <Volume2 className="h-3 w-3" />
            <span>
              Aim for around {targetSoft}% in soft sections and {targetLoud}% in loud sections.
            </span>
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Soft target</span>
            <span className="text-xs font-mono">{targetSoft}%</span>
          </div>
          <Slider
            value={[targetSoft]}
            onValueChange={([v]) => setTargetSoft(v)}
            min={5}
            max={60}
            step={5}
          />

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Loud target</span>
            <span className="text-xs font-mono">{targetLoud}%</span>
          </div>
          <Slider
            value={[targetLoud]}
            onValueChange={([v]) => setTargetLoud(v)}
            min={40}
            max={100}
            step={5}
          />

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Tolerance</span>
            <span className="text-xs font-mono">±{tolerance}%</span>
          </div>
          <Slider
            value={[tolerance]}
            onValueChange={([v]) => setTolerance(v)}
            min={5}
            max={30}
            step={1}
          />
        </div>
      </CardContent>
    </Card>
  );
}

