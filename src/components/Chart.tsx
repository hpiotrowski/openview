import React, { useEffect, useRef, useState, useCallback } from 'react';
import { init, dispose, Chart as KLineChartInstance, Crosshair, Period } from 'klinecharts';
import { Clock, X } from 'lucide-react';
import { BinanceService, KLineBar } from '../services/binance';
import { ChartType } from './TopNavbar';
import { VolumeProfileCalculator, VolumeProfileResult } from '../services/volumeProfile';
import { VolumeProfileOverlay } from './VolumeProfileOverlay';
import { SMCCalculator, SMCResult } from '../services/smc';
import { SmcOverlay } from './SmcOverlay';
import { SupplyDemandCalculator, ZonesAnalysisResult } from '../services/supplyDemand';
import { ZonesOverlay } from './ZonesOverlay';
import { CipherACalculator, CipherAResult } from '../services/cipherA';
import { CipherAOverlay } from './CipherAOverlay';
import { KillzonesCalculator, KillzonesResult } from '../services/killzones';
import { KillzonesOverlay } from './KillzonesOverlay';
import { AnchoredVwapCalculator, AnchoredVwapResult } from '../services/anchoredVwap';
import { VwapOverlay } from './VwapOverlay';
import { LiquidationHeatmapCalculator, LiquidationHeatmapResult } from '../services/liquidationHeatmap';
import { LiquidationOverlay } from './LiquidationOverlay';
import { ReplayEngine } from '../services/replayEngine';
import { AVAILABLE_INDICATORS } from './IndicatorsModal';

interface ChartProps {
  id: string;
  symbol: string;
  interval: string;
  chartType: ChartType;
  activeDrawingTool: string | null;
  onOverlayCreated?: () => void;
  activeIndicators: string[];
  onRemoveIndicator?: (name: string) => void;
  volumeProfileEnabled: boolean;
  replayEngine: ReplayEngine;
  isReplayActive: boolean;
  onCrosshairMove?: (crosshair: Crosshair, sourceId: string) => void;
  externalCrosshair?: Crosshair | null;
  onPriceUpdate?: (price: number) => void;
}

