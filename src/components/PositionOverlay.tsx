import React, { useEffect, useRef } from 'react';
import { Chart as KLineChartInstance } from 'klinecharts';

interface PositionOverlayProps {
  chart: KLineChartInstance | null;
  visible: boolean;
  direction: 'LONG' | 'SHORT' | null;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  entryIndex?: number;
}

export const PositionOverlay: React.FC<PositionOverlayProps> = ({
  chart,
  visible,
  direction,
  entryPrice,
  stopLossPrice,
  takeProfitPrice,
  entryIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !direction || !chart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const candleSize = chart.getSize('candle_pane') || {
      width: canvas.width - 65,
      height: canvas.height - 40,
      left: 0,
      top: 0,
      right: canvas.width - 65,
      bottom: canvas.height - 40,
    };

    const getY = (val: number): number | null => {
      try {
        const p = chart.convertToPixel({ value: val }, { paneId: 'candle_pane' });
        const y = Array.isArray(p) ? p[0]?.y : p?.y;
        return typeof y === 'number' ? y : null;
      } catch (e) {
        return null;
      }
    };

    const getX = (idx: number): number | null => {
      try {
        const p = chart.convertToPixel({ dataIndex: idx }, { paneId: 'candle_pane' });
        const x = Array.isArray(p) ? p[0]?.x : p?.x;
        return typeof x === 'number' ? x : null;
      } catch (e) {
        return null;
      }
    };

    const entryY = getY(entryPrice);
    const tpY = getY(takeProfitPrice);
    const slY = getY(stopLossPrice);

    if (entryY === null || tpY === null || slY === null) return;

    // Determine start X coordinate (entry point or default to middle-left)
    let startX = 60;
    if (typeof entryIndex === 'number' && entryIndex >= 0) {
      const calculatedX = getX(entryIndex);
      if (calculatedX !== null) {
        startX = Math.max(20, calculatedX);
      }
    }
    const endX = Math.min(candleSize.width, canvas.width - 70);
    const boxWidth = Math.max(120, endX - startX);

    // Calculate R:R metrics
    const slDist = Math.abs(entryPrice - stopLossPrice);
    const tpDist = Math.abs(takeProfitPrice - entryPrice);
    const rrRatio = slDist > 0 ? (tpDist / slDist).toFixed(2) : '0';
    const tpPercent = ((tpDist / entryPrice) * 100).toFixed(2);
    const slPercent = ((slDist / entryPrice) * 100).toFixed(2);

    // 1. Draw Target (Take Profit) Box (Green)
    ctx.save();
    const tpBoxTop = Math.min(entryY, tpY);
    const tpBoxHeight = Math.abs(entryY - tpY);

    ctx.fillStyle = 'rgba(8, 153, 129, 0.16)';
    ctx.fillRect(startX, tpBoxTop, boxWidth, tpBoxHeight);

    ctx.strokeStyle = '#089981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, tpY);
    ctx.lineTo(startX + boxWidth, tpY);
    ctx.stroke();

    // TP Label Box
    ctx.setLineDash([]);
    ctx.fillStyle = '#089981';
    ctx.fillRect(startX + 4, tpBoxTop + 4, 150, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`TARGET: +${tpPercent}% | ${rrRatio}R`, startX + 10, tpBoxTop + 18);

    // 2. Draw Risk (Stop Loss) Box (Red)
    const slBoxTop = Math.min(entryY, slY);
    const slBoxHeight = Math.abs(entryY - slY);

    ctx.fillStyle = 'rgba(242, 54, 69, 0.16)';
    ctx.fillRect(startX, slBoxTop, boxWidth, slBoxHeight);

    ctx.strokeStyle = '#f23645';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, slY);
    ctx.lineTo(startX + boxWidth, slY);
    ctx.stroke();

    // SL Label Box
    ctx.setLineDash([]);
    ctx.fillStyle = '#f23645';
    ctx.fillRect(startX + 4, slBoxTop + slBoxHeight - 24, 140, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`STOP: -${slPercent}% (1.0R)`, startX + 10, slBoxTop + slBoxHeight - 10);

    // 3. Draw Entry Line (Cyan / Gray)
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(startX, entryY);
    ctx.lineTo(startX + boxWidth, entryY);
    ctx.stroke();

    // Entry Label
    ctx.setLineDash([]);
    ctx.fillStyle = '#00bcd4';
    ctx.fillRect(startX + boxWidth - 110, entryY - 10, 110, 20);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`ENTRY: $${entryPrice.toLocaleString()}`, startX + boxWidth - 105, entryY + 4);

    ctx.restore();
  }, [visible, direction, entryPrice, stopLossPrice, takeProfitPrice, entryIndex, chart]);

  if (!visible || !direction) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-15"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
