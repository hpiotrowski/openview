import React, { useEffect, useRef } from 'react';
import { SMCResult } from '../services/smc';
import { Chart } from 'klinecharts';

interface SmcOverlayProps {
  chart: Chart | null;
  smcData: SMCResult | null;
  visible: boolean;
}

export const SmcOverlay: React.FC<SmcOverlayProps> = ({ chart, smcData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !smcData || !chart || !canvasRef.current) return;

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
      left: 0,
      top: 0,
      right: canvas.width - 60,
      bottom: canvas.height - 40,
    };

    // Helper to convert dataIndex to X coordinate
    const getXCoord = (index: number) => {
      try {
        const p = chart.convertToPixel({ dataIndex: index }, { paneId: 'candle_pane' });
        const x = Array.isArray(p) ? p[0]?.x : p?.x;
        return typeof x === 'number' ? x : null;
      } catch (e) {
        return null;
      }
    };

    // Helper to convert price to Y coordinate
    const getYCoord = (price: number) => {
      try {
        const p = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
        const y = Array.isArray(p) ? p[0]?.y : p?.y;
        return typeof y === 'number' ? y : null;
      } catch (e) {
        return null;
      }
    };

    // 1. Draw Fair Value Gaps (FVG)
    smcData.fvgs.forEach((fvg) => {
      const startX = getXCoord(fvg.startIndex);
      const endX = getXCoord(fvg.endIndex) || candleSize.width;
      const topY = getYCoord(fvg.top);
      const bottomY = getYCoord(fvg.bottom);

      if (startX !== null && topY !== null && bottomY !== null) {
        const x = Math.max(0, startX);
        const w = Math.min(candleSize.width, endX) - x;
        const y = Math.min(topY, bottomY);
        const h = Math.abs(bottomY - topY);

        if (w > 5 && h > 2) {
          ctx.save();
          if (fvg.type === 'BULLISH') {
            ctx.fillStyle = fvg.isMitigated ? 'rgba(41, 98, 255, 0.08)' : 'rgba(41, 98, 255, 0.2)';
            ctx.strokeStyle = 'rgba(41, 98, 255, 0.4)';
          } else {
            ctx.fillStyle = fvg.isMitigated ? 'rgba(255, 152, 0, 0.08)' : 'rgba(255, 152, 0, 0.2)';
            ctx.strokeStyle = 'rgba(255, 152, 0, 0.4)';
          }
          ctx.setLineDash([3, 3]);
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);

          // FVG Label
          ctx.fillStyle = fvg.type === 'BULLISH' ? '#2962ff' : '#ff9800';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`FVG`, x + 4, y + 10);
          ctx.restore();
        }
      }
    });

    // 2. Draw Order Blocks (OB)
    smcData.orderBlocks.forEach((ob) => {
      const startX = getXCoord(ob.startIndex);
      const endX = getXCoord(ob.endIndex) || candleSize.width;
      const topY = getYCoord(ob.top);
      const bottomY = getYCoord(ob.bottom);

      if (startX !== null && topY !== null && bottomY !== null) {
        const x = Math.max(0, startX);
        const w = Math.min(candleSize.width, endX) - x;
        const y = Math.min(topY, bottomY);
        const h = Math.max(4, Math.abs(bottomY - topY));

        if (w > 5) {
          ctx.save();
          const isBull = ob.type === 'BULLISH';
          ctx.fillStyle = isBull ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)';
          ctx.strokeStyle = isBull ? '#089981' : '#f23645';
          ctx.lineWidth = 1;

          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);

          // OB Badge
          ctx.fillStyle = isBull ? '#089981' : '#f23645';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(isBull ? '+OB' : '-OB', x + 4, y + 10);
          ctx.restore();
        }
      }
    });

    // 3. Draw Market Structure Breaks (BOS / CHOCH)
    smcData.breaks.forEach((brk) => {
      const x = getXCoord(brk.index);
      const y = getYCoord(brk.price);

      if (x !== null && y !== null && x > 30) {
        ctx.save();
        ctx.strokeStyle = brk.direction === 'BULLISH' ? '#089981' : '#f23645';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x - 40, y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Tag label
        ctx.fillStyle = brk.direction === 'BULLISH' ? '#089981' : '#f23645';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(brk.type, x - 35, y - 4);
        ctx.restore();
      }
    });
  }, [chart, smcData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
