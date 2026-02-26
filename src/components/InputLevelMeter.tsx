import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface InputLevelMeterProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
}

export function InputLevelMeter({ analyserNode, isActive }: InputLevelMeterProps) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!analyserNode || !isActive) {
      setLevel(0);
      return;
    }

    let animationId: number;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);

    const updateLevel = () => {
      analyserNode.getFloatTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);

      const db = 20 * Math.log10(Math.max(rms, 0.00001));
      const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.67));

      setLevel(normalizedLevel);
      animationId = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [analyserNode, isActive]);

  const getColorClass = () => {
    if (level < 20) return 'bg-slate-400';
    if (level < 50) return 'bg-green-500';
    if (level < 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Input Level</span>
          <span className="text-slate-600">{level.toFixed(0)}%</span>
        </div>
        <div className="text-center text-4xl font-bold tabular-nums text-slate-700">
          {level.toFixed(0)}%
        </div>
        {!isActive && (
          <p className="text-xs text-slate-500 text-center">
            Start session to see input level
          </p>
        )}
      </div>
    </Card>
  );
}
