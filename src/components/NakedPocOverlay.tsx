import React, { useEffect, useRef } from 'react';
import { NakedPocResult } from '../services/nakedPoc';
import { Chart } from 'klinecharts';

interface NakedPocOverlayProps {
  chart: Chart | null;
  nakedPocData: NakedPocResult | null;
  visible: boolean;
  showMitigated?: boolean;
}

export const NakedPocOverlay: React.FC<NakedPocOverlayProps> = ({
  chart,
  nakedPocData,
  visible,
  showMitigated = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !nakedPocData || !chart || !canvasRef.current) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const candleSize = chart.getSize('candle_pane') || {
        width: canvas.width - 60,
        height: canvas.height - 40,
        left: 0,
        top: 0,
      };

      const getXCoord = (timestamp?: number) => {
        try {
          if (typeof timestamp === 'number' && timestamp > 0) {
            const p = chart.convertToPixel({ timestamp }, { paneId: 'candle_pane' });
            const x = Array.isArray(p) ? p[0]?.x : p?.x;
            if (typeof x === 'number' && !isNaN(x)) return x;
          }
          return null;
        } catch (e) {
          return null;
        }
      };

      const itemsToDraw = nakedPocData.items.filter((item) => showMitigated || !item.isMitigated);
      const drawnBadgeYs: number[] = [];

      itemsToDraw.forEach((item) => {
        try {
          const point = chart.convertToPixel({ value: item.pocPrice }, { paneId: 'candle_pane' });
          const rawY = Array.isArray(point) ? point[0]?.y : point?.y;

          if (typeof rawY !== 'number' || isNaN(rawY) || rawY < 0 || rawY > candleSize.height) {
            return;
          }

          let startX = getXCoord(item.endTimestamp) ?? 0;
          startX = Math.max(0, Math.min(candleSize.width, startX));

          let endX = candleSize.width;
          if (item.isMitigated && item.mitigatedTimestamp) {
            const mitX = getXCoord(item.mitigatedTimestamp);
            if (typeof mitX === 'number') {
              endX = Math.max(startX, Math.min(candleSize.width, mitX));
            }
          }

          if (endX <= startX && item.isMitigated) return;

          // Prevent overlapping labels
          let badgeY = rawY;
          for (const prevY of drawnBadgeYs) {
            if (Math.abs(badgeY - prevY) < 16) {
              badgeY = prevY + 16;
            }
          }
          drawnBadgeYs.push(badgeY);

          ctx.save();

          const lineColor = item.isMitigated ? 'rgba(156, 163, 175, 0.4)' : '#f59e0b'; // Amber-500
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = item.isMitigated ? 1 : 1.5;
          ctx.setLineDash([4, 4]);

          // Draw horizontal ray line from day end to present (or to mitigation)
          ctx.beginPath();
          ctx.moveTo(startX, rawY);
          ctx.lineTo(endX, rawY);
          ctx.stroke();

          // Small origin marker dot
          ctx.fillStyle = lineColor;
          ctx.beginPath();
          ctx.arc(startX, rawY, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Pill badge on the right
          if (!item.isMitigated) {
            const dateShort = item.dateStr.slice(5); // "MM-DD"
            const distSign = item.distancePercent > 0 ? '+' : '';
            const badgeText = `nPOC ${dateShort} $${item.pocPrice.toLocaleString()} (${distSign}${item.distancePercent}%)`;

            ctx.font = 'bold 9.5px monospace';
            const textMetrics = ctx.measureText(badgeText);
            const badgeWidth = textMetrics.width + 12;
            const badgeHeight = 16;
            const badgeX = candleSize.width - badgeWidth - 4;

            // Background badge
            ctx.fillStyle = '#1e222d';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 3);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle = '#fbbf24'; // Amber-400
            ctx.fillText(badgeText, badgeX + 6, badgeY + 3.5);
          } else {
            // Mitigated badge
            const badgeText = `nPOC ${item.dateStr.slice(5)} [Tested]`;
            ctx.font = '9px monospace';
            const textMetrics = ctx.measureText(badgeText);
            const badgeWidth = textMetrics.width + 8;
            const badgeHeight = 14;

            ctx.fillStyle = '#1f2430';
            ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.roundRect(endX - badgeWidth - 2, rawY - badgeHeight / 2, badgeWidth, badgeHeight, 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#9ca3af';
            ctx.fillText(badgeText, endX - badgeWidth + 2, rawY + 3);
          }

          ctx.restore();
        } catch (e) {}
      });
    };

    draw();

    // 60fps real-time synchronized event handlers
    let animId: number | null = null;
    const handleSync = () => {
      if (animId) cancelAnimationFrame(animId);
      animId = requestAnimationFrame(draw);
    };

    chart.subscribeAction('onScroll', handleSync);
    chart.subscribeAction('onZoom', handleSync);
    chart.subscribeAction('onVisibleRangeChange', handleSync);
    chart.subscribeAction('onPaneDrag', handleSync);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      chart.unsubscribeAction('onScroll', handleSync);
      chart.unsubscribeAction('onZoom', handleSync);
      chart.unsubscribeAction('onVisibleRangeChange', handleSync);
      chart.unsubscribeAction('onPaneDrag', handleSync);
    };
  }, [chart, nakedPocData, visible, showMitigated]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
