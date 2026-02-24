'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Timer, Settings } from 'lucide-react';
import { EngineState } from '@/src/engine/types';
import { useState, useEffect } from 'react';
import { getSustainSettings, setSustainSettings, resetBestSustain } from '@/src/engine/sustainAnalysis';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SustainModuleProps {
  state: EngineState | null;
}

export function SustainModule({ state }: SustainModuleProps) {
  const duration = state?.sustainSeconds ?? 0;
  const bestDuration = state?.bestSustainSeconds ?? 0;
  const isSustaining = state?.isSustaining ?? false;

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(getSustainSettings());

  useEffect(() => {
    const current = getSustainSettings();
    setSettings(current);
  }, []);

  const handleSettingChange = (key: keyof typeof settings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSustainSettings({ [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <CardTitle>Note Sustain</CardTitle>
          </div>
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
        <CardDescription>Track note duration and hold</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current:</span>
            <span className="text-2xl font-bold">{duration.toFixed(1)}s</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Best:</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-blue-600">{bestDuration.toFixed(1)}s</span>
              {bestDuration > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetBestSustain}
                  className="h-6 px-2 text-xs"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className={`text-sm font-semibold ${isSustaining ? 'text-green-600' : 'text-slate-400'}`}>
              {isSustaining ? 'Sustaining' : 'Idle'}
            </span>
          </div>

          {duration > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Quality:</span>
                <span className="text-sm">
                  {duration > 3 ? 'Excellent' : duration > 2 ? 'Good' : duration > 1 ? 'Fair' : 'Building'}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min((duration / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <Collapsible open={showSettings}>
            <CollapsibleContent className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Pitch Confidence</Label>
                  <span className="text-xs font-mono">{(settings.pitchConfidenceThreshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[settings.pitchConfidenceThreshold * 100]}
                  onValueChange={([v]) => handleSettingChange('pitchConfidenceThreshold', v / 100)}
                  min={30}
                  max={90}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Pitch Tolerance</Label>
                  <span className="text-xs font-mono">±{settings.centsTolerance} cents</span>
                </div>
                <Slider
                  value={[settings.centsTolerance]}
                  onValueChange={([v]) => handleSettingChange('centsTolerance', v)}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Min Volume</Label>
                  <span className="text-xs font-mono">{(settings.minRMSThreshold * 1000).toFixed(1)}</span>
                </div>
                <Slider
                  value={[settings.minRMSThreshold * 1000]}
                  onValueChange={([v]) => handleSettingChange('minRMSThreshold', v / 1000)}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
