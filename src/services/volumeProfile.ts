import { KLineBar } from './binance';

export interface VolumeProfileRow {
  price: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  isPOC: boolean;
  isValueArea: boolean;
}

export interface VolumeProfileResult {
  rows: VolumeProfileRow[];
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  maxRowVolume: number;
}

export class VolumeProfileCalculator {
  static calculate(bars: KLineBar[], rowCount = 40, valueAreaPercent = 0.7): VolumeProfileResult | null {
    if (!bars || bars.length === 0) return null;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalVolume = 0;

    for (const b of bars) {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      totalVolume += b.volume;
    }

    if (minPrice >= maxPrice || totalVolume === 0) return null;

    const priceStep = (maxPrice - minPrice) / rowCount;
    const rows: VolumeProfileRow[] = [];

    for (let i = 0; i < rowCount; i++) {
      const price = minPrice + (i + 0.5) * priceStep;
      rows.push({
        price,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        isPOC: false,
        isValueArea: false,
      });
    }

    // Distribute bar volumes across price rows
    for (const b of bars) {
      const barRange = Math.max(b.high - b.low, priceStep);
      const buyRatio = b.takerBuyVolume ? b.takerBuyVolume / b.volume : 0.5;

      const startIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((b.low - minPrice) / priceStep)));
      const endIdx = Math.max(0, Math.min(rowCount - 1, Math.floor((b.high - minPrice) / priceStep)));
      const span = Math.max(1, endIdx - startIdx + 1);

      const volPerStep = b.volume / span;
      for (let idx = startIdx; idx <= endIdx; idx++) {
        rows[idx].totalVolume += volPerStep;
        rows[idx].buyVolume += volPerStep * buyRatio;
        rows[idx].sellVolume += volPerStep * (1 - buyRatio);
      }
    }

    // Find POC (Point of Control)
    let pocIdx = 0;
    let maxRowVolume = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].totalVolume > maxRowVolume) {
        maxRowVolume = rows[i].totalVolume;
        pocIdx = i;
      }
    }
    rows[pocIdx].isPOC = true;
    const pocPrice = rows[pocIdx].price;

    // Calculate Value Area (70% around POC)
    const targetValueAreaVol = totalVolume * valueAreaPercent;
    let currentVaVol = rows[pocIdx].totalVolume;
    rows[pocIdx].isValueArea = true;

    let up = pocIdx + 1;
    let down = pocIdx - 1;

    while (currentVaVol < targetValueAreaVol && (up < rows.length || down >= 0)) {
      const upVol = up < rows.length ? rows[up].totalVolume : -1;
      const downVol = down >= 0 ? rows[down].totalVolume : -1;

      if (upVol >= downVol && up < rows.length) {
        currentVaVol += upVol;
        rows[up].isValueArea = true;
        up++;
      } else if (down >= 0) {
        currentVaVol += downVol;
        rows[down].isValueArea = true;
        down--;
      } else if (up < rows.length) {
        currentVaVol += upVol;
        rows[up].isValueArea = true;
        up++;
      }
    }

    let valPrice = rows[0].price;
    let vahPrice = rows[rows.length - 1].price;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].isValueArea) {
        valPrice = rows[i].price;
        break;
      }
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].isValueArea) {
        vahPrice = rows[i].price;
        break;
      }
    }

    return {
      rows,
      pocPrice,
      vahPrice,
      valPrice,
      totalVolume,
      maxRowVolume,
    };
  }
}
