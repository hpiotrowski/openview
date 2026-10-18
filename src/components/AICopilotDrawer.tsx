import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  ShieldAlert,
  Settings,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  RefreshCw,
  Target,
  Zap,
  Activity,
  Trash2,
  TrendingUp,
  TrendingDown,
  Shield,
  Cpu,
  ChevronDown,
  ChevronUp,
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
import { setupGuardService } from '../services/setupGuard';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeChartId: string;
  currentSymbol: string;
  currentInterval: string;
  currentPrice: number;
  onSelectSymbol?: (symbol: string) => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeChartId,
  currentSymbol,
  currentInterval,
  currentPrice,
  onSelectSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<'brain' | 'sentinel' | 'settings'>('brain');

  // Kronos Health Status
  const [kronosOnline, setKronosOnline] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/kronos/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setKronosOnline(data?.ready === true);
      })
      .catch(() => {
        setKronosOnline(false);
      });
  }, [isOpen]);

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
    const savedPlans = StorageService.getSavedPlans();
    return savedPlans.length > 0 ? savedPlans[0] : null;
  });
  const [capturedSnapshot, setCapturedSnapshot] = useState<MarketSnapshot | null>(null);
  const [snapshotViewTab, setSnapshotViewTab] = useState<'exec' | 'htf'>('exec');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState(false);
  const [autoFrameToast, setAutoFrameToast] = useState(false);

  // Radar / Multi-Coin Setups State
  const [plans, setPlans] = useState<TradingPlan[]>(() => setupGuardService.getPlans());
  const [radarFilter, setRadarFilter] = useState<'all' | 'active' | 'invalidated'>('all');
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    symbol: string;
    stage: string;
  } | null>(null);

  const activePlansCount = plans.filter((p) => p.status !== 'INVALIDATED').length;
  const invalidPlansCount = plans.filter((p) => p.status === 'INVALIDATED').length;

  // Subscribe to live 1:1 Guard updates (WebSocket feed)
  useEffect(() => {
    const unsub = setupGuardService.subscribe((updated) => {
      setPlans(updated);
    });
    return unsub;
  }, []);

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
      setErrorMsg('Wprowadź swój klucz API w ustawieniach, aby rozpocząć.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setShowAdvanced(false);
    setAnalysisStep('Pobieranie wykresu i uruchamianie podwójnej weryfikacji...');

    try {
      const snapshot = await aiTraderService.gatherMarketSnapshot(activeChartId, true);
      if (!snapshot) {
        throw new Error('Nie udało się pobrać danych z aktywnego wykresu.');
      }
      setCapturedSnapshot(snapshot);

      setAnalysisStep('Analiza SMC + symulacje Monte Carlo Kronos...');
      const effectiveBrainModel =
        brainModel === 'custom' && customBrainModel ? customBrainModel : brainModel;

      const plan = await aiTraderService.generateStrategyPlan({
        apiKey,
        model: effectiveBrainModel,
        snapshot,
      });

      setActivePlan(plan);
      // Add to 1:1 Guard & auto-draw on chart if setup is valid
      if (plan.direction !== 'NEUTRAL') {
        setupGuardService.addPlan(plan, true);
      }
    } catch (err: any) {
      console.error('Brain analysis error:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas analizy rynku.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Batch scan popular watchlist symbols
  const handleBatchScanWatchlist = async () => {
    if (isBatchScanning) return;
    if (!apiKey.trim()) {
      setActiveTab('settings');
      setErrorMsg('Wprowadź swój klucz API w zakładce Ustawienia przed skanowaniem.');
      return;
    }
    const effectiveBrainModel =
      brainModel === 'custom' && customBrainModel ? customBrainModel : brainModel;

    const scanSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'NEARUSDT', 'SUIUSDT'];
    setIsBatchScanning(true);
    setErrorMsg(null);

    try {
      await setupGuardService.scanWatchlist(
        scanSymbols,
        { apiKey, model: effectiveBrainModel, fastMode: true },
        (progress) => {
          setBatchProgress(progress);
        }
      );
      setActiveTab('sentinel');
    } catch (err: any) {
      setErrorMsg(err.message || 'Błąd podczas skanowania watchlisty.');
    } finally {
      setIsBatchScanning(false);
      setBatchProgress(null);
    }
  };

  const handleViewPlanOnChart = (plan: TradingPlan) => {
    if (onSelectSymbol) {
      onSelectSymbol(plan.symbol);
    }
    setTimeout(() => {
      aiTraderService.applyPlanToChart(plan, activeChartId);
    }, 150);
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

  if (!isOpen) return null;

  return (
    <aside className="fixed top-11 right-0 bottom-0 w-[420px] max-w-full bg-[#131722] border-l border-[#2a2e39] z-40 flex flex-col shadow-2xl text-[#d1d4dc] select-none animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="h-12 border-b border-[#2a2e39] px-4 flex items-center justify-between bg-[#1e222d]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#2962ff] to-[#00b0ff] flex items-center justify-center text-white shadow-md">
            <Brain size={16} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm tracking-wide">AI Copilot</span>
            {kronosOnline ? (
              <span
                title="Model Kronos-base działa w tle i aktywnie weryfikuje każdy setup"
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Kronos 102M A+
              </span>
            ) : (
              <span
                title="Kronos jest wyłączony. Uruchom kontener w Docker Desktop, aby aktywować podwójną weryfikację."
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/15 border border-gray-500/30 text-gray-400 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Kronos Offline
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-white transition-colors"
          title="Zamknij panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation Tabs (Clear 3-tab layout) */}
      <div className="flex border-b border-[#2a2e39] bg-[#161a25] text-xs">
        <button
          onClick={() => setActiveTab('brain')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 font-bold transition-colors ${
            activeTab === 'brain'
              ? 'border-[#2962ff] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
        >
          <Sparkles size={13} className={activeTab === 'brain' ? 'text-[#2962ff]' : ''} />
          <span>⚡ Analiza</span>
        </button>

        <button
          onClick={() => setActiveTab('sentinel')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 font-bold transition-colors relative ${
            activeTab === 'sentinel'
              ? 'border-[#089981] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
        >
          <Target size={13} className={activeTab === 'sentinel' ? 'text-[#089981]' : ''} />
          <span>📡 Radar Rynku</span>
          {activePlansCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-black text-[10px] font-black leading-none">
              {activePlansCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-3.5 flex items-center justify-center border-b-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-[#7c4dff] text-white bg-[#1e222d]'
              : 'border-transparent text-[#868993] hover:text-[#d1d4dc]'
          }`}
          title="Ustawienia API i Modele"
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
              <span className="font-semibold block mb-0.5">Informacja:</span>
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

        {/* ===================== TAB 1: ⚡ ANALIZA WYKRESU ===================== */}
        {activeTab === 'brain' && (
          <div className="space-y-4">
            {/* Asset Header Bar */}
            <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] text-[#868993] uppercase font-semibold block">Wykres</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-base font-mono">{currentSymbol}</span>
                  <span className="text-xs text-[#2962ff] font-bold bg-[#2962ff]/10 px-1.5 py-0.5 rounded border border-[#2962ff]/30">
                    {currentInterval}
                  </span>
                </div>
              </div>

              <div className="text-right flex items-center gap-2">
                <div>
                  <span className="text-[10px] text-[#868993] uppercase font-semibold block">Cena rynkowa</span>
                  <span className="font-mono font-bold text-white text-sm">
                    ${currentPrice ? currentPrice.toLocaleString() : '---'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ok = aiTraderService.autoFrameActiveChart(activeChartId);
                    if (ok) {
                      setAutoFrameToast(true);
                      setTimeout(() => setAutoFrameToast(false), 2000);
                    }
                  }}
                  className="p-2 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-[#868993] hover:text-white transition-colors"
                  title="Dopasuj idealne przybliżenie wykresu (~85 świec)"
                >
                  <Target size={14} className="text-[#2962ff]" />
                </button>
              </div>
            </div>

            {autoFrameToast && (
              <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Kadr wykresu wycentrowany!</span>
              </div>
            )}

            {/* Main Action Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={isAnalyzing}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                isAnalyzing
                  ? 'bg-[#2962ff]/50 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#2962ff] via-[#1e53e5] to-[#7c4dff] hover:opacity-95 text-white hover:shadow-[#2962ff]/25 active:scale-[0.99]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-cyan-300" />
                  <span className="truncate">{analysisStep || 'Analizowanie rynku...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-cyan-300" />
                  <span>⚡ Przeanalizuj Setup (Mózg + Kronos)</span>
                </>
              )}
            </button>

            {/* State A: No Plan Yet Placeholder */}
            {!activePlan && !isAnalyzing && (
              <div className="p-6 bg-[#161a25] border border-[#2a2e39] rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1e222d] border border-[#2a2e39] flex items-center justify-center mx-auto text-[#2962ff] shadow-inner">
                  <Brain size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Gotowy do analizy rynku</h4>
                  <p className="text-[11px] text-[#868993] leading-relaxed max-w-[280px] mx-auto mt-1">
                    Kliknij przycisk powyżej. Mózg AI zbada płynność i poziomy SMC, a Kronos sprawdzi kierunek pędu na 12 mld świec.
                  </p>
                </div>
                <div className="pt-1 flex items-center justify-center gap-2 text-[10px] text-[#868993]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-400" /> 100% Zgody (A+)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Shield size={11} className="text-rose-400" /> Twarde VETO przy ryzyku
                  </span>
                </div>
              </div>
            )}

            {/* State B: Active Plan Result */}
            {activePlan && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* 1. DECISION BANNER (Sniper Verdict) */}
                {activePlan.direction === 'NEUTRAL' ? (
                  // VETO / NO TRADE STATE
                  <div className="p-4 bg-[#1a1c23] border border-amber-500/30 rounded-2xl space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-amber-400" />
                          BRAK SETUPU DO GRY
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-[#868993] px-2 py-0.5 rounded bg-[#2a2e39]">
                        Zasada Snajpera
                      </span>
                    </div>

                    <div className="p-3 bg-[#13151b] rounded-xl border border-[#2a2e39]/60">
                      <p className="text-xs text-[#d1d4dc] leading-relaxed font-medium">
                        {activePlan.summary}
                      </p>
                    </div>

                    <div className="text-[10px] text-[#868993] flex items-center gap-1.5 pt-0.5">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>Gotówka na koncie jest bezpieczna. Czekaj na idealny układ A+.</span>
                    </div>
                  </div>
                ) : (
                  // ACTIONABLE TRADE STATE (LONG or SHORT)
                  <div className="p-4 bg-[#1a1e29] border border-[#2a2e39] rounded-2xl space-y-3.5 shadow-xl">
                    {/* Header Verdict */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                            activePlan.direction === 'LONG'
                              ? 'bg-emerald-500 text-black shadow-emerald-900/30'
                              : 'bg-rose-500 text-white shadow-rose-900/30'
                          }`}
                        >
                          {activePlan.direction === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {activePlan.direction} A+
                        </span>

                        {activePlan.kronos?.status === 'VERIFIED' && (
                          <span
                            title={`Kronos: ${activePlan.kronos.direction} (${activePlan.kronos.driftPct! > 0 ? '+' : ''}${activePlan.kronos.driftPct}%)`}
                            className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1"
                          >
                            <Cpu size={11} className="text-cyan-400" />
                            KRONOS A+
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#868993] uppercase font-bold block">Risk : Reward</span>
                        <span className="font-mono font-black text-xs text-emerald-400">
                          1 : {activePlan.setup.riskRewardRatio.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h4 className="font-bold text-white text-xs mb-1">{activePlan.title}</h4>
                      <p className="text-[11px] text-[#868993] leading-relaxed">{activePlan.summary}</p>
                    </div>

                    {/* 3 BIG TRADE LEVEL TILES */}
                    <div className="grid grid-cols-3 gap-2 font-mono">
                      <div className="p-2.5 rounded-xl bg-[#131722] border border-[#2a2e39]">
                        <span className="text-[9px] text-[#868993] uppercase block font-sans font-bold">WEJŚCIE</span>
                        <span className="font-black text-white text-xs block truncate mt-0.5">
                          ${activePlan.setup.entryPrice.toLocaleString()}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#131722] border border-rose-500/30">
                        <span className="text-[9px] text-rose-400 uppercase block font-sans font-bold">STOP LOSS</span>
                        <span className="font-black text-rose-400 text-xs block truncate mt-0.5">
                          ${activePlan.setup.stopLoss.toLocaleString()}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#131722] border border-emerald-500/30">
                        <span className="text-[9px] text-emerald-400 uppercase block font-sans font-bold">CEL (TP1)</span>
                        <span className="font-black text-emerald-400 text-xs block truncate mt-0.5">
                          ${activePlan.setup.takeProfit1.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Primary Action Button */}
                    <button
                      onClick={handleApplyToChart}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                    >
                      <Target size={15} />
                      <span>🎯 Nanieś Setup na Wykres (1-Click)</span>
                    </button>
                  </div>
                )}

                {/* 2. ACCORDION: Zaawansowane Szczegóły Analityczne (Collapsible) */}
                <div className="border border-[#2a2e39] rounded-xl overflow-hidden bg-[#161a25]">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full py-2.5 px-3.5 flex items-center justify-between text-xs font-semibold text-[#868993] hover:text-white transition-colors bg-[#1a1e29]"
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity size={13} className="text-[#2962ff]" />
                      <span>Szczegóły Analityczne (CVD, nPOC, Zrzuty)</span>
                    </span>
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showAdvanced && (
                    <div className="p-3 space-y-3 border-t border-[#2a2e39] text-xs animate-in fade-in">
                      {/* Order Flow Details */}
                      {capturedSnapshot && (
                        <div className="space-y-2">
                          <span className="text-[10px] text-[#868993] font-bold uppercase tracking-wider block">
                            Filtry Order Flow & Smart Money
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            {capturedSnapshot.cvd && (
                              <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39]">
                                <div className="text-[#868993] font-sans text-[9px] mb-0.5">Dywergencja CVD</div>
                                <div
                                  className={`font-bold ${
                                    capturedSnapshot.cvd.divergence === 'BULLISH'
                                      ? 'text-emerald-400'
                                      : capturedSnapshot.cvd.divergence === 'BEARISH'
                                      ? 'text-rose-400'
                                      : 'text-gray-300'
                                  }`}
                                >
                                  {capturedSnapshot.cvd.divergence || 'Brak'}
                                </div>
                              </div>
                            )}

                            {activePlan.cipherBAnalysis && (
                              <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39]">
                                <div className="text-[#868993] font-sans text-[9px] mb-0.5">Cipher B MFI</div>
                                <div className="font-bold text-white">
                                  {activePlan.cipherBAnalysis.mfiTrend}
                                </div>
                              </div>
                            )}

                            {capturedSnapshot.nakedPocs && capturedSnapshot.nakedPocs.length > 0 && (
                              <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39] col-span-2">
                                <div className="text-[#868993] font-sans text-[9px] mb-0.5">Naked POCs (Magnesy Wolumenu)</div>
                                <div className="text-[#d1d4dc] truncate">
                                  {capturedSnapshot.nakedPocs
                                    .slice(0, 3)
                                    .map((p) => `$${p.price.toLocaleString()} (${p.distancePct}%)`)
                                    .join(' • ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Multi-Timeframe Context */}
                      {activePlan.htfContext && (
                        <div className="space-y-2 pt-1 border-t border-[#2a2e39]">
                          <span className="text-[10px] text-[#868993] font-bold uppercase tracking-wider block">
                            Kontekst Multi-Timeframe
                          </span>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39]">
                              <span className="text-[#868993] font-sans text-[9px] block">
                                Makro ({activePlan.htfContext.macro.timeframe})
                              </span>
                              <span className="font-bold text-white block mt-0.5">
                                {activePlan.htfContext.macro.trend}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39]">
                              <span className="text-[#868993] font-sans text-[9px] block">
                                Struktura ({activePlan.htfContext.structure.timeframe})
                              </span>
                              <span className="font-bold text-white block mt-0.5">
                                {activePlan.htfContext.structure.trend}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Chart Screenshot Preview */}
                      {(capturedSnapshot?.imageBase64 || capturedSnapshot?.htfImageBase64) && (
                        <div className="space-y-2 pt-1 border-t border-[#2a2e39]">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#868993] font-bold uppercase tracking-wider">
                              Zrzut przesłany do AI
                            </span>
                            {capturedSnapshot?.htfImageBase64 && (
                              <div className="flex items-center gap-1 bg-[#131722] p-0.5 rounded border border-[#2a2e39] text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => setSnapshotViewTab('exec')}
                                  className={`px-1.5 py-0.5 rounded font-semibold ${
                                    snapshotViewTab === 'exec' ? 'bg-[#2962ff] text-white' : 'text-[#868993]'
                                  }`}
                                >
                                  {capturedSnapshot.interval}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSnapshotViewTab('htf')}
                                  className={`px-1.5 py-0.5 rounded font-semibold ${
                                    snapshotViewTab === 'htf' ? 'bg-[#7c4dff] text-white' : 'text-[#868993]'
                                  }`}
                                >
                                  {capturedSnapshot.htfContext?.macro.timeframe || '4h'}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="rounded-lg overflow-hidden border border-[#2a2e39] aspect-video bg-[#0c0d10]">
                            <img
                              src={
                                snapshotViewTab === 'htf' && capturedSnapshot?.htfImageBase64
                                  ? capturedSnapshot.htfImageBase64
                                  : capturedSnapshot?.imageBase64 || ''
                              }
                              alt="Chart snapshot"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: 📡 RADAR RYNKU ===================== */}
        {activeTab === 'sentinel' && (
          <div className="space-y-4">
            {/* Top Control Bar */}
            <div className="p-3.5 bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Target className="text-[#089981]" size={14} />
                    <span>Radar Rynku (Top 5 Watchlist)</span>
                  </h4>
                  <span className="text-[11px] text-[#868993] block">
                    Skanuje BTC, ETH, SOL, NEAR, SUI i filtruje przez twarde VETO
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={handleBatchScanWatchlist}
                  disabled={isBatchScanning}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#2962ff] hover:bg-[#1e4bd8] text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-md"
                >
                  <RefreshCw size={13} className={isBatchScanning ? 'animate-spin' : ''} />
                  <span>{isBatchScanning ? 'Skanowanie...' : '⚡ Skanuj Watchlistę'}</span>
                </button>

                <button
                  onClick={() => setupGuardService.clearInvalidatedPlans()}
                  disabled={invalidPlansCount === 0}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    invalidPlansCount > 0
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                      : 'bg-[#2a2e39] text-[#868993] opacity-50 cursor-not-allowed'
                  }`}
                  title="Usuń setupy, które wybiły SL lub osiągnęły cel"
                >
                  <Trash2 size={13} />
                  <span>Wyczyść ({invalidPlansCount})</span>
                </button>
              </div>

              {/* Batch Scan Progress Banner */}
              {isBatchScanning && batchProgress && (
                <div className="p-3 bg-[#141720] border border-[#2962ff]/40 rounded-xl space-y-2 animate-in fade-in shadow-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white text-[11px] truncate">
                      Skanowanie ({batchProgress.current}/{batchProgress.total}): {batchProgress.symbol}
                    </span>
                    <button
                      onClick={() => setupGuardService.cancelWatchlistScan()}
                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold border border-rose-500/40"
                    >
                      Anuluj
                    </button>
                  </div>
                  <div className="w-full bg-[#1e222d] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#2962ff] to-[#00e676] h-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  {batchProgress.stage && (
                    <div className="text-[10px] text-[#868993] truncate font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2962ff] animate-ping shrink-0" />
                      <span className="truncate">{batchProgress.stage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-[#161a25] rounded-lg border border-[#2a2e39] text-xs">
              <button
                onClick={() => setRadarFilter('all')}
                className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                  radarFilter === 'all' ? 'bg-[#2a2e39] text-white shadow-sm' : 'text-[#868993] hover:text-[#d1d4dc]'
                }`}
              >
                <span>Wszystkie ({plans.length})</span>
              </button>
              <button
                onClick={() => setRadarFilter('active')}
                className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                  radarFilter === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-[#868993] hover:text-[#d1d4dc]'
                }`}
              >
                <span>Aktywne ({activePlansCount})</span>
              </button>
              <button
                onClick={() => setRadarFilter('invalidated')}
                className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                  radarFilter === 'invalidated'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-[#868993] hover:text-[#d1d4dc]'
                }`}
              >
                <span>Zakończone ({invalidPlansCount})</span>
              </button>
            </div>

            {/* Setup Cards List */}
            <div className="space-y-3">
              {(() => {
                const filteredPlans = plans.filter((p) => {
                  if (radarFilter === 'active') return p.status !== 'INVALIDATED';
                  if (radarFilter === 'invalidated') return p.status === 'INVALIDATED';
                  return true;
                });

                if (filteredPlans.length === 0) {
                  return (
                    <div className="p-6 bg-[#161a25] border border-[#2a2e39] rounded-xl text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-[#2a2e39] flex items-center justify-center mx-auto text-[#868993]">
                        <Target size={18} />
                      </div>
                      <h5 className="font-semibold text-white text-xs">Brak setupów</h5>
                      <p className="text-[11px] text-[#868993] leading-relaxed max-w-[280px] mx-auto">
                        Kliknij <strong>"Skanuj Watchlistę"</strong> powyżej, aby automatycznie znaleźć i nadzorować setupy dla 5 głównych kryptowalut.
                      </p>
                    </div>
                  );
                }

                return filteredPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                      plan.status === 'IN_ZONE'
                        ? 'bg-[#14261e] border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                        : plan.status === 'TRIGGERED'
                        ? 'bg-[#221833] border-purple-500/60 shadow-lg shadow-purple-950/40'
                        : plan.status === 'INVALIDATED'
                        ? 'bg-[#181b22] border-rose-500/30 opacity-75'
                        : 'bg-[#1e222d] border-[#2a2e39] hover:border-[#3a4052]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm font-mono">{plan.symbol}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black flex items-center gap-1 ${
                            plan.direction === 'LONG'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : plan.direction === 'SHORT'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                          }`}
                        >
                          {plan.direction === 'LONG' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {plan.direction}
                        </span>

                        {plan.kronos?.status === 'VERIFIED' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                            <Cpu size={10} className="text-cyan-400" />
                            A+
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewPlanOnChart(plan)}
                          className="py-1 px-2.5 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                          title="Pokaż na wykresie"
                        >
                          <Target size={12} />
                          <span>Pokaż</span>
                        </button>
                        <button
                          onClick={() => setupGuardService.deletePlan(plan.id)}
                          className="p-1 rounded bg-[#2a2e39] hover:bg-rose-500/20 text-[#868993] hover:text-rose-400 transition-colors"
                          title="Usuń z radaru"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Numbers Grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono p-2 bg-[#141720] rounded-lg">
                      <div>
                        <span className="text-[#868993] block font-sans text-[9px]">Wejście</span>
                        <span className="font-bold text-white">${plan.setup.entryPrice.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-rose-400 block font-sans text-[9px]">Stop Loss</span>
                        <span className="font-bold text-rose-400">${plan.setup.stopLoss.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 block font-sans text-[9px]">Cel (TP1)</span>
                        <span className="font-bold text-emerald-400">${plan.setup.takeProfit1.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: ⚙️ USTAWIENIA ===================== */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white block">
                  Klucz API ({activeProvider === 'opencode' ? 'OpenCode Go' : 'OpenRouter'})
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

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTestingKey || !apiKey.trim()}
                  className="py-1 px-2.5 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-[11px] font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isTestingKey ? 'animate-spin' : ''} />
                  <span>{isTestingKey ? 'Sprawdzanie...' : '🔍 Sprawdź Klucz'}</span>
                </button>
                <span className="text-[10px] text-[#868993]">Wykrywa klucz automatycznie.</span>
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
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white block">
                🧠 Model AI (Strategia & Analiza Świec)
              </label>
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
                  placeholder="Wpisz identyfikator modelu..."
                  className="w-full bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono mt-1"
                />
              )}
            </div>

            {/* Kronos Info Card */}
            <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu size={14} className="text-cyan-400" />
                  <span>Model Statystyczny Kronos</span>
                </span>
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  {kronosOnline ? 'Aktywny (Docker)' : 'Wyłączony'}
                </span>
              </div>
              <p className="text-[11px] text-[#868993] leading-relaxed">
                Kronos to 102M model wyszkolony na 12 mld świec. Odpowiada za 5 ścieżek Monte Carlo i twarde VETO przy braku pędu. Działa lokalnie na Twoim komputerze bez żadnych opłat za tokeny.
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              className="w-full py-2.5 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] font-bold text-xs text-white transition-colors mt-2"
            >
              Zapisz Ustawienia
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
