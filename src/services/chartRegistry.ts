import { Nullable, Chart as KLineChartInstance, KLineData } from 'klinecharts';

export interface ChartController {
  id: string;
  symbol: string;
  interval: string;
  getContainer: () => HTMLDivElement | null;
  getChart: () => Nullable<KLineChartInstance>;
  getBars: () => KLineData[];
  getSnapshotBase64: () => string | null;
  createPositionOverlay: (params: {
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    takeProfit: number;
    stopLoss: number;
  }) => string | null;
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
}

export const chartRegistry = new ChartRegistryService();
