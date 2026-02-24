export interface AirflowResult {
  consistency: number;
  smoothness: number;
  control: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
}

export class AirflowAnalyzer {
  private amplitudeHistory: number[] = [];
  private readonly maxHistory = 40;

  addFrame(buffer: Float32Array): void {
    const rms = Math.sqrt(
      buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length
    );

    this.amplitudeHistory.push(rms);
    if (this.amplitudeHistory.length > this.maxHistory) {
      this.amplitudeHistory.shift();
    }
  }

  analyze(): AirflowResult {
    if (this.amplitudeHistory.length < 10) {
      return {
        consistency: 0,
        smoothness: 0,
        control: 0,
        rating: 'poor'
      };
    }

    const mean = this.amplitudeHistory.reduce((sum, val) => sum + val, 0) / this.amplitudeHistory.length;

    const variance = this.amplitudeHistory.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    ) / this.amplitudeHistory.length;

    const consistency = Math.max(0, Math.min(100, 100 - Math.sqrt(variance) * 1000));

    let totalChange = 0;
    for (let i = 1; i < this.amplitudeHistory.length; i++) {
      totalChange += Math.abs(this.amplitudeHistory[i] - this.amplitudeHistory[i - 1]);
    }
    const avgChange = totalChange / (this.amplitudeHistory.length - 1);
    const smoothness = Math.max(0, Math.min(100, 100 - avgChange * 2000));

    const control = (consistency + smoothness) / 2;

    let rating: AirflowResult['rating'] = 'poor';
    if (control >= 80) {
      rating = 'excellent';
    } else if (control >= 60) {
      rating = 'good';
    } else if (control >= 40) {
      rating = 'fair';
    }

    return {
      consistency,
      smoothness,
      control,
      rating
    };
  }

  reset(): void {
    this.amplitudeHistory = [];
  }
}
