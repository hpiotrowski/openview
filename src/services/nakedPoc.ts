import { KLineBar } from './binance';
import { VolumeProfileCalculator } from './volumeProfile';

export interface NakedPocItem {
  id: string;
  dateStr: string;
  pocPrice: number;
  startTimestamp: number;
  endTimestamp: number;
  totalVolume: number;
  isMitigated: boolean;
  mitigatedTimestamp?: number;
  distancePercent: number; // percentage distance from current price
}

export interface NakedPocResult {
  items: NakedPocItem[];
  activeCount: number;
}

export class NakedPocCalculator {
  static calculate(bars: KLineBar[], maxDaysLookback = 14): NakedPocResult | null {
    if (!bars || bars.length < 50) return null;

    // 1. Group bars by UTC day
    const dayMap = new Map<string, KLineBar[]>();
    const dayKeys: string[] = [];

    for (const b of bars) {
      const dateStr = new Date(b.timestamp).toISOString().slice(0, 10);
      let list = dayMap.get(dateStr);
      if (!list) {
        list = [];
        dayMap.set(dateStr, list);
        dayKeys.push(dateStr);
      }
      list.push(b);
    }

    if (dayKeys.length < 2) return null;

    const currentPrice = bars[bars.length - 1].close;
    // We only analyze past completed days (exclude current todayKey)
    const completedDayKeys = dayKeys.slice(0, dayKeys.length - 1).slice(-maxDaysLookback);

    const items: NakedPocItem[] = [];

    for (const dayKey of completedDayKeys) {
      const dayBars = dayMap.get(dayKey);
      if (!dayBars || dayBars.length < 5) continue;

      const profile = VolumeProfileCalculator.calculate(dayBars, 30);
      if (!profile) continue;

      const pocPrice = profile.pocPrice;
      const startTimestamp = dayBars[0].timestamp;
      const endTimestamp = dayBars[dayBars.length - 1].timestamp;

      // 2. Check if any subsequent bar after endTimestamp mitigated/touched pocPrice
      let isMitigated = false;
      let mitigatedTimestamp: number | undefined;

      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (b.timestamp <= endTimestamp) continue;

        // Price touched or crossed through POC
        if (b.low <= pocPrice && b.high >= pocPrice) {
          isMitigated = true;
          mitigatedTimestamp = b.timestamp;
          break;
        }
      }

      const distancePercent = ((currentPrice - pocPrice) / pocPrice) * 100;

      items.push({
        id: `npoc_${dayKey}`,
        dateStr: dayKey,
        pocPrice,
        startTimestamp,
        endTimestamp,
        totalVolume: profile.totalVolume,
        isMitigated,
        mitigatedTimestamp,
        distancePercent: parseFloat(distancePercent.toFixed(2)),
      });
    }

    // Filter to prioritize active (unmitigated) nPOCs
    const activeCount = items.filter((i) => !i.isMitigated).length;

    return {
      items,
      activeCount,
    };
  }
}
