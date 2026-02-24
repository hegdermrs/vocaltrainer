import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wind } from 'lucide-react';
import { EngineState } from '@/src/engine/types';

interface AirflowModuleProps {
  state: EngineState | null;
}

export function AirflowModule({ state }: AirflowModuleProps) {
  const breathiness = (state?.breathiness ?? 0) * 100;

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
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5" />
          <CardTitle>Breathiness</CardTitle>
        </div>
        <CardDescription>Spectral noise analysis (proxy estimate)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Level:</span>
              <span className="text-2xl font-bold tabular-nums">{breathiness.toFixed(0)}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getBarColor(breathiness)}`}
                style={{ width: `${breathiness}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Clean</span>
            <span className="font-medium">Breathy ↔ Clean</span>
            <span>Breathy</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">Quality:</span>
            <span className={`text-sm font-semibold ${getQualityColor(breathiness)}`}>
              {breathiness < 30 ? 'Clean' : breathiness < 60 ? 'Moderate' : 'Breathy'}
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mt-2">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Breathiness is estimated from high-frequency spectral content.
              Lower values indicate clearer vocal tone.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
