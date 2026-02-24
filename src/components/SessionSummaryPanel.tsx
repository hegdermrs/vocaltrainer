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
}

interface SessionSummaryPanelProps {
  sessions: SessionSummary[];
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function SessionSummaryPanel({ sessions }: SessionSummaryPanelProps) {
  const latest = sessions[0];

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
            Start and stop a recording session to see your best sustain, average stability, and tuning
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
            <div className="text-xs text-muted-foreground">Avg stability</div>
            <div className="text-xl font-semibold">
              {(latest.avgStability * 100).toFixed(0)}
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

        <div className="border-t pt-3">
          <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
            <span>Best sustain across sessions</span>
            <span className="font-medium">
              {bestSustain.toFixed(1)}
              <span className="ml-0.5 text-[10px] text-muted-foreground">s</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${Math.min((bestSustain / Math.max(bestSustain, 5)) * 100, 100)}%` }}
            />
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
                  <span>{(s.avgStability * 100).toFixed(0)}% stab.</span>
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

