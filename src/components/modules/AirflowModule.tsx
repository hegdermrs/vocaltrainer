'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wind } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface AirflowModuleProps {
  state: EngineState | null;
}

type BreathinessLevel = 'CLEAN' | 'MODERATE' | 'BREATHY';

export function AirflowModule({ state }: AirflowModuleProps) {
  const breathiness = (state?.breathiness ?? 0) * 100;
  const [windowPeak, setWindowPeak] = useState(0);
  const [history, setHistory] = useState<Array<{ t: number; v: number }>>([]);
  const [displayLevel, setDisplayLevel] = useState<BreathinessLevel>('CLEAN');
  const peakSamplesRef = useRef<Array<{ t: number; v: number }>>([]);
  const pendingLevelRef = useRef<BreathinessLevel | null>(null);
  const pendingSinceRef = useRef<number>(0);
  const moderateHoldUntilRef = useRef<number>(0);
  const breathyHoldUntilRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    const value = Math.max(0, Math.min(50, breathiness));
    peakSamplesRef.current.push({ t: now, v: value });
    peakSamplesRef.current = peakSamplesRef.current.filter((s) => now - s.t <= 2000);
    setHistory((prev) => [...prev, { t: now, v: value }].filter((s) => now - s.t <= 6000));
    if (value > 9) {
      moderateHoldUntilRef.current = now + 1400;
    }
    if (value > 18) {
      breathyHoldUntilRef.current = now + 650;
    }
    let peak = 0;
    for (let i = 0; i < peakSamplesRef.current.length; i++) {
      if (peakSamplesRef.current[i].v > peak) {
        peak = peakSamplesRef.current[i].v;
      }
    }
    setWindowPeak(peak);
  }, [breathiness]);

  useEffect(() => {
    const now = Date.now();
    let nextLevel = getLevelFromValue(breathiness);
    if (now < breathyHoldUntilRef.current) {
      nextLevel = 'BREATHY';
    } else if (now < moderateHoldUntilRef.current && nextLevel === 'CLEAN') {
      nextLevel = 'MODERATE';
    }
    if (nextLevel === displayLevel) {
      pendingLevelRef.current = null;
      pendingSinceRef.current = 0;
      return;
    }
    if (pendingLevelRef.current !== nextLevel) {
      pendingLevelRef.current = nextLevel;
      pendingSinceRef.current = now;
      return;
    }
    if (now - pendingSinceRef.current >= 220) {
      setDisplayLevel(nextLevel);
      pendingLevelRef.current = null;
      pendingSinceRef.current = 0;
    }
  }, [breathiness, displayLevel]);

  const getQualityColor = (value: number) => getQualityColorByLevel(getLevelFromValue(value));
  const currentSeriesColor = getSeriesColorByLevel(getLevelFromValue(breathiness));

  const graphWidth = 360;
  const graphHeight = 96;
  const graphPadding = 10;
  const usableW = graphWidth - graphPadding * 2;
  const usableH = graphHeight - graphPadding * 2;
  const maxY = 50;
  const now = Date.now();
  const windowMs = 6000;
  const points = history.map((p) => {
    const x = graphPadding + ((windowMs - (now - p.t)) / windowMs) * usableW;
    const y = graphPadding + (1 - Math.min(1, Math.max(0, p.v / maxY))) * usableH;
    return { x, y, v: p.v };
  });
  const linePath =
    points.length > 0
      ? `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}`
      : '';
  const areaPath =
    points.length > 0
      ? `${linePath} L ${(graphPadding + usableW).toFixed(2)} ${(graphPadding + usableH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(graphPadding + usableH).toFixed(2)} Z`
      : '';
  const peakPoint = points.reduce<{ x: number; y: number; v: number } | null>(
    (acc, p) => (!acc || p.v > acc.v ? p : acc),
    null
  );
  const currentPoint = points.length > 0 ? points[points.length - 1] : null;
  const yFor = (value: number) => graphPadding + (1 - Math.min(1, Math.max(0, value / maxY))) * usableH;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            <CardTitle>Breathiness</CardTitle>
          </div>
          <InfoTooltip text="Estimates how airy/noisy your tone is. Lower % means clearer tone; higher % means breathier." />
        </div>
        <CardDescription>Legacy time-domain breathiness metric</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground">Level</div>
            <div className={`text-center text-6xl font-bold tabular-nums ${getQualityColorByLevel(displayLevel)}`}>
              {displayLevel}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Clean</span>
            <span className="font-medium">Breathy ↔ Clean</span>
            <span>Breathy</span>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {displayLevel}
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <svg
              viewBox={`0 0 ${graphWidth} ${graphHeight}`}
              className="w-full h-24"
              role="img"
              aria-label="Breathiness live graph"
            >
              <defs>
                <linearGradient id="breathinessArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentSeriesColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={currentSeriesColor} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line
                x1={graphPadding}
                y1={yFor(5)}
                x2={graphPadding + usableW}
                y2={yFor(5)}
                stroke="#16a34a"
                strokeDasharray="3 3"
                strokeWidth="1"
                opacity="0.7"
              />
              <line
                x1={graphPadding}
                y1={yFor(9)}
                x2={graphPadding + usableW}
                y2={yFor(9)}
                stroke="#d97706"
                strokeDasharray="3 3"
                strokeWidth="1"
                opacity="0.7"
              />
              {areaPath && <path d={areaPath} fill="url(#breathinessArea)" />}
              {linePath && (
                <path d={linePath} fill="none" stroke={currentSeriesColor} strokeWidth="2.2" strokeLinecap="round" />
              )}
              {peakPoint && (
                <circle cx={peakPoint.x} cy={peakPoint.y} r="3.4" fill={getSeriesColorByLevel(getLevelFromValue(windowPeak))} stroke="#fff" strokeWidth="1.2" />
              )}
              {currentPoint && (
                <circle cx={currentPoint.x} cy={currentPoint.y} r="3.1" fill={currentSeriesColor} stroke="#fff" strokeWidth="1.2" />
              )}
            </svg>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
              <span>6s live trend</span>
              <span>
                Peak: <span className={getQualityColor(windowPeak)}>{getLevelFromValue(windowPeak)}</span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getLevelFromValue(value: number): BreathinessLevel {
  if (value < 5) return 'CLEAN';
  if (value <= 9) return 'MODERATE';
  return 'BREATHY';
}

function getQualityColorByLevel(level: BreathinessLevel): string {
  if (level === 'CLEAN') return 'text-green-600';
  if (level === 'MODERATE') return 'text-amber-600';
  return 'text-red-600';
}

function getSeriesColorByLevel(level: BreathinessLevel): string {
  if (level === 'CLEAN') return '#16a34a';
  if (level === 'MODERATE') return '#d97706';
  return '#dc2626';
}
