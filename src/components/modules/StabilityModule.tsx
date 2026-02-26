'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { getStabilityJitterValues } from '@/src/engine/stabilityAnalysis';

interface StabilityModuleProps {
  state: EngineState | null;
}

export function StabilityModule({ state }: StabilityModuleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stability = state?.pitchStability ?? 0;
  const stabilityPercent = stability * 100;
  const vibratoRate = state?.vibratoRateHz;
  const vibratoDepth = state?.vibratoDepthCents;

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

    const jitterValues = getStabilityJitterValues(50);

    if (jitterValues.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', width / 2, height / 2);
      return;
    }

    const minFreq = Math.min(...jitterValues);
    const maxFreq = Math.max(...jitterValues);
    const range = maxFreq - minFreq || 1;

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    jitterValues.forEach((freq, i) => {
      const x = (i / (jitterValues.length - 1)) * width;
      const normalizedFreq = (freq - minFreq) / range;
      const y = height - normalizedFreq * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    ctx.fillStyle = '#0ea5e9';
    jitterValues.forEach((freq, i) => {
      const x = (i / (jitterValues.length - 1)) * width;
      const normalizedFreq = (freq - minFreq) / range;
      const y = height - normalizedFreq * height;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const centerY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  const getStabilityColor = () => {
    if (stabilityPercent > 80) return 'bg-green-500';
    if (stabilityPercent > 60) return 'bg-blue-500';
    if (stabilityPercent > 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getStabilityStatus = () => {
    if (stabilityPercent > 80) return 'Excellent';
    if (stabilityPercent > 60) return 'Good';
    if (stabilityPercent > 40) return 'Fair';
    return 'Poor';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle>Pitch Stability</CardTitle>
        </div>
        <CardDescription>Track pitch consistency over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Stability:</span>
              <span className="text-lg font-semibold">{stabilityPercent.toFixed(0)}%</span>
            </div>
            <div className="text-center text-5xl font-bold tabular-nums text-slate-700">
              {stabilityPercent.toFixed(0)}%
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className="text-sm font-medium">{getStabilityStatus()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-sm text-muted-foreground">Vibrato:</span>
            {vibratoRate && vibratoDepth ? (
              <span className="text-sm font-medium">
                {vibratoRate.toFixed(1)} Hz, {vibratoDepth.toFixed(0)}¢
              </span>
            ) : (
              <span className="text-xs text-slate-400">Hold a steady, vibrato-rich note to analyze</span>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Jitter Graph (1.5s)</div>
            <canvas
              ref={canvasRef}
              className="w-full h-12 bg-slate-50 rounded border border-slate-200"
              style={{ width: '100%', height: '48px' }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
