import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Volume2, CheckCircle2, AlertCircle } from 'lucide-react';
import { EngineState } from '@/src/engine/types';

interface VolumeModuleProps {
  state: EngineState | null;
}

const CONSISTENCY_THRESHOLD = 60;

export function VolumeModule({ state }: VolumeModuleProps) {
  const rms = state?.rms ?? 0;
  const db = 20 * Math.log10(Math.max(rms, 0.00001));
  const level = Math.max(0, Math.min(100, (db + 60) * 1.67));
  const rawConsistency = state?.volumeConsistency ?? 0;
  const consistency = rawConsistency * 100;

  const isConsistent = consistency >= CONSISTENCY_THRESHOLD;

  const getConsistencyColor = () => {
    if (consistency >= 75) return 'bg-green-500';
    if (consistency >= 60) return 'bg-blue-500';
    if (consistency >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConsistencyStatus = () => {
    if (consistency >= 75) return 'Excellent';
    if (consistency >= 60) return 'Good';
    if (consistency >= 40) return 'Fair';
    return 'Inconsistent';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          <CardTitle>Volume Control</CardTitle>
        </div>
        <CardDescription>Monitor vocal volume and dynamics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Current RMS:</span>
              <span className="text-lg font-semibold">{rms.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Level:</span>
              <span className="text-sm font-medium">{level.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-150"
                style={{ width: `${level}%` }}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Steadiness:</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-semibold">{consistency.toFixed(0)}%</span>
                {isConsistent ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getConsistencyColor()}`}
                style={{ width: `${Math.max(consistency, 0)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className="text-xs font-medium">{getConsistencyStatus()}</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border-2 transition-all duration-300 ${
            isConsistent
              ? 'bg-green-50 border-green-500'
              : 'bg-slate-50 border-slate-300'
          }`}>
            <div className="flex items-center justify-center gap-2">
              {isConsistent ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">Consistent Volume</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Maintain Steadiness</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
