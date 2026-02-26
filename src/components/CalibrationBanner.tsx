'use client';

import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CalibrationBannerProps {
  progress: number;
  secondsLeft?: number;
}

export function CalibrationBanner({ progress, secondsLeft }: CalibrationBannerProps) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Loader2
            className="h-5 w-5 text-blue-600"
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <div>
            <h3 className="font-semibold text-blue-900">Calibrating...</h3>
            <p className="text-sm text-blue-700">Do not sing or speak</p>
          </div>
        </div>
        <div className="min-w-[96px] text-right">
          <div className="text-3xl font-bold text-blue-900 tabular-nums">
            {secondsLeft ?? 0}s
          </div>
          <div className="text-xs text-blue-700">remaining</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="text-xs text-blue-700 text-center">
          {Math.round(progress)}% complete
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Card>
  );
}
