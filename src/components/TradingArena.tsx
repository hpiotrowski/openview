import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  init,
  dispose,
  Chart as KLineChartInstance,
  Nullable,
} from 'klinecharts';
import {
  ScenarioInfo,
  ScenarioService,
  calculateATR,
} from '../services/scenarioGenerator';
import { KLineBar } from '../services/binance';
import { IndicatorsModal } from './IndicatorsModal';
import { DrawingToolbar } from './DrawingToolbar';
import { VolumeProfileOverlay } from './VolumeProfileOverlay';
import { VolumeProfileCalculator, VolumeProfileResult } from '../services/volumeProfile';
import { ZonesOverlay } from './ZonesOverlay';
import { SupplyDemandCalculator, ZonesAnalysisResult } from '../services/supplyDemand';
import { SmcOverlay } from './SmcOverlay';
import { SMCCalculator, SMCResult } from '../services/smc';
import { CipherAOverlay } from './CipherAOverlay';
import { CipherACalculator, CipherAResult } from '../services/cipherA';
import { KillzonesOverlay } from './KillzonesOverlay';
import { KillzonesCalculator, KillzonesResult } from '../services/killzones';
import { VwapOverlay } from './VwapOverlay';
import { AnchoredVwapCalculator, AnchoredVwapResult } from '../services/anchoredVwap';
import { LiquidationOverlay } from './LiquidationOverlay';
import { LiquidationHeatmapCalculator, LiquidationHeatmapResult } from '../services/liquidationHeatmap';
import { PositionOverlay } from './PositionOverlay';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sliders,
  TrendingUp,
  TrendingDown,
  FastForward,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Layers,
  ShieldAlert,
  Flame,
} from 'lucide-react';

interface TradingArenaProps {
  onBackToLobby: () => void;
}

interface SessionStats {
  trades: number;
  wins: number;
  losses: number;
  skips: number;
  totalR: number;
}

