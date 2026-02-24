export interface MicStreamConfig {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
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

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation,
      noiseSuppression,
      autoGainControl
    }
  });

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);

  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 80;
  highPassFilter.Q.value = 0.7071;

  const lowPassFilter = audioContext.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 1000;
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
