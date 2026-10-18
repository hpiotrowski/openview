import React, { useState, useEffect } from 'react';
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
  MarketSnapshot,
  OPENCODE_BRAIN_PRESETS,
  OPENROUTER_BRAIN_PRESETS,
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
  // Show settings inline overlay
  const [showSettings, setShowSettings] = useState(false);

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

  const [brainModel, setBrainModel] = useState(() => {
    const saved = StorageService.getBrainModel();
    const presets = detectProvider(StorageService.getOpenRouterKey()) === 'opencode'
      ? OPENCODE_BRAIN_PRESETS
      : OPENROUTER_BRAIN_PRESETS;
    return presets.some((p) => p.id === saved) || saved === 'custom' ? saved : presets[0].id;
  });
  const [customBrainModel, setCustomBrainModel] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; provider?: AIProvider } | null>(null);

  const handleApiKeyChange = (val: string) => {
    const cleaned = aiTraderService.cleanApiKey(val);
    const newProv = detectProvider(cleaned);
    setApiKey(cleaned);
    StorageService.setOpenRouterKey(cleaned);
    setTestResult(null);

    const targetBrainPresets = newProv === 'opencode' ? OPENCODE_BRAIN_PRESETS : OPENROUTER_BRAIN_PRESETS;
    if (!targetBrainPresets.some((p) => p.id === brainModel) && brainModel !== 'custom') {
      const defBrain = targetBrainPresets[0].id;
      setBrainModel(defBrain);
      StorageService.setBrainModel(defBrain);
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

  const handleSaveSettings = () => {
    const finalBrain = brainModel === 'custom' && customBrainModel ? customBrainModel : brainModel;
    StorageService.setOpenRouterKey(apiKey);
    StorageService.setBrainModel(finalBrain);
    setShowSettings(false);
    setErrorMsg(null);
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
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    symbol: string;
    stage: string;
  } | null>(null);

  // Subscribe to live 1:1 Guard updates (WebSocket feed)
  useEffect(() => {
    const unsub = setupGuardService.subscribe((updated) => {
      setPlans(updated);
    });
    return unsub;
  }, []);

  // Run Brain Setup Generation
  const handleGeneratePlan = async () => {
    if (!apiKey.trim()) {
      setShowSettings(true);
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
      setShowSettings(true);
      setErrorMsg('Wprowadź swój klucz API przed skanowaniem.');
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
      <div className="h-12 border-b border-[#2a2e39] px-4 flex items-center justify-between bg-[#1e222d] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#2962ff] to-[#00b0ff] flex items-center justify-center text-white shadow-md">
            <Brain size={16} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm tracking-wide">AI Copilot</span>
            {kronosOnline ? (
              <span
                title="Model Kronos-base aktywny (5 ścieżek Monte Carlo + Hard Veto)"
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Kronos 102M
              </span>
            ) : (
              <span
                title="Kronos Offline (odpal kontener w Docker Desktop, aby włączyć podwójną weryfikację)"
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/15 border border-gray-500/30 text-gray-400 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Kronos Off
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded hover:bg-[#2a2e39] transition-colors ${
              showSettings ? 'text-[#2962ff] bg-[#2a2e39]' : 'text-[#868993] hover:text-white'
            }`}
            title="Ustawienia API"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-white transition-colors"
            title="Zamknij panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Inline Settings Panel (Toggleable, doesn't break flow) */}
      {showSettings && (
        <div className="p-4 bg-[#181b24] border-b border-[#2a2e39] space-y-3 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Settings size={13} className="text-[#2962ff]" />
              <span>Konfiguracja AI</span>
            </span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeProvider === 'opencode'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
              }`}
            >
              {activeProvider === 'opencode' ? 'OpenCode Go' : 'OpenRouter'}
            </span>
          </div>

          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Klucz API: oc_sk_... lub sk-or-..."
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

          <div className="flex items-center gap-2">
            <select
              value={brainModel}
              onChange={(e) => setBrainModel(e.target.value)}
              className="flex-1 bg-[#1e222d] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
            >
              {brainPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTestingKey || !apiKey.trim()}
              className="py-1.5 px-3 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-xs font-semibold text-white transition-colors shrink-0"
            >
              {isTestingKey ? '...' : 'Test'}
            </button>
            <button
              onClick={handleSaveSettings}
              className="py-1.5 px-3 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-xs font-bold text-white transition-colors shrink-0"
            >
              Zapisz
            </button>
          </div>

          {testResult && (
            <div
              className={`p-2 rounded text-[11px] font-medium border ${
                testResult.ok
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* Main Unified Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-in fade-in">
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
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="font-medium">Setup naniesiony bezpośrednio na Twój wykres!</span>
          </div>
        )}

        {/* ----------------- SECTION 1: AKTYWNY WYKRES (SINGLE-VIEW HERO) ----------------- */}
        <section className="space-y-3">
          {/* Asset Info Bar */}
          <div className="p-3 bg-[#1e222d] border border-[#2a2e39] rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-[#868993] uppercase font-semibold block">Twój aktywny wykres</span>
              <div className="flex items-center gap-1.5 mt-0.5">
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
                className="p-2 rounded-xl bg-[#2a2e39] hover:bg-[#363c4e] text-[#868993] hover:text-white transition-colors"
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

          {/* Big Action Button */}
          <button
            onClick={handleGeneratePlan}
            disabled={isAnalyzing}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              isAnalyzing
                ? 'bg-[#2962ff]/50 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-[#2962ff] via-[#1e53e5] to-[#7c4dff] hover:opacity-95 text-white hover:shadow-[#2962ff]/30 active:scale-[0.99]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={16} className="animate-spin text-cyan-300" />
                <span className="truncate">{analysisStep || 'Analizowanie rynku...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-cyan-300" />
                <span>⚡ PRZEANALIZUJ WYKRES (MÓZG + KRONOS)</span>
              </>
            )}
          </button>

          {/* Plan Result Card */}
          {activePlan && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {activePlan.direction === 'NEUTRAL' ? (
                // HARD VETO / NO TRADE STATE
                <div className="p-4 bg-[#1a1c23] border border-amber-500/30 rounded-2xl space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-400" />
                      BRAK SETUPU DO GRY (HARD VETO)
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#868993] px-2 py-0.5 rounded bg-[#2a2e39]">
                      Zasada Snajpera
                    </span>
                  </div>

                  <div className="p-3 bg-[#13151b] rounded-xl border border-[#2a2e39]/60">
                    <p className="text-xs text-[#d1d4dc] leading-relaxed font-medium">
                      {activePlan.summary}
                    </p>
                  </div>

                  {/* Kronos Probability Gauge */}
                  {activePlan.kronos?.confidence !== undefined && (
                    <div className="p-2.5 rounded-xl bg-[#141720] border border-[#262a35] space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#868993] font-sans flex items-center gap-1">
                          <Cpu size={12} className="text-cyan-400" /> Model Kronos (102M FM):
                        </span>
                        <span className="font-bold text-amber-400">
                          {activePlan.kronos.direction} ({activePlan.kronos.driftPct! > 0 ? '+' : ''}
                          {activePlan.kronos.driftPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-[#1e222d] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full transition-all duration-300"
                          style={{ width: `${activePlan.kronos.confidence}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#868993]">
                        <span>Pewność: {activePlan.kronos.confidence}% ścieżek Monte Carlo</span>
                        <span>Dolny szum: ${activePlan.kronos.envelopeLow?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-[#868993] flex items-center gap-1.5 pt-0.5">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Kapitał jest bezpieczny. Czekaj na czyste wybicie lub re-test.</span>
                  </div>
                </div>
              ) : (
                // ACTIONABLE TRADE STATE (LONG / SHORT)
                <div className="p-4 bg-[#1a1e29] border border-[#2a2e39] rounded-2xl space-y-3.5 shadow-xl">
                  {/* Verdict Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                          activePlan.direction === 'LONG'
                            ? 'bg-emerald-500 text-black shadow-emerald-950/40'
                            : 'bg-rose-500 text-white shadow-rose-950/40'
                        }`}
                      >
                        {activePlan.direction === 'LONG' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {activePlan.direction} A+
                      </span>

                      {activePlan.kronos?.status === 'VERIFIED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <Cpu size={11} className="text-cyan-400" />
                          KRONOS {activePlan.kronos.confidence ? `${activePlan.kronos.confidence}%` : 'A+'}
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

                  {/* Pullback / Entry Notification with clear reasoning */}
                  {activePlan.setup.entryPrice < currentPrice && activePlan.direction === 'LONG' ? (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock size={14} className="text-blue-400 shrink-0" />
                        <span>
                          <strong>Zlecenie Limit:</strong> Kupujemy na korekcie do{' '}
                          <strong className="text-white">${activePlan.setup.entryPrice.toLocaleString()}</strong>
                          {currentPrice > 0 && (
                            <span className="ml-1 text-blue-400 font-mono text-[11px]">
                              (-{Math.abs(((activePlan.setup.entryPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% od ceny rynkowej)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#868993] pl-5 leading-normal">
                        💡 Zamiast gonić szczyt zielonej świecy po cenie rynkowej, Mózg stawia zlecenie na dołku lokalnej korekty (węzeł wolumenowy / strefa popytu), by zminimalizować ryzyko i zapewnić ciasny SL.
                      </div>
                    </div>
                  ) : activePlan.setup.entryPrice > currentPrice && activePlan.direction === 'SHORT' ? (
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock size={14} className="text-purple-400 shrink-0" />
                        <span>
                          <strong>Zlecenie Limit:</strong> Sprzedajemy na odbiciu do{' '}
                          <strong className="text-white">${activePlan.setup.entryPrice.toLocaleString()}</strong>
                          {currentPrice > 0 && (
                            <span className="ml-1 text-purple-400 font-mono text-[11px]">
                              (+{Math.abs(((activePlan.setup.entryPrice - currentPrice) / currentPrice) * 100).toFixed(1)}% od ceny rynkowej)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#868993] pl-5 leading-normal">
                        💡 Zamiast sprzedawać w dołek, czekamy na podejście pod opór (węzeł wolumenowy / strefa podaży), by wejść po wyższej cenie z minimalnym ryzykiem.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2 font-medium">
                      <Zap size={14} className="text-emerald-400 shrink-0" />
                      <span>Cena znajduje się w optymalnej strefie wejścia!</span>
                    </div>
                  )}

                  {/* 3 BIG TRADE NUMBER CARDS */}
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div className="p-2.5 rounded-xl bg-[#131722] border border-[#2a2e39]">
                      <span className="text-[9px] text-[#868993] uppercase block font-sans font-bold">
                        {activePlan.setup.entryPrice !== currentPrice ? 'WEJŚCIE (LIMIT)' : 'WEJŚCIE (MARKET)'}
                      </span>
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

                  {/* Kronos Probability & Foundation Model Consensus */}
                  {activePlan.kronos?.confidence !== undefined ? (
                    <div className="p-2.5 rounded-xl bg-[#141720] border border-[#262a35] space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#868993] font-sans flex items-center gap-1.5 font-bold">
                          <Cpu size={12} className="text-cyan-400" />
                          <span>Prawdopodobieństwo Kronos:</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          activePlan.kronos.direction === 'BULLISH'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : activePlan.kronos.direction === 'BEARISH'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {activePlan.kronos.confidence}% Ścieżek {activePlan.kronos.direction}
                        </span>
                      </div>
                      <div className="w-full bg-[#1e222d] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            activePlan.kronos.direction === 'BEARISH'
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                              : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                          }`}
                          style={{ width: `${activePlan.kronos.confidence}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#868993]">
                        <span>Oczekiwany pęd: <strong className="text-zinc-200">{activePlan.kronos.driftPct! > 0 ? '+' : ''}{activePlan.kronos.driftPct}%</strong></span>
                        <span>Szum rynkowy (min/max): <strong className="text-zinc-200">${activePlan.kronos.envelopeLow?.toLocaleString()} - ${activePlan.kronos.envelopeHigh?.toLocaleString()}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#141720] border border-[#262a35] flex items-center justify-between text-[10px]">
                      <span className="text-[#868993] flex items-center gap-1.5 font-sans">
                        <Cpu size={12} className="text-zinc-500" />
                        <span>Radar Statystyczny Kronos:</span>
                      </span>
                      <span className="text-amber-400/80 font-mono">
                        {activePlan.kronos?.status === 'OFFLINE' ? '⚡ Offline / Przekroczony limit' : '⚡ Oczekiwanie na model'}
                      </span>
                    </div>
                  )}

                  {/* Summary */}
                  <p className="text-[11px] text-[#868993] leading-relaxed">{activePlan.summary}</p>

                  {/* 1-Click Action Button */}
                  <button
                    onClick={handleApplyToChart}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <Target size={15} />
                    <span>🎯 Nanieś Setup na Wykres (1-Click)</span>
                  </button>
                </div>
              )}

              {/* Collapsible Advanced Analytics */}
              <div className="border border-[#2a2e39] rounded-2xl overflow-hidden bg-[#161a25]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full py-2.5 px-3.5 flex items-center justify-between text-xs font-semibold text-[#868993] hover:text-white transition-colors bg-[#1a1e29]"
                >
                  <span className="flex items-center gap-1.5">
                    <Activity size={13} className="text-[#2962ff]" />
                    <span>Szczegóły Analityczne (Order Flow, CVD, MTF)</span>
                  </span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <div className="p-3 space-y-3 border-t border-[#2a2e39] text-xs animate-in fade-in">
                    {capturedSnapshot && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-[#868993] font-bold uppercase tracking-wider block">
                          Filtry Order Flow & Smart Money
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          {capturedSnapshot.cvd && (
                            <div className="p-2 rounded-lg bg-[#1e222d] border border-[#2a2e39]">
                              <div className="text-[#868993] font-sans text-[9px] mb-0.5">Dywergencja CVD</div>
                              <div className="font-bold text-emerald-400">
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
        </section>

        {/* ----------------- SECTION 2: RADAR WATCHLISTY (SAME VIEW, NO TABS!) ----------------- */}
        <section className="space-y-3 pt-4 border-t border-[#2a2e39]/80">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Target className="text-[#089981]" size={14} />
                <span>Radar Rynku (Top 5 Monet)</span>
              </h4>
              <span className="text-[10px] text-[#868993] block">
                Szybki skan: BTC, ETH, SOL, NEAR, SUI
              </span>
            </div>

            <button
              onClick={() => setupGuardService.clearInvalidatedPlans()}
              className="p-1 rounded text-[#868993] hover:text-white transition-colors"
              title="Wyczyść listę"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <button
            onClick={handleBatchScanWatchlist}
            disabled={isBatchScanning}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] hover:border-[#2962ff]/50 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <RefreshCw size={13} className={isBatchScanning ? 'animate-spin text-[#2962ff]' : 'text-[#2962ff]'} />
            <span>{isBatchScanning ? 'Przeszukiwanie rynku...' : '⚡ Przeskanuj Top 5 Monet (Watchlista)'}</span>
          </button>

          {/* Skan Progress Bar */}
          {isBatchScanning && batchProgress && (
            <div className="p-2.5 bg-[#141720] border border-[#2962ff]/40 rounded-xl space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white truncate">
                  ({batchProgress.current}/{batchProgress.total}) {batchProgress.symbol}
                </span>
                <button
                  onClick={() => setupGuardService.cancelWatchlistScan()}
                  className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold"
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
            </div>
          )}

          {/* Compact Radar Coin Cards */}
          <div className="space-y-2">
            {plans.length === 0 ? (
              <div className="p-4 bg-[#161a25] border border-[#2a2e39] rounded-xl text-center">
                <span className="text-[11px] text-[#868993]">
                  Kliknij przycisk powyżej, aby automatycznie znaleźć setupy na 5 monetach.
                </span>
              </div>
            ) : (
              plans.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-[#1e222d] hover:bg-[#252a37] border border-[#2a2e39] rounded-xl flex items-center justify-between transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs font-mono">{p.symbol}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                        p.direction === 'LONG'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : p.direction === 'SHORT'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                      }`}
                    >
                      {p.direction}
                    </span>
                    {p.kronos?.status === 'VERIFIED' && (
                      <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded">
                        A+
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#868993]">
                      ${p.setup.entryPrice.toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleViewPlanOnChart(p)}
                      className="py-1 px-2 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Target size={11} />
                      <span>Otwórz</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
};
