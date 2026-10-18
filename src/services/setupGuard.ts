import { TradingPlan, GuardRules, PlanStatus, aiTraderService } from './aiTrader';
import { StorageService } from './storage';
import { BinanceService, WatchlistTicker } from './binance';

export interface SetupGuardListener {
  (plans: TradingPlan[]): void;
}

class SetupGuardService {
  private listeners = new Set<SetupGuardListener>();
  private isInitialized = false;
  private isScanningWatchlist = false;

  constructor() {
    // Lazy init on first import
    if (typeof window !== 'undefined') {
      setTimeout(() => this.init(), 1000);
    }
  }

  /**
   * Initializes real-time live ticker listener across all watchlist symbols (0 token cost)
   */
  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    BinanceService.subscribeWatchlist('setup-guard-service', (tickers) => {
      this.evaluateLiveTickers(tickers);
    });
  }

  subscribe(listener: SetupGuardListener): () => void {
    this.listeners.add(listener);
    // Send current plans immediately
    listener(this.getPlans());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const plans = this.getPlans();
    this.listeners.forEach((cb) => {
      try {
        cb(plans);
      } catch (err) {
        console.warn('SetupGuard listener error:', err);
      }
    });
  }

  getPlans(): TradingPlan[] {
    return StorageService.getSavedPlans() as TradingPlan[];
  }

  /**
   * 1:1 Mathematical & Indicator Guard against live market feed (Zero token cost)
   */
  evaluateLiveTickers(tickers: WatchlistTicker[]): void {
    const plans = this.getPlans();
    if (!plans || plans.length === 0) return;

    let changed = false;
    const tickerMap = new Map<string, number>();
    tickers.forEach((t) => tickerMap.set(t.symbol, t.price));

    const updatedPlans = plans.map((plan) => {
      const livePrice = tickerMap.get(plan.symbol);
      if (!livePrice || livePrice <= 0) return plan;

      // Ensure guardRules object exists (with fallback to setup/jevCriteria)
      const rules: GuardRules = plan.guardRules || {
        entryZone: plan.setup?.entryZone || [plan.setup?.entryPrice * 0.995, plan.setup?.entryPrice * 1.005],
        targetPrice: plan.setup?.takeProfit1 || 0,
        stopLoss: plan.setup?.stopLoss || 0,
        invalidationPrice: plan.jevCriteria?.invalidationPrice || plan.setup?.stopLoss || 0,
        invalidationReason: 'Wybity poziom obrony strategii',
        requiredCipherSignal: plan.jevCriteria?.requiredCipherSignal || 'NONE',
        cancelIfTpHitFirst: true,
        expiresAt: plan.createdAt + 12 * 3600 * 1000,
      };

      // 1. If already invalidated, preserve reason
      if (plan.status === 'INVALIDATED') {
        return plan;
      }

      const [minEntry, maxEntry] = [
        Math.min(rules.entryZone[0], rules.entryZone[1]),
        Math.max(rules.entryZone[0], rules.entryZone[1]),
      ];

      // -------------------------------------------------------------
      // RULE 1: Stop Loss / Invalidation Price Violation before entry
      // -------------------------------------------------------------
      if (plan.direction === 'LONG' && livePrice <= rules.invalidationPrice) {
        changed = true;
        aiTraderService.removePlanFromChart(plan);
        return {
          ...plan,
          status: 'INVALIDATED' as PlanStatus,
          invalidationReason: `Cena ($${livePrice}) wybiła poziom unieważnienia ($${rules.invalidationPrice})`,
          distanceToEntryPct: 0,
        };
      }

      if (plan.direction === 'SHORT' && livePrice >= rules.invalidationPrice) {
        changed = true;
        aiTraderService.removePlanFromChart(plan);
        return {
          ...plan,
          status: 'INVALIDATED' as PlanStatus,
          invalidationReason: `Cena ($${livePrice}) wybiła poziom unieważnienia ($${rules.invalidationPrice})`,
          distanceToEntryPct: 0,
        };
      }

      // -------------------------------------------------------------
      // RULE 2: "Train Left" (Target TP1 hit before testing entry zone)
      // -------------------------------------------------------------
      if (rules.cancelIfTpHitFirst && rules.targetPrice > 0) {
        if (plan.direction === 'LONG' && livePrice >= rules.targetPrice) {
          changed = true;
          aiTraderService.removePlanFromChart(plan);
          return {
            ...plan,
            status: 'INVALIDATED' as PlanStatus,
            invalidationReason: `Cel TP1 ($${rules.targetPrice}) osiągnięty bez testu strefy (ruch się dokonał)`,
            distanceToEntryPct: 0,
          };
        }

        if (plan.direction === 'SHORT' && livePrice <= rules.targetPrice) {
          changed = true;
          aiTraderService.removePlanFromChart(plan);
          return {
            ...plan,
            status: 'INVALIDATED' as PlanStatus,
            invalidationReason: `Cel TP1 ($${rules.targetPrice}) osiągnięty bez testu strefy (ruch się dokonał)`,
            distanceToEntryPct: 0,
          };
        }
      }

      // -------------------------------------------------------------
      // RULE 3: Time Expiration (Freshness timeout)
      // -------------------------------------------------------------
      if (rules.expiresAt && Date.now() > rules.expiresAt) {
        changed = true;
        aiTraderService.removePlanFromChart(plan);
        return {
          ...plan,
          status: 'INVALIDATED' as PlanStatus,
          invalidationReason: 'Setup przeterminowany (brak testu strefy w zadanym oknie czasowym)',
          distanceToEntryPct: 0,
        };
      }

      // -------------------------------------------------------------
      // RULE 4: Entry Zone Proximity & In-Zone Confirmation
      // -------------------------------------------------------------
      const isInZone = livePrice >= minEntry && livePrice <= maxEntry;
      if (isInZone) {
        const nextStatus: PlanStatus =
          rules.requiredCipherSignal === 'NONE' ? 'TRIGGERED' : 'IN_ZONE';

        if (plan.status !== nextStatus) {
          changed = true;
          if (nextStatus === 'TRIGGERED') {
            aiTraderService.playTriggerChime();
          }
          return {
            ...plan,
            status: nextStatus,
            distanceToEntryPct: 0,
          };
        }
        return plan;
      }

      // Calculate distance percentage to nearest entry edge
      let distPct = 0;
      if (plan.direction === 'LONG') {
        if (livePrice > maxEntry) {
          distPct = ((livePrice - maxEntry) / livePrice) * 100;
        }
      } else if (plan.direction === 'SHORT') {
        if (livePrice < minEntry) {
          distPct = ((minEntry - livePrice) / livePrice) * 100;
        }
      }

      const roundedDist = Math.round(distPct * 100) / 100;
      if (plan.status !== 'PENDING' || plan.distanceToEntryPct !== roundedDist) {
        changed = true;
        return {
          ...plan,
          status: 'PENDING' as PlanStatus,
          distanceToEntryPct: roundedDist,
        };
      }

      return plan;
    });

    if (changed) {
      StorageService.setSavedPlans(updatedPlans);
      this.notify();
    }
  }

  /**
   * Adds or updates a plan, automatically drawing its position tool on the matching chart.
   */
  addPlan(plan: TradingPlan, autoDraw = true): void {
    const plans = this.getPlans();
    const existingIdx = plans.findIndex((p) => p.id === plan.id || p.symbol === plan.symbol);

    let nextPlans: TradingPlan[];
    if (existingIdx >= 0) {
      nextPlans = [...plans];
      nextPlans[existingIdx] = plan;
    } else {
      nextPlans = [plan, ...plans.slice(0, 19)];
    }

    StorageService.setSavedPlans(nextPlans);

    if (autoDraw && plan.direction !== 'NEUTRAL') {
      aiTraderService.applyPlanToChart(plan);
    }

    this.notify();
  }

  /**
   * Deletes a plan and removes its overlay from the chart.
   */
  deletePlan(planId: string): void {
    const plans = this.getPlans();
    const target = plans.find((p) => p.id === planId);
    if (target) {
      aiTraderService.removePlanFromChart(target);
    }
    const filtered = plans.filter((p) => p.id !== planId);
    StorageService.setSavedPlans(filtered);
    this.notify();
  }

  /**
   * 1-Click prune of all invalidated setups (clean radar).
   */
  clearInvalidatedPlans(): void {
    const plans = this.getPlans();
    const invalidated = plans.filter((p) => p.status === 'INVALIDATED');
    invalidated.forEach((p) => aiTraderService.removePlanFromChart(p));

    const activeOnly = plans.filter((p) => p.status !== 'INVALIDATED');
    StorageService.setSavedPlans(activeOnly);
    this.notify();
  }

  /**
   * Re-applies active setup overlays across all charts currently open.
   */
  autoDrawActivePlans(): void {
    const plans = this.getPlans();
    plans
      .filter((p) => p.status !== 'INVALIDATED' && p.direction !== 'NEUTRAL')
      .forEach((p) => {
        aiTraderService.applyPlanToChart(p);
      });
  }

  private scanAbortController: AbortController | null = null;

  /**
   * Immediately stops any ongoing watchlist batch scan.
   */
  cancelWatchlistScan(): void {
    if (this.scanAbortController) {
      this.scanAbortController.abort();
      this.scanAbortController = null;
    }
    this.isScanningWatchlist = false;
    this.notify();
  }

  /**
   * Scans all symbols in the user's watchlist sequentially, generating plans and auto-drawing them.
   */
  async scanWatchlist(
    symbols: string[],
    params: { apiKey: string; model: string; fastMode?: boolean },
    onProgress?: (progress: { current: number; total: number; symbol: string; stage: string }) => void
  ): Promise<TradingPlan[]> {
    if (this.isScanningWatchlist) {
      throw new Error('Skanowanie watchlisty jest już w toku.');
    }
    this.isScanningWatchlist = true;
    this.scanAbortController = new AbortController();
    const signal = this.scanAbortController.signal;
    const results: TradingPlan[] = [];

    // fastMode defaults to true for rapid 3-5s scans without heavy vision payload
    const isFast = params.fastMode !== false;

    try {
      for (let i = 0; i < symbols.length; i++) {
        if (signal.aborted) break;

        const symbol = symbols[i];
        const num = i + 1;
        const total = symbols.length;

        onProgress?.({
          current: num,
          total,
          symbol,
          stage: `Pobieranie świec i wskaźników z Binance (${symbol})...`,
        });

        try {
          // 1. Gather snapshot for this symbol (15m execution + 4h macro)
          const snapshot = await aiTraderService.gatherSymbolSnapshot(
            symbol,
            '15m',
            true,
            !isFast // if fastMode, skip heavy off-screen screenshots
          );

          if (signal.aborted) break;

          if (!snapshot) {
            onProgress?.({
              current: num,
              total,
              symbol,
              stage: `Brak danych rynkowych dla ${symbol} – pomijam`,
            });
            continue;
          }

          onProgress?.({
            current: num,
            total,
            symbol,
            stage: `Zapytanie do AI (${params.model}). Czekam na strategię...`,
          });

          // 2. Generate strategic plan via Brain with signal and 35s timeout
          const plan = await aiTraderService.generateStrategyPlan({
            apiKey: params.apiKey,
            model: params.model,
            snapshot,
            signal,
            timeoutMs: 35000,
          });

          if (signal.aborted) break;

          if (plan && plan.direction !== 'NEUTRAL') {
            this.addPlan(plan, true);
            results.push(plan);
            onProgress?.({
              current: num,
              total,
              symbol,
              stage: `✅ Gotowe! Wykryto setup ${plan.direction} na ${symbol}`,
            });
          } else {
            onProgress?.({
              current: num,
              total,
              symbol,
              stage: `Rynek neutralny dla ${symbol} (brak setupu o R:R > 2.5)`,
            });
          }
        } catch (symErr: any) {
          if (signal.aborted) break;
          console.warn(`Watchlist scan error on ${symbol}:`, symErr);
          onProgress?.({
            current: num,
            total,
            symbol,
            stage: `⚠️ ${symErr.message || 'Błąd analizy dla tej monety'}`,
          });
        }

        // Brief 1s delay before next coin if not aborted
        if (i < symbols.length - 1 && !signal.aborted) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      this.isScanningWatchlist = false;
      this.scanAbortController = null;
      this.notify();
    }

    return results;
  }
}

export const setupGuardService = new SetupGuardService();
