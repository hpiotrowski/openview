import { KLineData } from 'klinecharts';

export interface CVDResult {
  delta: number;
  cvd: number;
  divergence: 'BULLISH' | 'BEARISH' | null;
}

export class CVDCalculator {
  static calculate(bars: KLineData[]): CVDResult[] {
    if (!bars || bars.length === 0) return [];

    const results: CVDResult[] = [];
    let runningCVD = 0;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const totalVol = b.volume || 1;
      const takerBuy = (b.takerBuyVolume as number) || totalVol * 0.5;
      const takerSell = totalVol - takerBuy;
      const delta = takerBuy - takerSell;

      runningCVD += delta;

      // Check simple divergence over 15 bars
      let div: 'BULLISH' | 'BEARISH' | null = null;
      if (i > 15) {
        const prevPrice = bars[i - 10].low;
        const currPrice = b.low;
        const prevCvd = results[i - 10].cvd;
        const currCvd = runningCVD;

        if (currPrice < prevPrice && currCvd > prevCvd) {
          div = 'BULLISH';
        } else if (b.high > bars[i - 10].high && runningCVD < results[i - 10].cvd) {
          div = 'BEARISH';
        }
      }

      results.push({
        delta: Math.round(delta * 100) / 100,
        cvd: Math.round(runningCVD * 100) / 100,
        divergence: div,
      });
    }

    return results;
  }
}
