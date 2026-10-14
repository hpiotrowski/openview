import React, { useEffect, useRef } from 'react';
import { KillzonesResult } from '../services/killzones';
import { Chart } from 'klinecharts';

interface KillzonesOverlayProps {
  chart: Chart | null;
  killzonesData: KillzonesResult | null;
  visible: boolean;
}

export const KillzonesOverlay: React.FC<KillzonesOverlayProps> = ({ chart, killzonesData, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !killzonesData || !chart || !canvasRef.current) {
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

      // 1. Draw Sessions
      killzonesData.sessions.forEach((s) => {
        const x1 = getXCoord(s.startTimestamp, s.startIndex);
        const x2 = getXCoord(s.endTimestamp, s.endIndex) || candleSize.width;
        const yTop = getYCoord(s.high);
        const yBottom = getYCoord(s.low);

        if (x1 !== null && yTop !== null && yBottom !== null) {
          const x = Math.max(0, x1);
          const w = Math.min(candleSize.width, x2) - x;
          const y = Math.min(yTop, yBottom);
          const h = Math.abs(yBottom - yTop);

          if (w > 2 && h > 2 && x < candleSize.width) {
            ctx.save();
            if (s.name === 'ASIA') {
              ctx.fillStyle = 'rgba(147, 51, 234, 0.08)';
              ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)';
            } else if (s.name === 'LONDON') {
              ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
            } else {
              ctx.fillStyle = 'rgba(234, 88, 12, 0.08)';
              ctx.strokeStyle = 'rgba(234, 88, 12, 0.35)';
            }

            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);

            // Session Tag
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = s.name === 'ASIA' ? '#a855f7' : s.name === 'LONDON' ? '#60a5fa' : '#fb923c';
            ctx.fillText(s.name, x + 4, y + 11);
            ctx.restore();
          }

          // Draw Asian High / Low projection lines
          if (s.asianHighLine) {
            const yAh = getYCoord(s.asianHighLine);
            if (yAh !== null) {
              ctx.save();
              ctx.strokeStyle = '#089981';
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(x1, yAh);
              ctx.lineTo(candleSize.width, yAh);
              ctx.stroke();

              ctx.fillStyle = '#089981';
              ctx.font = '8px sans-serif';
              ctx.fillText('Asian High (BSL)', candleSize.width - 90, yAh - 3);
              ctx.restore();
            }
          }

          if (s.asianLowLine) {
            const yAl = getYCoord(s.asianLowLine);
            if (yAl !== null) {
              ctx.save();
              ctx.strokeStyle = '#f23645';
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(x1, yAl);
              ctx.lineTo(candleSize.width, yAl);
              ctx.stroke();

              ctx.fillStyle = '#f23645';
              ctx.font = '8px sans-serif';
              ctx.fillText('Asian Low (SSL)', candleSize.width - 85, yAl + 10);
              ctx.restore();
            }
          }

          // 2. Draw Judas Swing Badge if triggered
          if (s.judasSwing) {
            const jX = getXCoord(s.judasSwing.timestamp, s.judasSwing.index);
            const jY = getYCoord(s.judasSwing.price);

            if (jX !== null && jY !== null && jX > 10 && jX < candleSize.width + 50) {
              ctx.save();
              const isBull = s.judasSwing.type === 'BULLISH_JUDAS';
              ctx.fillStyle = isBull ? '#089981' : '#f23645';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;

              ctx.beginPath();
              ctx.arc(jX, jY, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.font = 'bold 9px sans-serif';
              ctx.fillStyle = isBull ? '#089981' : '#f23645';
              ctx.fillText('JUDAS SWING', jX - 25, isBull ? jY + 14 : jY - 7);
              ctx.restore();
            }
          }
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
  }, [chart, killzonesData, visible]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
