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
    if (!visible || !vwapData || !chart || !canvasRef.current) return;

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

    const getXCoord = (index: number) => {
      try {
        const p = chart.convertToPixel({ dataIndex: index }, { paneId: 'candle_pane' });
        const x = Array.isArray(p) ? p[0]?.x : p?.x;
        return typeof x === 'number' ? x : null;
      } catch (e) {
        return null;
      }
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

    const pts = vwapData.points;
    if (pts.length < 2) return;

    // 1. Draw Shaded Band between Upper2 and Lower2
    ctx.save();
    ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
    ctx.beginPath();
    let firstX: number | null = null;
    let firstY: number | null = null;

    // Upper curve
    for (let i = 0; i < pts.length; i++) {
      const x = getXCoord(pts[i].index);
      const y = getYCoord(pts[i].upper2);
      if (x !== null && y !== null) {
        if (firstX === null) {
          firstX = x;
          firstY = y;
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    // Lower curve backwards
    for (let i = pts.length - 1; i >= 0; i--) {
      const x = getXCoord(pts[i].index);
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
    for (let i = 0; i < pts.length; i++) {
      const x = getXCoord(pts[i].index);
      const y = getYCoord(pts[i].upper2);
      if (x !== null && y !== null) {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Lower 2
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = getXCoord(pts[i].index);
      const y = getYCoord(pts[i].lower2);
      if (x !== null && y !== null) {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // 3. Draw Center AVWAP Line (Bright Gold)
    ctx.save();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = getXCoord(pts[i].index);
      const y = getYCoord(pts[i].vwap);
      if (x !== null && y !== null) {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Label at last point
    const lastPt = pts[pts.length - 1];
    const lastX = getXCoord(lastPt.index);
    const lastY = getYCoord(lastPt.vwap);
    if (lastX !== null && lastY !== null) {
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`AVWAP: $${lastPt.vwap.toFixed(2)}`, Math.min(candleSize.width - 120, lastX + 6), lastY + 3);
    }
    ctx.restore();
  }, [chart, vwapData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
