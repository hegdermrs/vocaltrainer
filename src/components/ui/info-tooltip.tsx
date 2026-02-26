'use client';

import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="relative group">
      <Info className="h-4 w-4 text-slate-400" />
      <div className="pointer-events-none absolute right-0 top-6 z-50 w-56 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {text}
      </div>
    </div>
  );
}
