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
    if (!visible || !liqData || !chart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const candleSize = chart.getSize('candle_pane') || {
      width: canvas.width - 60,
      height: canvas.height - 40,
    };

    const getYCoord = (price: number) => {
      try {
        const p = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
        const y = Array.isArray(p) ? p[0]?.y : p?.y;
        return typeof y === 'number' ? y : null;
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
        grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        grad.addColorStop(0.5, `rgba(16, 185, 129, ${0.15 + cl.intensity * 0.25})`);
        grad.addColorStop(1, `rgba(6, 182, 212, ${0.3 + cl.intensity * 0.4})`);
      }

      ctx.fillStyle = grad;
      ctx.fillRect(rightEdge - bandWidth, y - 6, bandWidth, 12);

      // Horizontal guideline
      ctx.strokeStyle = isShort ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(candleSize.width * 0.4, y);
      ctx.lineTo(rightEdge, y);
      ctx.stroke();

      // Cluster label
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = isShort ? '#fca5a5' : '#6ee7b7';
      const label = `${cl.leverage} ${isShort ? 'Short' : 'Long'} ~$${cl.volumeUsdEstimate}M`;
      ctx.fillText(label, rightEdge - bandWidth + 10, y + 3);

      // Magnet label for strongest cluster
      if (isMagnet) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('MAGNET', rightEdge - bandWidth - 48, y + 3);
      }

      ctx.restore();
    });

    // Top Right Header Badge
    ctx.save();
    ctx.fillStyle = '#1e222d';
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;
    ctx.fillRect(candleSize.width - 130, 8, 120, 20);
    ctx.strokeRect(candleSize.width - 130, 8, 120, 20);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('LIQUIDATION MAP', candleSize.width - 120, 22);
    ctx.restore();
  }, [chart, liqData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
