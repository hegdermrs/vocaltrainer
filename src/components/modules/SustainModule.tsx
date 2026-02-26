'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Timer } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { Button } from '@/components/ui/button';
import { resetBestSustain } from '@/src/engine/sustainAnalysis';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface SustainModuleProps {
  state: EngineState | null;
}

export function SustainModule({ state }: SustainModuleProps) {
  const duration = state?.sustainSeconds ?? 0;
  const bestDuration = state?.bestSustainSeconds ?? 0;
  const isSustaining = state?.isSustaining ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <CardTitle>Note Sustain</CardTitle>
          </div>
          <InfoTooltip text="Measures how long you can hold a steady note. Longer sustain suggests better breath support and control." />
        </div>
        <CardDescription>Track note duration and hold</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current:</span>
            <span className="text-2xl font-bold">{duration.toFixed(1)}s</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Best:</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-blue-600">{bestDuration.toFixed(1)}s</span>
              {bestDuration > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetBestSustain}
                  className="h-6 px-2 text-xs"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className={`text-sm font-semibold ${isSustaining ? 'text-green-600' : 'text-slate-400'}`}>
              {isSustaining ? 'Sustaining' : 'Idle'}
            </span>
          </div>

          {duration > 0 && (
            <div className="text-center text-5xl font-bold tabular-nums text-slate-700">
              {duration.toFixed(1)}s
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
