import { KLineData } from 'klinecharts';

export interface SDZone {
  id: string;
  type: 'SUPPLY' | 'DEMAND';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  isTested: boolean;
  strength: 'STRONG' | 'NORMAL';
}

export interface LiquiditySweep {
  id: string;
  type: 'BEARISH_SWEEP' | 'BULLISH_SWEEP'; // Bearish sweep = swept high and rejected down; Bullish sweep = swept low and rejected up
  price: number;
  index: number;
}

export interface TradingSession {
  name: 'ASIA' | 'LONDON' | 'NEW_YORK';
  high: number;
  low: number;
  startIndex: number;
  endIndex: number;
  color: string;
}

export interface PremiumDiscount {
  high: number;
  low: number;
  equilibrium: number;
  startIndex: number;
}

export interface ZonesAnalysisResult {
  zones: SDZone[];
  sweeps: LiquiditySweep[];
  sessions: TradingSession[];
  premiumDiscount: PremiumDiscount | null;
}

export class SupplyDemandCalculator {
  // Simple ATR calculation
  private static calculateATR(bars: KLineData[], period = 14): number[] {
    const atrs: number[] = new Array(bars.length).fill(0);
    if (bars.length < 2) return atrs;

    let trSum = 0;
    for (let i = 1; i < bars.length; i++) {
      const h = bars[i].high;
      const l = bars[i].low;
      const prevC = bars[i - 1].close;
      const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));

      if (i <= period) {
        trSum += tr;
        atrs[i] = trSum / i;
      } else {
        atrs[i] = (atrs[i - 1] * (period - 1) + tr) / period;
      }
    }
    return atrs;
  }

  static calculate(bars: KLineData[]): ZonesAnalysisResult {
    if (!bars || bars.length < 10) {
      return { zones: [], sweeps: [], sessions: [], premiumDiscount: null };
    }

    const n = bars.length;
    const atrs = this.calculateATR(bars, 14);
    const zones: SDZone[] = [];
    const sweeps: LiquiditySweep[] = [];

    // 1. Supply & Demand Zones Detection (Displacement away from base candle)
    for (let i = 2; i < n; i++) {
      const base = bars[i - 1];
      const curr = bars[i];
      const atr = atrs[i] || (curr.high - curr.low);
      const body = Math.abs(curr.close - curr.open);

      const isDisplacementUp = curr.close > curr.open && body > atr * 1.4;
      const isDisplacementDown = curr.close < curr.open && body > atr * 1.4;

      // Demand Zone: base followed by impulsive expansion UP
      if (isDisplacementUp) {
        const top = Math.max(base.open, base.close);
        const bottom = base.low;
        let isTested = false;
        let endIndex = n - 1;

        for (let j = i + 1; j < n; j++) {
          if (bars[j].low <= top) {
            isTested = true;
            endIndex = j;
            break;
          }
        }

        zones.push({
          id: `demand-${i}`,
          type: 'DEMAND',
          top,
          bottom,
          startIndex: i - 1,
          endIndex,
          isTested,
          strength: body > atr * 2.0 ? 'STRONG' : 'NORMAL',
        });
      }

      // Supply Zone: base followed by impulsive expansion DOWN
      if (isDisplacementDown) {
        const top = base.high;
        const bottom = Math.min(base.open, base.close);
        let isTested = false;
        let endIndex = n - 1;

        for (let j = i + 1; j < n; j++) {
          if (bars[j].high >= bottom) {
            isTested = true;
            endIndex = j;
            break;
          }
        }

        zones.push({
          id: `supply-${i}`,
          type: 'SUPPLY',
          top,
          bottom,
          startIndex: i - 1,
          endIndex,
          isTested,
          strength: body > atr * 2.0 ? 'STRONG' : 'NORMAL',
        });
      }
    }

    // 2. Liquidity Sweeps / SFP (Swing Failure Pattern)
    // Find pivots and check if recent candles swept the pivot high/low and closed back inside
    for (let i = 15; i < n; i++) {
      const curr = bars[i];
      // Check last 10 bars for highest high
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      for (let j = i - 10; j < i; j++) {
        if (bars[j].high > highestHigh) highestHigh = bars[j].high;
        if (bars[j].low < lowestLow) lowestLow = bars[j].low;
      }

      // Bearish Sweep: Wick poked above previous high, but body closed below it
      if (curr.high > highestHigh && curr.close < highestHigh && curr.close < curr.open) {
        sweeps.push({
          id: `sweep-bear-${i}`,
          type: 'BEARISH_SWEEP',
          price: curr.high,
          index: i,
        });
      }

      // Bullish Sweep: Wick poked below previous low, but body closed above it
      if (curr.low < lowestLow && curr.close > lowestLow && curr.close > curr.open) {
        sweeps.push({
          id: `sweep-bull-${i}`,
          type: 'BULLISH_SWEEP',
          price: curr.low,
          index: i,
        });
      }
    }

    // 3. Premium / Discount Equilibrium over recent 100 bars
    let swingHigh = -Infinity;
    let swingLow = Infinity;
    const windowStart = Math.max(0, n - 80);
    for (let i = windowStart; i < n; i++) {
      if (bars[i].high > swingHigh) swingHigh = bars[i].high;
      if (bars[i].low < swingLow) swingLow = bars[i].low;
    }

    const premiumDiscount: PremiumDiscount = {
      high: swingHigh,
      low: swingLow,
      equilibrium: (swingHigh + swingLow) / 2,
      startIndex: windowStart,
    };

    return {
      zones: zones.slice(-15),
      sweeps: sweeps.slice(-8),
      sessions: [],
      premiumDiscount,
    };
  }
}
