'use client';

import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CalibrationBannerProps {
  progress: number;
}

export function CalibrationBanner({ progress }: CalibrationBannerProps) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-blue-900">Calibrating...</h3>
            <p className="text-sm text-blue-700">Measuring ambient noise level</p>
          </div>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-150"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
