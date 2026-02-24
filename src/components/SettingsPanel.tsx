'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw, Mic } from 'lucide-react';
import {
  getEngineSettings,
  updateEngineSettings,
  resetEngineSettings,
  getAvailablePresets,
  applyPreset,
  getCurrentPreset,
  EnginePreset
} from '@/src/engine/engineSettings';
import { startCalibration, getCalibrationState, setNoiseGate } from '@/src/engine/calibration';
import { Separator } from '@/components/ui/separator';

interface SettingsPanelProps {
  isRecording: boolean;
}

export function SettingsPanel({ isRecording }: SettingsPanelProps) {
  const [settings, setSettings] = useState(getEngineSettings());
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [preset, setPreset] = useState<EnginePreset | 'custom'>(() => getCurrentPreset() ?? 'custom');

  useEffect(() => {
    const interval = setInterval(() => {
      const state = getCalibrationState();
      if (state.isCalibrating) {
        setCalibrationProgress(state.progress);
        if (state.progress >= 100) {
          setCalibrating(false);
          const newSettings = getEngineSettings();
          setSettings(newSettings);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handleSettingChange = (key: string, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateEngineSettings({ [key]: value });

    if (key === 'noiseGateRMS') {
      setNoiseGate(value);
    }
  };

  const handleModuleToggle = (module: keyof typeof settings.modules, enabled: boolean) => {
    const newSettings = {
      ...settings,
      modules: { ...settings.modules, [module]: enabled }
    };
    setSettings(newSettings);
    updateEngineSettings({ modules: newSettings.modules });
  };

  const handleReset = () => {
    resetEngineSettings();
    setSettings(getEngineSettings());
    setPreset(getCurrentPreset() ?? 'custom');
  };

  const handleCalibrate = () => {
    if (!isRecording) return;
    setCalibrating(true);
    setCalibrationProgress(0);
    startCalibration();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Settings</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Configure analysis parameters and modules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Global Thresholds</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Preset</span>
              <select
                className="h-7 rounded border border-slate-200 bg-background px-2 text-xs"
                value={preset}
                onChange={(e) => {
                  const value = e.target.value as EnginePreset | 'custom';
                  if (value === 'custom') {
                    setPreset('custom');
                    return;
                  }
                  applyPreset(value);
                  const updated = getEngineSettings();
                  setSettings(updated);
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
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Noise Gate RMS</Label>
              <span className="text-xs font-mono">{settings.noiseGateRMS.toFixed(4)}</span>
            </div>
            <Slider
              value={[settings.noiseGateRMS * 10000]}
              onValueChange={([v]) => handleSettingChange('noiseGateRMS', v / 10000)}
              min={1}
              max={50}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Pitch Confidence</Label>
              <span className="text-xs font-mono">{(settings.pitchConfidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[settings.pitchConfidenceThreshold * 100]}
              onValueChange={([v]) => handleSettingChange('pitchConfidenceThreshold', v / 100)}
              min={30}
              max={95}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Cents Tolerance</Label>
              <span className="text-xs font-mono">±{settings.centsTolerance}</span>
            </div>
            <Slider
              value={[settings.centsTolerance]}
              onValueChange={([v]) => handleSettingChange('centsTolerance', v)}
              min={5}
              max={100}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Smoothing</Label>
              <span className="text-xs font-mono">{(settings.smoothingAmount * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[settings.smoothingAmount * 100]}
              onValueChange={([v]) => handleSettingChange('smoothingAmount', v / 100)}
              min={0}
              max={80}
              step={5}
            />
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalibrate}
              disabled={!isRecording || calibrating}
              className="w-full"
            >
              <Mic className="h-4 w-4 mr-2" />
              {calibrating ? `Calibrating... ${calibrationProgress.toFixed(0)}%` : 'Calibrate Noise Gate'}
            </Button>
            {calibrating && (
              <div className="w-full bg-slate-200 rounded-full h-1 mt-2 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-100"
                  style={{ width: `${calibrationProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Active Modules</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Pitch Detection</Label>
              <Switch
                checked={settings.modules.pitch}
                onCheckedChange={(checked) => handleModuleToggle('pitch', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Pitch Stability</Label>
              <Switch
                checked={settings.modules.stability}
                onCheckedChange={(checked) => handleModuleToggle('stability', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Volume Control</Label>
              <Switch
                checked={settings.modules.volume}
                onCheckedChange={(checked) => handleModuleToggle('volume', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Breathiness</Label>
              <Switch
                checked={settings.modules.breathiness}
                onCheckedChange={(checked) => handleModuleToggle('breathiness', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Note Sustain</Label>
              <Switch
                checked={settings.modules.sustain}
                onCheckedChange={(checked) => handleModuleToggle('sustain', checked)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
