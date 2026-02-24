import { AudioCapture } from './AudioCapture';
import { EngineState, createEmptyState } from '../engine/types';
import { updateEngine, resetEngineContext } from '../engine/updateEngine';

export type AnalysisCallback = (state: EngineState) => void;

export class VoiceAnalyzer {
  private audioCapture: AudioCapture;
  private callback: AnalysisCallback | null = null;
  private currentState: EngineState = createEmptyState();

  constructor() {
    this.audioCapture = new AudioCapture();
  }

  async start(callback: AnalysisCallback): Promise<void> {
    this.callback = callback;
    this.currentState = createEmptyState();
    resetEngineContext();
    await this.audioCapture.start(this.handleAudioFrame);
  }

  stop(): void {
    this.audioCapture.stop();
    this.callback = null;
    this.currentState = createEmptyState();
    resetEngineContext();
  }

  private handleAudioFrame = (buffer: Float32Array, sampleRate: number): void => {
    if (!this.callback) return;

    const analyserNode = this.audioCapture.getAnalyserNode();
    this.currentState = updateEngine(buffer, sampleRate, this.currentState, analyserNode);
    this.callback(this.currentState);
  };

  isActive(): boolean {
    return this.audioCapture.isActive();
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.audioCapture.getAnalyserNode();
  }
}
