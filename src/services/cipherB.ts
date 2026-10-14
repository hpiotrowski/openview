import { KLineData } from 'klinecharts';

export interface CipherBResult {
  wt1: number;
  wt2: number;
  mfi: number;
  buyDot: number | null;
  sellDot: number | null;
  goldDot: number | null;
}

export class CipherBCalculator {
  private static ema(data: number[], length: number): number[] {
    const k = 2 / (length + 1);
    const result: number[] = new Array(data.length);
    let prev = data[0] || 0;
    result[0] = prev;

    for (let i = 1; i < data.length; i++) {
      const val = data[i] * k + prev * (1 - k);
      result[i] = val;
      prev = val;
    }
    return result;
  }

  private static sma(data: number[], length: number): number[] {
    const result: number[] = new Array(data.length);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= length) {
        sum -= data[i - length];
        result[i] = sum / length;
      } else {
        result[i] = sum / (i + 1);
      }
    }
    return result;
  }

  static calculate(bars: KLineData[]): CipherBResult[] {
    if (!bars || bars.length === 0) return [];

    const n = bars.length;
    const hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);

    // 1. WaveTrend Calculation:
    // esa = ema(hlc3, 9)
    const esa = this.ema(hlc3, 9);

    // de = ema(abs(hlc3 - esa), 9)
    const diff = hlc3.map((v, i) => Math.abs(v - esa[i]));
    const de = this.ema(diff, 9);

    // ci = (hlc3 - esa) / (0.015 * de)
    const ci = hlc3.map((v, i) => {
      const denom = 0.015 * (de[i] || 0.00001);
      return (v - esa[i]) / denom;
    });

    // wt1 = ema(ci, 12)
    const wt1 = this.ema(ci, 12);
    // wt2 = sma(wt1, 3)
    const wt2 = this.sma(wt1, 3);

    // 2. Money Flow Index (MFI) Area calculation:
    // Raw Money flow over 30 periods normalized around 0
    const mfiWindow = 30;
    const mfi: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      let posFlow = 0;
      let negFlow = 0;
      const start = Math.max(0, i - mfiWindow);
      for (let j = start + 1; j <= i; j++) {
        const tp = hlc3[j];
        const prevTp = hlc3[j - 1];
        const vol = bars[j].volume || 1;
        if (tp > prevTp) posFlow += tp * vol;
        else if (tp < prevTp) negFlow += tp * vol;
      }
      const ratio = negFlow === 0 ? 100 : posFlow / negFlow;
      const rawMfi = 100 - 100 / (1 + ratio);
      // Center MFI around 0, scaled to -30 .. +30 to sit nicely on the WaveTrend panel
      mfi[i] = (rawMfi - 50) * 0.8;
    }

    // 3. Dot triggers
    const results: CipherBResult[] = [];
    for (let i = 0; i < n; i++) {
      const prevWt1 = i > 0 ? wt1[i - 1] : wt1[0];
      const prevWt2 = i > 0 ? wt2[i - 1] : wt2[0];
      const currWt1 = wt1[i];
      const currWt2 = wt2[i];

      // Green Dot: WT1 crosses WT2 upward from oversold zone (<= -20)
      const isCrossUp = prevWt1 < prevWt2 && currWt1 >= currWt2;
      const isOversold = currWt2 <= -20;
      const isBuy = isCrossUp && isOversold;

      // Red Dot: WT1 crosses WT2 downward from overbought zone (>= 20)
      const isCrossDown = prevWt1 > prevWt2 && currWt1 <= currWt2;
      const isOverbought = currWt2 >= 20;
      const isSell = isCrossDown && isOverbought;

      // Gold Dot: Extreme oversold trigger (WT2 <= -60)
      const isGold = isBuy && currWt2 <= -55;

      results.push({
        wt1: Math.round(currWt1 * 100) / 100,
        wt2: Math.round(currWt2 * 100) / 100,
        mfi: Math.round(mfi[i] * 100) / 100,
        buyDot: isBuy ? currWt2 : null,
        sellDot: isSell ? currWt2 : null,
        goldDot: isGold ? currWt2 : null,
      });
    }

    return results;
  }
}
