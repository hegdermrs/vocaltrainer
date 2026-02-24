export interface BreathinessResult {
  breathiness: number;
  highFreqRatio: number;
  spectralFlatness: number;
}

const BREATHINESS_HISTORY_SIZE = 10;
const breathinessHistory: number[] = [];

export function calculateBreathiness(
  analyserNode: AnalyserNode | null,
  sampleRate: number
): number {
  if (!analyserNode) {
    return 0;
  }

  const fftSize = analyserNode.fftSize;
  const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(frequencyData);

  const binFrequency = sampleRate / fftSize;

  const lowFreqThresholdHz = 300;
  const highFreqThresholdHz = 4000;

  const lowFreqBinStart = Math.floor(lowFreqThresholdHz / binFrequency);
  const highFreqBinStart = Math.floor(highFreqThresholdHz / binFrequency);

  let lowEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;

  for (let i = lowFreqBinStart; i < frequencyData.length && i < highFreqBinStart * 2; i++) {
    const magnitude = frequencyData[i] / 255.0;
    totalEnergy += magnitude;

    if (i < highFreqBinStart) {
      lowEnergy += magnitude;
    } else {
      highEnergy += magnitude;
    }
  }

  if (totalEnergy < 0.01) {
    return breathinessHistory.length > 0
      ? breathinessHistory[breathinessHistory.length - 1]
      : 0;
  }

  const highFreqRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;

  const spectralFlatness = calculateSpectralFlatness(frequencyData);

  const breathinessScore = Math.min(1, (highFreqRatio * 0.6 + spectralFlatness * 0.4) * 1.8);

  breathinessHistory.push(breathinessScore);
  if (breathinessHistory.length > BREATHINESS_HISTORY_SIZE) {
    breathinessHistory.shift();
  }

  const smoothedBreathiness = breathinessHistory.reduce((sum, val) => sum + val, 0) / breathinessHistory.length;

  return Math.max(0, Math.min(1, smoothedBreathiness));
}

function calculateSpectralFlatness(frequencyData: Uint8Array): number {
  let geometricSum = 0;
  let arithmeticSum = 0;
  let count = 0;

  for (let i = 0; i < frequencyData.length; i++) {
    const magnitude = frequencyData[i] / 255.0;
    if (magnitude > 0.01) {
      geometricSum += Math.log(magnitude);
      arithmeticSum += magnitude;
      count++;
    }
  }

  if (count === 0) return 0;

  const geometricMean = Math.exp(geometricSum / count);
  const arithmeticMean = arithmeticSum / count;

  return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
}

export function resetBreathinessContext(): void {
  breathinessHistory.length = 0;
}
