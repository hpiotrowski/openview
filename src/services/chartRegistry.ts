import { Nullable, Chart as KLineChartInstance, KLineData, Period, init, dispose } from 'klinecharts';

export interface ChartController {
  id: string;
  symbol: string;
  interval: string;
  getContainer: () => HTMLDivElement | null;
  getChart: () => Nullable<KLineChartInstance>;
  getBars: () => KLineData[];
  getSnapshotBase64: () => string | null;
  autoFrameForAI?: () => void;
  createPositionOverlay: (params: {
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    takeProfit: number;
    stopLoss: number;
    overlayId?: string;
  }) => string | null;
  removePositionOverlay?: (overlayId: string) => void;
}

class ChartRegistryService {
  private controllers = new Map<string, ChartController>();

  register(id: string, controller: ChartController): void {
    this.controllers.set(id, controller);
  }

  unregister(id: string): void {
    this.controllers.delete(id);
  }

  get(id: string): ChartController | undefined {
    return this.controllers.get(id);
  }

  getActive(activeId?: string): ChartController | undefined {
    if (activeId && this.controllers.has(activeId)) {
      return this.controllers.get(activeId);
    }
    const first = this.controllers.values().next();
    return first.value;
  }

  getAll(): ChartController[] {
    return Array.from(this.controllers.values());
  }

  /**
   * Captures a high-resolution snapshot of a chart pane, combining
   * all underlying Klinecharts canvases and overlay layers into a single image.
   */
  takeCompositeSnapshot(container: HTMLDivElement | null, chart: Nullable<KLineChartInstance>): string | null {
    if (container) {
      const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];
      if (canvases.length > 0) {
        try {
          const width = container.clientWidth || canvases[0].width;
          const height = container.clientHeight || canvases[0].height;

          const composite = document.createElement('canvas');
          composite.width = width;
          composite.height = height;
          const ctx = composite.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0c0d10';
            ctx.fillRect(0, 0, width, height);

            const containerRect = container.getBoundingClientRect();
            for (const c of canvases) {
              const rect = c.getBoundingClientRect();
              const offsetX = rect.left - containerRect.left;
              const offsetY = rect.top - containerRect.top;
              if (rect.width > 0 && rect.height > 0) {
                ctx.drawImage(c, offsetX, offsetY, rect.width, rect.height);
              }
            }

            return composite.toDataURL('image/png');
          }
        } catch (err) {
          console.warn('Composite snapshot failed, falling back to native capture', err);
        }
      }
    }

    if (chart && typeof chart.getConvertPictureUrl === 'function') {
      try {
        return chart.getConvertPictureUrl(true, 'png', '#0c0d10');
      } catch (e) {
        console.warn('Native getConvertPictureUrl failed', e);
      }
    }

    return null;
  }

  /**
   * Helper to map timeframe string to Klinecharts Period
   */
  mapIntervalToPeriod(intv: string): Period {
    const s = (intv || '15m').toLowerCase();
    if (s.endsWith('s')) return { type: 'second', span: parseInt(s) || 1 };
    if (s.endsWith('m')) return { type: 'minute', span: parseInt(s) || 1 };
    if (s.endsWith('h')) return { type: 'hour', span: parseInt(s) || 1 };
    if (s.endsWith('d') || s.endsWith('D')) return { type: 'day', span: 1 };
    if (s.endsWith('w') || s.endsWith('W')) return { type: 'week', span: 1 };
    return { type: 'minute', span: 15 };
  }

  /**
   * Renders a clean, high-resolution chart of any timeframe (e.g. 15m or 4h)
   * in the background using an off-screen container without interrupting the user.
   */
  async renderBackgroundChartSnapshot(
    bars: KLineData[],
    options: {
      symbol?: string;
      interval?: string;
      includeCipherB?: boolean;
      includeVol?: boolean;
      barSpace?: number;
      offsetRight?: number;
    } = {}
  ): Promise<string | null> {
    if (!bars || bars.length < 15) return null;

    const {
      symbol = 'SNAPSHOT',
      interval = '15m',
      includeCipherB = false,
      includeVol = true,
      barSpace = 9,
      offsetRight = 90,
    } = options;

    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '-9999px';
    hiddenDiv.style.width = '1280px';
    hiddenDiv.style.height = includeCipherB ? '720px' : '600px';
    hiddenDiv.style.opacity = '0';
    hiddenDiv.style.pointerEvents = 'none';
    hiddenDiv.style.zIndex = '-9999';
    document.body.appendChild(hiddenDiv);

    try {
      const chart = init(hiddenDiv, {
        styles: {
          grid: {
            show: true,
            horizontal: { color: '#1a1e28' },
            vertical: { color: '#1a1e28' },
          },
          candle: {
            bar: {
              upColor: '#089981',
              downColor: '#f23645',
              upBorderColor: '#089981',
              downBorderColor: '#f23645',
              upWickColor: '#089981',
              downWickColor: '#f23645',
            },
            priceMark: {
              last: {
                show: true,
                upColor: '#089981',
                downColor: '#f23645',
              },
            },
          },
        },
      });

      if (!chart) {
        if (document.body.contains(hiddenDiv)) document.body.removeChild(hiddenDiv);
        return null;
      }

      // Klinecharts requires symbol and period to be initialized BEFORE data loading
      chart.setSymbol({
        ticker: symbol,
        pricePrecision: 2,
        volumePrecision: 2,
      });

      chart.setPeriod(this.mapIntervalToPeriod(interval));

      // Connect data loader to supply bars
      chart.setDataLoader({
        getBars: ({ callback }) => {
          callback(bars as any);
        },
      });

      if (includeVol) {
        chart.createIndicator('VOL', false);
      }
      if (includeCipherB) {
        chart.createIndicator('CIPHER_B', false);
      }

      chart.setBarSpace(barSpace);
      chart.setOffsetRightDistance(offsetRight);
      chart.resize();
      chart.scrollToRealTime(0);

      // Brief delay to allow canvas layout and rendering pipeline
      await new Promise((r) => setTimeout(r, 120));

      const loadedCount = chart.getDataList().length;
      if (loadedCount === 0) {
        console.warn('Background chart has 0 bars loaded after setDataLoader!');
      }

      const imgUrl = chart.getConvertPictureUrl(true, 'png', '#0c0d10');

      dispose(hiddenDiv);
      if (document.body.contains(hiddenDiv)) {
        document.body.removeChild(hiddenDiv);
      }

      // Check if image is valid base64 and not an empty stub (< 4000 bytes)
      if (!imgUrl || imgUrl.length < 4000) {
        console.warn('Background chart snapshot was empty or too small:', imgUrl?.length);
        return null;
      }

      return imgUrl;
    } catch (err) {
      console.warn('Failed to render background chart snapshot:', err);
      try {
        dispose(hiddenDiv);
        if (document.body.contains(hiddenDiv)) {
          document.body.removeChild(hiddenDiv);
        }
      } catch {}
      return null;
    }
  }

  /**
   * Alias for backward-compatible HTF macro render
   */
  async renderBackgroundHTFSnapshot(
    bars: KLineData[],
    timeframe: string
  ): Promise<string | null> {
    return this.renderBackgroundChartSnapshot(bars, {
      interval: timeframe,
      includeVol: true,
      includeCipherB: false,
      barSpace: 10,
      offsetRight: 80,
    });
  }
}

export const chartRegistry = new ChartRegistryService();

