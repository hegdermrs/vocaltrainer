'use client';

import { memo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface PitchModuleProps {
  state: EngineState | null;
}

type PitchSnapshot = {
  pitchHz: number;
  noteName: string;
  cents?: number;
  pitchConfidence?: number;
};

function getDeviationFeedback(cents?: number) {
  if (cents === undefined) {
    return {
      label: 'Listening for pitch',
      detail: 'Hold a note for a moment and we will show how centered it is.',
      colorClass: 'text-slate-500',
      icon: null as JSX.Element | null
    };
  }

  const absCents = Math.abs(cents);
  const direction = cents < 0 ? 'flat' : 'sharp';

  if (absCents <= 12) {
    return {
      label: 'Nicely centered',
      detail: `${absCents}¢ ${direction} is well within normal vocal variation.`,
      colorClass: 'text-emerald-600',
      icon: <span className="text-xl">•</span>
    };
  }

  if (absCents <= 30) {
    return {
      label: 'Very close',
      detail: `${absCents}¢ ${direction} is just a small adjustment away.`,
      colorClass: 'text-green-600',
      icon: cents < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
    };
  }

  if (absCents <= 55) {
    return {
      label: 'Small natural variation',
      detail: `${absCents}¢ ${direction}. This is noticeable, but still fairly close.`,
      colorClass: 'text-lime-600',
      icon: cents < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
    };
  }

  if (absCents <= 80) {
    return {
      label: 'A little off center',
      detail: `${absCents}¢ ${direction}. A gentle adjustment should settle it.`,
      colorClass: 'text-amber-600',
      icon: cents < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
    };
  }

  return {
    label: 'Needs a clearer adjustment',
    detail: `${absCents}¢ ${direction}. Try resetting the note and matching again.`,
    colorClass: 'text-orange-600',
    icon: cents < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
  };
}

export const PitchModule = memo(function PitchModule({ state }: PitchModuleProps) {
  const hasPitch = Boolean(state?.pitchHz && state?.noteName);
  const lastPitchRef = useRef<PitchSnapshot | null>(null);

  if (hasPitch && state?.pitchHz && state?.noteName) {
    lastPitchRef.current = {
      pitchHz: state.pitchHz,
      noteName: state.noteName,
      cents: state.cents,
      pitchConfidence: state.pitchConfidence
    };
  }

  const displayPitch = hasPitch ? state : lastPitchRef.current;
  const deviationFeedback = getDeviationFeedback(displayPitch?.cents);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            <CardTitle>Pitch Detection</CardTitle>
          </div>
          <InfoTooltip text="Shows your current note and how centered it is. Small vocal variations are normal, so use this as a gentle guide rather than a pass/fail meter." />
        </div>
        <CardDescription>Real-time pitch and note detection with more forgiving feedback</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Note</div>
            <div className="text-6xl font-bold tabular-nums text-slate-800">
              {displayPitch?.noteName ?? '—'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <div className={`flex items-center justify-center gap-2 text-2xl font-semibold ${deviationFeedback.colorClass}`}>
              {deviationFeedback.icon}
              <span>{deviationFeedback.label}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">{deviationFeedback.detail}</div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {displayPitch?.cents !== undefined ? `${displayPitch.cents > 0 ? '+' : ''}${displayPitch.cents}¢` : 'No current deviation'}
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
});
