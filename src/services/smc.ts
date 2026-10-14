import { KLineData } from 'klinecharts';

export interface FairValueGap {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  isMitigated: boolean;
}

export interface OrderBlock {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  isMitigated: boolean;
}

export interface StructureBreak {
  type: 'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  price: number;
  index: number;
}

export interface SMCResult {
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  breaks: StructureBreak[];
}

export class SMCCalculator {
  static calculate(bars: KLineData[]): SMCResult {
    if (!bars || bars.length < 5) {
      return { fvgs: [], orderBlocks: [], breaks: [] };
    }

    const n = bars.length;
    const fvgs: FairValueGap[] = [];
    const orderBlocks: OrderBlock[] = [];
    const breaks: StructureBreak[] = [];

    // 1. Detect Fair Value Gaps (FVG)
    for (let i = 2; i < n; i++) {
      const b0 = bars[i - 2];
      const b2 = bars[i];

      // Bullish FVG: 3-candle pattern where Low of current candle > High of candle from 2 bars ago
      if (b2.low > b0.high) {
        const top = b2.low;
        const bottom = b0.high;
        let isMitigated = false;
        let endIndex = n - 1;

        // Check if subsequent bars mitigate this gap
        for (let j = i + 1; j < n; j++) {
          if (bars[j].low <= top) {
            isMitigated = true;
            endIndex = j;
            break;
          }
        }

        fvgs.push({
          id: `fvg-bull-${i}`,
          type: 'BULLISH',
          top,
          bottom,
          startIndex: i - 1,
          endIndex,
          isMitigated,
        });
      }

      // Bearish FVG: High of current candle < Low of candle from 2 bars ago
      if (b2.high < b0.low) {
        const top = b0.low;
        const bottom = b2.high;
        let isMitigated = false;
        let endIndex = n - 1;

        for (let j = i + 1; j < n; j++) {
          if (bars[j].high >= bottom) {
            isMitigated = true;
            endIndex = j;
            break;
          }
        }

        fvgs.push({
          id: `fvg-bear-${i}`,
          type: 'BEARISH',
          top,
          bottom,
          startIndex: i - 1,
          endIndex,
          isMitigated,
        });
      }
    }

    // 2. Detect Swing Highs, Swing Lows and Order Blocks (OB)
    // Pivot window = 4
    const pivotLen = 4;
    interface SwingPoint {
      index: number;
      price: number;
      type: 'HIGH' | 'LOW';
    }
    const swings: SwingPoint[] = [];

    for (let i = pivotLen; i < n - pivotLen; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = i - pivotLen; j <= i + pivotLen; j++) {
        if (j !== i) {
          if (bars[j].high >= bars[i].high) isHigh = false;
          if (bars[j].low <= bars[i].low) isLow = false;
        }
      }
      if (isHigh) swings.push({ index: i, price: bars[i].high, type: 'HIGH' });
      if (isLow) swings.push({ index: i, price: bars[i].low, type: 'LOW' });
    }

    // Detect Structure Breaks (BOS / CHOCH) and Order Blocks
    let lastTrend: 'UP' | 'DOWN' = 'UP';
    for (let i = 1; i < swings.length; i++) {
      const prev = swings[i - 1];
      const curr = swings[i];

      if (curr.type === 'HIGH' && prev.type === 'HIGH') {
        if (curr.price > prev.price) {
          // Break of Structure (BOS)
          breaks.push({
            type: lastTrend === 'UP' ? 'BOS' : 'CHOCH',
            direction: 'BULLISH',
            price: prev.price,
            index: curr.index,
          });
          lastTrend = 'UP';

          // Bullish Order Block: find the last down candle before this impulse
          let obIdx = curr.index - 1;
          while (obIdx > prev.index && bars[obIdx].close >= bars[obIdx].open) {
            obIdx--;
          }
          if (obIdx >= prev.index) {
            const obCandle = bars[obIdx];
            orderBlocks.push({
              id: `ob-bull-${obIdx}`,
              type: 'BULLISH',
              top: obCandle.high,
              bottom: obCandle.low,
              startIndex: obIdx,
              endIndex: Math.min(n - 1, obIdx + 30),
              isMitigated: false,
            });
          }
        }
      } else if (curr.type === 'LOW' && prev.type === 'LOW') {
        if (curr.price < prev.price) {
          // Break of Structure (BOS Down)
          breaks.push({
            type: lastTrend === 'DOWN' ? 'BOS' : 'CHOCH',
            direction: 'BEARISH',
            price: prev.price,
            index: curr.index,
          });
          lastTrend = 'DOWN';

          // Bearish Order Block: find the last up candle before this impulse
          let obIdx = curr.index - 1;
          while (obIdx > prev.index && bars[obIdx].close <= bars[obIdx].open) {
            obIdx--;
          }
          if (obIdx >= prev.index) {
            const obCandle = bars[obIdx];
            orderBlocks.push({
              id: `ob-bear-${obIdx}`,
              type: 'BEARISH',
              top: obCandle.high,
              bottom: obCandle.low,
              startIndex: obIdx,
              endIndex: Math.min(n - 1, obIdx + 30),
              isMitigated: false,
            });
          }
        }
      }
    }

    return {
      // Return the most recent 15 unmitigated or active FVGs and OBs
      fvgs: fvgs.slice(-20),
      orderBlocks: orderBlocks.slice(-15),
      breaks: breaks.slice(-15),
    };
  }
}
