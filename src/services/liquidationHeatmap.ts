import { KLineBar } from './binance';

export interface LiquidationCluster {
  id: string;
  type: 'SHORT_LIQ' | 'LONG_LIQ';
  price: number;
  leverage: string; // '100x' | '50x' | '25x' | '10x'
  intensity: number; // 0 to 1
  volumeUsdEstimate: number; // Millions USD
  isCleared: boolean;
  distancePct: number;
}

export interface LiquidationHeatmapResult {
  currentPrice: number;
  clusters: LiquidationCluster[];
  magnetCluster?: LiquidationCluster;
}

export class LiquidationHeatmapCalculator {
  public static calculate(bars: KLineBar[]): LiquidationHeatmapResult | null {
    if (!bars || bars.length < 30) return null;

    const currentPrice = bars[bars.length - 1].close;
    const clusters: LiquidationCluster[] = [];

    // Find local pivot highs and lows
    const pivotHighs: { index: number; price: number; volume: number }[] = [];
    const pivotLows: { index: number; price: number; volume: number }[] = [];

    const window = 5;
    for (let i = window; i < bars.length - window; i++) {
      const b = bars[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= window; j++) {
        if (bars[i - j].high >= b.high || bars[i + j].high >= b.high) isHigh = false;
        if (bars[i - j].low <= b.low || bars[i + j].low <= b.low) isLow = false;
      }

      if (isHigh) {
        pivotHighs.push({ index: i, price: b.high, volume: b.volume || 1 });
      }
      if (isLow) {
        pivotLows.push({ index: i, price: b.low, volume: b.volume || 1 });
      }
    }

    const leverageTiers = [
      { lev: '100x', pct: 0.01, baseVol: 12.5 },
      { lev: '50x', pct: 0.02, baseVol: 8.2 },
      { lev: '25x', pct: 0.04, baseVol: 5.4 },
      { lev: '10x', pct: 0.10, baseVol: 3.1 },
    ];

    // 1. Calculate Short Liquidations above Pivot Highs
    pivotHighs.slice(-6).forEach((ph) => {
      leverageTiers.forEach((tier) => {
        const liqPrice = ph.price * (1 + tier.pct);
        // Has this level been swept since the pivot?
        const subsequentBars = bars.slice(ph.index);
        const isCleared = subsequentBars.some((b) => b.high >= liqPrice);

        if (!isCleared && liqPrice > currentPrice) {
          const distPct = ((liqPrice - currentPrice) / currentPrice) * 100;
          if (distPct < 15) {
            const volEst = tier.baseVol * (1 + Math.log10(ph.volume || 10) * 0.2);
            clusters.push({
              id: `short-${ph.index}-${tier.lev}`,
              type: 'SHORT_LIQ',
              price: liqPrice,
              leverage: tier.lev,
              intensity: Math.min(1, volEst / 15),
              volumeUsdEstimate: Math.round(volEst * 10) / 10,
              isCleared: false,
              distancePct: distPct,
            });
          }
        }
      });
    });

    // 2. Calculate Long Liquidations below Pivot Lows
    pivotLows.slice(-6).forEach((pl) => {
      leverageTiers.forEach((tier) => {
        const liqPrice = pl.price * (1 - tier.pct);
        const subsequentBars = bars.slice(pl.index);
        const isCleared = subsequentBars.some((b) => b.low <= liqPrice);

        if (!isCleared && liqPrice < currentPrice) {
          const distPct = ((currentPrice - liqPrice) / currentPrice) * 100;
          if (distPct < 15) {
            const volEst = tier.baseVol * (1 + Math.log10(pl.volume || 10) * 0.2);
            clusters.push({
              id: `long-${pl.index}-${tier.lev}`,
              type: 'LONG_LIQ',
              price: liqPrice,
              leverage: tier.lev,
              intensity: Math.min(1, volEst / 15),
              volumeUsdEstimate: Math.round(volEst * 10) / 10,
              isCleared: false,
              distancePct: distPct,
            });
          }
        }
      });
    });

    // Sort clusters by distance from current price
    clusters.sort((a, b) => a.distancePct - b.distancePct);

    // Identify the strongest immediate magnet cluster
    const magnetCluster = clusters[0];

    return {
      currentPrice,
      clusters,
      magnetCluster,
    };
  }
}
