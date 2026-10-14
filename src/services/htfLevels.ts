import { KLineBar } from './binance';

export interface HtfLevelItem {
  id: string;
  name: string;
  shortName: string;
  price: number;
  color: string;
  type: 'PDH' | 'PDL' | 'PWH' | 'PWL' | 'DO' | 'WO' | 'MO' | 'MONDAY_HIGH' | 'MONDAY_LOW';
  dashed?: boolean;
  isSwept?: boolean;
  description: string;
}

export interface HtfLevelsResult {
  levels: HtfLevelItem[];
  pdh?: number;
  pdl?: number;
  pwh?: number;
  pwl?: number;
  dailyOpen?: number;
  weeklyOpen?: number;
  monthlyOpen?: number;
  mondayHigh?: number;
  mondayLow?: number;
}

interface DaySummary {
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startTimestamp: number;
}

export class HtfLevelsCalculator {
  static calculate(bars: KLineBar[]): HtfLevelsResult | null {
    if (!bars || bars.length < 10) return null;

    // 1. Group bars by UTC calendar date
    const dayMap = new Map<string, DaySummary>();
    const dayKeys: string[] = [];

    for (const b of bars) {
      const d = new Date(b.timestamp);
      const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

      const existing = dayMap.get(dateStr);
      if (!existing) {
        dayMap.set(dateStr, {
          dateStr,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          dayOfWeek: d.getUTCDay(),
          startTimestamp: b.timestamp,
        });
        dayKeys.push(dateStr);
      } else {
        if (b.high > existing.high) existing.high = b.high;
        if (b.low < existing.low) existing.low = b.low;
        existing.close = b.close;
      }
    }

    if (dayKeys.length === 0) return null;

    const currentBar = bars[bars.length - 1];
    const currentPrice = currentBar.close;

    // 2. Identify Current Day & Previous Day
    const todayKey = dayKeys[dayKeys.length - 1];
    const todaySummary = dayMap.get(todayKey)!;

    let yesterdaySummary: DaySummary | null = null;
    if (dayKeys.length >= 2) {
      yesterdaySummary = dayMap.get(dayKeys[dayKeys.length - 2]) || null;
    }

    const levels: HtfLevelItem[] = [];

    // Daily Open (DO)
    const dailyOpen = todaySummary.open;
    levels.push({
      id: 'DO',
      name: 'Daily Open',
      shortName: 'DO',
      price: dailyOpen,
      color: '#00bcd4', // Cyan
      type: 'DO',
      dashed: true,
      description: 'Current UTC day opening price (00:00 UTC)',
    });

    // Previous Day High / Low (PDH / PDL)
    let pdh: number | undefined;
    let pdl: number | undefined;

    if (yesterdaySummary) {
      pdh = yesterdaySummary.high;
      pdl = yesterdaySummary.low;

      const isPdhSwept = todaySummary.high > pdh;
      const isPdlSwept = todaySummary.low < pdl;

      levels.push({
        id: 'PDH',
        name: 'Previous Day High',
        shortName: isPdhSwept ? 'PDH (Swept)' : 'PDH',
        price: pdh,
        color: '#ff9800', // Amber/Orange
        type: 'PDH',
        dashed: false,
        isSwept: isPdhSwept,
        description: 'Yesterday high - key liquidity magnet for stop hunts',
      });

      levels.push({
        id: 'PDL',
        name: 'Previous Day Low',
        shortName: isPdlSwept ? 'PDL (Swept)' : 'PDL',
        price: pdl,
        color: '#ff9800', // Amber/Orange
        type: 'PDL',
        dashed: false,
        isSwept: isPdlSwept,
        description: 'Yesterday low - key liquidity magnet for stop hunts',
      });
    }

    // 3. Weekly Open (WO) & Previous Week High / Low (PWH / PWL)
    // Find the Monday of current week
    let currentWeekStartIdx = -1;
    for (let i = dayKeys.length - 1; i >= 0; i--) {
      const summary = dayMap.get(dayKeys[i])!;
      if (summary.dayOfWeek === 1) {
        // Monday
        currentWeekStartIdx = i;
        break;
      }
    }

    let weeklyOpen: number | undefined;
    let mondayHigh: number | undefined;
    let mondayLow: number | undefined;

    if (currentWeekStartIdx !== -1) {
      const mondaySummary = dayMap.get(dayKeys[currentWeekStartIdx])!;
      weeklyOpen = mondaySummary.open;
      mondayHigh = mondaySummary.high;
      mondayLow = mondaySummary.low;

      levels.push({
        id: 'WO',
        name: 'Weekly Open',
        shortName: 'WO',
        price: weeklyOpen,
        color: '#2962ff', // Royal Blue
        type: 'WO',
        dashed: true,
        description: 'Opening price of the current week (Monday 00:00 UTC)',
      });

      // Monday Range (MH / ML)
      levels.push({
        id: 'MONDAY_HIGH',
        name: 'Monday High',
        shortName: 'Monday High',
        price: mondayHigh,
        color: '#10b981', // Emerald
        type: 'MONDAY_HIGH',
        dashed: true,
        description: 'High of Monday - defines weekly trading range bounds',
      });

      levels.push({
        id: 'MONDAY_LOW',
        name: 'Monday Low',
        shortName: 'Monday Low',
        price: mondayLow,
        color: '#10b981', // Emerald
        type: 'MONDAY_LOW',
        dashed: true,
        description: 'Low of Monday - defines weekly trading range bounds',
      });

      // Previous Week (days before currentWeekStartIdx)
      let prevWeekHigh = -Infinity;
      let prevWeekLow = Infinity;
      let prevWeekBarsCount = 0;

      // Look back up to 7 days before current Monday
      for (let i = currentWeekStartIdx - 1; i >= Math.max(0, currentWeekStartIdx - 7); i--) {
        const s = dayMap.get(dayKeys[i])!;
        if (s.high > prevWeekHigh) prevWeekHigh = s.high;
        if (s.low < prevWeekLow) prevWeekLow = s.low;
        prevWeekBarsCount++;
      }

      if (prevWeekBarsCount > 0 && prevWeekHigh > -Infinity && prevWeekLow < Infinity) {
        const isPwhSwept = currentPrice > prevWeekHigh || todaySummary.high > prevWeekHigh;
        const isPwlSwept = currentPrice < prevWeekLow || todaySummary.low < prevWeekLow;

        levels.push({
          id: 'PWH',
          name: 'Previous Week High',
          shortName: isPwhSwept ? 'PWH (Swept)' : 'PWH',
          price: prevWeekHigh,
          color: '#e040fb', // Magenta/Purple
          type: 'PWH',
          dashed: false,
          isSwept: isPwhSwept,
          description: 'Previous calendar week high',
        });

        levels.push({
          id: 'PWL',
          name: 'Previous Week Low',
          shortName: isPwlSwept ? 'PWL (Swept)' : 'PWL',
          price: prevWeekLow,
          color: '#e040fb', // Magenta/Purple
          type: 'PWL',
          dashed: false,
          isSwept: isPwlSwept,
          description: 'Previous calendar week low',
        });
      }
    }

    // 4. Monthly Open (MO)
    const currentMonthPrefix = todayKey.slice(0, 7); // YYYY-MM
    for (let i = 0; i < dayKeys.length; i++) {
      if (dayKeys[i].startsWith(currentMonthPrefix)) {
        const firstDayOfMonth = dayMap.get(dayKeys[i])!;
        const monthlyOpen = firstDayOfMonth.open;
        levels.push({
          id: 'MO',
          name: 'Monthly Open',
          shortName: 'MO',
          price: monthlyOpen,
          color: '#ffd600', // Gold/Yellow
          type: 'MO',
          dashed: true,
          description: 'Opening price of current month (1st day 00:00 UTC)',
        });
        break;
      }
    }

    // Sort levels by price descending for clean visualization
    levels.sort((a, b) => b.price - a.price);

    return {
      levels,
      pdh,
      pdl,
      dailyOpen,
      weeklyOpen,
      mondayHigh,
      mondayLow,
    };
  }
}
