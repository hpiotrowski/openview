import { KLineBar } from './binance';

export interface SessionZone {
  name: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'LONDON_CLOSE';
  label: string;
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
  asianHighLine?: number;
  asianLowLine?: number;
  judasSwing?: {
    index: number;
    type: 'BULLISH_JUDAS' | 'BEARISH_JUDAS';
    price: number;
    sweptLevel: number;
  };
}

export interface KillzonesResult {
  sessions: SessionZone[];
  activeAsianHigh?: number;
  activeAsianLow?: number;
}

export class KillzonesCalculator {
  public static calculate(bars: KLineBar[]): KillzonesResult {
    if (!bars || bars.length < 10) {
      return { sessions: [] };
    }

    const sessions: SessionZone[] = [];
    let currentAsianHigh: number | undefined;
    let currentAsianLow: number | undefined;
    let currentDayKey = '';

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const date = new Date(b.timestamp);
      const dayKey = date.toISOString().slice(0, 10);
      const utcHour = date.getUTCHours();
      const utcMinute = date.getUTCMinutes();
      const timeDecimal = utcHour + utcMinute / 60;

      // New day reset
      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        currentAsianHigh = undefined;
        currentAsianLow = undefined;
      }

      // 1. Asian Session (00:00 - 08:00 UTC)
      if (timeDecimal >= 0 && timeDecimal < 8) {
        if (currentAsianHigh === undefined || b.high > currentAsianHigh) {
          currentAsianHigh = b.high;
        }
        if (currentAsianLow === undefined || b.low < currentAsianLow) {
          currentAsianLow = b.low;
        }

        const lastSession = sessions[sessions.length - 1];
        if (lastSession && lastSession.name === 'ASIA' && lastSession.endIndex === i - 1) {
          lastSession.endIndex = i;
          lastSession.high = Math.max(lastSession.high, b.high);
          lastSession.low = Math.min(lastSession.low, b.low);
          lastSession.asianHighLine = currentAsianHigh;
          lastSession.asianLowLine = currentAsianLow;
        } else {
          sessions.push({
            name: 'ASIA',
            label: 'Asian Session Range',
            startIndex: i,
            endIndex: i,
            high: b.high,
            low: b.low,
            asianHighLine: currentAsianHigh,
            asianLowLine: currentAsianLow,
          });
        }
      }

      // 2. London Open Killzone (07:00 - 10:00 UTC)
      if (timeDecimal >= 7 && timeDecimal < 10) {
        const lastSession = sessions[sessions.length - 1];
        let judasSwing: SessionZone['judasSwing'];

        if (currentAsianHigh && b.high > currentAsianHigh && b.close < currentAsianHigh) {
          judasSwing = {
            index: i,
            type: 'BEARISH_JUDAS',
            price: b.high,
            sweptLevel: currentAsianHigh,
          };
        } else if (currentAsianLow && b.low < currentAsianLow && b.close > currentAsianLow) {
          judasSwing = {
            index: i,
            type: 'BULLISH_JUDAS',
            price: b.low,
            sweptLevel: currentAsianLow,
          };
        }

        if (lastSession && lastSession.name === 'LONDON' && lastSession.endIndex === i - 1) {
          lastSession.endIndex = i;
          lastSession.high = Math.max(lastSession.high, b.high);
          lastSession.low = Math.min(lastSession.low, b.low);
          if (judasSwing && !lastSession.judasSwing) {
            lastSession.judasSwing = judasSwing;
          }
        } else {
          sessions.push({
            name: 'LONDON',
            label: 'London Open Killzone',
            startIndex: i,
            endIndex: i,
            high: b.high,
            low: b.low,
            asianHighLine: currentAsianHigh,
            asianLowLine: currentAsianLow,
            judasSwing,
          });
        }
      }

      // 3. New York Open Killzone (12:00 - 15:00 UTC)
      if (timeDecimal >= 12 && timeDecimal < 15) {
        const lastSession = sessions[sessions.length - 1];
        if (lastSession && lastSession.name === 'NEW_YORK' && lastSession.endIndex === i - 1) {
          lastSession.endIndex = i;
          lastSession.high = Math.max(lastSession.high, b.high);
          lastSession.low = Math.min(lastSession.low, b.low);
        } else {
          sessions.push({
            name: 'NEW_YORK',
            label: 'New York Open Killzone',
            startIndex: i,
            endIndex: i,
            high: b.high,
            low: b.low,
            asianHighLine: currentAsianHigh,
            asianLowLine: currentAsianLow,
          });
        }
      }
    }

    return {
      sessions,
      activeAsianHigh: currentAsianHigh,
      activeAsianLow: currentAsianLow,
    };
  }
}
