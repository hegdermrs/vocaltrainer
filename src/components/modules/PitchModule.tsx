'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface PitchModuleProps {
  state: EngineState | null;
}

interface PitchDataPoint {
  frequency: number;
  timestamp: number;
}

const pitchHistory: PitchDataPoint[] = [];
const MAX_HISTORY_SECONDS = 5;

export function PitchModule({ state }: PitchModuleProps) {
  const hasPitch = state?.pitchHz && state?.noteName;
  const lastPitchRef = useRef<{
    pitchHz: number;
    noteName: string;
    cents?: number;
    pitchConfidence?: number;
  } | null>(null);

  if (hasPitch && state?.pitchHz && state?.noteName) {
    lastPitchRef.current = {
      pitchHz: state.pitchHz,
      noteName: state.noteName,
      cents: state.cents,
      pitchConfidence: state.pitchConfidence
    };
  }

  const displayPitch = hasPitch ? state : lastPitchRef.current;

  const getCentsIndicator = () => {
    const cents = displayPitch?.cents ?? 0;
    if (Math.abs(cents) < 5) {
      return <span className="text-green-600 font-bold">●</span>;
    } else if (cents < 0) {
      return <ChevronLeft className="h-5 w-5 text-orange-600" />;
    } else {
      return <ChevronRight className="h-5 w-5 text-orange-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            <CardTitle>Pitch Detection</CardTitle>
          </div>
          <InfoTooltip text="Detects your current note and how far off you are. Smaller deviation means more accurate pitch." />
        </div>
        <CardDescription>Real-time pitch and note detection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Note</div>
            <div className="text-6xl font-bold tabular-nums text-slate-800">
              {displayPitch?.noteName ?? '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Deviation</div>
            <div className={`text-4xl font-bold ${displayPitch?.cents !== undefined && Math.abs(displayPitch.cents) < 10 ? 'text-green-600' : 'text-orange-600'}`}>
              {displayPitch?.cents !== undefined
                ? `${displayPitch.cents > 0 ? '+' : ''}${displayPitch.cents}¢`
                : '—'}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Frequency</span>
            <span className="font-medium text-slate-700">
              {displayPitch?.pitchHz ? `${displayPitch.pitchHz.toFixed(2)} Hz` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Confidence</span>
            <span className="font-medium text-slate-700">
              {displayPitch?.pitchConfidence !== undefined ? `${(displayPitch.pitchConfidence * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
