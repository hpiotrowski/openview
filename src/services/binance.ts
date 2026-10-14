export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
  takerBuyVolume?: number; // for volume delta
  [key: string]: unknown;
}

export interface WatchlistTicker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export const POPULAR_SYMBOLS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'ADAUSDT', name: 'Cardano' },
  { symbol: 'AVAXUSDT', name: 'Avalanche' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol' },
  { symbol: 'SUIUSDT', name: 'Sui' },
  { symbol: 'PEPEUSDT', name: 'Pepe' },
  { symbol: 'LINKUSDT', name: 'Chainlink' },
];

export const TIMEFRAMES = [
  { label: '1s', value: '1s', isCustom: true },
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '2h', value: '2h' },
  { label: '4h', value: '4h' },
  { label: '8h', value: '8h' },
  { label: '12h', value: '12h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

export function parseIntervalMs(intv: string): number {
  if (intv.endsWith('s')) return (parseInt(intv) || 1) * 1000;
  if (intv.endsWith('m')) return (parseInt(intv) || 1) * 60 * 1000;
  if (intv.endsWith('h')) return (parseInt(intv) || 1) * 3600 * 1000;
  if (intv.toLowerCase().endsWith('d')) return (parseInt(intv) || 1) * 86400 * 1000;
  if (intv.toLowerCase().endsWith('w')) return (parseInt(intv) || 1) * 7 * 86400 * 1000;
  return 60 * 1000;
}

interface WSChannelEntry {
  ws: WebSocket | null;
  close: () => void;
  setActiveBar?: (bar: KLineBar) => void;
}

export class BinanceService {
  private static wsMap = new Map<string, WSChannelEntry>();

  // Fetch historical OHLCV bars
  static async fetchKlines(symbol: string, interval: string, limit = 1000, endTime?: number): Promise<KLineBar[]> {
    try {
      let url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
      if (endTime) {
        url += `&endTime=${endTime}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }
      const raw = await response.json();
      return raw.map((item: any[]) => ({
        timestamp: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        turnover: parseFloat(item[7]),
        takerBuyVolume: parseFloat(item[9]),
      }));
    } catch (error) {
      console.error('Error fetching Binance klines:', error);
      return [];
    }
  }

  // Subscribe to live kline & real-time aggTrade updates via combined WebSocket
  static subscribeKlines(
    channelId: string,
    symbol: string,
    interval: string,
    onBarUpdate: (bar: KLineBar) => void,
    initialBar?: KLineBar
  ) {
    this.unsubscribe(channelId);

    const streamSymbol = symbol.toLowerCase();
    const intervalMs = parseIntervalMs(interval);
    // Combined stream: kline (official candle structure) + aggTrade (tick-level sub-50ms price updates)
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamSymbol}@kline_${interval}/${streamSymbol}@aggTrade`;
    let isClosed = false;
    let currentWs: WebSocket | null = null;

    // Local copy of the active forming candle
    let activeBar: KLineBar | null = initialBar ? { ...initialBar } : null;

    const connect = () => {
      if (isClosed) return;
      try {
        const ws = new WebSocket(wsUrl);
        currentWs = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const data = payload.data || payload;

            if (data.e === 'kline' && data.k) {
              const k = data.k;
              activeBar = {
                timestamp: k.t,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                turnover: parseFloat(k.q),
                takerBuyVolume: parseFloat(k.V),
              };
              onBarUpdate({ ...activeBar });
            } else if (data.e === 'aggTrade') {
              const price = parseFloat(data.p);
              const quantity = parseFloat(data.q);
              const isBuyerMaker = data.m;
              const tradeTime = data.T || Date.now();

              if (activeBar && intervalMs > 0 && tradeTime >= activeBar.timestamp + intervalMs) {
                // New candle period has started before the next kline heartbeat arrives
                const candleStart = Math.floor(tradeTime / intervalMs) * intervalMs;
                activeBar = {
                  timestamp: candleStart,
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                  volume: quantity,
                  turnover: price * quantity,
                  takerBuyVolume: isBuyerMaker ? 0 : quantity,
                };
                onBarUpdate({ ...activeBar });
              } else if (activeBar) {
                activeBar.close = price;
                if (price > activeBar.high) activeBar.high = price;
                if (price < activeBar.low) activeBar.low = price;
                activeBar.volume += quantity;
                activeBar.turnover = (activeBar.turnover || 0) + price * quantity;
                if (!isBuyerMaker) {
                  activeBar.takerBuyVolume = (activeBar.takerBuyVolume || 0) + quantity;
                }
                onBarUpdate({ ...activeBar });
              } else {
                // No active bar yet: create pseudo bar aligned with interval
                const candleStart = intervalMs > 0 ? Math.floor(tradeTime / intervalMs) * intervalMs : tradeTime;
                activeBar = {
                  timestamp: candleStart,
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                  volume: quantity,
                  turnover: price * quantity,
                  takerBuyVolume: isBuyerMaker ? 0 : quantity,
                };
                onBarUpdate({ ...activeBar });
              }
            }
          } catch (err) {
            console.error('WebSocket parse error:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn(`WebSocket error for ${symbol}:`, err);
        };

        ws.onclose = () => {
          if (!isClosed) {
            setTimeout(connect, 2000);
          }
        };
      } catch (e) {
        console.warn(`Failed to connect WebSocket for ${symbol}:`, e);
      }
    };

    const close = () => {
      isClosed = true;
      if (currentWs) {
        try {
          currentWs.close();
        } catch (e) {}
      }
    };

    const setActiveBar = (bar: KLineBar) => {
      activeBar = { ...bar };
    };

    this.wsMap.set(channelId, {
      get ws() {
        return currentWs;
      },
      close,
      setActiveBar,
    });

    connect();
  }

  // Update active forming bar dynamically from outside (e.g. after REST fetch)
  static setActiveBar(channelId: string, bar: KLineBar) {
    const entry = this.wsMap.get(channelId);
    if (entry && entry.setActiveBar) {
      entry.setActiveBar(bar);
    }
  }

  // Unsubscribe a specific channel cleanly
  static unsubscribe(channelId: string) {
    const entry = this.wsMap.get(channelId);
    if (entry) {
      try {
        entry.close();
      } catch (e) {}
      this.wsMap.delete(channelId);
    }
  }

  // Real-time miniTicker stream for the entire market (1-second live updates)
  static subscribeWatchlist(
    channelId: string,
    onTickersUpdate: (tickers: WatchlistTicker[]) => void
  ) {
    this.unsubscribe(channelId);
    const wsUrl = `wss://stream.binance.com:9443/ws/!miniTicker@arr`;
    let isClosed = false;
    let currentWs: WebSocket | null = null;

    const connect = () => {
      if (isClosed) return;
      try {
        const ws = new WebSocket(wsUrl);
        currentWs = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!Array.isArray(data)) return;
            const symbolMap = new Map<string, any>(data.map((d: any) => [d.s, d]));

            const updated: WatchlistTicker[] = POPULAR_SYMBOLS.map((s) => {
              const item = symbolMap.get(s.symbol);
              if (item) {
                const price = parseFloat(item.c);
                const open = parseFloat(item.o);
                const change = open > 0 ? ((price - open) / open) * 100 : 0;
                return {
                  symbol: s.symbol,
                  name: s.name,
                  price,
                  change24h: parseFloat(change.toFixed(2)),
                  high24h: parseFloat(item.h),
                  low24h: parseFloat(item.l),
                  volume24h: parseFloat(item.q),
                };
              }
              return {
                symbol: s.symbol,
                name: s.name,
                price: 0,
                change24h: 0,
                high24h: 0,
                low24h: 0,
                volume24h: 0,
              };
            });

            onTickersUpdate(updated);
          } catch (e) {}
        };

        ws.onclose = () => {
          if (!isClosed) {
            setTimeout(connect, 3000);
          }
        };
      } catch (e) {}
    };

    const close = () => {
      isClosed = true;
      if (currentWs) {
        try {
          currentWs.close();
        } catch (e) {}
      }
    };

    this.wsMap.set(channelId, {
      get ws() {
        return currentWs;
      },
      close,
    });

    connect();
  }

  // Fetch 24h tickers for watchlist (initial snapshot)
  static async fetch24hTickers(): Promise<WatchlistTicker[]> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!response.ok) return [];
      const data = await response.json();
      const symbolMap = new Map<string, any>(data.map((d: any) => [d.symbol, d]));

      return POPULAR_SYMBOLS.map((s) => {
        const item = symbolMap.get(s.symbol);
        return {
          symbol: s.symbol,
          name: s.name,
          price: item ? parseFloat(item.lastPrice) : 0,
          change24h: item ? parseFloat(item.priceChangePercent) : 0,
          high24h: item ? parseFloat(item.highPrice) : 0,
          low24h: item ? parseFloat(item.lowPrice) : 0,
          volume24h: item ? parseFloat(item.quoteVolume) : 0,
        };
      });
    } catch (e) {
      console.error('Error fetching 24hr tickers:', e);
      return [];
    }
  }
}
