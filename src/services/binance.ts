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

export class BinanceService {
  private static wsMap = new Map<string, WebSocket>();

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

  // Subscribe to live kline updates via WebSocket
  static subscribeKlines(
    channelId: string,
    symbol: string,
    interval: string,
    onBarUpdate: (bar: KLineBar) => void
  ) {
    this.unsubscribe(channelId);

    const streamSymbol = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${interval}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.e === 'kline' && message.k) {
          const k = message.k;
          const bar: KLineBar = {
            timestamp: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            turnover: parseFloat(k.q),
            takerBuyVolume: parseFloat(k.V),
          };
          onBarUpdate(bar);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn(`WebSocket error for ${symbol}:`, err);
    };

    this.wsMap.set(channelId, ws);
  }

  // Unsubscribe a specific channel
  static unsubscribe(channelId: string) {
    const ws = this.wsMap.get(channelId);
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      this.wsMap.delete(channelId);
    }
  }

  // Fetch 24h tickers for watchlist
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
