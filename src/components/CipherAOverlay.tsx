import React, { useEffect, useRef } from 'react';
import { CipherAResult } from '../services/cipherA';
import { Chart } from 'klinecharts';

interface CipherAOverlayProps {
  chart: Chart | null;
  cipherAData: CipherAResult | null;
  visible: boolean;
}

export const CipherAOverlay: React.FC<CipherAOverlayProps> = ({ chart, cipherAData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !cipherAData || !chart || !canvasRef.current) {
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

      const ribbon = cipherAData.ribbon;
      if (ribbon.length < 2) return;

      // Draw the 8 EMA ribbon lines
      const emaKeys = ['ema5', 'ema11', 'ema15', 'ema21', 'ema27', 'ema33', 'ema40', 'ema48'] as const;

      emaKeys.forEach((key, keyIdx) => {
        ctx.save();
        ctx.lineWidth = keyIdx === 0 || keyIdx === 7 ? 1.5 : 1;

        for (let i = 1; i < ribbon.length; i++) {
          const p1 = ribbon[i - 1];
          const p2 = ribbon[i];

          const x1 = getXCoord(p1.timestamp, p1.index);
          const x2 = getXCoord(p2.timestamp, p2.index);
          const y1 = getYCoord(p1[key]);
          const y2 = getYCoord(p2[key]);

          if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
            if (x2 < 0 || x1 > candleSize.width + 50) continue;

            if (p2.trend === 'BULLISH') {
              ctx.strokeStyle = `rgba(8, 153, 129, ${0.4 + keyIdx * 0.07})`;
            } else if (p2.trend === 'BEARISH') {
              ctx.strokeStyle = `rgba(242, 54, 69, ${0.4 + keyIdx * 0.07})`;
            } else {
              ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + keyIdx * 0.06})`;
            }

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
        ctx.restore();
      });

      // Draw Signals (Blue Triangles, Green/Red Diamonds, Bloodhound Divergences)
      cipherAData.signals.forEach((sig) => {
        const x = getXCoord(sig.timestamp, sig.index);
        const y = getYCoord(sig.price);

        if (x !== null && y !== null && x > 20 && x < candleSize.width + 50) {
          ctx.save();

          if (sig.type === 'BLUE_TRIANGLE') {
            ctx.fillStyle = '#00e5ff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            if (sig.direction === 'BULLISH') {
              ctx.moveTo(x, y - 8);
              ctx.lineTo(x - 5, y + 2);
              ctx.lineTo(x + 5, y + 2);
            } else {
              ctx.moveTo(x, y + 8);
              ctx.lineTo(x - 5, y - 2);
              ctx.lineTo(x + 5, y - 2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Small tag
            ctx.font = 'bold 8px sans-serif';
            ctx.fillStyle = '#00e5ff';
            ctx.fillText(sig.direction === 'BULLISH' ? '▲ BUY' : '▼ SELL', x - 12, sig.direction === 'BULLISH' ? y + 12 : y - 6);
          } else if (sig.type === 'GREEN_DIAMOND' || sig.type === 'RED_DIAMOND') {
            const isGreen = sig.type === 'GREEN_DIAMOND';
            ctx.fillStyle = isGreen ? '#00e676' : '#ff1744';

            ctx.beginPath();
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x + 4, y);
            ctx.lineTo(x, y + 4);
            ctx.lineTo(x - 4, y);
            ctx.closePath();
            ctx.fill();

            ctx.font = 'bold 8px sans-serif';
            ctx.fillStyle = isGreen ? '#00e676' : '#ff1744';
            ctx.fillText('◆', x - 3, isGreen ? y + 11 : y - 6);
          } else if (sig.type === 'BLOODHOUND_DIVERGENCE') {
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText('EXHAUSTION', x - 25, sig.direction === 'BULLISH' ? y + 14 : y - 8);
          }

          ctx.restore();
        }
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
  }, [chart, cipherAData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
