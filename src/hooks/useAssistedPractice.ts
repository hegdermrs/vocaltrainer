'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssistedGuide } from '@/src/audio/assistedGuide';
import {
  AssistedConfig,
  DEFAULT_ASSISTED_CONFIG,
  clampBpm,
  clampGuideVolume,
  clampTranspose,
  evaluateAssistedFollow,
  getExerciseSequence
} from '@/src/engine/assistedPractice';
import { EngineState } from '@/src/engine/types';
import { getEngineSettings } from '@/src/engine/engineSettings';

const ASSISTED_CONFIG_KEY = 'voice-trainer-assisted-config';

function loadAssistedConfig(): AssistedConfig {
  try {
    if (typeof window === 'undefined') return DEFAULT_ASSISTED_CONFIG;
    const raw = window.localStorage.getItem(ASSISTED_CONFIG_KEY);
    if (!raw) return DEFAULT_ASSISTED_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AssistedConfig>;
    return {
      voiceProfile: parsed.voiceProfile === 'female' ? 'female' : 'male',
      bpm: clampBpm(parsed.bpm ?? DEFAULT_ASSISTED_CONFIG.bpm),
      exerciseId:
        parsed.exerciseId === 'five_tone' ||
        parsed.exerciseId === 'octave' ||
        parsed.exerciseId === 'mixed_octave' ||
        parsed.exerciseId === 'long_arpeggio'
          ? parsed.exerciseId
          : 'three_tone',
      transposeSemitones: clampTranspose(parsed.transposeSemitones ?? 0),
      guideVolume: clampGuideVolume(parsed.guideVolume ?? DEFAULT_ASSISTED_CONFIG.guideVolume)
    };
  } catch {
    return DEFAULT_ASSISTED_CONFIG;
  }
}

export function useAssistedPractice() {
  const [assistedConfig, setAssistedConfig] = useState<AssistedConfig>(DEFAULT_ASSISTED_CONFIG);
  const [assistedTargetNote, setAssistedTargetNote] = useState<string | undefined>(undefined);
  const [assistedFollowStatus, setAssistedFollowStatus] =
    useState<'on-target' | 'near' | 'off' | 'no-pitch'>('no-pitch');
  const [assistedFollowAccuracy, setAssistedFollowAccuracy] = useState(0);

  const guideRef = useRef<AssistedGuide | null>(null);
  const isGuideRunningRef = useRef(false);
  const targetRef = useRef<string | undefined>(undefined);
  const eligibleFramesRef = useRef(0);
  const hitFramesRef = useRef(0);
  const pendingStatusRef = useRef<'on-target' | 'near' | 'off' | 'no-pitch'>('no-pitch');
  const pendingAccuracyRef = useRef(0);

  useEffect(() => {
    guideRef.current = new AssistedGuide();
    guideRef.current.setOnTargetChange((state) => {
      targetRef.current = state.targetNoteName;
      setAssistedTargetNote(state.targetNoteName);
    });
    setAssistedConfig(loadAssistedConfig());

    return () => {
      guideRef.current?.stop();
      guideRef.current = null;
    };
  }, []);

  const persistConfig = useCallback((config: AssistedConfig) => {
    setAssistedConfig(config);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ASSISTED_CONFIG_KEY, JSON.stringify(config));
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const updateAssistedConfig = useCallback(
    (next: AssistedConfig, options?: { restartGuide?: boolean }) => {
      const normalized: AssistedConfig = {
        voiceProfile: next.voiceProfile,
        bpm: clampBpm(next.bpm),
        exerciseId: next.exerciseId,
        transposeSemitones: clampTranspose(next.transposeSemitones),
        guideVolume: clampGuideVolume(next.guideVolume)
      };
      persistConfig(normalized);
      if (options?.restartGuide && isGuideRunningRef.current && guideRef.current) {
        guideRef.current.updateConfig(normalized);
      }
    },
    [persistConfig]
  );

  const resetSessionTracking = useCallback(() => {
    eligibleFramesRef.current = 0;
    hitFramesRef.current = 0;
    pendingStatusRef.current = 'no-pitch';
    pendingAccuracyRef.current = 0;
    setAssistedFollowStatus('no-pitch');
    setAssistedFollowAccuracy(0);
  }, []);

  const clearAssistedUi = useCallback(() => {
    targetRef.current = undefined;
    setAssistedTargetNote(undefined);
    resetSessionTracking();
  }, [resetSessionTracking]);

  const applyAssistedState = useCallback((state: EngineState, enabled: boolean): EngineState => {
    if (!enabled) {
      return {
        ...state,
        assistedTargetNote: undefined,
        assistedFollowHit: undefined,
        assistedFollowAccuracy: undefined
      };
    }

    const settings = getEngineSettings();
    const nextState: EngineState = {
      ...state,
      assistedTargetNote: targetRef.current
    };
    const follow = evaluateAssistedFollow(
      state.noteName,
      state.pitchHz,
      state.pitchConfidence,
      targetRef.current,
      settings.pitchConfidenceThreshold,
      settings.centsTolerance
    );

    nextState.assistedFollowHit = follow.hit;
    if (follow.eligible) {
      eligibleFramesRef.current += 1;
      if (follow.hit) {
        hitFramesRef.current += 1;
      }
    }

    pendingStatusRef.current = follow.status;
    pendingAccuracyRef.current =
      eligibleFramesRef.current > 0 ? hitFramesRef.current / eligibleFramesRef.current : 0;
    nextState.assistedFollowAccuracy = pendingAccuracyRef.current;
    return nextState;
  }, []);

  const commitFollowUi = useCallback(() => {
    setAssistedFollowStatus(pendingStatusRef.current);
    setAssistedFollowAccuracy(pendingAccuracyRef.current);
  }, []);

  const startGuideIfNeeded = useCallback(async (enabled: boolean, config: AssistedConfig) => {
    if (!enabled || !guideRef.current) return;
    await guideRef.current.start(config);
    isGuideRunningRef.current = true;
  }, []);

  const stopGuide = useCallback(() => {
    if (guideRef.current) {
      guideRef.current.stop();
    }
    isGuideRunningRef.current = false;
    targetRef.current = undefined;
    setAssistedTargetNote(undefined);
  }, []);

  const assistedSequence = useMemo(() => getExerciseSequence(assistedConfig), [assistedConfig]);

  return {
    assistedConfig,
    assistedTargetNote,
    assistedFollowStatus,
    assistedFollowAccuracy,
    assistedSequence,
    updateAssistedConfig,
    applyAssistedState,
    commitFollowUi,
    resetSessionTracking,
    clearAssistedUi,
    startGuideIfNeeded,
    stopGuide
  };
}



