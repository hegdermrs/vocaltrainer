'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface ScaleModuleProps {
  state: EngineState | null;
}

export function ScaleModule({ state }: ScaleModuleProps) {
  const scaleLabel = state?.scaleLabel ?? 'Scale not set';
  const match = state?.scaleMatch ?? 0;
  const percent = clamp(Math.round(match * 100), 0, 100);

  const metricColor =
    percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-amber-500' : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            <CardTitle>Scale Meter</CardTitle>
          </div>
          <InfoTooltip text="Shows how often your notes fall inside the selected scale. Higher % means you're staying in key." />
        </div>
        <CardDescription>How often notes are inside the selected scale</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Scale</div>
          <div className="text-lg font-semibold">{scaleLabel}</div>
          <div className={`text-center text-6xl font-bold tabular-nums ${metricColor}`}>
            {percent}%
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Current note</span>
            <span className={state?.scaleInKey ? 'text-green-600' : 'text-red-600'}>
              {state?.scaleInKey === undefined ? '—' : state.scaleInKey ? 'in scale' : 'out of scale'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
