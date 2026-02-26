'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Waves } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface DynamicRangeModuleProps {
  state: EngineState | null;
}

export function DynamicRangeModule({ state }: DynamicRangeModuleProps) {
  const rangeDb = state?.dynamicRangeDb;
  const stdDb = state?.loudnessStdDb;

  const getLabel = () => {
    if (rangeDb === undefined) return '—';
    if (rangeDb < 6) return 'Too flat';
    if (rangeDb < 12) return 'Balanced';
    return 'Too wide';
  };

  const getColor = () => {
    if (rangeDb === undefined) return 'text-slate-400';
    if (rangeDb < 6) return 'text-amber-600';
    if (rangeDb < 12) return 'text-green-600';
    return 'text-orange-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            <CardTitle>Dynamic Range</CardTitle>
          </div>
          <InfoTooltip text="Measures how much your loudness varies while singing. Balanced range usually sounds controlled." />
        </div>
        <CardDescription>Quiet vs loud span over recent seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className={`text-6xl font-bold ${getColor()}`}>{getLabel()}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Range: {rangeDb !== undefined ? `${rangeDb.toFixed(1)} dB` : '—'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Loudness std: {stdDb !== undefined ? `${stdDb.toFixed(1)} dB` : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
