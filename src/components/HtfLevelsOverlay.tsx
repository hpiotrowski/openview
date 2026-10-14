import React, { useEffect, useRef } from 'react';
import { HtfLevelsResult } from '../services/htfLevels';
import { Chart } from 'klinecharts';

interface HtfLevelsOverlayProps {
  chart: Chart | null;
  htfData: HtfLevelsResult | null;
  visible: boolean;
}

export const HtfLevelsOverlay: React.FC<HtfLevelsOverlayProps> = ({ chart, htfData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !htfData || !chart || !canvasRef.current) {
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

      if (!htfData.levels || htfData.levels.length === 0) return;

      // Keep track of drawn label Y positions to avoid overlapping badges
      const drawnBadgeYs: number[] = [];

      htfData.levels.forEach((lvl) => {
        try {
          const point = chart.convertToPixel({ value: lvl.price }, { paneId: 'candle_pane' });
          const rawY = Array.isArray(point) ? point[0]?.y : point?.y;

          if (typeof rawY !== 'number' || isNaN(rawY) || rawY < 0 || rawY > candleSize.height) {
            return;
          }

          // Adjust badge position if overlapping with previous badge
          let badgeY = rawY;
          for (const prevY of drawnBadgeYs) {
            if (Math.abs(badgeY - prevY) < 16) {
              badgeY = prevY + 16;
            }
          }
          drawnBadgeYs.push(badgeY);

          ctx.save();

          // 1. Line across chart pane
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = lvl.isSwept ? 1 : 1.5;
          ctx.globalAlpha = lvl.isSwept ? 0.45 : 0.85;

          if (lvl.dashed) {
            ctx.setLineDash([5, 4]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          ctx.moveTo(0, rawY);
          ctx.lineTo(candleSize.width, rawY);
          ctx.stroke();

          // 2. Right-side pill badge with level name and price
          const priceStr = `$${lvl.price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
          const badgeText = `${lvl.shortName} ${priceStr}`;

          ctx.font = 'bold 10px monospace';
          const textMetrics = ctx.measureText(badgeText);
          const badgeWidth = textMetrics.width + 12;
          const badgeHeight = 16;
          const badgeX = candleSize.width - badgeWidth - 4;

          // Badge background
          ctx.fillStyle = lvl.isSwept ? '#1f2430' : '#1e222d';
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 3);
          ctx.fill();
          ctx.stroke();

          // Text inside badge
          ctx.fillStyle = lvl.color;
          ctx.fillText(badgeText, badgeX + 6, badgeY + 3.5);

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
  }, [chart, htfData, visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
