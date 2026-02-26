'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw } from 'lucide-react';
import {
  getEngineSettings,
  resetEngineSettings,
  getAvailablePresets,
  applyPreset,
  getCurrentPreset,
  EnginePreset
} from '@/src/engine/engineSettings';

interface SettingsPanelProps {
  isRecording: boolean;
}

export function SettingsPanel({ isRecording }: SettingsPanelProps) {
  const [preset, setPreset] = useState<EnginePreset | 'custom'>(() => getCurrentPreset() ?? 'custom');

  const handleReset = () => {
    resetEngineSettings();
    setPreset(getCurrentPreset() ?? 'custom');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Presets</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Quick presets (applied on session start)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preset</span>
          <select
            className="h-8 rounded border border-slate-200 bg-background px-2 text-xs"
            value={preset}
            onChange={(e) => {
              const value = e.target.value as EnginePreset | 'custom';
              if (value === 'custom') {
                setPreset('custom');
                return;
              }
              applyPreset(value);
              getEngineSettings();
              setPreset(value);
            }}
          >
            <option value="custom">Custom</option>
            {getAvailablePresets().map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {!isRecording && (
          <div className="text-xs text-muted-foreground">
            Select a preset, then start your session.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
