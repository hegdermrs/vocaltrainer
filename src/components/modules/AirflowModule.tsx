'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wind } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface AirflowModuleProps {
  state: EngineState | null;
}

type BreathinessLevel = 'CLEAN' | 'MODERATE' | 'BREATHY';

function formatLevel(level: BreathinessLevel): string {
  if (level === 'CLEAN') return 'Clean';
  if (level === 'MODERATE') return 'Moderate';
  return 'Breathy';
}

export const AirflowModule = memo(function AirflowModule({ state }: AirflowModuleProps) {
  const breathiness = (state?.breathiness ?? 0) * 100;
  const [windowPeak, setWindowPeak] = useState(0);
  const [history, setHistory] = useState<Array<{ t: number; v: number }>>([]);
  const [displayLevel, setDisplayLevel] = useState<BreathinessLevel>('CLEAN');
  const peakSamplesRef = useRef<Array<{ t: number; v: number }>>([]);
  const pendingLevelRef = useRef<BreathinessLevel | null>(null);
  const pendingSinceRef = useRef(0);
  const moderateHoldUntilRef = useRef(0);
  const breathyHoldUntilRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const value = Math.max(0, Math.min(50, breathiness));
    peakSamplesRef.current.push({ t: now, v: value });
    peakSamplesRef.current = peakSamplesRef.current.filter((sample) => now - sample.t <= 2000);
    setHistory((prev) => [...prev, { t: now, v: value }].filter((sample) => now - sample.t <= 6000));
    if (value > 9) moderateHoldUntilRef.current = now + 1400;
    if (value > 18) breathyHoldUntilRef.current = now + 650;
    setWindowPeak(peakSamplesRef.current.reduce((peak, sample) => Math.max(peak, sample.v), 0));
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

  const graphWidth = 360;
  const graphHeight = 96;
  const graphPadding = 10;
  const usableW = graphWidth - graphPadding * 2;
  const usableH = graphHeight - graphPadding * 2;
  const maxY = 50;
  const now = Date.now();
  const windowMs = 6000;
  const points = history.map((point) => {
    const x = graphPadding + ((windowMs - (now - point.t)) / windowMs) * usableW;
    const y = graphPadding + (1 - Math.min(1, Math.max(0, point.v / maxY))) * usableH;
    return { x, y, v: point.v };
  });
  const linePath = points.length > 0 ? `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')}` : '';
  const areaPath =
    points.length > 0
      ? `${linePath} L ${(graphPadding + usableW).toFixed(2)} ${(graphPadding + usableH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(graphPadding + usableH).toFixed(2)} Z`
      : '';
  const peakPoint = points.reduce<{ x: number; y: number; v: number } | null>((acc, point) => (!acc || point.v > acc.v ? point : acc), null);
  const currentPoint = points.length > 0 ? points[points.length - 1] : null;
  const currentSeriesColor = getSeriesColorByLevel(getLevelFromValue(breathiness));
  const yFor = (value: number) => graphPadding + (1 - Math.min(1, Math.max(0, value / maxY))) * usableH;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            <CardTitle>Tone Air</CardTitle>
          </div>
          <InfoTooltip text="Shows how airy or clean the tone is." />
        </div>
        <CardDescription>Clean vs airy tone</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`text-center text-5xl font-bold md:text-6xl ${getQualityColorByLevel(displayLevel)}`}>{formatLevel(displayLevel)}</div>
          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="h-24 w-full" role="img" aria-label="Breathiness live graph">
              <defs>
                <linearGradient id="breathinessArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentSeriesColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={currentSeriesColor} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line x1={graphPadding} y1={yFor(5)} x2={graphPadding + usableW} y2={yFor(5)} stroke="#16a34a" strokeDasharray="3 3" strokeWidth="1" opacity="0.7" />
              <line x1={graphPadding} y1={yFor(9)} x2={graphPadding + usableW} y2={yFor(9)} stroke="#d97706" strokeDasharray="3 3" strokeWidth="1" opacity="0.7" />
              {areaPath && <path d={areaPath} fill="url(#breathinessArea)" />}
              {linePath && <path d={linePath} fill="none" stroke={currentSeriesColor} strokeWidth="2.2" strokeLinecap="round" />}
              {peakPoint && <circle cx={peakPoint.x} cy={peakPoint.y} r="3.4" fill={getSeriesColorByLevel(getLevelFromValue(windowPeak))} stroke="#fff" strokeWidth="1.2" />}
              {currentPoint && <circle cx={currentPoint.x} cy={currentPoint.y} r="3.1" fill={currentSeriesColor} stroke="#fff" strokeWidth="1.2" />}
            </svg>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
              <span>6s live trend</span>
              <span>Peak: <span className={getQualityColorByLevel(getLevelFromValue(windowPeak))}>{formatLevel(getLevelFromValue(windowPeak))}</span></span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

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
