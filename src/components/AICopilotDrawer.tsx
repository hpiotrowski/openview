import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  ShieldAlert,
  Settings,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  Volume2,
  RefreshCw,
  ExternalLink,
  Target,
  Zap,
  Activity,
} from 'lucide-react';
import {
  aiTraderService,
  TradingPlan,
  JevDecision,
  MarketSnapshot,
  OPENCODE_BRAIN_PRESETS,
  OPENCODE_JEV_PRESETS,
  OPENROUTER_BRAIN_PRESETS,
  OPENROUTER_JEV_PRESETS,
  detectProvider,
  AIProvider,
} from '../services/aiTrader';
import { StorageService } from '../services/storage';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeChartId: string;
  currentSymbol: string;
  currentInterval: string;
  currentPrice: number;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeChartId,
  currentSymbol,
  currentInterval,
  currentPrice,
}) => {
  const [activeTab, setActiveTab] = useState<'brain' | 'sentinel' | 'settings'>('brain');

  // Settings State
  const [apiKey, setApiKey] = useState(() => StorageService.getOpenRouterKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const activeProvider = detectProvider(apiKey);
  const brainPresets = activeProvider === 'opencode' ? OPENCODE_BRAIN_PRESETS : OPENROUTER_BRAIN_PRESETS;
  const jevPresets = activeProvider === 'opencode' ? OPENCODE_JEV_PRESETS : OPENROUTER_JEV_PRESETS;

  const [brainModel, setBrainModel] = useState(() => {
    const saved = StorageService.getBrainModel();
    const presets = detectProvider(StorageService.getOpenRouterKey()) === 'opencode'
      ? OPENCODE_BRAIN_PRESETS
      : OPENROUTER_BRAIN_PRESETS;
    return presets.some((p) => p.id === saved) || saved === 'custom' ? saved : presets[0].id;
  });
  const [customBrainModel, setCustomBrainModel] = useState('');

  const [jevModel, setJevModel] = useState(() => {
    const saved = StorageService.getJevModel();
    const presets = detectProvider(StorageService.getOpenRouterKey()) === 'opencode'
      ? OPENCODE_JEV_PRESETS
      : OPENROUTER_JEV_PRESETS;
    return presets.some((p) => p.id === saved) || saved === 'custom' ? saved : presets[0].id;
  });
  const [customJevModel, setCustomJevModel] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; provider?: AIProvider } | null>(null);

  const handleApiKeyChange = (val: string) => {
    const cleaned = aiTraderService.cleanApiKey(val);
    const newProv = detectProvider(cleaned);
    setApiKey(cleaned);
    StorageService.setOpenRouterKey(cleaned);
    setTestResult(null);

    const targetBrainPresets = newProv === 'opencode' ? OPENCODE_BRAIN_PRESETS : OPENROUTER_BRAIN_PRESETS;
    const targetJevPresets = newProv === 'opencode' ? OPENCODE_JEV_PRESETS : OPENROUTER_JEV_PRESETS;

    if (!targetBrainPresets.some((p) => p.id === brainModel) && brainModel !== 'custom') {
      const defBrain = targetBrainPresets[0].id;
      setBrainModel(defBrain);
      StorageService.setBrainModel(defBrain);
    }
    if (!targetJevPresets.some((p) => p.id === jevModel) && jevModel !== 'custom') {
      const defJev = targetJevPresets[0].id;
      setJevModel(defJev);
      StorageService.setJevModel(defJev);
    }
  };

  const handleTestKey = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await aiTraderService.testApiKey(apiKey);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, message: `Błąd: ${e.message}`, provider: activeProvider });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Brain State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [activePlan, setActivePlan] = useState<TradingPlan | null>(() => {
    const plans = StorageService.getSavedPlans();
    return plans.length > 0 ? plans[0] : null;
  });
  const [capturedSnapshot, setCapturedSnapshot] = useState<MarketSnapshot | null>(null);
  const [snapshotViewTab, setSnapshotViewTab] = useState<'exec' | 'htf'>('exec');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState(false);
  const [autoFrameToast, setAutoFrameToast] = useState(false);

  // Sentinel State
  const [sentinelEnabled, setSentinelEnabled] = useState(() => StorageService.getAutoSentinel());
  const [isSentinelScanning, setIsSentinelScanning] = useState(false);
  const [lastDecision, setLastDecision] = useState<JevDecision | null>(null);
  const [sentinelLogs, setSentinelLogs] = useState<JevDecision[]>(() => aiTraderService.getSentinelLogs());
  const [scanCountdown, setScanCountdown] = useState<number>(60);
  const sentinelTimerRef = useRef<any>(null);

  // Save settings when changed
  const handleSaveSettings = () => {
    const finalBrain = brainModel === 'custom' && customBrainModel ? customBrainModel : brainModel;
    const finalJev = jevModel === 'custom' && customJevModel ? customJevModel : jevModel;

    StorageService.setOpenRouterKey(apiKey);
    StorageService.setBrainModel(finalBrain);
    StorageService.setJevModel(finalJev);
    setErrorMsg(null);
    setActiveTab('brain');
  };

  // Run Brain Setup Generation
  const handleGeneratePlan = async () => {
    if (!apiKey.trim()) {
      setActiveTab('settings');
      setErrorMsg('Wprowadź swój klucz OpenRouter API Key, aby rozpocząć.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisStep('1. Pobieranie danych & renderowanie 15m i 4h w tle...');

    try {
      const snapshot = await aiTraderService.gatherMarketSnapshot(activeChartId, true);
      if (!snapshot) {
        throw new Error('Nie udało się pobrać danych z aktywnego wykresu.');
      }
      setCapturedSnapshot(snapshot);

      setAnalysisStep('2. Analiza Top-Down (4h Makro, 15m, CVD, nPOC, HTF & Cipher B)...');
      const effectiveBrainModel =
        brainModel === 'custom' && customBrainModel ? customBrainModel : brainModel;

      const plan = await aiTraderService.generateStrategyPlan({
        apiKey,
        model: effectiveBrainModel,
        snapshot,
      });

      setActivePlan(plan);
      // Persist plan in storage
      const existing = StorageService.getSavedPlans();
      StorageService.setSavedPlans([plan, ...existing.slice(0, 9)]);
    } catch (err: any) {
      console.error('Brain analysis error:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas analizy rynku.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Apply setup directly to chart
  const handleApplyToChart = () => {
    if (!activePlan) return;
    const ok = aiTraderService.applyPlanToChart(activePlan, activeChartId);
    if (ok) {
      setAppliedToast(true);
      setTimeout(() => setAppliedToast(false), 2500);
      setActivePlan({ ...activePlan, appliedToChart: true });
    } else {
      setErrorMsg('Nie można nanieść setupu (brak aktywnego wykresu lub setup jest NEUTRAL).');
    }
  };

  // Sentinel manual scan
  const handleSentinelScan = async () => {
    if (!activePlan) return;
    if (!apiKey.trim()) {
      setErrorMsg('Wprowadź klucz OpenRouter API Key w ustawieniach.');
      return;
    }

    setIsSentinelScanning(true);
    try {
      const snapshot = await aiTraderService.gatherMarketSnapshot(activeChartId, false);
      if (!snapshot) return;

      const effectiveJevModel = jevModel === 'custom' && customJevModel ? customJevModel : jevModel;
      const decision = await aiTraderService.evaluateJevSentinel({
        apiKey,
        model: effectiveJevModel,
        plan: activePlan,
        snapshot,
      });

      setLastDecision(decision);
      aiTraderService.notifySentinel(decision);
      setSentinelLogs(aiTraderService.getSentinelLogs());
    } catch (e: any) {
      console.warn('Sentinel scan error:', e);
    } finally {
      setIsSentinelScanning(false);
      setScanCountdown(60);
    }
  };

  // Auto-Sentinel 60s Interval Loop
  useEffect(() => {
    if (!sentinelEnabled || !activePlan) {
      if (sentinelTimerRef.current) {
        clearInterval(sentinelTimerRef.current);
        sentinelTimerRef.current = null;
      }
      return;
    }

    // Run immediately on enable
    handleSentinelScan();

    const interval = setInterval(() => {
      setScanCountdown((prev) => {
        if (prev <= 1) {
          handleSentinelScan();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    sentinelTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [sentinelEnabled, activePlan, activeChartId, apiKey, jevModel]);

  // Subscribe to Sentinel logs
  useEffect(() => {
    const unsub = aiTraderService.subscribeSentinel((dec) => {
      setLastDecision(dec);
      setSentinelLogs(aiTraderService.getSentinelLogs());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  return (
    <aside className="fixed top-11 right-0 bottom-0 w-[420px] max-w-full bg-[#131722] border-l border-[#2a2e39] z-40 flex flex-col shadow-2xl text-[#d1d4dc] select-none animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="h-12 border-b border-[#2a2e39] px-4 flex items-center justify-between bg-[#1e222d]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#2962ff] to-[#7c4dff] flex items-center justify-center text-white shadow-md">
            <Brain size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">AI Copilot</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/40">
                Dual-Layer
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sentinelEnabled && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Jev 1m</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#2a2e39] bg-[#161a25] text-xs">
        <button
          onClick={() => setActiveTab('brain')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'brain'
              ? 'border-[#2962ff] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
        >
          <Sparkles size={13} className={activeTab === 'brain' ? 'text-[#2962ff]' : ''} />
          <span>Mózg Strategii</span>
        </button>
        <button
          onClick={() => setActiveTab('sentinel')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 font-medium transition-colors relative ${
            activeTab === 'sentinel'
              ? 'border-[#089981] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
        >
          <ShieldAlert size={13} className={activeTab === 'sentinel' ? 'text-[#089981]' : ''} />
          <span>Jev Strażnik</span>
          {sentinelEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#089981] absolute top-2 right-2 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-3 flex items-center justify-center border-b-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-[#7c4dff] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
          title="Ustawienia OpenRouter & Modele"
        >
          <Settings size={14} className={activeTab === 'settings' ? 'text-[#7c4dff]' : ''} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Uwaga:</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {appliedToast && (
          <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="font-medium">Setup naniesiony bezpośrednio na Twój wykres!</span>
          </div>
        )}

        {/* ----------------- TAB 1: BRAIN STRATEGIST ----------------- */}
        {activeTab === 'brain' && (
          <div className="space-y-4">
            {/* Asset Status Card */}
            <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#868993] block">Aktywny instrument</span>
                <span className="font-bold text-white text-sm">{currentSymbol}</span>
                <span className="text-xs text-[#868993] ml-1.5 font-medium">({currentInterval})</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#868993] block">Cena na żywo</span>
                <span className="font-mono font-bold text-white text-sm">
                  ${currentPrice ? currentPrice.toLocaleString() : '---'}
                </span>
              </div>
            </div>

            {/* Model Badge */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[#868993]">Model Mózgu:</span>
              <span className="font-mono text-[11px] bg-[#2a2e39] text-[#2962ff] px-2 py-0.5 rounded font-semibold border border-[#363c4e]">
                {brainModel}
              </span>
            </div>

            {/* Auto-Frame Button */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  const ok = aiTraderService.autoFrameActiveChart(activeChartId);
                  if (ok) {
                    setAutoFrameToast(true);
                    setTimeout(() => setAutoFrameToast(false), 2200);
                  }
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] hover:border-[#2962ff]/50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm"
                title="Automatycznie ustawia idealne przybliżenie (~85 świec), prawy margines i centruje na bieżącej cenie"
              >
                <Target size={14} className="text-[#2962ff]" />
                <span>🎯 Dopasuj Kadr dla AI (Auto-Zoom)</span>
              </button>

              {autoFrameToast && (
                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Kadr dopasowany (~85 świec + margines prawy)!</span>
                </div>
              )}
            </div>

            {/* Plan Generation Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={isAnalyzing}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                isAnalyzing
                  ? 'bg-[#2962ff]/50 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#2962ff] to-[#7c4dff] hover:from-[#1e53e5] hover:to-[#6d3ee8] text-white hover:shadow-[#2962ff]/20'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>{analysisStep || 'Analizowanie...'}</span>
                </>
              ) : (
                <>
                  <Brain size={16} />
                  <span>🧠 Przeanalizuj Wykres & Zaplanuj Setup</span>
                </>
              )}
            </button>

            {/* Generated Plan Result */}
            {activePlan && (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 bg-[#1a1e29] border border-[#2a2e39] rounded-xl space-y-3 shadow-md">
                  {/* Plan Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                          activePlan.direction === 'LONG'
                            ? 'bg-[#089981]/20 text-[#089981] border border-[#089981]/40'
                            : activePlan.direction === 'SHORT'
                            ? 'bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/40'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}
                      >
                        {activePlan.direction === 'LONG' ? (
                          <span className="flex items-center gap-1">
                            <ArrowUpRight size={14} /> LONG
                          </span>
                        ) : activePlan.direction === 'SHORT' ? (
                          <span className="flex items-center gap-1">
                            <ArrowDownRight size={14} /> SHORT
                          </span>
                        ) : (
                          'NEUTRAL'
                        )}
                      </span>
                      <span className="text-[11px] text-[#868993] font-medium">
                        Pewność: {activePlan.confidence}%
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#868993] uppercase block font-semibold">
                        Risk : Reward
                      </span>
                      <span className="font-mono font-bold text-xs text-[#089981]">
                        1 : {activePlan.setup.riskRewardRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h4 className="font-bold text-white text-xs mb-1">{activePlan.title}</h4>
                    <p className="text-[11px] text-[#868993] leading-relaxed">{activePlan.summary}</p>
                  </div>

                  {/* Multi-Timeframe Context Box */}
                  {activePlan.htfContext && (
                    <div className="p-2.5 rounded-lg bg-[#131722] border border-[#2a2e39] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-[#868993] font-semibold uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-[#2962ff]">
                          <Layers size={12} /> Kontekst Multi-Timeframe (MTF)
                        </span>
                        <span className="text-gray-400">Top-Down Analysis</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2 rounded bg-[#1e222d] border border-[#2a2e39]/80">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className="text-[#868993] font-sans font-semibold">
                              Makro ({activePlan.htfContext.macro.timeframe})
                            </span>
                            <span
                              className={`font-black ${
                                activePlan.htfContext.macro.trend.includes('BULLISH')
                                  ? 'text-emerald-400'
                                  : activePlan.htfContext.macro.trend.includes('BEARISH')
                                  ? 'text-rose-400'
                                  : 'text-yellow-400'
                              }`}
                            >
                              {activePlan.htfContext.macro.trend}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#868993]">
                            WT: <strong className="text-white">{activePlan.htfContext.macro.wt1}</strong> | MFI: <strong className="text-white">{activePlan.htfContext.macro.mfi}</strong>
                          </div>
                          {activePlan.htfContext.macro.poc > 0 && (
                            <div className="text-[10px] text-[#868993]">
                              POC: ${activePlan.htfContext.macro.poc.toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div className="p-2 rounded bg-[#1e222d] border border-[#2a2e39]/80">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className="text-[#868993] font-sans font-semibold">
                              Struktura ({activePlan.htfContext.structure.timeframe})
                            </span>
                            <span
                              className={`font-black ${
                                activePlan.htfContext.structure.trend.includes('BULLISH')
                                  ? 'text-emerald-400'
                                  : activePlan.htfContext.structure.trend.includes('BEARISH')
                                  ? 'text-rose-400'
                                  : 'text-yellow-400'
                              }`}
                            >
                              {activePlan.htfContext.structure.trend}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#868993]">
                            Momentum: <strong className="text-white">{activePlan.htfContext.structure.momentum}</strong>
                          </div>
                          {activePlan.htfContext.structure.poc > 0 && (
                            <div className="text-[10px] text-[#868993]">
                              POC: ${activePlan.htfContext.structure.poc.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Institutional & Order Flow Confluence Box */}
                  {capturedSnapshot &&
                    (capturedSnapshot.cvd ||
                      (capturedSnapshot.nakedPocs && capturedSnapshot.nakedPocs.length > 0) ||
                      capturedSnapshot.htfLevels ||
                      capturedSnapshot.liquidationMagnet) && (
                      <div className="p-2.5 rounded-lg bg-[#131722] border border-[#2a2e39] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-[#868993] font-semibold uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-[#00bcd4]">
                            <Activity size={12} /> Filtry Instytucjonalne (Order Flow)
                          </span>
                          <span className="text-gray-400">Smart Money</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          {capturedSnapshot.cvd && (
                            <div className="p-1.5 rounded bg-[#1e222d] border border-[#2a2e39]/80">
                              <div className="text-[#868993] font-sans text-[9px] mb-0.5">CVD Divergence</div>
                              <div
                                className={`font-bold ${
                                  capturedSnapshot.cvd.divergence === 'BULLISH'
                                    ? 'text-emerald-400'
                                    : capturedSnapshot.cvd.divergence === 'BEARISH'
                                    ? 'text-rose-400'
                                    : 'text-gray-300'
                                }`}
                              >
                                {capturedSnapshot.cvd.divergence
                                  ? `${capturedSnapshot.cvd.divergence} DIV`
                                  : 'Brak dywergencji'}
                              </div>
                            </div>
                          )}
                          {capturedSnapshot.liquidationMagnet && (
                            <div className="p-1.5 rounded bg-[#1e222d] border border-[#2a2e39]/80">
                              <div className="text-[#868993] font-sans text-[9px] mb-0.5">Magnes Likwidacji</div>
                              <div className="font-bold text-[#f7a600]">
                                ${capturedSnapshot.liquidationMagnet.price.toLocaleString()} ({capturedSnapshot.liquidationMagnet.leverage})
                              </div>
                            </div>
                          )}
                          {capturedSnapshot.nakedPocs && capturedSnapshot.nakedPocs.length > 0 && (
                            <div className="p-1.5 rounded bg-[#1e222d] border border-[#2a2e39]/80 col-span-2">
                              <div className="text-[#868993] font-sans text-[9px] mb-0.5">Naked POCs (Dziewicze Wolumeny)</div>
                              <div className="text-[#d1d4dc] truncate">
                                {capturedSnapshot.nakedPocs
                                  .map(
                                    (p) =>
                                      `$${p.price.toLocaleString()} (${
                                        p.distancePct > 0 ? '+' : ''
                                      }${p.distancePct}%)`
                                  )
                                  .join(' • ')}
                              </div>
                            </div>
                          )}
                          {capturedSnapshot.htfLevels &&
                            (capturedSnapshot.htfLevels.pdh ||
                              capturedSnapshot.htfLevels.pdl ||
                              capturedSnapshot.htfLevels.mondayHigh) && (
                              <div className="p-1.5 rounded bg-[#1e222d] border border-[#2a2e39]/80 col-span-2">
                                <div className="text-[#868993] font-sans text-[9px] mb-0.5">Poziomy Sesyjne (PDH / PDL / Mon)</div>
                                <div className="text-[#868993] flex items-center gap-2">
                                  {capturedSnapshot.htfLevels.pdh && (
                                    <span>
                                      PDH: <strong className="text-rose-400">${capturedSnapshot.htfLevels.pdh.toLocaleString()}</strong>
                                    </span>
                                  )}
                                  {capturedSnapshot.htfLevels.pdl && (
                                    <span>
                                      PDL: <strong className="text-emerald-400">${capturedSnapshot.htfLevels.pdl.toLocaleString()}</strong>
                                    </span>
                                  )}
                                  {capturedSnapshot.htfLevels.mondayHigh && (
                                    <span>
                                      MonH: <strong className="text-white">${capturedSnapshot.htfLevels.mondayHigh.toLocaleString()}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                  {/* Trade Levels Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2a2e39]/60 text-xs font-mono">
                    <div className="p-2 rounded bg-[#131722] border border-[#2a2e39]">
                      <span className="text-[10px] text-[#868993] block font-sans">ENTRY</span>
                      <span className="font-bold text-white text-[11px]">
                        ${activePlan.setup.entryPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#131722] border border-[#2a2e39]">
                      <span className="text-[10px] text-rose-400 block font-sans">STOP LOSS</span>
                      <span className="font-bold text-rose-400 text-[11px]">
                        ${activePlan.setup.stopLoss.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#131722] border border-[#2a2e39]">
                      <span className="text-[10px] text-emerald-400 block font-sans">TARGET (TP1)</span>
                      <span className="font-bold text-emerald-400 text-[11px]">
                        ${activePlan.setup.takeProfit1.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Technical Confluence Badges */}
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex items-start gap-1.5 text-[#868993]">
                      <Target size={13} className="text-[#2962ff] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#d1d4dc]">Strefa Wejścia:</strong>{' '}
                        ${activePlan.setup.entryZone[0].toLocaleString()} - $
                        {activePlan.setup.entryZone[1].toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#868993]">
                      <Zap size={13} className="text-[#f7a600] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#d1d4dc]">Cipher B Trigger:</strong>{' '}
                        {activePlan.cipherBAnalysis.expectedTrigger}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this setup */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleApplyToChart}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Target size={14} />
                      <span>🎯 Nanieś na Wykres</span>
                    </button>
                    <button
                      onClick={() => {
                        setSentinelEnabled(true);
                        StorageService.setAutoSentinel(true);
                        setActiveTab('sentinel');
                      }}
                      className="py-2 px-3 rounded-lg bg-[#1e222d] hover:bg-[#2a2e39] border border-[#363c4e] text-emerald-400 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      title="Włącz monitorowanie przez Jeva"
                    >
                      <ShieldAlert size={14} />
                      <span>Monitoruj Jev</span>
                    </button>
                  </div>
                </div>

                {/* Screenshot Preview with Multi-Timeframe Tabs */}
                {(capturedSnapshot?.imageBase64 || capturedSnapshot?.htfImageBase64) && (
                  <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#868993] block">
                        Zrzuty przesłane do AI:
                      </span>
                      {capturedSnapshot?.htfImageBase64 && (
                        <div className="flex items-center gap-1 bg-[#161a25] p-0.5 rounded-lg border border-[#2a2e39] text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSnapshotViewTab('exec')}
                            className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                              snapshotViewTab === 'exec'
                                ? 'bg-[#2962ff] text-white'
                                : 'text-[#868993] hover:text-white'
                            }`}
                          >
                            Wykonawczy ({capturedSnapshot.interval} w tle)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSnapshotViewTab('htf')}
                            className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                              snapshotViewTab === 'htf'
                                ? 'bg-[#7c4dff] text-white'
                                : 'text-[#868993] hover:text-white'
                            }`}
                          >
                            Makro ({capturedSnapshot.htfContext?.macro.timeframe || '4h'} w tle)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg overflow-hidden border border-[#2a2e39] aspect-video bg-[#0c0d10] relative">
                      <img
                        src={
                          snapshotViewTab === 'htf' && capturedSnapshot?.htfImageBase64
                            ? capturedSnapshot.htfImageBase64
                            : capturedSnapshot?.imageBase64 || ''
                        }
                        alt="Chart snapshot"
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/75 text-white font-mono border border-white/10">
                        {snapshotViewTab === 'htf' ? '🌐 Wykres Makro wygenerowany w tle' : '📸 Twój kadr z ekranu'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: JEV SENTINEL (1m) ----------------- */}
        {activeTab === 'sentinel' && (
          <div className="space-y-4">
            {/* Sentinel Control Card */}
            <div className="p-4 bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">Jev Strażnik Egzekucji</h4>
                  <span className="text-[11px] text-[#868993]">
                    Model: <strong className="text-white font-mono">{jevModel}</strong>
                  </span>
                </div>
                <button
                  onClick={() => {
                    const next = !sentinelEnabled;
                    setSentinelEnabled(next);
                    StorageService.setAutoSentinel(next);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    sentinelEnabled
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'bg-[#2a2e39] text-[#868993] hover:text-white'
                  }`}
                >
                  <ShieldAlert size={14} />
                  <span>{sentinelEnabled ? 'Aktywny' : 'Wyłączony'}</span>
                </button>
              </div>

              {sentinelEnabled && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2a2e39] text-[#868993]">
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-emerald-400" /> Następny skan:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">{scanCountdown}s</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSentinelScan}
                  disabled={isSentinelScanning || !activePlan}
                  className="flex-1 py-1.5 px-3 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isSentinelScanning ? 'animate-spin' : ''} />
                  <span>Skanuj Teraz (Manual)</span>
                </button>
                <button
                  onClick={() => aiTraderService.playTriggerChime()}
                  className="py-1.5 px-2.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-xs text-[#868993] hover:text-white transition-colors"
                  title="Test sygnału dźwiękowego"
                >
                  <Volume2 size={14} />
                </button>
              </div>
            </div>

            {/* Active Monitored Setup Info */}
            {activePlan ? (
              <div className="p-3 bg-[#161a25] border border-[#2a2e39] rounded-xl text-xs space-y-2">
                <span className="text-[10px] text-[#868993] uppercase font-bold tracking-wider block">
                  Nadzorowany Setup ({activePlan.symbol})
                </span>
                <div className="flex items-center justify-between font-mono">
                  <span
                    className={`font-black ${
                      activePlan.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activePlan.direction} @ ${activePlan.setup.entryPrice.toLocaleString()}
                  </span>
                  <span className="text-gray-400">
                    Strefa: [${activePlan.setup.entryZone[0].toLocaleString()} - $
                    {activePlan.setup.entryZone[1].toLocaleString()}]
                  </span>
                </div>
                <div className="text-[11px] text-[#868993]">
                  Trigger: {activePlan.jevCriteria.executionTrigger} (Wymóg: {activePlan.jevCriteria.requiredCipherSignal})
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#161a25] border border-[#2a2e39] rounded-xl text-xs text-center text-[#868993]">
                Brak aktywnego planu. Przejdź do zakładki <strong>Mózg Strategii</strong> i wygeneruj setup.
              </div>
            )}

            {/* Last Decision Banner */}
            {lastDecision && (
              <div
                className={`p-3.5 rounded-xl border space-y-1.5 ${
                  lastDecision.decision === 'ENTER'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 animate-pulse'
                    : lastDecision.decision === 'INVALIDATED'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-[#1e222d] border-[#363c4e] text-[#d1d4dc]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                        lastDecision.decision === 'ENTER'
                          ? 'bg-emerald-500 text-black'
                          : lastDecision.decision === 'INVALIDATED'
                          ? 'bg-rose-500 text-white'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {lastDecision.decision}
                    </span>
                    <span className="text-[10px] text-[#868993]">
                      {new Date(lastDecision.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#868993] font-mono">
                    Urgency: {lastDecision.urgency}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{lastDecision.reason}</p>
              </div>
            )}

            {/* Sentinel Decision History Logs */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[#868993] uppercase tracking-wider block px-1">
                Dziennik Sprawdzeń Jeva
              </span>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {sentinelLogs.length === 0 ? (
                  <div className="text-[11px] text-[#868993] italic px-1">
                    Brak wpisów. Jev sprawdza warunki co 60 sekund po aktywacji.
                  </div>
                ) : (
                  sentinelLogs.map((log, i) => (
                    <div
                      key={i}
                      className="p-2 bg-[#1e222d] border border-[#2a2e39] rounded-lg text-[11px] flex items-center justify-between font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            log.decision === 'ENTER'
                              ? 'bg-emerald-400'
                              : log.decision === 'INVALIDATED'
                              ? 'bg-rose-400'
                              : 'bg-yellow-400'
                          }`}
                        />
                        <span className="font-bold text-white">{log.decision}</span>
                        <span className="text-[#868993] truncate max-w-[200px] font-sans">
                          {log.reason}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#868993]">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 3: SETTINGS ----------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* API Key Input & Provider Indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white block">
                  Klucz API ({activeProvider === 'opencode' ? 'OpenCode Go / Console' : 'OpenRouter'})
                </label>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 border ${
                    activeProvider === 'opencode'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeProvider === 'opencode' ? 'bg-emerald-400' : 'bg-purple-400'
                    }`}
                  />
                  {activeProvider === 'opencode' ? 'OpenCode Go' : 'OpenRouter'}
                </span>
              </div>

              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="oc_sk_... (OpenCode) lub sk-or-... (OpenRouter)"
                  className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white placeholder-[#868993] outline-none font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-2.5 text-[#868993] hover:text-white"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Test Button & Status */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTestingKey || !apiKey.trim()}
                  className="py-1 px-2.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-[11px] font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isTestingKey ? 'animate-spin' : ''} />
                  <span>{isTestingKey ? 'Sprawdzanie...' : '🔍 Przetestuj Klucz API'}</span>
                </button>
                <span className="text-[10px] text-[#868993]">
                  Wykrywa OpenCode (`oc_sk_`) oraz OpenRouter (`sk-or-`).
                </span>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium border ${
                    testResult.ok
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <p className="text-[10px] text-[#868993] leading-relaxed">
                Klucz przechowywany jest wyłącznie lokalnie w Twojej przeglądarce (<code className="text-[#2962ff]">localStorage</code>).
              </p>
            </div>

            {/* Brain Model Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white block">
                  🧠 Model Mózgu (Strategia + Vision)
                </label>
                <span className="text-[10px] text-[#868993]">
                  {activeProvider === 'opencode' ? 'Katalog OpenCode Go' : 'Katalog OpenRouter'}
                </span>
              </div>
              <select
                value={brainModel}
                onChange={(e) => setBrainModel(e.target.value)}
                className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                {brainPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {brainModel === 'custom' && (
                <input
                  type="text"
                  value={customBrainModel}
                  onChange={(e) => setCustomBrainModel(e.target.value)}
                  placeholder="Wpisz identyfikator (np. deepseek-v4.1-flash)..."
                  className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono mt-1"
                />
              )}
            </div>

            {/* Jev Model Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white block">
                  🛡️ Model Jev (Egzekutor / Strażnik 1m)
                </label>
                <span className="text-[10px] text-[#868993]">
                  Błyskawiczna analiza co 60s
                </span>
              </div>
              <select
                value={jevModel}
                onChange={(e) => setJevModel(e.target.value)}
                className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                {jevPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {jevModel === 'custom' && (
                <input
                  type="text"
                  value={customJevModel}
                  onChange={(e) => setCustomJevModel(e.target.value)}
                  placeholder="Wpisz identyfikator Jeva..."
                  className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono mt-1"
                />
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] font-bold text-xs text-white transition-colors mt-2"
            >
              Zapisz Konfigurację
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
