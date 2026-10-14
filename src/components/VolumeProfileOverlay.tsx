import React, { useEffect, useRef } from 'react';
import { VolumeProfileResult } from '../services/volumeProfile';
import { Chart } from 'klinecharts';

interface VolumeProfileOverlayProps {
  chart: Chart | null;
  profile: VolumeProfileResult | null;
  visible: boolean;
}

export const VolumeProfileOverlay: React.FC<VolumeProfileOverlayProps> = ({
  chart,
  profile,
  visible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible || !profile || !chart || !canvasRef.current) return;

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

    const maxBarWidth = 140; // max width of the volume profile histogram

    // Draw horizontal volume bars on the right side of the main chart
    profile.rows.forEach((row) => {
      try {
        const point = chart.convertToPixel({ value: row.price }, { paneId: 'candle_pane' });
        const y = Array.isArray(point) ? point[0]?.y : point?.y;

        if (typeof y === 'number' && y >= 0 && y <= candleSize.height) {
          const buyRatio = row.totalVolume > 0 ? row.buyVolume / row.totalVolume : 0.5;
          const barWidth = (row.totalVolume / profile.maxRowVolume) * maxBarWidth;
          const startX = candleSize.width - barWidth;

          // Buy volume portion (green)
          ctx.fillStyle = row.isValueArea ? 'rgba(8, 153, 129, 0.45)' : 'rgba(8, 153, 129, 0.2)';
          ctx.fillRect(startX, y - 2, barWidth * buyRatio, 4);

          // Sell volume portion (red)
          ctx.fillStyle = row.isValueArea ? 'rgba(242, 54, 69, 0.45)' : 'rgba(242, 54, 69, 0.2)';
          ctx.fillRect(startX + barWidth * buyRatio, y - 2, barWidth * (1 - buyRatio), 4);
        }
      } catch (e) {}
    });

    // Helper to draw horizontal reference line with label
    const drawRefLine = (price: number, label: string, color: string, isDashed = false) => {
      try {
        const point = chart.convertToPixel({ value: price }, { paneId: 'candle_pane' });
        const y = Array.isArray(point) ? point[0]?.y : point?.y;

        if (typeof y === 'number' && y >= 0 && y <= candleSize.height) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = label === 'POC' ? 1.5 : 1;
          if (isDashed) ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(candleSize.width - maxBarWidth - 30, y);
          ctx.lineTo(candleSize.width, y);
          ctx.stroke();

          // Label badge
          ctx.fillStyle = color;
          ctx.fillRect(candleSize.width - 45, y - 8, 42, 14);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`${label}`, candleSize.width - 42, y + 2);
          ctx.restore();
        }
      } catch (e) {}
    };

    // Draw POC, VAH, VAL
    drawRefLine(profile.pocPrice, 'POC', '#f23645');
    drawRefLine(profile.vahPrice, 'VAH', '#2962ff', true);
    drawRefLine(profile.valPrice, 'VAL', '#2962ff', true);
  }, [chart, profile, visible]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
    />
  );
};
