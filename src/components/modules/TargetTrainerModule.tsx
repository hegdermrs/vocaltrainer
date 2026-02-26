'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { EngineState } from '@/src/engine/types';
import { Music2, Target } from 'lucide-react';

interface TargetTrainerModuleProps {
  state: EngineState | null;
}

type NoteName =
  | 'C3' | 'C#3' | 'D3' | 'D#3' | 'E3' | 'F3' | 'F#3' | 'G3' | 'G#3' | 'A3' | 'A#3' | 'B3'
  | 'C4' | 'C#4' | 'D4' | 'D#4' | 'E4' | 'F4' | 'F#4' | 'G4' | 'G#4' | 'A4' | 'A#4' | 'B4'
  | 'C5' | 'C#5' | 'D5' | 'D#5' | 'E5' | 'F5' | 'F#5' | 'G5' | 'G#5' | 'A5' | 'A#5' | 'B5';

type ScaleId = 'none' | 'c-major' | 'g-major' | 'd-major';

const NOTE_FREQUENCIES: Record<NoteName, number> = {
  C3: 130.81, 'C#3': 138.59, D3: 146.83, 'D#3': 155.56, E3: 164.81, F3: 174.61, 'F#3': 185.0,
  G3: 196.0, 'G#3': 207.65, A3: 220.0, 'A#3': 233.08, B3: 246.94,
  C4: 261.63, 'C#4': 277.18, D4: 293.66, 'D#4': 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99,
  G4: 392.0, 'G#4': 415.3, A4: 440.0, 'A#4': 466.16, B4: 493.88,
  C5: 523.25, 'C#5': 554.37, D5: 587.33, 'D#5': 622.25, E5: 659.25, F5: 698.46, 'F#5': 739.99,
  G5: 783.99, 'G#5': 830.61, A5: 880.0, 'A#5': 932.33, B5: 987.77
};

const SCALES: { id: ScaleId; label: string; notes: NoteName[] }[] = [
  {
    id: 'none',
    label: 'Single note',
    notes: []
  },
  {
    id: 'c-major',
    label: 'C Major (C4–C5)',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
  },
  {
    id: 'g-major',
    label: 'G Major (G3–G4)',
    notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4']
  },
  {
    id: 'd-major',
    label: 'D Major (D3–D4)',
    notes: ['D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4']
  }
];

function centsDifference(currentHz: number | undefined, targetHz: number | undefined): number | null {
  if (!currentHz || !targetHz) return null;
  return 1200 * Math.log2(currentHz / targetHz);
}

function getStatus(cents: number | null, tolerance: number) {
  if (cents === null) {
    return { label: 'No pitch detected', variant: 'secondary' as const };
  }
  const abs = Math.abs(cents);
  if (abs <= tolerance) return { label: 'In tune', variant: 'default' as const };
  if (abs <= tolerance * 2) return { label: 'Close', variant: 'outline' as const };
  return { label: 'Off target', variant: 'destructive' as const };
}

export function TargetTrainerModule({ state }: TargetTrainerModuleProps) {
  const [scaleId, setScaleId] = useState<ScaleId>('c-major');
  const [targetNote, setTargetNote] = useState<NoteName>('A4');
  const [tolerance, setTolerance] = useState<number>(50);

  const availableNotes = useMemo(() => {
    const scale = SCALES.find(s => s.id === scaleId);
    if (!scale || scale.id === 'none') {
      return Object.keys(NOTE_FREQUENCIES) as NoteName[];
    }
    return scale.notes;
  }, [scaleId]);

  const currentHz = state?.pitchHz;
  const targetHz = NOTE_FREQUENCIES[targetNote];
  const diffCents = centsDifference(currentHz, targetHz);
  const status = getStatus(diffCents, tolerance);

  const displayDiff = diffCents !== null ? diffCents.toFixed(1) : '--';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Target Trainer</CardTitle>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <CardDescription>Match your voice to a target note or scale</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Scale</span>
            <Select value={scaleId} onValueChange={value => setScaleId(value as ScaleId)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select scale" />
              </SelectTrigger>
              <SelectContent>
                {SCALES.map(scale => (
                  <SelectItem key={scale.id} value={scale.id}>
                    {scale.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Target Note</span>
            <Select
              value={targetNote}
              onValueChange={value => setTargetNote(value as NoteName)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select note" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {availableNotes.map(note => (
                  <SelectItem key={note} value={note}>
                    {note}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground">Tolerance</span>
            <span className="text-xs font-mono">±{tolerance.toFixed(0)}¢</span>
          </div>
          <Slider
            value={[tolerance]}
            onValueChange={([v]) => setTolerance(v)}
            min={5}
            max={100}
            step={1}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Difference</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-xl font-semibold ${
                  diffCents !== null && Math.abs(diffCents) <= tolerance ? 'text-green-600' : 'text-orange-600'
                }`}
              >
                {displayDiff}
              </span>
              <span className="text-xs text-muted-foreground">cents</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Current note</span>
            <div className="flex items-center gap-1">
              <Music2 className="h-3 w-3 text-slate-400" />
              <span className="text-sm font-medium">
                {state?.noteName ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