export const TradingArena: React.FC<TradingArenaProps> = ({ onBackToLobby }) => {
  // Scenario State
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'scalp' | 'daytrade' | 'swing'>('all');
  const [scenario, setScenario] = useState<ScenarioInfo>(() => ScenarioService.getRandomScenario());
  const [isRevealed, setIsRevealed] = useState(false);
  const [tradeOutcome, setTradeOutcome] = useState<'WIN' | 'LOSS' | 'SKIPPED' | null>(null);
  const [finalReturnROE, setFinalReturnROE] = useState<number>(0);

  // Indicators & Drawing Tools
  const [activeIndicators, setActiveIndicators] = useState<string[]>([
    'VOL',
    'SMC',
    'CIPHER_B',
  ]);
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);

  // Overlays Data
  const [profileResult, setProfileResult] = useState<VolumeProfileResult | null>(null);
  const [zonesResult, setZonesResult] = useState<ZonesAnalysisResult | null>(null);
  const [smcResult, setSmcResult] = useState<SMCResult | null>(null);
  const [cipherAResult, setCipherAResult] = useState<CipherAResult | null>(null);
  const [killzonesResult, setKillzonesResult] = useState<KillzonesResult | null>(null);
  const [vwapResult, setVwapResult] = useState<AnchoredVwapResult | null>(null);
  const [liqResult, setLiqResult] = useState<LiquidationHeatmapResult | null>(null);

  // Trade Decision State
  const [direction, setDirection] = useState<'LONG' | 'SHORT' | null>(null);
  const [leverage, setLeverage] = useState<number>(10);
  const [entryPrice, setEntryPrice] = useState<number>(scenario.entryPrice);
  const [stopLoss, setStopLoss] = useState<number>(scenario.suggestedStopLoss);
  const [takeProfit, setTakeProfit] = useState<number>(scenario.suggestedTakeProfit);

  // Playback / Simulation State
  const [simIndex, setSimIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(2); // candles per second
  const simTimerRef = useRef<any>(null);

  // Session Statistics
  const [stats, setStats] = useState<SessionStats>({
    trades: 0,
    wins: 0,
    losses: 0,
    skips: 0,
    totalR: 0,
  });

  // Chart Container
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<KLineChartInstance | null>(null);

  // Synchronize indicators with KlineCharts
  const syncIndicators = useCallback((chart: KLineChartInstance, targetIndicators: string[]) => {
    try {
      const currentList = chart.getIndicators() || [];
      currentList.forEach((ind) => {
        if (!targetIndicators.includes(ind.name)) {
          chart.removeIndicator({ id: ind.id });
        }
      });

      const updatedList = chart.getIndicators() || [];
      const seenNames = new Set<string>();
      updatedList.forEach((ind) => {
        if (seenNames.has(ind.name)) {
          chart.removeIndicator({ id: ind.id });
        } else {
          seenNames.add(ind.name);
        }
      });

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
        if (canvasOnlyIndicators.includes(indName) || presentNames.has(indName)) return;
        const isOverlay = ['EMA', 'SMA', 'BOLL', 'SAR', 'BBI'].includes(indName);
        if (isOverlay) {
          chart.createIndicator({ name: indName, paneId: 'candle_pane' }, true);
        } else {
          chart.createIndicator({ name: indName }, false);
        }
        presentNames.add(indName);
      });
    } catch (e) {}
  }, []);

  // Update all custom technical calculations for the currently visible slice of bars
  const recalculateOverlays = useCallback((bars: KLineBar[]) => {
    if (!bars || bars.length < 5) return;
    setProfileResult(VolumeProfileCalculator.calculate(bars.slice(-120)));
    setSmcResult(SMCCalculator.calculate(bars.slice(-150)));
    setZonesResult(SupplyDemandCalculator.calculate(bars.slice(-180)));
    if (bars.length > 30) setCipherAResult(CipherACalculator.calculate(bars.slice(-180)));
    if (bars.length > 20) setKillzonesResult(KillzonesCalculator.calculate(bars.slice(-200)));
    setVwapResult(AnchoredVwapCalculator.calculate(bars.slice(-180), 'HIGH'));
    if (bars.length > 30) setLiqResult(LiquidationHeatmapCalculator.calculate(bars.slice(-150)));
  }, []);

  const visibleBarsRef = useRef<KLineBar[]>([]);
  const liveUpdateCallbackRef = useRef<((bar: KLineBar) => void) | null>(null);

  // 1. Initialize Chart instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    visibleBarsRef.current = [
      ...scenario.contextBars,
      ...scenario.futureBars.slice(0, simIndex),
    ];

    const chart = init(chartContainerRef.current, {
      styles: {
        grid: {
          show: true,
          horizontal: { show: true, size: 1, color: '#1a1f2c', style: 'dashed', dashedValue: [2, 2] },
          vertical: { show: true, size: 1, color: '#1a1f2c', style: 'dashed', dashedValue: [2, 2] },
        },
        candle: {
          type: 'candle_solid',
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
            last: {
              show: true,
              upColor: '#089981',
              downColor: '#f23645',
              line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
              text: { show: true, color: '#ffffff', size: 11, paddingLeft: 4, paddingRight: 4 },
            },
          },
        },
        xAxis: { show: true, size: 'auto', axisLine: { color: '#2a2e39' }, tickText: { color: '#868993', size: 11 } },
        yAxis: { show: true, size: 'auto', axisLine: { color: '#2a2e39' }, tickText: { color: '#868993', size: 11 } },
      },
    });

    if (chart) {
      chartInstanceRef.current = chart;
      syncIndicators(chart, activeIndicators);

      chart.setDataLoader({
        getBars: async ({ callback }) => {
          callback(visibleBarsRef.current);
        },
        subscribeBar: ({ callback }) => {
          liveUpdateCallbackRef.current = callback;
        },
      });
    }

    const ro = new ResizeObserver(() => {
      chart?.resize();
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      if (chart) dispose(chart);
      chartInstanceRef.current = null;
    };
  }, []);

  // 2. Refresh chart data whenever scenario or simIndex changes
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const visibleBars = [
      ...scenario.contextBars,
      ...scenario.futureBars.slice(0, simIndex),
    ];
    visibleBarsRef.current = visibleBars;
    chart.resetData();
    recalculateOverlays(visibleBars);
  }, [scenario, simIndex, recalculateOverlays]);

  // 3. Sync indicators whenever activeIndicators changes
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    syncIndicators(chart, activeIndicators);
  }, [activeIndicators, syncIndicators]);

  // Handle active drawing tool
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (chart && activeDrawingTool) {
      try {
        chart.createOverlay(activeDrawingTool);
      } catch (e) {}
    }
  }, [activeDrawingTool]);

  // Load a new scenario
  const handleLoadNewScenario = (targetCategory?: 'scalp' | 'daytrade' | 'swing') => {
    clearInterval(simTimerRef.current);
    setIsPlaying(false);
    setSimIndex(0);
    setIsRevealed(false);
    setTradeOutcome(null);

    const cat = targetCategory || (categoryFilter === 'all' ? undefined : categoryFilter);
    const newScen = ScenarioService.getRandomScenario(cat);
    setScenario(newScen);
    setDirection(null);
    setEntryPrice(newScen.entryPrice);
    setStopLoss(newScen.suggestedStopLoss);
    setTakeProfit(newScen.suggestedTakeProfit);
  };

  // Change category filter
  const handleSelectCategory = (cat: 'all' | 'scalp' | 'daytrade' | 'swing') => {
    setCategoryFilter(cat);
    handleLoadNewScenario(cat === 'all' ? undefined : cat);
  };

  // Switch Direction (LONG or SHORT)
  const handleSetDirection = (newDir: 'LONG' | 'SHORT') => {
    setDirection(newDir);
    const entry = scenario.entryPrice;
    const atr = scenario.atr > 0 ? scenario.atr : entry * 0.005;

    // Default R:R 1:3.0
    if (newDir === 'LONG') {
      const slDist = Math.max(entry * 0.002, atr * 1.2);
      setStopLoss(parseFloat((entry - slDist).toFixed(2)));
      setTakeProfit(parseFloat((entry + slDist * 3.0).toFixed(2)));
    } else {
      const slDist = Math.max(entry * 0.002, atr * 1.2);
      setStopLoss(parseFloat((entry + slDist).toFixed(2)));
      setTakeProfit(parseFloat((entry - slDist * 3.0).toFixed(2)));
    }
  };

  // Skip scenario
  const handleSkip = () => {
    clearInterval(simTimerRef.current);
    setIsPlaying(false);
    setTradeOutcome('SKIPPED');
    setIsRevealed(true);
    setStats((prev) => ({
      ...prev,
      trades: prev.trades + 1,
      skips: prev.skips + 1,
    }));
  };

  // Evaluate single step or candle during simulation
  const checkTradeConditions = useCallback(
    (step: number) => {
      if (!direction) return false;
      const futureBar = scenario.futureBars[step - 1];
      if (!futureBar) return false;

      const slDist = Math.abs(entryPrice - stopLoss);
      const tpDist = Math.abs(takeProfit - entryPrice);
      const rr = slDist > 0 ? tpDist / slDist : 3.0;

      if (direction === 'LONG') {
        // Did it hit Stop Loss?
        if (futureBar.low <= stopLoss) {
          const roe = -((slDist / entryPrice) * 100 * leverage);
          setFinalReturnROE(roe);
          setTradeOutcome('LOSS');
          setIsRevealed(true);
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            losses: prev.losses + 1,
            totalR: parseFloat((prev.totalR - 1.0).toFixed(2)),
          }));
          return true;
        }
        // Did it hit Take Profit?
        if (futureBar.high >= takeProfit) {
          const roe = (tpDist / entryPrice) * 100 * leverage;
          setFinalReturnROE(roe);
          setTradeOutcome('WIN');
          setIsRevealed(true);
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            wins: prev.wins + 1,
            totalR: parseFloat((prev.totalR + rr).toFixed(2)),
          }));
          return true;
        }
      } else {
        // SHORT
        // Did it hit Stop Loss?
        if (futureBar.high >= stopLoss) {
          const roe = -((slDist / entryPrice) * 100 * leverage);
          setFinalReturnROE(roe);
          setTradeOutcome('LOSS');
          setIsRevealed(true);
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            losses: prev.losses + 1,
            totalR: parseFloat((prev.totalR - 1.0).toFixed(2)),
          }));
          return true;
        }
        // Did it hit Take Profit?
        if (futureBar.low <= takeProfit) {
          const roe = (tpDist / entryPrice) * 100 * leverage;
          setFinalReturnROE(roe);
          setTradeOutcome('WIN');
          setIsRevealed(true);
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            wins: prev.wins + 1,
            totalR: parseFloat((prev.totalR + rr).toFixed(2)),
          }));
          return true;
        }
      }

      // Reached the end of future bars without hitting either
      if (step >= scenario.futureBars.length) {
        const lastClose = futureBar.close;
        const pnlPercent =
          direction === 'LONG'
            ? ((lastClose - entryPrice) / entryPrice) * 100
            : ((entryPrice - lastClose) / entryPrice) * 100;
        const roe = pnlPercent * leverage;
        setFinalReturnROE(roe);
        const isWin = pnlPercent > 0;
        setTradeOutcome(isWin ? 'WIN' : 'LOSS');
        setIsRevealed(true);
        const earnedR = slDist > 0 ? Math.abs(lastClose - entryPrice) / slDist : 1;
        setStats((prev) => ({
          ...prev,
          trades: prev.trades + 1,
          wins: prev.wins + (isWin ? 1 : 0),
          losses: prev.losses + (isWin ? 0 : 1),
          totalR: parseFloat((prev.totalR + (isWin ? earnedR : -1)).toFixed(2)),
        }));
        return true;
      }

      return false;
    },
    [direction, entryPrice, stopLoss, takeProfit, leverage, scenario.futureBars]
  );

  // Step 1 candle forward
  const handleStepForward = useCallback(() => {
    if (simIndex < scenario.futureBars.length) {
      const nextIndex = simIndex + 1;
      setSimIndex(nextIndex);
      const isEnded = checkTradeConditions(nextIndex);
      if (isEnded) {
        clearInterval(simTimerRef.current);
        setIsPlaying(false);
      }
    } else {
      clearInterval(simTimerRef.current);
      setIsPlaying(false);
    }
  }, [simIndex, scenario.futureBars.length, checkTradeConditions]);

  // Start continuous simulation playback
  const handleTogglePlay = () => {
    if (!direction) {
      alert('Please select LONG or SHORT before simulating the trade!');
      return;
    }

    if (isPlaying) {
      clearInterval(simTimerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const intervalMs = Math.max(80, Math.floor(1000 / simSpeed));
      simTimerRef.current = setInterval(() => {
        handleStepForward();
      }, intervalMs);
    }
  };

  useEffect(() => {
    return () => clearInterval(simTimerRef.current);
  }, []);

  // Compute live R:R and distance %
  const riskDist = Math.abs(entryPrice - stopLoss);
  const rewardDist = Math.abs(takeProfit - entryPrice);
  const currentRR = riskDist > 0 ? (rewardDist / riskDist).toFixed(2) : '0';
  const riskPercent = ((riskDist / entryPrice) * 100).toFixed(2);
  const rewardPercent = ((rewardDist / entryPrice) * 100).toFixed(2);
  const projectedRoe = (parseFloat(rewardPercent) * leverage).toFixed(1);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131722] text-[#d1d4dc] select-none font-sans overflow-hidden">
      {/* 1. Header Toolbar */}
      <header className="h-12 border-b border-[#2a2e39] bg-[#1e222d] px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLobby}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-gray-200 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            Lobby
          </button>

          <div className="h-5 w-[1px] bg-[#2a2e39]" />

          {/* Blind Title / Scenario Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide">
              {isRevealed ? scenario.realSymbol : 'Asset Confidential'}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#363c4e] text-cyan-300">
              {scenario.timeframe}
            </span>
            {isRevealed && (
              <span className="text-xs text-gray-400 font-mono">({scenario.realDate})</span>
            )}
          </div>
        </div>

        {/* Filter categories */}
        <div className="flex items-center bg-[#131722] p-0.5 rounded border border-[#2a2e39] gap-1">
          {(['all', 'scalp', 'daytrade', 'swing'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelectCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'All Timeframes' : cat}
            </button>
          ))}
        </div>

        {/* Action Controls & Stats */}
        <div className="flex items-center gap-3">
          {/* Indicators Button */}
          <button
            onClick={() => setIndicatorsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-gray-200 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Indicators ({activeIndicators.length})
          </button>

          {/* Random Scenario Button */}
          <button
            onClick={() => handleLoadNewScenario()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-black" />
            Next Scenario
          </button>

          {/* Session Score Card */}
          <div className="flex items-center gap-2 bg-[#131722] border border-[#2a2e39] px-2.5 py-1 rounded text-xs">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-gray-400">P&L:</span>
            <span
              className={`font-mono font-bold ${
                stats.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {stats.totalR >= 0 ? `+${stats.totalR}R` : `${stats.totalR}R`}
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">WR:</span>
            <span className="font-mono font-semibold text-white">
              {stats.trades > 0
                ? `${Math.round((stats.wins / stats.trades) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Arena Workspace */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Drawing Toolbar */}
        <DrawingToolbar
          activeTool={activeDrawingTool || 'cursor'}
          onSelectTool={setActiveDrawingTool}
          onClearDrawings={() => {}}
          magnetEnabled={false}
          onToggleMagnet={() => {}}
        />

        {/* Central Chart Workspace */}
        <div className="flex-1 relative bg-[#131722] overflow-hidden">
          <div ref={chartContainerRef} className="w-full h-full" />

          {/* Canvas Overlays Layer */}
          <VolumeProfileOverlay
            chart={chartInstanceRef.current}
            profile={profileResult}
            visible={activeIndicators.includes('VP')}
          />
          <ZonesOverlay
            chart={chartInstanceRef.current}
            zonesData={zonesResult}
            showSupplyDemand={activeIndicators.includes('SUPPLY_DEMAND')}
            showSweeps={activeIndicators.includes('LIQUIDITY_SWEEP')}
            showPremiumDiscount={activeIndicators.includes('PREMIUM_DISCOUNT')}
          />
          <SmcOverlay
            chart={chartInstanceRef.current}
            smcData={smcResult}
            visible={activeIndicators.includes('SMC')}
          />
          <CipherAOverlay
            chart={chartInstanceRef.current}
            cipherAData={cipherAResult}
            visible={activeIndicators.includes('CIPHER_A')}
          />
          <KillzonesOverlay
            chart={chartInstanceRef.current}
            killzonesData={killzonesResult}
            visible={activeIndicators.includes('KILLZONES')}
          />
          <VwapOverlay
            chart={chartInstanceRef.current}
            vwapData={vwapResult}
            visible={activeIndicators.includes('AVWAP')}
          />
          <LiquidationOverlay
            chart={chartInstanceRef.current}
            liqData={liqResult}
            visible={activeIndicators.includes('LIQUIDATION_HEATMAP')}
          />

          {/* Position R:R Visual Overlay */}
          <PositionOverlay
            chart={chartInstanceRef.current}
            visible={!!direction}
            direction={direction}
            entryPrice={entryPrice}
            stopLossPrice={stopLoss}
            takeProfitPrice={takeProfit}
            entryIndex={scenario.contextBars.length - 1}
          />

          {/* Inflection Point Marker & Blind Badge */}
          <div className="absolute top-3 left-16 z-20 flex items-center gap-2 bg-[#1e222d]/90 backdrop-blur border border-[#2a2e39] px-3 py-1.5 rounded-lg shadow-lg">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-gray-200">
                Decision Point (Inflection Zone)
              </span>
              <span className="text-[10px] text-gray-400">
                Future is hidden • Formulate your edge & R:R
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Trader Decision & Execution Cockpit */}
      <footer className="h-20 bg-[#1e222d] border-t border-[#2a2e39] px-6 flex items-center justify-between z-30">
        {/* Left: Direction Decision Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSetDirection('LONG')}
            disabled={isRevealed || isPlaying}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 ${
              direction === 'LONG'
                ? 'bg-emerald-500 text-black ring-2 ring-emerald-300'
                : 'bg-[#131722] text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            LONG POSITION
          </button>

          <button
            onClick={() => handleSetDirection('SHORT')}
            disabled={isRevealed || isPlaying}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 ${
              direction === 'SHORT'
                ? 'bg-rose-500 text-white ring-2 ring-rose-300'
                : 'bg-[#131722] text-rose-400 border border-rose-500/40 hover:bg-rose-500/10'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            SHORT POSITION
          </button>

          <button
            onClick={handleSkip}
            disabled={isRevealed || isPlaying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-gray-300 text-xs font-semibold transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            SKIP (No Setup)
          </button>
        </div>

        {/* Center: Leverage & Risk Management Calculator */}
        <div className="flex items-center gap-6 bg-[#131722] px-4 py-2 rounded-lg border border-[#2a2e39]">
          {/* Leverage Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Leverage
            </span>
            <div className="flex gap-1">
              {[1, 5, 10, 20, 50].map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                    leverage === lev
                      ? 'bg-cyan-500 text-black'
                      : 'bg-[#2a2e39] text-gray-300 hover:text-white'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-[1px] bg-[#2a2e39]" />

          {/* Stop Loss & Invalidation */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1">
              Stop Loss <span className="text-gray-500">(-{riskPercent}%)</span>
            </span>
            <input
              type="number"
              step="any"
              value={stopLoss}
              onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
              disabled={isRevealed || isPlaying}
              className="w-24 bg-[#1e222d] border border-[#2a2e39] text-white px-2 py-1 rounded text-xs font-mono font-bold focus:border-rose-400 outline-none"
            />
          </div>

          {/* Take Profit Target */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
              Take Profit <span className="text-gray-500">(+{rewardPercent}%)</span>
            </span>
            <input
              type="number"
              step="any"
              value={takeProfit}
              onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
              disabled={isRevealed || isPlaying}
              className="w-24 bg-[#1e222d] border border-[#2a2e39] text-white px-2 py-1 rounded text-xs font-mono font-bold focus:border-emerald-400 outline-none"
            />
          </div>

          <div className="h-8 w-[1px] bg-[#2a2e39]" />

          {/* Risk to Reward Ratio & ROE */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              R:R Ratio
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono text-sm font-black ${
                  parseFloat(currentRR) >= 2.0
                    ? 'text-emerald-400'
                    : parseFloat(currentRR) >= 1.5
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                1 : {currentRR}
              </span>
              <span className="text-[11px] font-mono text-cyan-300">
                (ROE +{projectedRoe}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Simulation & Playback Engine Controls */}
        <div className="flex items-center gap-3">
          {/* Step 1 Candle */}
          <button
            onClick={handleStepForward}
            disabled={!direction || isRevealed}
            className="p-2.5 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-white transition-colors disabled:opacity-40"
            title="Step 1 Candle Forward"
          >
            <FastForward className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Play / Simulate Button */}
          <button
            onClick={handleTogglePlay}
            disabled={!direction || isRevealed}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-40 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                PAUSE
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                SIMULATE TRADE
              </>
            )}
          </button>

          {/* Speed Toggle */}
          <div className="flex bg-[#131722] rounded p-0.5 border border-[#2a2e39]">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSimSpeed(s)}
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded ${
                  simSpeed === s
                    ? 'bg-[#363c4e] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* 4. Debrief & Outcome Reveal Modal */}
      {isRevealed && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Outcome Header Banner */}
            <div className="flex items-center justify-between border-b border-[#2a2e39] pb-4">
              <div className="flex items-center gap-3">
                {tradeOutcome === 'WIN' ? (
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                ) : tradeOutcome === 'LOSS' ? (
                  <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl">
                    <XCircle className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="p-3 bg-gray-500/20 text-gray-400 rounded-xl">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-black text-white">
                    {tradeOutcome === 'WIN'
                      ? 'TARGET HIT • WIN!'
                      : tradeOutcome === 'LOSS'
                      ? 'STOPPED OUT • LOSS'
                      : 'SCENARIO SKIPPED'}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {tradeOutcome === 'WIN'
                      ? `Execution successful. Realized ROE on ${leverage}x leverage: +${finalReturnROE.toFixed(1)}%`
                      : tradeOutcome === 'LOSS'
                      ? `Invalidation triggered. Loss strictly capped to 1.0R (${finalReturnROE.toFixed(1)}% ROE)`
                      : 'No position taken. Preserving capital is part of mathematical edge.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Revealed Reality */}
            <div className="bg-[#131722] p-3.5 rounded-lg border border-[#2a2e39] flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">
                  Underlying Asset
                </span>
                <span className="text-sm font-bold text-white">
                  {scenario.realSymbol} ({scenario.timeframe})
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">
                  Historical Timestamp
                </span>
                <span className="text-xs font-mono text-cyan-300">
                  {scenario.realDate}
                </span>
              </div>
            </div>

            {/* Technical Analysis Debrief */}
            <div className="flex flex-col gap-2 bg-[#131722] p-4 rounded-lg border border-[#2a2e39] text-xs">
              <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Structural Breakdown
              </span>
              <p className="text-gray-300 leading-relaxed font-medium">
                {scenario.debrief.outcomeExplanation}
              </p>
              <div className="mt-2 pt-2 border-t border-[#2a2e39]">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Core Lesson:
                </span>
                <p className="text-cyan-300 italic">{scenario.debrief.lessonLearned}</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsRevealed(false)}
                className="px-4 py-2 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-gray-300 transition-colors"
              >
                Review Chart
              </button>
              <button
                onClick={() => handleLoadNewScenario()}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Next Scenario ➡️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Indicators Modal */}
      <IndicatorsModal
        isOpen={indicatorsModalOpen}
        onClose={() => setIndicatorsModalOpen(false)}
        activeIndicators={activeIndicators}
        onAddIndicator={(name) => {
          if (!activeIndicators.includes(name)) {
            setActiveIndicators([...activeIndicators, name]);
          }
        }}
        onRemoveIndicator={(name) => {
          setActiveIndicators(activeIndicators.filter((i) => i !== name));
        }}
      />
    </div>
  );
};
