export interface MicStreamConfig {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: string;
}

export interface MicStream {
  audioContext: AudioContext;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  highPassFilter: BiquadFilterNode;
  lowPassFilter: BiquadFilterNode;
  filteredOutput: AudioNode;
}

export async function createMicStream(config: MicStreamConfig = {}): Promise<MicStream> {
  const {
    echoCancellation = true,
    noiseSuppression = true,
    autoGainControl = false
  } = config;
  const { deviceId } = config;

  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation,
      noiseSuppression,
      autoGainControl,
      channelCount: 1,
      sampleRate: isIOS ? { ideal: 48000 } : undefined,
      deviceId: deviceId ? { exact: deviceId } : undefined
    }
  });

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const sourceNode = audioContext.createMediaStreamSource(stream);

  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = isIOS ? 90 : 80;
  highPassFilter.Q.value = 0.7071;

  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = isIOS ? 5000 : 3000;
  lowPassFilter.Q.value = 0.7071;

  sourceNode.connect(highPassFilter);
  highPassFilter.connect(lowPassFilter);

  return {
    audioContext,
    stream,
    sourceNode,
    highPassFilter,
    lowPassFilter,
    filteredOutput: lowPassFilter
  };
}

export function closeMicStream(micStream: MicStream): void {
  if (micStream.sourceNode) {
    micStream.sourceNode.disconnect();
  }

  if (micStream.stream) {
    micStream.stream.getTracks().forEach(track => track.stop());
  }

  if (micStream.audioContext && micStream.audioContext.state !== 'closed') {
    micStream.audioContext.close();
  }
}
