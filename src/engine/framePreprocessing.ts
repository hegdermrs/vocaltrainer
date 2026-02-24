export interface PreprocessedFrame {
  original: Float32Array;
  normalized: Float32Array;
  rms: number;
  isVoiced: boolean;
}

export function preprocessFrame(frame: Float32Array, noiseGate: number): PreprocessedFrame {
  const rms = calculateRMS(frame);

  const isVoiced = rms >= noiseGate;

  const dcRemoved = removeDCOffset(frame);

  let normalized: Float32Array;
  if (isVoiced) {
    normalized = normalizeFrame(dcRemoved, rms);
  } else {
    normalized = new Float32Array(dcRemoved.length);
  }

  return {
    original: frame,
    normalized,
    rms,
    isVoiced
  };
}

function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

function removeDCOffset(buffer: Float32Array): Float32Array {
  const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;

  const result = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] - mean;
  }

  return result;
}

function normalizeFrame(buffer: Float32Array, currentRMS: number): Float32Array {
  const targetRMS = 0.15;

  if (currentRMS === 0) {
    return new Float32Array(buffer.length);
  }

  let scale = targetRMS / currentRMS;
  scale = Math.max(0.8, Math.min(150, scale));

  const result = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] * scale;
  }

  return result;
}
