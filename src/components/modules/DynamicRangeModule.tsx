'use client';

import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Waves } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface DynamicRangeModuleProps {
  state: EngineState | null;
}

export const DynamicRangeModule = memo(function DynamicRangeModule({ state }: DynamicRangeModuleProps) {
  const rangeDb = state?.dynamicRangeDb;
  const stdDb = state?.loudnessStdDb;

  const label =
    rangeDb === undefined ? '-' : rangeDb < 6 ? 'Very steady' : rangeDb < 12 ? 'Balanced' : 'Wide';
  const color =
    rangeDb === undefined
      ? 'text-slate-400'
      : rangeDb < 6
        ? 'text-amber-600'
        : rangeDb < 12
          ? 'text-green-600'
          : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            <CardTitle>Volume Control</CardTitle>
          </div>
          <InfoTooltip text="Shows how much your loudness changes while you sing." />
        </div>
        <CardDescription>Loudness movement in recent seconds</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 text-center">
          <div className={`text-6xl font-bold ${color}`}>{label}</div>
          <div className="text-sm text-muted-foreground">
            Range: {rangeDb !== undefined ? `${rangeDb.toFixed(1)} dB` : '-'}
          </div>
          <div className="text-sm text-muted-foreground">
            Stability: {stdDb !== undefined ? `${stdDb.toFixed(1)} dB` : '-'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
