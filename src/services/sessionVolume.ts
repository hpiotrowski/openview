import { KLineBar } from './binance';
import { VolumeProfileCalculator, VolumeProfileRow } from './volumeProfile';

export interface DailySessionProfile {
  dateStr: string;
  startTimestamp: number;
  endTimestamp: number;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  maxRowVolume: number;
  isToday: boolean;
  rows: VolumeProfileRow[];
}

export interface SessionVolumeResult {
  sessions: DailySessionProfile[];
  todayPoc?: number;
  todayVah?: number;
  todayVal?: number;
  yesterdayPoc?: number;
  yesterdayVah?: number;
  yesterdayVal?: number;
}

export class SessionVolumeCalculator {
  static calculate(bars: KLineBar[], maxDays = 7): SessionVolumeResult | null {
    if (!bars || bars.length < 20) return null;

    // 1. Group bars by UTC calendar day
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

    if (dayKeys.length === 0) return null;

    // Analyze the last N days
    const targetDayKeys = dayKeys.slice(-maxDays);
    const sessions: DailySessionProfile[] = [];

    const todayKey = dayKeys[dayKeys.length - 1];
    const yesterdayKey = dayKeys.length >= 2 ? dayKeys[dayKeys.length - 2] : undefined;

    let todayPoc: number | undefined;
    let todayVah: number | undefined;
    let todayVal: number | undefined;
    let yesterdayPoc: number | undefined;
    let yesterdayVah: number | undefined;
    let yesterdayVal: number | undefined;

    for (const key of targetDayKeys) {
      const dayBars = dayMap.get(key);
      if (!dayBars || dayBars.length < 4) continue;

      const profile = VolumeProfileCalculator.calculate(dayBars, 28);
      if (!profile) continue;

      const isToday = key === todayKey;
      const isYesterday = key === yesterdayKey;

      if (isToday) {
        todayPoc = profile.pocPrice;
        todayVah = profile.vahPrice;
        todayVal = profile.valPrice;
      } else if (isYesterday) {
        yesterdayPoc = profile.pocPrice;
        yesterdayVah = profile.vahPrice;
        yesterdayVal = profile.valPrice;
      }

      sessions.push({
        dateStr: key,
        startTimestamp: dayBars[0].timestamp,
        endTimestamp: dayBars[dayBars.length - 1].timestamp,
        pocPrice: profile.pocPrice,
        vahPrice: profile.vahPrice,
        valPrice: profile.valPrice,
        totalVolume: profile.totalVolume,
        maxRowVolume: profile.maxRowVolume,
        isToday,
        rows: profile.rows,
      });
    }

    return {
      sessions,
      todayPoc,
      todayVah,
      todayVal,
      yesterdayPoc,
      yesterdayVah,
      yesterdayVal,
    };
  }
}
