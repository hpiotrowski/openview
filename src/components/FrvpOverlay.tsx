import React, { useEffect, useRef } from 'react';
import { VolumeProfileResult } from '../services/volumeProfile';
import { Chart } from 'klinecharts';

interface FrvpOverlayProps {
  chart: Chart | null;
  range: { startTimestamp: number; endTimestamp: number } | null;
  profile: VolumeProfileResult | null;
  visible: boolean;
  onClear?: () => void;
}

export const FrvpOverlay: React.FC<FrvpOverlayProps> = ({
  chart,
  range,
  profile,
  visible,
  onClear,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !range || !profile || !chart || !canvasRef.current) {
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

      const getXCoord = (timestamp: number) => {
        try {
          const p = chart.convertToPixel({ timestamp }, { paneId: 'candle_pane' });
          const x = Array.isArray(p) ? p[0]?.x : p?.x;
          return typeof x === 'number' && !isNaN(x) ? x : null;
        } catch (e) {
          return null;
        }
      };

      const x1 = getXCoord(range.startTimestamp);
      const x2 = getXCoord(range.endTimestamp);

      if (x1 === null && x2 === null) return;

      const leftX = Math.max(0, Math.min(x1 ?? 0, x2 ?? candleSize.width));
      const rightX = Math.min(candleSize.width, Math.max(x1 ?? 0, x2 ?? candleSize.width));
      const spanWidth = rightX - leftX;

      if (spanWidth <= 5) return;

      ctx.save();

      // 1. Range Shading
      ctx.fillStyle = 'rgba(41, 98, 255, 0.05)';
      ctx.fillRect(leftX, 0, spanWidth, candleSize.height);

      // Boundary vertical dashed lines
      ctx.strokeStyle = 'rgba(41, 98, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX, candleSize.height);
      ctx.moveTo(rightX, 0);
      ctx.lineTo(rightX, candleSize.height);
      ctx.stroke();

      // 2. Volume Profile Histogram (anchored to leftX)
      const maxBarWidth = Math.min(180, spanWidth * 0.75);

      profile.rows.forEach((row) => {
        try {
          const point = chart.convertToPixel({ value: row.price }, { paneId: 'candle_pane' });
          const y = Array.isArray(point) ? point[0]?.y : point?.y;

          if (typeof y === 'number' && !isNaN(y) && y >= 0 && y <= candleSize.height) {
            const buyRatio = row.totalVolume > 0 ? row.buyVolume / row.totalVolume : 0.5;
            const barWidth = (row.totalVolume / profile.maxRowVolume) * maxBarWidth;

            // Buy volume portion
            ctx.fillStyle = row.isValueArea ? 'rgba(8, 153, 129, 0.65)' : 'rgba(8, 153, 129, 0.3)';
            ctx.fillRect(leftX, y - 2, barWidth * buyRatio, 4);

            // Sell volume portion
            ctx.fillStyle = row.isValueArea ? 'rgba(242, 54, 69, 0.65)' : 'rgba(242, 54, 69, 0.3)';
            ctx.fillRect(leftX + barWidth * buyRatio, y - 2, barWidth * (1 - buyRatio), 4);
          }
        } catch (e) {}
      });

      // 3. Draw POC (Point of Control) line across the range
      const drawRangeLine = (price: number, label: string, color: string, isDashed = false) => {
        try {
          const point = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
          const y = Array.isArray(point) ? point[0]?.y : point?.y;

          if (typeof y === 'number' && !isNaN(y) && y >= 0 && y <= candleSize.height) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = label === 'POC' ? 1.5 : 1;
            if (isDashed) ctx.setLineDash([4, 3]);
            else ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(leftX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();

            // Badge
            ctx.fillStyle = color;
            const text = `${label} $${price.toLocaleString()}`;
            ctx.font = 'bold 9px monospace';
            const m = ctx.measureText(text);
            const w = m.width + 8;

            ctx.beginPath();
            ctx.roundRect(rightX - w - 2, y - 7, w, 14, 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, rightX - w + 2, y + 3);
            ctx.restore();
          }
        } catch (e) {}
      };

      drawRangeLine(profile.pocPrice, 'FRVP POC', '#f59e0b', false);
      drawRangeLine(profile.vahPrice, 'FRVP VAH', '#2962ff', true);
      drawRangeLine(profile.valPrice, 'FRVP VAL', '#2962ff', true);

      // 4. Header Badge indicating Fixed Range
      ctx.fillStyle = '#1e222d';
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(leftX + 4, 8, 120, 18, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('Fixed Range VP', leftX + 10, 20);

      ctx.restore();
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
  }, [chart, range, profile, visible]);

  if (!visible || !range) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ width: '100%', height: '100%' }}
      />
      {onClear && (
        <button
          onClick={onClear}
          title="Remove Fixed Range Volume Profile"
          className="absolute top-2 right-24 z-20 px-2 py-0.5 rounded bg-[#1e222d]/90 hover:bg-[#f23645]/20 text-[#868993] hover:text-[#f23645] border border-[#2a2e39] text-[10px] font-medium transition-colors"
        >
          Clear FRVP ✕
        </button>
      )}
    </>
  );
};
