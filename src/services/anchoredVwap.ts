import { KLineBar } from './binance';

export interface VwapPoint {
  index: number;
  vwap: number;
  upper1: number;
  lower1: number;
  upper2: number;
  lower2: number;
}

export interface AnchoredVwapResult {
  anchorIndex: number;
  anchorType: 'HIGH' | 'LOW' | 'START';
  anchorPrice: number;
  points: VwapPoint[];
}

export class AnchoredVwapCalculator {
  public static calculate(bars: KLineBar[], anchorType: 'HIGH' | 'LOW' | 'START' = 'HIGH'): AnchoredVwapResult | null {
    if (!bars || bars.length < 5) return null;

    let anchorIndex = 0;
    let anchorPrice = bars[0].close;

    if (anchorType === 'HIGH') {
      let maxHigh = -Infinity;
      bars.forEach((b, idx) => {
        if (b.high > maxHigh) {
          maxHigh = b.high;
          anchorIndex = idx;
          anchorPrice = b.high;
        }
      });
    } else if (anchorType === 'LOW') {
      let minLow = Infinity;
      bars.forEach((b, idx) => {
        if (b.low < minLow) {
          minLow = b.low;
          anchorIndex = idx;
          anchorPrice = b.low;
        }
      });
    } else {
      anchorIndex = 0;
      anchorPrice = bars[0].open;
    }

    let cumPV = 0;
    let cumVol = 0;
    const points: VwapPoint[] = [];

    // Temporary storage for calculating variance
    const segmentBars: { typical: number; volume: number }[] = [];

    for (let i = anchorIndex; i < bars.length; i++) {
      const b = bars[i];
      const typical = (b.high + b.low + b.close) / 3;
      const vol = b.volume || 1;

      cumPV += typical * vol;
      cumVol += vol;
      const vwap = cumPV / (cumVol || 1);

      segmentBars.push({ typical, volume: vol });

      // Calculate variance from current vwap
      let sumSqDiff = 0;
      for (const sb of segmentBars) {
        sumSqDiff += sb.volume * Math.pow(sb.typical - vwap, 2);
      }
      const variance = sumSqDiff / (cumVol || 1);
      const stdDev = Math.sqrt(variance);

      points.push({
        index: i,
        vwap,
        upper1: vwap + stdDev,
        lower1: vwap - stdDev,
        upper2: vwap + 2 * stdDev,
        lower2: vwap - 2 * stdDev,
      });
    }

    return {
      anchorIndex,
      anchorType,
      anchorPrice,
      points,
    };
  }
}
