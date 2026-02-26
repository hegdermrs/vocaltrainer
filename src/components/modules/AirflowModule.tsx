import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wind } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { InfoTooltip } from '@/src/components/ui/info-tooltip';

interface AirflowModuleProps {
  state: EngineState | null;
}

export function AirflowModule({ state }: AirflowModuleProps) {
  const breathiness = (state?.breathiness ?? 0) * 100;
  const debug = state?.breathinessDebug;

  const getQualityColor = (value: number) => {
    if (value < 30) return 'text-green-600';
    if (value < 60) return 'text-amber-600';
    return 'text-orange-600';
  };

  const getBarColor = (value: number) => {
    if (value < 30) return 'bg-green-600';
    if (value < 60) return 'bg-amber-500';
    return 'bg-orange-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            <CardTitle>Breathiness</CardTitle>
          </div>
          <InfoTooltip text="Estimates how airy/noisy your tone is. Lower % means clearer tone; higher % means breathier." />
        </div>
        <CardDescription>Spectral noise analysis (proxy estimate)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground">Level</div>
            <div className={`text-center text-6xl font-bold tabular-nums ${getQualityColor(breathiness)}`}>
              {breathiness.toFixed(0)}%
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Clean</span>
            <span className="font-medium">Breathy ↔ Clean</span>
            <span>Breathy</span>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {breathiness < 30 ? 'Clean' : breathiness < 60 ? 'Moderate' : 'Breathy'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
