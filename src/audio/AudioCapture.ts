import { createMicStream, closeMicStream, MicStream } from './createMicStream';

export type AudioFrameCallback = (buffer: Float32Array, sampleRate: number) => void;

export class AudioCapture {
  private micStream: MicStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private callback: AudioFrameCallback | null = null;
  private bufferSize = 2048;
  private useWorklet = false;

  async start(callback: AudioFrameCallback, deviceId?: string): Promise<void> {
    try {
      this.callback = callback;
      const isIOS =
        typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
      this.bufferSize = isIOS ? 1024 : 2048;
      this.micStream = await createMicStream({
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        deviceId
      });

      this.analyserNode = this.micStream.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.bufferSize * 2;
      this.analyserNode.smoothingTimeConstant = isIOS ? 0.85 : 0.8;

      this.micStream.filteredOutput.connect(this.analyserNode);

      try {
        await this.micStream.audioContext.audioWorklet.addModule('/audio-processor.js');
        this.useWorklet = true;
        await this.startWithWorklet();
      } catch (error) {
        console.warn('AudioWorklet not available, falling back to ScriptProcessor', error);
        this.useWorklet = false;
        this.startWithScriptProcessor();
      }
    } catch (error) {
      console.error('Error starting audio capture:', error);
      this.cleanup();
      throw error;
    }
  }

  private async startWithWorklet(): Promise<void> {
    if (!this.micStream) return;

    this.audioWorkletNode = new AudioWorkletNode(
      this.micStream.audioContext,
      'audio-frame-processor'
    );

    this.audioWorkletNode.port.onmessage = (event) => {
      if (this.callback && event.data.frame) {
        this.callback(event.data.frame, event.data.sampleRate);
      }
    };

    this.micStream.filteredOutput.connect(this.audioWorkletNode);
    this.audioWorkletNode.connect(this.micStream.audioContext.destination);
  }

  private startWithScriptProcessor(): void {
    if (!this.micStream) return;

    this.scriptProcessorNode = this.micStream.audioContext.createScriptProcessor(
      this.bufferSize,
      1,
      1
    );

    this.scriptProcessorNode.onaudioprocess = (event) => {
      if (this.callback && this.micStream) {
        const inputData = event.inputBuffer.getChannelData(0);
        const frame = new Float32Array(inputData);
        this.callback(frame, this.micStream.audioContext.sampleRate);
      }
    };

    this.micStream.filteredOutput.connect(this.scriptProcessorNode);
    this.scriptProcessorNode.connect(this.micStream.audioContext.destination);
  }

  stop(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode.port.onmessage = null;
      this.audioWorkletNode = null;
    }

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode.onaudioprocess = null;
      this.scriptProcessorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.micStream) {
      closeMicStream(this.micStream);
      this.micStream = null;
    }

    this.callback = null;
  }

  getSampleRate(): number {
    return this.micStream?.audioContext.sampleRate ?? 44100;
  }

  isActive(): boolean {
    return this.micStream !== null && this.micStream.audioContext.state === 'running';
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }
}
