import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  init,
  dispose,
  Chart as KLineChartInstance,
  Period,
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
  SkipBack,
  RotateCcw,
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
  Zap,
  Info,
  ChevronRight,
  X,
  Volume2,
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
  const [isLoadingReal, setIsLoadingReal] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [tradeOutcome, setTradeOutcome] = useState<'WIN' | 'LOSS' | 'SKIPPED' | null>(null);
  const [finalReturnROE, setFinalReturnROE] = useState<number>(0);
  const [isDebriefDrawerOpen, setIsDebriefDrawerOpen] = useState<boolean>(false);

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
  const [entryTimestamp, setEntryTimestamp] = useState<number | undefined>(undefined);
  const [floatingROE, setFloatingROE] = useState<number | null>(null);

  // Simulation State Machine (Ref-backed for 60 FPS zero-lag closures)
  const [simIndex, setSimIndex] = useState<number>(0);
  const simIndexRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(2); // candles per second
  const simSpeedRef = useRef<number>(2);
  simSpeedRef.current = simSpeed;
  const simTimerRef = useRef<any>(null);

  // Session Statistics
  const [stats, setStats] = useState<SessionStats>({
    trades: 0,
    wins: 0,
    losses: 0,
    skips: 0,
    totalR: 0,
  });

  // Chart Container & References
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<KLineChartInstance | null>(null);
  const visibleBarsRef = useRef<KLineBar[]>([]);
  const liveUpdateCallbackRef = useRef<((bar: KLineBar) => void) | null>(null);

  // Sound effects with WebAudio API
  const playSound = useCallback((type: 'win' | 'loss') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); // E4
        osc.frequency.setValueAtTime(261.63, audioCtx.currentTime + 0.15); // C4
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      }
    } catch (e) {}
  }, []);

  const mapIntervalToPeriod = (intv: string): Period => {
    if (intv.endsWith('s')) return { type: 'second', span: parseInt(intv) || 1 };
    if (intv.endsWith('m')) return { type: 'minute', span: parseInt(intv) || 1 };
    if (intv.endsWith('h')) return { type: 'hour', span: parseInt(intv) || 1 };
    if (intv.endsWith('d') || intv.endsWith('D')) return { type: 'day', span: 1 };
    if (intv.endsWith('w') || intv.endsWith('W')) return { type: 'week', span: 1 };
    return { type: 'minute', span: 15 };
  };

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

  // 1. Initialize Chart instance on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    visibleBarsRef.current = [...scenario.contextBars];
    simIndexRef.current = 0;

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

      chart.setSymbol({
        ticker: isRevealed ? scenario.realSymbol : 'CONFIDENTIAL',
        pricePrecision: 2,
        volumePrecision: 2,
      });
      chart.setPeriod(mapIntervalToPeriod(scenario.timeframe));
      chart.resetData();
      recalculateOverlays(visibleBarsRef.current);
      try {
        chart.scrollToRealTime();
      } catch (e) {}
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

  // Sync indicators whenever activeIndicators changes
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

  // Load a brand new scenario
  const applyNewScenario = (newScen: ScenarioInfo) => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);

    simIndexRef.current = 0;
    setSimIndex(0);
    setIsRevealed(false);
    setTradeOutcome(null);
    setFloatingROE(null);
    setFinalReturnROE(0);
    setIsDebriefDrawerOpen(false);

    setScenario(newScen);
    setDirection(null);
    setEntryPrice(newScen.entryPrice);
    setStopLoss(newScen.suggestedStopLoss);
    setTakeProfit(newScen.suggestedTakeProfit);
    setEntryTimestamp(undefined);

    visibleBarsRef.current = [...newScen.contextBars];

    const chart = chartInstanceRef.current;
    if (chart) {
      chart.setSymbol({
        ticker: 'CONFIDENTIAL',
        pricePrecision: 2,
        volumePrecision: 2,
      });
      chart.setPeriod(mapIntervalToPeriod(newScen.timeframe));
      chart.resetData();
      recalculateOverlays(visibleBarsRef.current);
      try {
        chart.scrollToRealTime();
      } catch (e) {}
    }
  };

  const handleLoadNewScenario = (targetCategory?: 'scalp' | 'daytrade' | 'swing') => {
    const cat = targetCategory || (categoryFilter === 'all' ? undefined : categoryFilter);
    const newScen = ScenarioService.getRandomScenario(cat);
    applyNewScenario(newScen);
  };

  // Fetch real historical segment directly from Binance
  const handleLoadRealBinance = async () => {
    setIsLoadingReal(true);
    const cat = categoryFilter === 'all' ? undefined : categoryFilter;
    const realScen = await ScenarioService.fetchRandomBinanceScenario(cat);
    setIsLoadingReal(false);

    if (realScen) {
      applyNewScenario(realScen);
    } else {
      // Fallback to offline curated scenario
      handleLoadNewScenario();
    }
  };

  // Reset current scenario back to start
  const handleResetScenario = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);

    simIndexRef.current = 0;
    setSimIndex(0);
    setTradeOutcome(null);
    setFloatingROE(null);
    setIsRevealed(false);
    setIsDebriefDrawerOpen(false);

    visibleBarsRef.current = [...scenario.contextBars];
    const chart = chartInstanceRef.current;
    if (chart) {
      chart.resetData();
      recalculateOverlays(visibleBarsRef.current);
      try {
        chart.scrollToRealTime();
      } catch (e) {}
    }
  };

  // Category filter selection
  const handleSelectCategory = (cat: 'all' | 'scalp' | 'daytrade' | 'swing') => {
    setCategoryFilter(cat);
    handleLoadNewScenario(cat === 'all' ? undefined : cat);
  };

  // Switch Direction (LONG or SHORT)
  const handleSetDirection = (newDir: 'LONG' | 'SHORT') => {
    setDirection(newDir);
    setTradeOutcome(null);
    setIsRevealed(false);

    // Entry price defaults to the current visible candle's close
    const lastBar = visibleBarsRef.current[visibleBarsRef.current.length - 1];
    const currentPrice = lastBar ? lastBar.close : scenario.entryPrice;
    setEntryPrice(currentPrice);
    setEntryTimestamp(lastBar ? lastBar.timestamp : undefined);

    const atr = scenario.atr > 0 ? scenario.atr : currentPrice * 0.005;
    const slDist = Math.max(currentPrice * 0.002, atr * 1.2);

    if (newDir === 'LONG') {
      setStopLoss(parseFloat((currentPrice - slDist).toFixed(2)));
      setTakeProfit(parseFloat((currentPrice + slDist * 3.0).toFixed(2)));
    } else {
      setStopLoss(parseFloat((currentPrice + slDist).toFixed(2)));
      setTakeProfit(parseFloat((currentPrice - slDist * 3.0).toFixed(2)));
    }
  };

  // Adjust R:R Ratio dynamically (e.g. 1:1.5, 1:2, 1:3, 1:5)
  const handleSetRRMultiplier = (rrMult: number) => {
    if (!direction) return;
    const slDist = Math.abs(entryPrice - stopLoss);
    if (slDist <= 0) return;

    if (direction === 'LONG') {
      setTakeProfit(parseFloat((entryPrice + slDist * rrMult).toFixed(2)));
    } else {
      setTakeProfit(parseFloat((entryPrice - slDist * rrMult).toFixed(2)));
    }
  };

  // Adjust Stop Loss distance presets
  const handleSetSLPercent = (percent: number) => {
    if (!direction) return;
    const slDist = entryPrice * (percent / 100);
    const rewardDist = Math.abs(takeProfit - entryPrice);
    const currentRR = slDist > 0 ? rewardDist / slDist : 3.0;

    if (direction === 'LONG') {
      const newSl = parseFloat((entryPrice - slDist).toFixed(2));
      setStopLoss(newSl);
      setTakeProfit(parseFloat((entryPrice + slDist * currentRR).toFixed(2)));
    } else {
      const newSl = parseFloat((entryPrice + slDist).toFixed(2));
      setStopLoss(newSl);
      setTakeProfit(parseFloat((entryPrice - slDist * currentRR).toFixed(2)));
    }
  };

  // Fine-tune nudge SL or TP
  const handleNudge = (target: 'SL' | 'TP', deltaPercent: number) => {
    const delta = entryPrice * (deltaPercent / 100);
    if (target === 'SL') {
      setStopLoss((prev) => parseFloat((prev + delta).toFixed(2)));
    } else {
      setTakeProfit((prev) => parseFloat((prev + delta).toFixed(2)));
    }
  };

  // Skip scenario
  const handleSkip = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setTradeOutcome('SKIPPED');
    setIsRevealed(true);
    setIsDebriefDrawerOpen(true);
    setStats((prev) => ({
      ...prev,
      trades: prev.trades + 1,
      skips: prev.skips + 1,
    }));
  };

  // Evaluate trade conditions on single bar
  const evaluateTradeOnBar = useCallback(
    (bar: KLineBar, currentStep: number): boolean => {
      if (!direction) return false;

      const slDist = Math.abs(entryPrice - stopLoss);
      const tpDist = Math.abs(takeProfit - entryPrice);
      const rrRatio = slDist > 0 ? parseFloat((tpDist / slDist).toFixed(2)) : 3.0;

      // Calculate live floating ROE
      const pnlPct =
        direction === 'LONG'
          ? ((bar.close - entryPrice) / entryPrice) * 100
          : ((entryPrice - bar.close) / entryPrice) * 100;
      const curRoe = pnlPct * leverage;
      setFloatingROE(curRoe);

      if (direction === 'LONG') {
        // Hit Stop Loss?
        if (bar.low <= stopLoss) {
          const roe = -((slDist / entryPrice) * 100 * leverage);
          setFinalReturnROE(roe);
          setTradeOutcome('LOSS');
          setIsRevealed(true);
          playSound('loss');
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            losses: prev.losses + 1,
            totalR: parseFloat((prev.totalR - 1.0).toFixed(2)),
          }));
          return true;
        }

        // Hit Take Profit?
        if (bar.high >= takeProfit) {
          const roe = (tpDist / entryPrice) * 100 * leverage;
          setFinalReturnROE(roe);
          setTradeOutcome('WIN');
          setIsRevealed(true);
          playSound('win');
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            wins: prev.wins + 1,
            totalR: parseFloat((prev.totalR + rrRatio).toFixed(2)),
          }));
          return true;
        }
      } else {
        // SHORT
        // Hit Stop Loss?
        if (bar.high >= stopLoss) {
          const roe = -((slDist / entryPrice) * 100 * leverage);
          setFinalReturnROE(roe);
          setTradeOutcome('LOSS');
          setIsRevealed(true);
          playSound('loss');
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            losses: prev.losses + 1,
            totalR: parseFloat((prev.totalR - 1.0).toFixed(2)),
          }));
          return true;
        }

        // Hit Take Profit?
        if (bar.low <= takeProfit) {
          const roe = (tpDist / entryPrice) * 100 * leverage;
          setFinalReturnROE(roe);
          setTradeOutcome('WIN');
          setIsRevealed(true);
          playSound('win');
          setStats((prev) => ({
            ...prev,
            trades: prev.trades + 1,
            wins: prev.wins + 1,
            totalR: parseFloat((prev.totalR + rrRatio).toFixed(2)),
          }));
          return true;
        }
      }

      // Reached the end of future bars without hitting either
      if (currentStep >= scenario.futureBars.length) {
        const isWin = pnlPct > 0;
        setFinalReturnROE(curRoe);
        setTradeOutcome(isWin ? 'WIN' : 'LOSS');
        setIsRevealed(true);
        if (isWin) playSound('win'); else playSound('loss');
        const earnedR = slDist > 0 ? parseFloat((Math.abs(bar.close - entryPrice) / slDist).toFixed(2)) : 1;
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
    [direction, entryPrice, stopLoss, takeProfit, leverage, scenario.futureBars.length, playSound]
  );

  // Core 1 Candle Forward Step (Ref-based, zero-stale closure)
  const stepForwardCore = useCallback((): boolean => {
    const totalFuture = scenario.futureBars.length;
    if (simIndexRef.current >= totalFuture) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
      return false;
    }

    const nextBar = scenario.futureBars[simIndexRef.current];
    simIndexRef.current += 1;
    const currentSim = simIndexRef.current;
    setSimIndex(currentSim);

    // 1. Append candle to visible list
    visibleBarsRef.current.push(nextBar);

    // 2. Direct push to KlineCharts (60 FPS smooth rendering)
    if (liveUpdateCallbackRef.current) {
      liveUpdateCallbackRef.current(nextBar);
    } else {
      chartInstanceRef.current?.resetData();
    }

    // 3. Recalculate indicators
    recalculateOverlays(visibleBarsRef.current);

    // 4. Trade evaluation
    if (direction && tradeOutcome === null) {
      const ended = evaluateTradeOnBar(nextBar, currentSim);
      if (ended) {
        if (simTimerRef.current) {
          clearInterval(simTimerRef.current);
          simTimerRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
        return false;
      }
    }

    return true;
  }, [scenario.futureBars, direction, tradeOutcome, recalculateOverlays, evaluateTradeOnBar]);

  // Step 1 Candle Backward
  const stepBackwardCore = useCallback(() => {
    if (simIndexRef.current <= 0) return;
    simIndexRef.current -= 1;
    const currentSim = simIndexRef.current;
    setSimIndex(currentSim);

    visibleBarsRef.current = [
      ...scenario.contextBars,
      ...scenario.futureBars.slice(0, currentSim),
    ];

    chartInstanceRef.current?.resetData();
    recalculateOverlays(visibleBarsRef.current);
  }, [scenario.contextBars, scenario.futureBars, recalculateOverlays]);

  // Play / Pause Simulation Toggle
  const handleTogglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      // If at end, rewind to start
      if (simIndexRef.current >= scenario.futureBars.length) {
        simIndexRef.current = 0;
        setSimIndex(0);
        visibleBarsRef.current = [...scenario.contextBars];
        chartInstanceRef.current?.resetData();
        setTradeOutcome(null);
      }

      isPlayingRef.current = true;
      setIsPlaying(true);

      const intervalMs = Math.max(50, Math.floor(1000 / simSpeedRef.current));
      simTimerRef.current = setInterval(() => {
        stepForwardCore();
      }, intervalMs);
    }
  }, [scenario.contextBars, scenario.futureBars.length, stepForwardCore]);

  // Change simulation speed and update running timer
  const handleSetSpeed = (newSpeed: number) => {
    setSimSpeed(newSpeed);
    simSpeedRef.current = newSpeed;
    if (isPlayingRef.current) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      const intervalMs = Math.max(50, Math.floor(1000 / newSpeed));
      simTimerRef.current = setInterval(() => {
        stepForwardCore();
      }, intervalMs);
    }
  };

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Keyboard Shortcuts in Arena: Space = play/pause, Right = step forward, Left = step back, R = reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForwardCore();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepBackwardCore();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetScenario();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleLoadNewScenario();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleSetDirection('LONG');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSetDirection('SHORT');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, stepForwardCore, stepBackwardCore]);

  // Compute live R:R and distance percentages
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
          {/* Real Binance Cut Loader */}
          <button
            onClick={handleLoadRealBinance}
            disabled={isLoadingReal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-amber-300 border border-amber-500/30 transition-all hover:border-amber-400 disabled:opacity-50"
            title="Load random real historical price action directly from Binance"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${isLoadingReal ? 'animate-spin' : ''}`} />
            {isLoadingReal ? 'Loading Real Market...' : '⚡ Real Binance Cut'}
          </button>

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
          <div className="flex items-center gap-2 bg-[#131722] border border-[#2a2e39] px-2.5 py-1 rounded text-xs font-mono">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-gray-400 font-sans">P&L:</span>
            <span
              className={`font-bold ${
                stats.totalR >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {stats.totalR >= 0 ? `+${stats.totalR}R` : `${stats.totalR}R`}
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400 font-sans">WR:</span>
            <span className="font-semibold text-white">
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
            entryTimestamp={entryTimestamp}
          />

          {/* Decision Point Marker & Progress Pill */}
          <div className="absolute top-3 left-16 z-20 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1e222d]/90 backdrop-blur border border-[#2a2e39] px-3 py-1.5 rounded-lg shadow-lg">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-gray-200">
                  Inflection Zone
                </span>
                <span className="text-[10px] text-gray-400">
                  Step or simulate forward • Edge vs Risk
                </span>
              </div>
            </div>

            {/* Simulation Progress Pill */}
            <div className="flex items-center gap-1.5 bg-[#1e222d]/90 backdrop-blur border border-[#2a2e39] px-2.5 py-1.5 rounded-lg text-xs font-mono">
              <span className="text-gray-400">Bar:</span>
              <span className="font-bold text-cyan-300">
                {simIndex} / {scenario.futureBars.length}
              </span>
            </div>

            {/* Live Floating PnL Pill (when position is active) */}
            {direction && tradeOutcome === null && floatingROE !== null && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur text-xs font-mono font-bold shadow-lg animate-in fade-in duration-150 ${
                  floatingROE >= 0
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full animate-ping ${
                    floatingROE >= 0 ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span>
                  Floating:{' '}
                  {floatingROE >= 0
                    ? `+${floatingROE.toFixed(1)}%`
                    : `${floatingROE.toFixed(1)}%`}
                </span>
              </div>
            )}
          </div>

          {/* Non-intrusive Outcome HUD (Floating Card when Trade Resolves) */}
          {tradeOutcome && (
            <div className="absolute top-3 right-4 z-30 max-w-md bg-[#1e222d]/95 backdrop-blur-md border border-[#363c4e] rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2.5">
                <div className="flex items-center gap-2.5">
                  {tradeOutcome === 'WIN' ? (
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : tradeOutcome === 'LOSS' ? (
                    <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                      <XCircle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-gray-500/20 text-gray-400 rounded-lg">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <span className="font-black text-sm text-white block">
                      {tradeOutcome === 'WIN'
                        ? 'TARGET HIT • WIN!'
                        : tradeOutcome === 'LOSS'
                        ? 'STOPPED OUT • LOSS'
                        : 'SETUP SKIPPED'}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-gray-300">
                      {tradeOutcome === 'WIN'
                        ? `Realized: +${finalReturnROE.toFixed(1)}% ROE on ${leverage}x`
                        : tradeOutcome === 'LOSS'
                        ? `Capped: ${finalReturnROE.toFixed(1)}% ROE (-1.0R)`
                        : 'No trade executed'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsDebriefDrawerOpen(!isDebriefDrawerOpen)}
                    className="p-1.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-gray-300 hover:text-white transition-colors"
                    title="Toggle structural debrief"
                  >
                    <Info className="w-4 h-4 text-cyan-400" />
                  </button>
                  <button
                    onClick={() => setTradeOutcome(null)}
                    className="p-1.5 rounded hover:bg-[#363c4e] text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collapsible Debrief Details */}
              {isDebriefDrawerOpen && (
                <div className="flex flex-col gap-2 bg-[#131722] p-3 rounded border border-[#2a2e39] text-xs">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold font-mono">
                    <span>{scenario.realSymbol}</span>
                    <span>{scenario.realDate}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed text-[11px]">
                    {scenario.debrief.outcomeExplanation}
                  </p>
                  <div className="pt-1.5 border-t border-[#2a2e39] text-[11px] text-cyan-300 italic">
                    💡 {scenario.debrief.lessonLearned}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={handleResetScenario}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-gray-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  onClick={() => handleLoadNewScenario()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-md"
                >
                  Next Scenario
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Trader Decision & Execution Cockpit */}
      <footer className="h-24 bg-[#1e222d] border-t border-[#2a2e39] px-6 flex items-center justify-between z-30">
        {/* Left: Direction Decision Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleSetDirection('LONG')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 ${
              direction === 'LONG'
                ? 'bg-emerald-500 text-black ring-2 ring-emerald-300'
                : 'bg-[#131722] text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            LONG
          </button>

          <button
            onClick={() => handleSetDirection('SHORT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md active:scale-95 ${
              direction === 'SHORT'
                ? 'bg-rose-500 text-white ring-2 ring-rose-300'
                : 'bg-[#131722] text-rose-400 border border-rose-500/40 hover:bg-rose-500/10'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            SHORT
          </button>

          {direction && (
            <button
              onClick={() => {
                setDirection(null);
                setTradeOutcome(null);
                setFloatingROE(null);
              }}
              className="px-2.5 py-2 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-gray-400 hover:text-white text-xs font-medium"
              title="Cancel / Close active setup"
            >
              Cancel Setup
            </button>
          )}

          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-gray-300 text-xs font-medium transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>

        {/* Center: Leverage, Stop Loss, Take Profit & R:R Calculator */}
        <div className="flex items-center gap-5 bg-[#131722] px-4 py-2 rounded-lg border border-[#2a2e39]">
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
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-rose-400 tracking-wider">
              <span>Stop Loss</span>
              <span className="text-gray-400 font-mono">(-{riskPercent}%)</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-24 bg-[#1e222d] border border-[#2a2e39] text-white px-2 py-1 rounded text-xs font-mono font-bold focus:border-rose-400 outline-none"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleNudge('SL', 0.1)}
                  className="w-4 h-3 bg-[#2a2e39] hover:bg-[#363c4e] text-white text-[9px] flex items-center justify-center rounded"
                >
                  +
                </button>
                <button
                  onClick={() => handleNudge('SL', -0.1)}
                  className="w-4 h-3 bg-[#2a2e39] hover:bg-[#363c4e] text-white text-[9px] flex items-center justify-center rounded"
                >
                  -
                </button>
              </div>
            </div>
            {/* Quick SL Presets */}
            <div className="flex gap-1 mt-1">
              {[0.3, 0.8, 1.5].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleSetSLPercent(pct)}
                  className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#2a2e39] text-gray-400 hover:text-white"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Take Profit Target */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
              <span>Take Profit</span>
              <span className="text-gray-400 font-mono">(+{rewardPercent}%)</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                className="w-24 bg-[#1e222d] border border-[#2a2e39] text-white px-2 py-1 rounded text-xs font-mono font-bold focus:border-emerald-400 outline-none"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleNudge('TP', 0.1)}
                  className="w-4 h-3 bg-[#2a2e39] hover:bg-[#363c4e] text-white text-[9px] flex items-center justify-center rounded"
                >
                  +
                </button>
                <button
                  onClick={() => handleNudge('TP', -0.1)}
                  className="w-4 h-3 bg-[#2a2e39] hover:bg-[#363c4e] text-white text-[9px] flex items-center justify-center rounded"
                >
                  -
                </button>
              </div>
            </div>
            {/* Quick R:R Presets */}
            <div className="flex gap-1 mt-1">
              {[1.5, 2, 3, 5].map((rr) => (
                <button
                  key={rr}
                  onClick={() => handleSetRRMultiplier(rr)}
                  className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#2a2e39] text-gray-400 hover:text-white"
                >
                  1:{rr}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-[1px] bg-[#2a2e39]" />

          {/* Risk to Reward Ratio & ROE Display */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              R:R Ratio
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
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
          {/* Step Backward 1 Candle */}
          <button
            onClick={stepBackwardCore}
            disabled={simIndex === 0}
            className="p-2.5 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-white transition-colors disabled:opacity-40"
            title="Step 1 Candle Backward (Left Arrow)"
          >
            <SkipBack className="w-4 h-4 text-gray-300" />
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs shadow-lg transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black'
            }`}
            title="Toggle Playback (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                PAUSE
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                {direction ? 'SIMULATE TRADE' : 'PLAY CANDLES'}
              </>
            )}
          </button>

          {/* Step Forward 1 Candle */}
          <button
            onClick={stepForwardCore}
            disabled={simIndex >= scenario.futureBars.length}
            className="p-2.5 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-white transition-colors disabled:opacity-40"
            title="Step 1 Candle Forward (Right Arrow)"
          >
            <FastForward className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Speed Toggle */}
          <div className="flex bg-[#131722] rounded p-0.5 border border-[#2a2e39]">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => handleSetSpeed(s)}
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

          {/* Reset Scenario Button */}
          <button
            onClick={handleResetScenario}
            className="p-2.5 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-gray-300 hover:text-white transition-colors"
            title="Reset scenario to beginning (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* 4. Indicators Modal */}
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
