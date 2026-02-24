class AudioFrameProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 2048;
    this.buffer = new Float32Array(this.frameSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input.length > 0) {
      const inputChannel = input[0];

      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];

        if (this.bufferIndex >= this.frameSize) {
          this.port.postMessage({
            frame: this.buffer.slice(0),
            sampleRate: sampleRate
          });

          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor('audio-frame-processor', AudioFrameProcessor);
