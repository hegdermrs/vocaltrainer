'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, ChevronLeft, ChevronRight } from 'lucide-react';
import { EngineState } from '@/src/engine/types';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasPitch = state?.pitchHz && state?.noteName;

  useEffect(() => {
    if (state?.pitchHz) {
      pitchHistory.push({
        frequency: state.pitchHz,
        timestamp: Date.now()
      });

      const cutoffTime = Date.now() - MAX_HISTORY_SECONDS * 1000;
      while (pitchHistory.length > 0 && pitchHistory[0].timestamp < cutoffTime) {
        pitchHistory.shift();
      }
    }
  }, [state?.pitchHz]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (pitchHistory.length < 2) return;

    const minFreq = 80;
    const maxFreq = 800;

    const now = Date.now();
    const timeRange = MAX_HISTORY_SECONDS * 1000;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    pitchHistory.forEach((point, i) => {
      const x = ((point.timestamp - (now - timeRange)) / timeRange) * width;
      const normalizedFreq = (point.frequency - minFreq) / (maxFreq - minFreq);
      const y = height - normalizedFreq * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const centerY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  const getCentsIndicator = () => {
    const cents = state?.cents ?? 0;
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
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          <CardTitle>Pitch Detection</CardTitle>
        </div>
        <CardDescription>Real-time pitch and note detection</CardDescription>
      </CardHeader>
      <CardContent>
        {hasPitch ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Note:</span>
              <span className="text-2xl font-bold">{state.noteName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Frequency:</span>
              <span className="text-lg font-semibold">{state.pitchHz?.toFixed(2)} Hz</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tuning:</span>
              <div className="flex items-center gap-2">
                {getCentsIndicator()}
                <span className={`text-lg font-semibold ${state.cents && Math.abs(state.cents) < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                  {state.cents && state.cents > 0 ? '+' : ''}{state.cents ?? 0}¢
                </span>
              </div>
            </div>
            {state.pitchConfidence !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <span className="text-sm">{(state.pitchConfidence * 100).toFixed(0)}%</span>
              </div>
            )}
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-1">Pitch History (5s)</div>
              <canvas
                ref={canvasRef}
                className="w-full h-16 bg-slate-50 rounded border border-slate-200"
                style={{ width: '100%', height: '64px' }}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No pitch detected
          </div>
        )}
      </CardContent>
    </Card>
  );
}
