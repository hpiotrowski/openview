import React, { useEffect, useRef } from 'react';
import { ZonesAnalysisResult } from '../services/supplyDemand';
import { Chart } from 'klinecharts';

interface ZonesOverlayProps {
  chart: Chart | null;
  zonesData: ZonesAnalysisResult | null;
  showSupplyDemand: boolean;
  showSweeps: boolean;
  showPremiumDiscount: boolean;
}

export const ZonesOverlay: React.FC<ZonesOverlayProps> = ({
  chart,
  zonesData,
  showSupplyDemand,
  showSweeps,
  showPremiumDiscount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!zonesData || !chart || !canvasRef.current || (!showSupplyDemand && !showSweeps && !showPremiumDiscount)) {
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
        right: canvas.width - 60,
        bottom: canvas.height - 40,
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

      // 1. Draw Premium / Discount Equilibrium zones
      if (showPremiumDiscount && zonesData.premiumDiscount) {
        const pd = zonesData.premiumDiscount;
        const startX = getXCoord(pd.startTimestamp, pd.startIndex) || 0;
        const endX = candleSize.width;
        const highY = getYCoord(pd.high);
        const lowY = getYCoord(pd.low);
        const eqY = getYCoord(pd.equilibrium);

        if (highY !== null && lowY !== null && eqY !== null) {
          ctx.save();
          // Premium Zone (Upper half: red tint)
          ctx.fillStyle = 'rgba(242, 54, 69, 0.05)';
          ctx.fillRect(Math.max(0, startX), Math.min(highY, eqY), Math.max(0, endX - startX), Math.abs(eqY - highY));

          // Discount Zone (Lower half: green tint)
          ctx.fillStyle = 'rgba(8, 153, 129, 0.05)';
          ctx.fillRect(Math.max(0, startX), Math.min(eqY, lowY), Math.max(0, endX - startX), Math.abs(lowY - eqY));

          // Equilibrium line (50%)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(Math.max(0, startX), eqY);
          ctx.lineTo(endX, eqY);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('EQ 0.50 (Equilibrium)', endX - 110, eqY - 4);
          ctx.restore();
        }
      }

      // 2. Draw Supply & Demand Zones
      if (showSupplyDemand) {
        zonesData.zones.forEach((zone) => {
          const startX = getXCoord(zone.startTimestamp, zone.startIndex);
          const endX = zone.isTested
            ? getXCoord(zone.endTimestamp, zone.endIndex) || candleSize.width
            : candleSize.width;
          const topY = getYCoord(zone.top);
          const bottomY = getYCoord(zone.bottom);

          if (startX !== null && topY !== null && bottomY !== null) {
            const x = Math.max(0, startX);
            const w = Math.min(candleSize.width, endX) - x;
            const y = Math.min(topY, bottomY);
            const h = Math.max(4, Math.abs(bottomY - topY));

            if (w > 2 && x < candleSize.width) {
              ctx.save();
              const isDemand = zone.type === 'DEMAND';
              const baseColor = isDemand ? '8, 153, 129' : '242, 54, 69';

              ctx.fillStyle = zone.isTested
                ? `rgba(${baseColor}, 0.08)`
                : `rgba(${baseColor}, 0.22)`;
              ctx.strokeStyle = zone.isTested
                ? `rgba(${baseColor}, 0.3)`
                : `rgba(${baseColor}, 0.8)`;
              ctx.lineWidth = zone.strength === 'STRONG' ? 1.5 : 1;

              ctx.fillRect(x, y, w, h);
              ctx.strokeRect(x, y, w, h);

              // Label
              ctx.fillStyle = `rgb(${baseColor})`;
              ctx.font = 'bold 9px sans-serif';
              const statusLabel = zone.isTested ? 'TESTED' : 'FRESH';
              ctx.fillText(
                `${isDemand ? 'DEMAND' : 'SUPPLY'} [${statusLabel}]`,
                x + 4,
                y + Math.min(h - 2, 10)
              );
              ctx.restore();
            }
          }
        });
      }

      // 3. Draw Liquidity Sweeps (SFP)
      if (showSweeps) {
        zonesData.sweeps.forEach((sweep) => {
          const x = getXCoord(sweep.timestamp, sweep.index);
          const y = getYCoord(sweep.price);

          if (x !== null && y !== null && x > 5 && x < candleSize.width + 50) {
            ctx.save();
            const isBear = sweep.type === 'BEARISH_SWEEP';
            ctx.fillStyle = isBear ? '#ff1744' : '#00e676';
            ctx.font = 'bold 10px sans-serif';

            // Draw marker pin
            ctx.beginPath();
            ctx.arc(x, y + (isBear ? -6 : 6), 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Sweep Text
            ctx.fillText(
              isBear ? 'SWEEP ⬇' : 'SWEEP ⬆',
              x - 22,
              y + (isBear ? -12 : 18)
            );
            ctx.restore();
          }
        });
      }
    };

    // Initial render
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
  }, [chart, zonesData, showSupplyDemand, showSweeps, showPremiumDiscount]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};
