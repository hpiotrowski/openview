/**
 * LocalStorage Persistence Service for OpenView
 * Handles active indicators, timeframe, symbol, chart preferences, and drawing overlays per symbol.
 */

const STORAGE_KEYS = {
  ACTIVE_INDICATORS: 'openview_active_indicators',
  CURRENT_INTERVAL: 'openview_current_interval',
  CURRENT_SYMBOL: 'openview_current_symbol',
  CHART_TYPE: 'openview_chart_type',
  WATCHLIST_OPEN: 'openview_watchlist_open',
  GRID_LAYOUT: 'openview_grid_layout',
  DRAWINGS_PREFIX: 'openview_drawings_',
};

// Default setup: user's requested 3-indicator setup
const DEFAULT_INDICATORS = ['DAILY_SVP', 'CIPHER_B', 'SUPPLY_DEMAND'];
const DEFAULT_INTERVAL = '15m';
const DEFAULT_SYMBOL = 'BTCUSDT';

export interface SavedOverlay {
  name: string;
  points: Array<{
    timestamp?: number;
    dataIndex?: number;
    value?: number;
  }>;
  styles?: any;
  lock?: boolean;
  extendData?: any;
  symbol?: string;
}

export const StorageService = {
  // --- Active Indicators ---
  getActiveIndicators(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_INDICATORS);
      if (!raw) return DEFAULT_INDICATORS;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INDICATORS;
    } catch {
      return DEFAULT_INDICATORS;
    }
  },

  setActiveIndicators(indicators: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_INDICATORS, JSON.stringify(indicators));
    } catch (err) {
      console.warn('StorageService: failed to save active indicators', err);
    }
  },

  // --- Interval / Timeframe ---
  getCurrentInterval(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_INTERVAL) || DEFAULT_INTERVAL;
    } catch {
      return DEFAULT_INTERVAL;
    }
  },

  setCurrentInterval(interval: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_INTERVAL, interval);
    } catch (err) {
      console.warn('StorageService: failed to save interval', err);
    }
  },

  // --- Symbol ---
  getCurrentSymbol(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_SYMBOL) || DEFAULT_SYMBOL;
    } catch {
      return DEFAULT_SYMBOL;
    }
  },

  setCurrentSymbol(symbol: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SYMBOL, symbol);
    } catch (err) {
      console.warn('StorageService: failed to save symbol', err);
    }
  },

  // --- Chart Type ---
  getChartType(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.CHART_TYPE) || 'candle_solid';
    } catch {
      return 'candle_solid';
    }
  },

  setChartType(chartType: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CHART_TYPE, chartType);
    } catch (err) {
      console.warn('StorageService: failed to save chart type', err);
    }
  },

  // --- Watchlist Sidebar Open/Closed ---
  getWatchlistOpen(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.WATCHLIST_OPEN);
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  },

  setWatchlistOpen(open: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.WATCHLIST_OPEN, String(open));
    } catch (err) {
      console.warn('StorageService: failed to save watchlist open state', err);
    }
  },

  // --- Grid Layout ---
  getGridLayout(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.GRID_LAYOUT) || '1x1';
    } catch {
      return '1x1';
    }
  },

  setGridLayout(layout: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GRID_LAYOUT, layout);
    } catch (err) {
      console.warn('StorageService: failed to save grid layout', err);
    }
  },

  // --- Drawings per Symbol ---
  getDrawings(symbol: string, currentPrice?: number): SavedOverlay[] {
    try {
      const key = `${STORAGE_KEYS.DRAWINGS_PREFIX}${symbol}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      if (typeof currentPrice === 'number' && currentPrice > 0) {
        // Filter out any overlays that were accidentally saved with wildly mismatched prices (e.g. BTC prices $83,000 on LINK $12)
        const sanitized = parsed.filter((item: SavedOverlay) => {
          if (item.symbol && item.symbol !== symbol) return false;
          if (!item.points || item.points.length === 0) return true;
          const isOutlier = item.points.some((p) => {
            if (typeof p.value !== 'number' || isNaN(p.value)) return false;
            return p.value > currentPrice * 6 || p.value < currentPrice * 0.15;
          });
          return !isOutlier;
        });

        if (sanitized.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(sanitized));
        }
        return sanitized;
      }

      return parsed;
    } catch {
      return [];
    }
  },

  setDrawings(symbol: string, overlays: SavedOverlay[]): void {
    try {
      const key = `${STORAGE_KEYS.DRAWINGS_PREFIX}${symbol}`;
      localStorage.setItem(key, JSON.stringify(overlays));
    } catch (err) {
      console.warn(`StorageService: failed to save drawings for ${symbol}`, err);
    }
  },

  clearDrawings(symbol: string): void {
    try {
      const key = `${STORAGE_KEYS.DRAWINGS_PREFIX}${symbol}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`StorageService: failed to clear drawings for ${symbol}`, err);
    }
  },
};
