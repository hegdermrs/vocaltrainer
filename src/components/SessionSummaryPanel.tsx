'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SessionSummary {
  id: number;
  timestamp: string;
  maxSustainSeconds: number;
  avgStability: number;
  tuningAccuracy: number;
  scaleAccuracy: number;
}

interface SessionSummaryPanelProps {
  sessions: SessionSummary[];
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function SessionSummaryPanel({
  sessions
}: SessionSummaryPanelProps) {
  const latest = sessions[0];
  const chartData = sessions.slice(0, 12).reverse();

  const bestSustain = useMemo(
    () => Math.max(0, ...sessions.map((s) => s.maxSustainSeconds)),
    [sessions]
  );

  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
          <CardDescription>No completed sessions yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start and stop a recording session to see your best sustain, in-scale accuracy, and tuning
            accuracy.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Session Summary</CardTitle>
          <CardDescription>Last {sessions.length} sessions (most recent first)</CardDescription>
        </div>
        <Badge variant="outline" className="text-xs">
          Last: {formatDate(latest.timestamp)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Max sustain</div>
            <div className="text-xl font-semibold">
              {latest.maxSustainSeconds.toFixed(1)}
              <span className="ml-0.5 text-xs text-muted-foreground">s</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">In-scale accuracy</div>
            <div className="text-xl font-semibold">
              {(latest.scaleAccuracy * 100).toFixed(0)}
              <span className="ml-0.5 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Tuning accuracy</div>
            <div className="text-xl font-semibold">
              {(latest.tuningAccuracy * 100).toFixed(0)}
              <span className="ml-0.5 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricChart
              label="Max Sustain (s)"
              values={chartData.map((s) => s.maxSustainSeconds)}
              format={(v) => v.toFixed(1)}
              color="#2563eb"
              compact
            />
            <MetricChart
              label="In-Scale Accuracy (%)"
              values={chartData.map((s) => s.scaleAccuracy * 100)}
              format={(v) => `${v.toFixed(0)}%`}
              color="#16a34a"
              compact
            />
            <MetricChart
              label="Tuning Accuracy (%)"
              values={chartData.map((s) => s.tuningAccuracy * 100)}
              format={(v) => `${v.toFixed(0)}%`}
              color="#f59e0b"
              compact
            />
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Best sustain across sessions</span>
            <span className="font-medium">
              {bestSustain.toFixed(1)}
              <span className="ml-0.5 text-[10px] text-muted-foreground">s</span>
            </span>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Recent sessions</div>
          <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
            {sessions.slice(0, 10).map((s) => (
              <div key={s.id} className="flex justify-between gap-2">
                <span className="truncate">{formatDate(s.timestamp)}</span>
                <span className="flex gap-2 tabular-nums">
                  <span>{s.maxSustainSeconds.toFixed(1)}s</span>
                  <span>{(s.scaleAccuracy * 100).toFixed(0)}% in-scale</span>
                  <span>{(s.tuningAccuracy * 100).toFixed(0)}% in tune</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricChartProps {
  label: string;
  values: number[];
  format: (v: number) => string;
  color: string;
  compact?: boolean;
}

function MetricChart({ label, values, format, color, compact = false }: MetricChartProps) {
  if (values.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        {label}: —
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const last = values[values.length - 1];
  const lastPoint = points.split(' ').slice(-1)[0].split(',');

  return (
    <div className={`space-y-1 rounded-lg border border-slate-200 p-3 ${compact ? 'bg-white' : ''}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{format(last)}</span>
      </div>
      <svg viewBox="0 0 100 100" className={compact ? 'w-full h-12' : 'w-full h-16'}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="2.5"
          fill={color}
        />
      </svg>
    </div>
  );
}
