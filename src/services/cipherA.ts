import { KLineBar } from './binance';

export interface RibbonPoint {
  index: number;
  timestamp?: number;
  ema5: number;
  ema11: number;
  ema15: number;
  ema21: number;
  ema27: number;
  ema33: number;
  ema40: number;
  ema48: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface CipherASignal {
  index: number;
  timestamp?: number;
  type: 'BLUE_TRIANGLE' | 'GREEN_DIAMOND' | 'RED_DIAMOND' | 'BLOODHOUND_DIVERGENCE';
  direction: 'BULLISH' | 'BEARISH';
  price: number;
  label: string;
}

export interface CipherAResult {
  ribbon: RibbonPoint[];
  signals: CipherASignal[];
}

export class CipherACalculator {
  private static calculateEMA(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArr: number[] = new Array(values.length);
    if (values.length === 0) return emaArr;

    let sum = 0;
    const initialCount = Math.min(period, values.length);
    for (let i = 0; i < initialCount; i++) {
      sum += values[i];
    }
    let prev = sum / initialCount;
    emaArr[initialCount - 1] = prev;

    for (let i = initialCount; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      emaArr[i] = prev;
    }
    // Fill leading items with initial SMA
    for (let i = 0; i < initialCount - 1; i++) {
      emaArr[i] = emaArr[initialCount - 1];
    }
    return emaArr;
  }

  public static calculate(bars: KLineBar[]): CipherAResult {
    if (!bars || bars.length < 50) {
      return { ribbon: [], signals: [] };
    }

    const closes = bars.map((b) => b.close);
    const ema5 = this.calculateEMA(closes, 5);
    const ema11 = this.calculateEMA(closes, 11);
    const ema15 = this.calculateEMA(closes, 15);
    const ema21 = this.calculateEMA(closes, 21);
    const ema27 = this.calculateEMA(closes, 27);
    const ema33 = this.calculateEMA(closes, 33);
    const ema40 = this.calculateEMA(closes, 40);
    const ema48 = this.calculateEMA(closes, 48);

    const ribbon: RibbonPoint[] = [];
    const signals: CipherASignal[] = [];

    for (let i = 0; i < bars.length; i++) {
      const e5 = ema5[i];
      const e11 = ema11[i];
      const e21 = ema21[i];
      const e48 = ema48[i];

      let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (e5 > e11 && e11 > e21 && e21 > e48) {
        trend = 'BULLISH';
      } else if (e5 < e11 && e11 < e21 && e21 < e48) {
        trend = 'BEARISH';
      }

      ribbon.push({
        index: i,
        timestamp: bars[i].timestamp,
        ema5: e5,
        ema11: e11,
        ema15: ema15[i],
        ema21: e21,
        ema27: ema27[i],
        ema33: ema33[i],
        ema40: ema40[i],
        ema48: e48,
        trend,
      });

      // 1. Blue Triangles (Short-term EMA 5 crosses long-term EMA 48 with high momentum)
      if (i > 1) {
        const prevE5 = ema5[i - 1];
        const prevE48 = ema48[i - 1];

        if (prevE5 <= prevE48 && e5 > e48) {
          signals.push({
            index: i,
            timestamp: bars[i].timestamp,
            type: 'BLUE_TRIANGLE',
            direction: 'BULLISH',
            price: bars[i].low * 0.997,
            label: 'BUY',
          });
        } else if (prevE5 >= prevE48 && e5 < e48) {
          signals.push({
            index: i,
            timestamp: bars[i].timestamp,
            type: 'BLUE_TRIANGLE',
            direction: 'BEARISH',
            price: bars[i].high * 1.003,
            label: 'SELL',
          });
        }
      }

      // 2. Green / Red Diamonds (Continuation bounce on pullback to EMA 21 in confirmed trend)
      if (i > 3 && trend !== 'NEUTRAL') {
        const b = bars[i];
        const prevB = bars[i - 1];

        // Bullish continuation: bar tests EMA 21 and closes above EMA 11
        if (trend === 'BULLISH' && prevB.low <= e21 && b.close > e11 && b.close > b.open) {
          if (!signals.some((s) => Math.abs(s.index - i) < 5 && s.type === 'GREEN_DIAMOND')) {
            signals.push({
              index: i,
              timestamp: bars[i].timestamp,
              type: 'GREEN_DIAMOND',
              direction: 'BULLISH',
              price: b.low * 0.995,
              label: 'Bullish Flow',
            });
          }
        }

        // Bearish continuation: bar tests EMA 21 and closes below EMA 11
        if (trend === 'BEARISH' && prevB.high >= e21 && b.close < e11 && b.close < b.open) {
          if (!signals.some((s) => Math.abs(s.index - i) < 5 && s.type === 'RED_DIAMOND')) {
            signals.push({
              index: i,
              timestamp: bars[i].timestamp,
              type: 'RED_DIAMOND',
              direction: 'BEARISH',
              price: b.high * 1.005,
              label: 'Bearish Flow',
            });
          }
        }
      }

      // 3. Bloodhound Divergences (Price new extreme, but ribbon spread narrowing)
      if (i > 10 && i % 8 === 0) {
        const recentBars = bars.slice(i - 8, i + 1);
        const highestBar = Math.max(...recentBars.map((r) => r.high));
        const lowestBar = Math.min(...recentBars.map((r) => r.low));
        const spreadNow = Math.abs(e5 - e48);
        const spreadBefore = Math.abs(ema5[i - 5] - ema48[i - 5]);

        if (bars[i].high >= highestBar && spreadNow < spreadBefore * 0.6) {
          signals.push({
            index: i,
            timestamp: bars[i].timestamp,
            type: 'BLOODHOUND_DIVERGENCE',
            direction: 'BEARISH',
            price: bars[i].high * 1.006,
            label: 'Exhaustion',
          });
        } else if (bars[i].low <= lowestBar && spreadNow < spreadBefore * 0.6) {
          signals.push({
            index: i,
            timestamp: bars[i].timestamp,
            type: 'BLOODHOUND_DIVERGENCE',
            direction: 'BULLISH',
            price: bars[i].low * 0.994,
            label: 'Exhaustion',
          });
        }
      }
    }

    return { ribbon, signals };
  }
}
