import React, { useEffect, useRef } from 'react';
import { SessionVolumeResult } from '../services/sessionVolume';
import { Chart } from 'klinecharts';

interface SessionVolumeOverlayProps {
  chart: Chart | null;
  sessionData: SessionVolumeResult | null;
  visible: boolean;
}

export const SessionVolumeOverlay: React.FC<SessionVolumeOverlayProps> = ({
  chart,
  sessionData,
  visible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !sessionData || !chart || !canvasRef.current) {
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

      const getYCoord = (price: number) => {
        try {
          const p = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
          const y = Array.isArray(p) ? p[0]?.y : p?.y;
          return typeof y === 'number' && !isNaN(y) ? y : null;
        } catch (e) {
          return null;
        }
      };

      // Draw each daily session profile
      sessionData.sessions.forEach((session) => {
        const x1 = getXCoord(session.startTimestamp);
        const x2 = getXCoord(session.endTimestamp);

        // If completely off screen to the left or right, skip
        if (x1 === null && x2 === null) return;

        const leftX = Math.max(0, x1 ?? 0);
        const rightX = Math.min(candleSize.width, x2 ?? candleSize.width);
        const spanWidth = rightX - leftX;

        if (spanWidth < 10) return;

        ctx.save();

        // 1. Session boundary subtle vertical separation
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(leftX, 0);
        ctx.lineTo(leftX, candleSize.height);
        ctx.stroke();

        // 2. Volume Profile Histogram (pinned to leftX of each day)
        const maxBarWidth = Math.min(130, Math.max(25, spanWidth * 0.45));

        session.rows.forEach((row) => {
          const y = getYCoord(row.price);
          if (y !== null && y >= 0 && y <= candleSize.height) {
            const buyRatio = row.totalVolume > 0 ? row.buyVolume / row.totalVolume : 0.5;
            const barWidth = (row.totalVolume / session.maxRowVolume) * maxBarWidth;

            // Buy volume (green)
            ctx.fillStyle = row.isValueArea
              ? 'rgba(8, 153, 129, 0.55)'
              : 'rgba(8, 153, 129, 0.22)';
            ctx.fillRect(leftX, y - 2, barWidth * buyRatio, 4);

            // Sell volume (red)
            ctx.fillStyle = row.isValueArea
              ? 'rgba(242, 54, 69, 0.55)'
              : 'rgba(242, 54, 69, 0.22)';
            ctx.fillRect(leftX + barWidth * buyRatio, y - 2, barWidth * (1 - buyRatio), 4);
          }
        });

        // 3. Daily POC (Point of Control) line
        const pocY = getYCoord(session.pocPrice);
        if (pocY !== null && pocY >= 0 && pocY <= candleSize.height) {
          ctx.strokeStyle = session.isToday ? '#ff9800' : '#f59e0b';
          ctx.lineWidth = session.isToday ? 2 : 1.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(leftX, pocY);
          ctx.lineTo(rightX, pocY);
          ctx.stroke();

          // dPOC Tag
          const label = session.isToday ? 'Today POC' : 'dPOC';
          const text = `${label} $${session.pocPrice.toLocaleString()}`;
          ctx.font = 'bold 9px monospace';
          const m = ctx.measureText(text);
          const badgeW = m.width + 6;

          ctx.fillStyle = session.isToday ? '#ff9800' : '#d97706';
          ctx.beginPath();
          ctx.roundRect(rightX - badgeW - 2, pocY - 6.5, badgeW, 13, 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, rightX - badgeW + 1, pocY + 3);
        }

        // 4. Daily VAH & VAL lines (dashed blue)
        const vahY = getYCoord(session.vahPrice);
        const valY = getYCoord(session.valPrice);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        if (vahY !== null && vahY >= 0 && vahY <= candleSize.height) {
          ctx.beginPath();
          ctx.moveTo(leftX, vahY);
          ctx.lineTo(rightX, vahY);
          ctx.stroke();
        }

        if (valY !== null && valY >= 0 && valY <= candleSize.height) {
          ctx.beginPath();
          ctx.moveTo(leftX, valY);
          ctx.lineTo(rightX, valY);
          ctx.stroke();
        }

        // 5. Date badge at the top of the session
        const shortDate = session.dateStr.slice(5); // "MM-DD"
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = session.isToday ? '#60a5fa' : '#9ca3af';
        ctx.fillText(session.isToday ? `Today (${shortDate})` : shortDate, leftX + 4, 16);

        ctx.restore();
      });

      // 6. Project Yesterday's POC as a dashed reference line into today's space
      if (sessionData.yesterdayPoc) {
        const yPocY = getYCoord(sessionData.yesterdayPoc);
        if (yPocY !== null && yPocY >= 0 && yPocY <= candleSize.height) {
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(0, yPocY);
          ctx.lineTo(candleSize.width, yPocY);
          ctx.stroke();

          // Right-aligned badge
          const text = `Prev Day POC: $${sessionData.yesterdayPoc.toLocaleString()}`;
          ctx.font = 'bold 9.5px monospace';
          const m = ctx.measureText(text);
          const badgeW = m.width + 10;
          const badgeX = candleSize.width - badgeW - 4;

          ctx.fillStyle = '#1e222d';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.roundRect(badgeX, yPocY - 8, badgeW, 16, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.fillText(text, badgeX + 5, yPocY + 3.5);

          ctx.restore();
        }
      }
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
  }, [chart, sessionData, visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
