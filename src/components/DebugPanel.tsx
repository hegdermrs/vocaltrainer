'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface DebugPanelProps {
  currentRMS: number;
  noiseGate: number;
}

export function DebugPanel({ currentRMS, noiseGate }: DebugPanelProps) {
  const isAboveGate = currentRMS >= noiseGate;

  return (
    <Card className="border-slate-300 bg-slate-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-600" />
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </div>
        <CardDescription className="text-xs">Signal processing metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Current RMS:</span>
            <span className="font-mono font-semibold">{currentRMS.toFixed(6)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Noise Gate:</span>
            <span className="font-mono font-semibold">{noiseGate.toFixed(6)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-slate-600">Signal Status:</span>
            <span className={`font-semibold ${isAboveGate ? 'text-green-600' : 'text-orange-600'}`}>
              {isAboveGate ? 'VOICED' : 'UNVOICED'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
