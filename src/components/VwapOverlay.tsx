import React, { useEffect, useRef } from 'react';
import { AnchoredVwapResult } from '../services/anchoredVwap';
import { Chart } from 'klinecharts';

interface VwapOverlayProps {
  chart: Chart | null;
  vwapData: AnchoredVwapResult | null;
  visible: boolean;
}

export const VwapOverlay: React.FC<VwapOverlayProps> = ({ chart, vwapData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !vwapData || !chart || !canvasRef.current) {
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

      const getXCoord = (timestamp?: number, fallbackIndex?: number) => {
        try {
          if (typeof timestamp === 'number' && timestamp > 0) {
            const p = chart.convertToPixel({ timestamp }, { paneId: 'candle_pane' });
            const x = Array.isArray(p) ? p[0]?.x : p?.x;
            if (typeof x === 'number' && !isNaN(x)) return x;
          }
          if (typeof fallbackIndex === 'number') {
            const p = chart.convertToPixel({ dataIndex: fallbackIndex }, { paneId: 'candle_pane' });
            const x = Array.isArray(p) ? p[0]?.x : p?.x;
            return typeof x === 'number' && !isNaN(x) ? x : null;
          }
          return null;
        } catch (e) {
          return null;
        }
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

      const pts = vwapData.points;
      if (pts.length < 2) return;

      // 1. Draw Shaded Band between Upper2 and Lower2
      ctx.save();
      ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
      ctx.beginPath();
      let firstX: number | null = null;

      // Upper curve
      for (let i = 0; i < pts.length; i++) {
        const x = getXCoord(pts[i].timestamp, pts[i].index);
        const y = getYCoord(pts[i].upper2);
        if (x !== null && y !== null) {
          if (firstX === null) {
            firstX = x;
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      // Lower curve backwards
      for (let i = pts.length - 1; i >= 0; i--) {
        const x = getXCoord(pts[i].timestamp, pts[i].index);
        const y = getYCoord(pts[i].lower2);
        if (x !== null && y !== null) {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Draw +2σ and -2σ lines
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      // Upper 2
      ctx.beginPath();
      let upperStarted = false;
      for (let i = 0; i < pts.length; i++) {
        const x = getXCoord(pts[i].timestamp, pts[i].index);
        const y = getYCoord(pts[i].upper2);
        if (x !== null && y !== null) {
          if (!upperStarted) {
            ctx.moveTo(x, y);
            upperStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Lower 2
      ctx.beginPath();
      let lowerStarted = false;
      for (let i = 0; i < pts.length; i++) {
        const x = getXCoord(pts[i].timestamp, pts[i].index);
        const y = getYCoord(pts[i].lower2);
        if (x !== null && y !== null) {
          if (!lowerStarted) {
            ctx.moveTo(x, y);
            lowerStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      // 3. Draw Center AVWAP Line (Bright Gold)
      ctx.save();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let centerStarted = false;
      for (let i = 0; i < pts.length; i++) {
        const x = getXCoord(pts[i].timestamp, pts[i].index);
        const y = getYCoord(pts[i].vwap);
        if (x !== null && y !== null) {
          if (!centerStarted) {
            ctx.moveTo(x, y);
            centerStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Label at last point
      const lastPt = pts[pts.length - 1];
      const lastX = getXCoord(lastPt.timestamp, lastPt.index);
      const lastY = getYCoord(lastPt.vwap);
      if (lastX !== null && lastY !== null && lastX > 0 && lastX < candleSize.width + 50) {
        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`AVWAP: $${lastPt.vwap.toFixed(2)}`, Math.min(candleSize.width - 120, lastX + 6), lastY + 3);
      }
      ctx.restore();
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
  }, [chart, vwapData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