export const Chart: React.FC<ChartProps> = ({
  id,
  symbol,
  interval,
  chartType,
  activeDrawingTool,
  onOverlayCreated,
  activeIndicators,
  onRemoveIndicator,
  volumeProfileEnabled,
  replayEngine,
  isReplayActive,
  onCrosshairMove,
  externalCrosshair,
  onPriceUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<KLineChartInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResult, setProfileResult] = useState<VolumeProfileResult | null>(null);
  const [smcResult, setSmcResult] = useState<SMCResult | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const rawBarsRef = useRef<KLineBar[]>([]);
  const liveUpdateCallbackRef = useRef<((bar: KLineBar) => void) | null>(null);

  // Interval duration helper
  const getIntervalMs = (intv: string): number => {
    if (intv.endsWith('s')) return (parseInt(intv) || 1) * 1000;
    if (intv.endsWith('m')) return (parseInt(intv) || 1) * 60 * 1000;
    if (intv.endsWith('h')) return (parseInt(intv) || 1) * 3600 * 1000;
    if (intv.toLowerCase().endsWith('d')) return (parseInt(intv) || 1) * 86400 * 1000;
    if (intv.toLowerCase().endsWith('w')) return (parseInt(intv) || 1) * 7 * 86400 * 1000;
    return 15 * 60 * 1000;
  };

  const formatCountdown = (diffSeconds: number): string => {
    if (diffSeconds <= 0) return '00:00';
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Candle close countdown timer (updates every second)
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const intervalMs = getIntervalMs(interval);
      const nextClose = (Math.floor(now / intervalMs) + 1) * intervalMs;
      const remainingSec = Math.max(0, Math.floor((nextClose - now) / 1000));
      setCountdown(formatCountdown(remainingSec));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [interval]);

  // Map interval string to Period
  const mapIntervalToPeriod = (intv: string): Period => {
    if (intv.endsWith('s')) return { type: 'second', span: parseInt(intv) || 1 };
    if (intv.endsWith('m')) return { type: 'minute', span: parseInt(intv) || 1 };
    if (intv.endsWith('h')) return { type: 'hour', span: parseInt(intv) || 1 };
    if (intv.endsWith('d') || intv.endsWith('D')) return { type: 'day', span: 1 };
    if (intv.endsWith('w') || intv.endsWith('W')) return { type: 'week', span: 1 };
    return { type: 'minute', span: 15 };
  };

  // Update Volume Profile
  const updateVolumeProfile = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 0) {
      const visibleBars = bars.slice(-150);
      const res = VolumeProfileCalculator.calculate(visibleBars);
      setProfileResult(res);
    }
  }, []);

  // Update Smart Money Concepts (SMC)
  const updateSmc = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 5) {
      const res = SMCCalculator.calculate(bars.slice(-200));
      setSmcResult(res);
    }
  }, []);

  // Update Supply & Demand Zones (Flux Charts style)
  const [zonesResult, setZonesResult] = useState<ZonesAnalysisResult | null>(null);
  const updateZones = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 10) {
      const res = SupplyDemandCalculator.calculate(bars.slice(-250));
      setZonesResult(res);
    }
  }, []);

  // Update Market Cipher A
  const [cipherAResult, setCipherAResult] = useState<CipherAResult | null>(null);
  const updateCipherA = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 30) {
      setCipherAResult(CipherACalculator.calculate(bars.slice(-250)));
    }
  }, []);

  // Update ICT Killzones
  const [killzonesResult, setKillzonesResult] = useState<KillzonesResult | null>(null);
  const updateKillzones = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 20) {
      setKillzonesResult(KillzonesCalculator.calculate(bars.slice(-300)));
    }
  }, []);

  // Update Anchored VWAP
  const [vwapResult, setVwapResult] = useState<AnchoredVwapResult | null>(null);
  const updateVwap = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 10) {
      setVwapResult(AnchoredVwapCalculator.calculate(bars.slice(-250), 'HIGH'));
    }
  }, []);

  // Update Liquidation Heatmap
  const [liqResult, setLiqResult] = useState<LiquidationHeatmapResult | null>(null);
  const updateLiq = useCallback((bars: KLineBar[]) => {
    if (bars && bars.length > 30) {
      setLiqResult(LiquidationHeatmapCalculator.calculate(bars.slice(-200)));
    }
  }, []);

  // Helper to synchronize indicators cleanly with KlineCharts (no duplicates, clean removals)
  const syncIndicators = useCallback((chart: KLineChartInstance, targetIndicators: string[]) => {
    try {
      const currentList = chart.getIndicators() || [];

      // 1. Remove indicators that are on chart but no longer in targetIndicators
      currentList.forEach((ind) => {
        if (!targetIndicators.includes(ind.name)) {
          chart.removeIndicator({ id: ind.id });
        }
      });

      // 2. Remove duplicate instances of the same indicator on chart if any exist
      const updatedList = chart.getIndicators() || [];
      const seenNames = new Set<string>();
      updatedList.forEach((ind) => {
        if (seenNames.has(ind.name)) {
          chart.removeIndicator({ id: ind.id });
        } else {
          seenNames.add(ind.name);
        }
      });

      // 3. Add indicators that should be on chart but are not yet present
      const presentNames = new Set((chart.getIndicators() || []).map((i) => i.name));
      const canvasOnlyIndicators = [
        'VP',
        'SMC',
        'SUPPLY_DEMAND',
        'LIQUIDITY_SWEEP',
        'PREMIUM_DISCOUNT',
        'CIPHER_A',
        'KILLZONES',
        'AVWAP',
        'LIQUIDATION_HEATMAP',
      ];

      targetIndicators.forEach((indName) => {
        // Skip canvas-only overlays
        if (canvasOnlyIndicators.includes(indName)) {
          return;
        }

        if (presentNames.has(indName)) {
          return; // already attached, do not duplicate!
        }

        const isOverlay = ['EMA', 'SMA', 'BOLL', 'SAR', 'BBI'].includes(indName);
        if (isOverlay) {
          chart.createIndicator({ name: indName, paneId: 'candle_pane' }, true);
        } else {
          chart.createIndicator({ name: indName }, false);
        }
        presentNames.add(indName);
      });
    } catch (err) {
      console.warn('Error syncing indicators:', err);
    }
  }, []);

  // 1. Initialize Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = init(containerRef.current, {
      styles: {
        grid: {
          show: true,
          horizontal: {
            show: true,
            size: 1,
            color: '#1f2430',
            style: 'dashed',
            dashedValue: [2, 2],
          },
          vertical: {
            show: true,
            size: 1,
            color: '#1f2430',
            style: 'dashed',
            dashedValue: [2, 2],
          },
        },
        candle: {
          type: chartType as any,
          bar: {
            upColor: '#089981',
            downColor: '#f23645',
            noChangeColor: '#868993',
            upBorderColor: '#089981',
            downBorderColor: '#f23645',
            noChangeBorderColor: '#868993',
            upWickColor: '#089981',
            downWickColor: '#f23645',
            noChangeWickColor: '#868993',
          },
          priceMark: {
            show: true,
            high: { show: true, color: '#868993', textSize: 10 },
            low: { show: true, color: '#868993', textSize: 10 },
            last: {
              show: true,
              upColor: '#089981',
              downColor: '#f23645',
              noChangeColor: '#868993',
              line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
              text: { show: true, color: '#ffffff', size: 11, paddingLeft: 4, paddingRight: 4 },
            },
          },
        },
        xAxis: {
          show: true,
          size: 'auto',
          axisLine: { show: true, size: 1, color: '#2a2e39' },
          tickLine: { show: true, size: 1, color: '#2a2e39', length: 3 },
          tickText: { show: true, color: '#868993', size: 11, family: 'sans-serif', weight: 'normal', marginStart: 4, marginEnd: 4 },
        },
        yAxis: {
          show: true,
          size: 'auto',
          axisLine: { show: true, size: 1, color: '#2a2e39' },
          tickLine: { show: true, size: 1, color: '#2a2e39', length: 3 },
          tickText: { show: true, color: '#868993', size: 11, family: 'sans-serif', weight: 'normal', marginStart: 4, marginEnd: 6 },
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { style: 'dashed', dashedValue: [4, 4], size: 1, color: '#868993' },
            text: { show: true, color: '#ffffff', backgroundColor: '#363c4e', size: 11 },
          },
          vertical: {
            show: true,
            line: { style: 'dashed', dashedValue: [4, 4], size: 1, color: '#868993' },
            text: { show: true, color: '#ffffff', backgroundColor: '#363c4e', size: 11 },
          },
        },
      },
    });

    if (!chart) return;
    chartInstanceRef.current = chart;
    syncIndicators(chart, activeIndicators);

    // Crosshair Sync Handler
    chart.subscribeAction('onCrosshairChange', (data) => {
      if (onCrosshairMove && data) {
        onCrosshairMove(data as Crosshair, id);
      }
    });

    // Bar click for Replay Mode activation
    chart.subscribeAction('onCandleBarClick', (data: any) => {
      if (isReplayActive && data && data.kLineData) {
        const sliced = replayEngine.startReplay(data.kLineData.timestamp);
        chart.resetData();
        updateVolumeProfile(sliced);
      }
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      dispose(chart);
      chartInstanceRef.current = null;
    };
  }, []);

  // 2. Handle External Crosshair Sync
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (chart && externalCrosshair) {
      try {
        chart.executeAction('onCrosshairChange', externalCrosshair);
      } catch (e) {}
    }
  }, [externalCrosshair]);

  // 3. Handle Chart Type change
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (chart) {
      chart.setStyles({
        candle: {
          type: chartType as any,
        },
      });
    }
  }, [chartType]);

  // 4. Handle Active Drawing Tool
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (chart && activeDrawingTool) {
      try {
        chart.createOverlay(activeDrawingTool);
        if (onOverlayCreated) onOverlayCreated();
      } catch (err) {
        console.warn('Error creating overlay:', err);
      }
    }
  }, [activeDrawingTool, onOverlayCreated]);

  // 5. Handle Indicators (UNLIMITED & SYNCHRONIZED)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    syncIndicators(chart, activeIndicators);
  }, [activeIndicators, syncIndicators]);

  // 6. Connect DataLoader (Historical REST + Live WebSocket)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    setLoading(true);
    chart.setSymbol({ ticker: symbol, pricePrecision: 2, volumePrecision: 2 });
    chart.setPeriod(mapIntervalToPeriod(interval));

    chart.setDataLoader({
      getBars: async ({ callback }) => {
        try {
          if (isReplayActive && replayEngine.isReplaying) {
            callback(replayEngine.getVisibleBars());
            setLoading(false);
          } else {
            const bars = await BinanceService.fetchKlines(symbol, interval, 1000);
            rawBarsRef.current = bars;
            replayEngine.setBars(bars);
            updateVolumeProfile(bars);
            updateSmc(bars);
            updateZones(bars);
            updateCipherA(bars);
            updateKillzones(bars);
            updateVwap(bars);
            updateLiq(bars);
            callback(bars);
            setLoading(false);

            if (bars.length > 0 && onPriceUpdate) {
              onPriceUpdate(bars[bars.length - 1].close);
            }
          }
        } catch (err) {
          console.error('Error in getBars:', err);
          setLoading(false);
        }
      },
      subscribeBar: ({ callback }) => {
        liveUpdateCallbackRef.current = callback;
        if (!isReplayActive) {
          let lastUpdateTime = 0;
          BinanceService.subscribeKlines(id, symbol, interval, (newBar) => {
            callback(newBar);
            if (onPriceUpdate) onPriceUpdate(newBar.close);

            // Update live bar in rawBarsRef
            const currentBars = rawBarsRef.current;
            if (currentBars.length > 0) {
              const lastIdx = currentBars.length - 1;
              if (currentBars[lastIdx].timestamp === newBar.timestamp) {
                currentBars[lastIdx] = newBar;
              } else if (newBar.timestamp > currentBars[lastIdx].timestamp) {
                currentBars.push(newBar);
              }

              // Throttle overlay recalculation every 2 seconds
              const now = Date.now();
              if (now - lastUpdateTime > 2000) {
                lastUpdateTime = now;
                updateVolumeProfile(currentBars);
                updateSmc(currentBars);
                updateZones(currentBars);
                updateCipherA(currentBars);
                updateVwap(currentBars);
                updateLiq(currentBars);
              }
            }
          });
        }
      },
      unsubscribeBar: () => {
        BinanceService.unsubscribe(id);
      },
    });

    return () => {
      BinanceService.unsubscribe(id);
    };
  }, [id, symbol, interval, isReplayActive]);

  // 7. Replay playback update listener
  useEffect(() => {
    if (!isReplayActive) return;

    const chart = chartInstanceRef.current;
    if (chart && replayEngine.isReplaying) {
      chart.resetData();
      const visible = replayEngine.getVisibleBars();
      updateVolumeProfile(visible);
      updateSmc(visible);
      updateZones(visible);
      updateCipherA(visible);
      updateKillzones(visible);
      updateVwap(visible);
      updateLiq(visible);
    }
  }, [isReplayActive]);

  return (
    <div className="relative w-full h-full bg-[#131722] overflow-hidden">
      {/* Chart Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Volume Profile Overlay (POC, VAH, VAL) */}
      <VolumeProfileOverlay
        chart={chartInstanceRef.current}
        profile={profileResult}
        visible={volumeProfileEnabled}
      />

      {/* Smart Money Concepts Overlay (Order Blocks, FVGs, BOS, CHOCH) */}
      <SmcOverlay
        chart={chartInstanceRef.current}
        smcData={smcResult}
        visible={activeIndicators.includes('SMC')}
      />

      {/* Flux Charts Style Supply & Demand, Liquidity Sweeps, and Premium/Discount Zones */}
      <ZonesOverlay
        chart={chartInstanceRef.current}
        zonesData={zonesResult}
        showSupplyDemand={activeIndicators.includes('SUPPLY_DEMAND')}
        showSweeps={activeIndicators.includes('LIQUIDITY_SWEEP')}
        showPremiumDiscount={activeIndicators.includes('PREMIUM_DISCOUNT')}
      />

      {/* Market Cipher A Overlay (CryptoFace Ribbon & Signals) */}
      <CipherAOverlay
        chart={chartInstanceRef.current}
        cipherAData={cipherAResult}
        visible={activeIndicators.includes('CIPHER_A')}
      />

      {/* ICT Killzones & Asian Range Overlay */}
      <KillzonesOverlay
        chart={chartInstanceRef.current}
        killzonesData={killzonesResult}
        visible={activeIndicators.includes('KILLZONES')}
      />

      {/* Anchored VWAP Overlay */}
      <VwapOverlay
        chart={chartInstanceRef.current}
        vwapData={vwapResult}
        visible={activeIndicators.includes('AVWAP')}
      />

      {/* Liquidation Heatmap Overlay (Kingfisher Style) */}
      <LiquidationOverlay
        chart={chartInstanceRef.current}
        liqData={liqResult}
        visible={activeIndicators.includes('LIQUIDATION_HEATMAP')}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#131722]/80 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-[#2962ff] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#868993]">Loading {symbol} ({interval})...</span>
          </div>
        </div>
      )}

      {/* Symbol & Interval Badge on Top Left with Live Candle Countdown Timer & Indicators Legend */}
      <div className="absolute top-2 left-3 z-10 flex flex-col space-y-1.5 pointer-events-none">
        <div className="flex items-center space-x-2 bg-[#1e222d]/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-[#2a2e39] shadow-md pointer-events-auto">
          <span className="font-bold text-xs text-[#d1d4dc]">{symbol}</span>
          <span className="text-[10px] text-[#868993] font-mono px-1.5 py-0.5 rounded bg-[#131722] border border-[#2a2e39]">
            {interval}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-pulse-live" />
          <div className="h-3 w-[1px] bg-[#2a2e39]" />
          <div className="flex items-center space-x-1.5 text-[11px] font-mono" title="Time remaining until candle close">
            <Clock size={12} className="text-[#868993]" />
            <span className="text-[#868993] text-[10px]">Close:</span>
            <span className="font-bold text-[#2962ff] bg-[#2962ff]/10 px-1 rounded">{countdown || '00:00'}</span>
          </div>
        </div>

        {/* Active Indicators Legend Chips with 1-Click Delete */}
        {activeIndicators.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 max-w-xl pointer-events-auto">
            {activeIndicators.map((indName) => {
              const info = AVAILABLE_INDICATORS.find((i) => i.id === indName);
              const label = info ? info.shortName : indName;

              return (
                <div
                  key={indName}
                  className="group flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded border transition-colors shadow-xs bg-[#1e222d]/90 border-[#2a2e39] text-[#d1d4dc] hover:border-[#4b5563]"
                  title={`${info?.name || indName} - Click to remove`}
                >
                  <span className="font-medium">{label}</span>
                  {onRemoveIndicator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveIndicator(indName);
                      }}
                      className="text-[#868993] hover:text-[#f23645] p-0.5 rounded transition-colors"
                      title={`Remove ${label}`}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
