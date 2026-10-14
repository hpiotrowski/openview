import React, { useEffect, useRef } from 'react';
import { LiquidationHeatmapResult } from '../services/liquidationHeatmap';
import { Chart } from 'klinecharts';

interface LiquidationOverlayProps {
  chart: Chart | null;
  liqData: LiquidationHeatmapResult | null;
  visible: boolean;
}

export const LiquidationOverlay: React.FC<LiquidationOverlayProps> = ({ chart, liqData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !liqData || !chart || !canvasRef.current) {
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
      };

      const getYCoord = (price: number) => {
        try {
          const p = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
          const y = Array.isArray(p) ? p[0]?.y : p?.y;
          return typeof y === 'number' && !isNaN(y) ? y : null;
        } catch (e) {
          return null;
        }
      };

      const rightEdge = candleSize.width;
      const bandWidth = 140;

      // Render each liquidation cluster as a glowing heat gradient bar on the right side
      liqData.clusters.forEach((cl) => {
        const y = getYCoord(cl.price);
        if (y === null || y < 10 || y > candleSize.height - 10) return;

        const isShort = cl.type === 'SHORT_LIQ';
        const isMagnet = liqData.magnetCluster?.id === cl.id;

        ctx.save();
        // Gradient heat bar
        const grad = ctx.createLinearGradient(rightEdge - bandWidth, y, rightEdge, y);
        if (isShort) {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
          grad.addColorStop(0.5, `rgba(245, 158, 11, ${0.15 + cl.intensity * 0.25})`);
          grad.addColorStop(1, `rgba(239, 68, 68, ${0.3 + cl.intensity * 0.4})`);
        } else {
          grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
          grad.addColorStop(0.5, `rgba(6, 182, 212, ${0.15 + cl.intensity * 0.25})`);
          grad.addColorStop(1, `rgba(16, 185, 129, ${0.3 + cl.intensity * 0.4})`);
        }

        ctx.fillStyle = grad;
        ctx.fillRect(rightEdge - bandWidth, y - 6, bandWidth, 12);

        // Thin price level line
        ctx.strokeStyle = isShort ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(rightEdge - bandWidth, y);
        ctx.lineTo(rightEdge, y);
        ctx.stroke();

        // Tier Badge & USD Volume estimate
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = isShort ? '#fca5a5' : '#86efac';
        ctx.fillText(`${cl.leverage} ($${cl.volumeUsdEstimate}M)`, rightEdge - 85, y - 2);

        // Magnet Tag if top priority
        if (isMagnet) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('MAGNET', rightEdge - 130, y - 2);
        }

        ctx.restore();
      });
    };

    // Initial draw
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
  }, [chart, liqData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
