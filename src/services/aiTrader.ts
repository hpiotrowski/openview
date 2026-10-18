import { CipherBCalculator } from './cipherB';
import { VolumeProfileCalculator } from './volumeProfile';
import { SessionVolumeCalculator } from './sessionVolume';
import { SMCCalculator } from './smc';
import { SupplyDemandCalculator } from './supplyDemand';
import { CVDCalculator } from './cvd';
import { NakedPocCalculator } from './nakedPoc';
import { HtfLevelsCalculator } from './htfLevels';
import { LiquidationHeatmapCalculator } from './liquidationHeatmap';
import { StorageService } from './storage';
import { chartRegistry } from './chartRegistry';
import { BinanceService, KLineBar } from './binance';
import { KLineData } from 'klinecharts';

export interface HTFAnalysis {
  timeframe: string;
  trend: string;
  poc: number;
  vah: number;
  val: number;
  wt1: number;
  wt2: number;
  mfi: number;
  momentum: 'RISING' | 'FALLING' | 'OVERSOLD' | 'OVERBOUGHT';
  nearestBullishOB: [number, number] | null;
  nearestBearishOB: [number, number] | null;
}

export type PlanStatus = 'PENDING' | 'IN_ZONE' | 'TRIGGERED' | 'INVALIDATED';

export interface GuardRules {
  entryZone: [number, number];
  targetPrice: number;
  stopLoss: number;
  invalidationPrice: number;
  invalidationReason: string;
  requiredCipherSignal: 'GREEN_DOT' | 'RED_DOT' | 'GOLD_DOT' | 'MFI_ABOVE_ZERO' | 'NONE';
  cancelIfTpHitFirst: boolean;
  expiresAt: number;
}

export interface TradingPlan {
  id: string;
  createdAt: number;
  symbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  status?: PlanStatus;
  invalidationReason?: string;
  distanceToEntryPct?: number;
  title: string;
  summary: string;
  marketStructure: {
    bias: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    keyLevel: number;
    trendComment: string;
  };
  setup: {
    entryPrice: number;
    entryZone: [number, number];
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskRewardRatio: number;
    riskPercent: number;
    rewardPercent: number;
  };
  cipherBAnalysis: {
    wtCondition: string;
    mfiTrend: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL';
    expectedTrigger: string;
  };
  jevCriteria: {
    targetZoneMin: number;
    targetZoneMax: number;
    requiredCipherSignal: 'GREEN_DOT' | 'RED_DOT' | 'GOLD_DOT' | 'MFI_ABOVE_ZERO' | 'NONE';
    invalidationPrice: number;
    executionTrigger: string;
  };
  guardRules?: GuardRules;
  htfContext?: {
    macro: HTFAnalysis;
    structure: HTFAnalysis;
  };
  kronos?: KronosConsensus;
  appliedToChart?: boolean;
}

export interface KronosConsensus {
  status: 'VERIFIED' | 'VETOED' | 'OFFLINE';
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  driftPct?: number;
  confidence?: number;
  envelopeLow?: number;
  envelopeHigh?: number;
  meanPath?: number[];
  latencyMs?: number;
}

export interface JevDecision {
  decision: 'ENTER' | 'WAIT' | 'INVALIDATED';
  confidence: number;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: number;
}

export interface MarketSnapshot {
  symbol: string;
  interval: string;
  currentPrice: number;
  barsCount: number;
  cipherB: {
    wt1: number;
    wt2: number;
    mfi: number;
    hasBuyDot: boolean;
    hasSellDot: boolean;
    hasGoldDot: boolean;
  };
  volumeProfile: {
    poc: number;
    vah: number;
    val: number;
  } | null;
  sessionVolume: {
    todayPOC: number;
    todayVAH: number;
    todayVAL: number;
  } | null;
  smc: {
    bullishOB: [number, number] | null;
    bearishOB: [number, number] | null;
    fvgRange: [number, number] | null;
    trendBias: string;
  } | null;
  supplyDemand: {
    nearestDemand: [number, number] | null;
    nearestSupply: [number, number] | null;
  } | null;
  cvd?: {
    delta: number;
    cvd: number;
    divergence: 'BULLISH' | 'BEARISH' | null;
  } | null;
  nakedPocs?: Array<{
    price: number;
    date: string;
    distancePct: number;
  }> | null;
  htfLevels?: {
    pdh?: number;
    pdl?: number;
    pwh?: number;
    pwl?: number;
    mondayHigh?: number;
    mondayLow?: number;
  } | null;
  liquidationMagnet?: {
    price: number;
    type: 'SHORT_LIQ' | 'LONG_LIQ';
    leverage: string;
    distancePct: number;
  } | null;
  htfContext?: {
    macro: HTFAnalysis;
    structure: HTFAnalysis;
  };
  imageBase64: string | null;
  htfImageBase64?: string | null;
}

export interface AISettings {
  apiKey: string;
  brainModel: string;
  jevModel: string;
  autoSentinel: boolean;
}

export type AIProvider = 'opencode' | 'openrouter';

export function cleanApiKey(rawKey: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();
  key = key.replace(/^["']+|["']+$/g, '');
  key = key.replace(/^Bearer\s+/i, '');
  return key.trim();
}

export function detectProvider(apiKey: string): AIProvider {
  const clean = cleanApiKey(apiKey);
  if (clean.startsWith('oc_sk_')) {
    return 'opencode';
  }
  return 'openrouter';
}

export const OPENCODE_BRAIN_PRESETS = [
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash (Vision + Błyskawiczny - Rekomendowany)', isRecommended: true },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (Głębokie rozumowanie)', isRecommended: false },
  { id: 'kimi-k3', name: 'Kimi K3 (Vision + 1M Context)', isRecommended: false },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash (Vision + Niski koszt)', isRecommended: false },
  { id: 'longcat-2.5-preview-free', name: 'LongCat 2.5 Preview (Darmowy / Free)', isRecommended: false },
  { id: 'beam-free', name: 'Beam Free (Darmowy / Free)', isRecommended: false },
  { id: 'space-bunny', name: 'Space Bunny', isRecommended: false },
  { id: 'custom', name: 'Inny model OpenCode...', isRecommended: false },
];

export const OPENCODE_JEV_PRESETS = [
  { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash (~150ms - Rekomendowany Egzekutor)', isRecommended: true },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash (Ultra szybki)', isRecommended: false },
  { id: 'beam-free', name: 'Beam Free ($0.00 / Free)', isRecommended: false },
  { id: 'longcat-2.5-preview-free', name: 'LongCat 2.5 ($0.00 / Free)', isRecommended: false },
  { id: 'space-bunny', name: 'Space Bunny', isRecommended: false },
  { id: 'custom', name: 'Inny identyfikator Jeva...', isRecommended: false },
];

export const OPENROUTER_BRAIN_PRESETS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Rekomendowany Mózg)', isRecommended: true },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Błyskawiczny)', isRecommended: false },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isRecommended: false },
  { id: 'custom', name: 'Inny model OpenRouter...', isRecommended: false },
];

export const OPENROUTER_JEV_PRESETS = [
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Rekomendowany Egzekutor)', isRecommended: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isRecommended: false },
  { id: 'custom', name: 'Własny identyfikator Jeva...', isRecommended: false },
];

// Backward-compatible fallback presets
export const BRAIN_MODEL_PRESETS = OPENCODE_BRAIN_PRESETS;
export const JEV_MODEL_PRESETS = OPENCODE_JEV_PRESETS;

export function combineSignals(s1?: AbortSignal, s2?: AbortSignal): AbortSignal | undefined {
  if (!s1) return s2;
  if (!s2) return s1;
  if ('any' in AbortSignal && typeof (AbortSignal as any).any === 'function') {
    return (AbortSignal as any).any([s1, s2]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  s1.addEventListener('abort', onAbort, { once: true });
  s2.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

export function getProviderConfig(apiKey: string): {
  provider: AIProvider;
  chatUrl: string;
  testUrl: string;
  headers: Record<string, string>;
} {
  const clean = cleanApiKey(apiKey);
  const provider = detectProvider(clean);
  const isDev = import.meta.env.DEV;

  if (provider === 'opencode') {
    const base = isDev ? '/api/opencode' : 'https://opencode.ai';
    return {
      provider,
      chatUrl: `${base}/inference/go/openai/v1/chat/completions`,
      testUrl: `${base}/console/api/v2/config`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clean}`,
        'x-opencode-session': `openview-session-${Date.now()}`,
        'User-Agent': 'openview-copilot/1.0',
      },
    };
  } else {
    const base = isDev ? '/api/openrouter' : 'https://openrouter.ai';
    return {
      provider,
      chatUrl: `${base}/api/v1/chat/completions`,
      testUrl: `${base}/api/v1/auth/key`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clean}`,
        'HTTP-Referer': 'https://openview.local',
        'X-Title': 'OpenView Crypto AI Copilot',
      },
    };
  }
}

function getHigherTimeframes(currentInterval: string): { macro: string; structure: string } {
  const norm = currentInterval.toLowerCase();
  if (norm.includes('s') || norm === '1m' || norm === '3m') {
    return { macro: '1h', structure: '15m' };
  }
  if (norm === '5m') {
    return { macro: '4h', structure: '1h' };
  }
  if (norm === '15m' || norm === '30m') {
    return { macro: '4h', structure: '1h' };
  }
  if (norm === '1h' || norm === '2h') {
    return { macro: '1d', structure: '4h' };
  }
  if (norm === '4h') {
    return { macro: '1w', structure: '1d' };
  }
  return { macro: '4h', structure: '1h' };
}

function analyzeHTF(timeframe: string, bars: KLineBar[]): HTFAnalysis | null {
  if (!bars || bars.length < 15) return null;

  const safeBars = bars.map((b) => ({
    timestamp: b.timestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume ?? 0,
    turnover: b.turnover,
  }));

  const cipher = CipherBCalculator.calculate(safeBars as any);
  const lastC = cipher[cipher.length - 1] || { wt1: 0, wt2: 0, mfi: 0 };

  let momentum: 'RISING' | 'FALLING' | 'OVERSOLD' | 'OVERBOUGHT' = 'RISING';
  if (lastC.wt1 <= -45) momentum = 'OVERSOLD';
  else if (lastC.wt1 >= 45) momentum = 'OVERBOUGHT';
  else if (lastC.wt1 > lastC.wt2) momentum = 'RISING';
  else momentum = 'FALLING';

  let poc = 0;
  let vah = 0;
  let val = 0;
  try {
    const vp = VolumeProfileCalculator.calculate(safeBars as any, 30);
    if (vp) {
      poc = Math.round(vp.pocPrice * 100) / 100;
      vah = Math.round(vp.vahPrice * 100) / 100;
      val = Math.round(vp.valPrice * 100) / 100;
    }
  } catch (e) {}

  let trend = 'CONSOLIDATION';
  let nearestBullishOB: [number, number] | null = null;
  let nearestBearishOB: [number, number] | null = null;
  try {
    const smc = SMCCalculator.calculate(bars as any);
    const lastBreak = smc.breaks[smc.breaks.length - 1];
    if (lastBreak) {
      trend = `${lastBreak.direction} ${lastBreak.type}`;
    }
    const bullOB = smc.orderBlocks.find((ob) => ob.type === 'BULLISH' && !ob.isMitigated);
    if (bullOB) nearestBullishOB = [bullOB.bottom, bullOB.top];
    const bearOB = smc.orderBlocks.find((ob) => ob.type === 'BEARISH' && !ob.isMitigated);
    if (bearOB) nearestBearishOB = [bearOB.bottom, bearOB.top];
  } catch (e) {}

  return {
    timeframe,
    trend,
    poc,
    vah,
    val,
    wt1: Math.round(lastC.wt1 * 10) / 10,
    wt2: Math.round(lastC.wt2 * 10) / 10,
    mfi: Math.round(lastC.mfi * 10) / 10,
    momentum,
    nearestBullishOB,
    nearestBearishOB,
  };
}

class AITraderService {
  private activeSentinelInterval: any = null;
  private sentinelSubscribers = new Set<(decision: JevDecision) => void>();
  private sentinelLogs: JevDecision[] = [];

  /**
   * Sound alert with WebAudio synthesizer for trade triggers
   */
  playTriggerChime(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // First beep (C6 = 1046 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Second higher chime (E6 = 1318 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.15);
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  }

  /**
   * Harvests multi-dimensional market data, background HTF analysis, and high-res chart screenshot
   */
  async gatherMarketSnapshot(chartId?: string, fetchHTF = true): Promise<MarketSnapshot | null> {
    const controller = chartRegistry.getActive(chartId);
    if (!controller) return null;

    const bars: KLineData[] = controller.getBars();
    if (!bars || bars.length === 0) return null;

    return this.buildSnapshotFromBars(
      controller.symbol,
      controller.interval,
      bars,
      fetchHTF,
      controller.getSnapshotBase64()
    );
  }

  /**
   * Gathers full multi-dimensional snapshot for any symbol without needing an open chart pane
   */
  async gatherSymbolSnapshot(
    symbol: string,
    interval = '15m',
    fetchHTF = true,
    includeScreenshots = true
  ): Promise<MarketSnapshot | null> {
    const bars = await BinanceService.fetchKlines(symbol, interval, 300);
    if (!bars || bars.length === 0) return null;
    return this.buildSnapshotFromBars(symbol, interval, bars as any, fetchHTF, null, includeScreenshots);
  }

  /**
   * Universal snapshot builder from klines
   */
  async buildSnapshotFromBars(
    symbol: string,
    interval: string,
    bars: KLineData[],
    fetchHTF = true,
    fallbackImageBase64?: string | null,
    includeScreenshots = true
  ): Promise<MarketSnapshot | null> {
    const currentBar = bars[bars.length - 1];
    const currentPrice = currentBar.close;

    // Background fetch of Multi-Timeframe data (e.g. 4h Macro & 1h Structure)
    let htfContext: { macro: HTFAnalysis; structure: HTFAnalysis } | undefined = undefined;
    let htfImageBase64: string | null = null;
    if (fetchHTF) {
      try {
        const { macro, structure } = getHigherTimeframes(interval);
        const [macroBars, structBars] = await Promise.all([
          BinanceService.fetchKlines(symbol, macro, 100),
          BinanceService.fetchKlines(symbol, structure, 100),
        ]);

        const macroAnalysis = analyzeHTF(macro, macroBars);
        const structAnalysis = analyzeHTF(structure, structBars);

        if (macroAnalysis && structAnalysis) {
          htfContext = {
            macro: macroAnalysis,
            structure: structAnalysis,
          };
        }

        // Render off-screen HTF macro chart screenshot in the background (only if screenshots enabled)
        if (includeScreenshots) {
          try {
            htfImageBase64 = await chartRegistry.renderBackgroundChartSnapshot(
              macroBars as any,
              {
                symbol,
                interval: macro,
                includeVol: true,
                includeCipherB: false,
                barSpace: 10,
                offsetRight: 80,
              }
            );
          } catch (renderErr) {
            console.warn('Background HTF chart render failed:', renderErr);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch background HTF context from Binance:', err);
      }
    }

    // 1. Cipher B calculation (Current chart timeframe)
    const cipherResults = CipherBCalculator.calculate(bars);
    const lastCipher = cipherResults[cipherResults.length - 1] || {
      wt1: 0,
      wt2: 0,
      mfi: 0,
      buyDot: null,
      sellDot: null,
      goldDot: null,
    };

    // Lookback last 3 bars for dots
    const recentBars = cipherResults.slice(-4);
    const hasBuyDot = recentBars.some((r) => r.buyDot !== null);
    const hasSellDot = recentBars.some((r) => r.sellDot !== null);
    const hasGoldDot = recentBars.some((r) => r.goldDot !== null);

    // Prepare bars with guaranteed volume for indicators expecting KLineBar
    const safeBars = bars.map((b) => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
      turnover: b.turnover,
    }));

    // 2. Volume Profile calculation
    let vpResult = null;
    try {
      const vp = VolumeProfileCalculator.calculate(safeBars as any, 36);
      if (vp && vp.pocPrice > 0) {
        vpResult = {
          poc: vp.pocPrice,
          vah: vp.vahPrice,
          val: vp.valPrice,
        };
      }
    } catch (e) {}

    // 3. Daily Session Volume calculation
    let svResult = null;
    try {
      const sv = SessionVolumeCalculator.calculate(safeBars as any);
      if (sv && sv.sessions.length > 0) {
        const lastSession = sv.sessions[sv.sessions.length - 1];
        svResult = {
          todayPOC: lastSession.pocPrice,
          todayVAH: lastSession.vahPrice,
          todayVAL: lastSession.valPrice,
        };
      }
    } catch (e) {}

    // 4. SMC Calculation
    let smcSummary = null;
    try {
      const smc = SMCCalculator.calculate(bars);
      const activeBullishOB = smc.orderBlocks.find((ob) => ob.type === 'BULLISH' && !ob.isMitigated);
      const activeBearishOB = smc.orderBlocks.find((ob) => ob.type === 'BEARISH' && !ob.isMitigated);
      const activeFVG = smc.fvgs.find((f) => !f.isMitigated);
      const lastBreak = smc.breaks[smc.breaks.length - 1];

      smcSummary = {
        bullishOB: activeBullishOB ? ([activeBullishOB.bottom, activeBullishOB.top] as [number, number]) : null,
        bearishOB: activeBearishOB ? ([activeBearishOB.bottom, activeBearishOB.top] as [number, number]) : null,
        fvgRange: activeFVG ? ([activeFVG.bottom, activeFVG.top] as [number, number]) : null,
        trendBias: lastBreak ? `${lastBreak.direction} ${lastBreak.type}` : 'CONSOLIDATION',
      };
    } catch (e) {}

    // 5. Supply & Demand
    let sdSummary = null;
    try {
      const sd = SupplyDemandCalculator.calculate(bars);
      const demand = sd.zones.find((z) => z.type === 'DEMAND' && !z.isTested);
      const supply = sd.zones.find((z) => z.type === 'SUPPLY' && !z.isTested);
      sdSummary = {
        nearestDemand: demand ? ([demand.bottom, demand.top] as [number, number]) : null,
        nearestSupply: supply ? ([supply.bottom, supply.top] as [number, number]) : null,
      };
    } catch (e) {}

    // 6. Screenshot: Render crisp execution chart in background with Cipher B (if enabled)
    // (Never distorts, zooms or interrupts the user's active screen view!)
    let imageBase64: string | null = null;
    if (includeScreenshots) {
      try {
        imageBase64 = await chartRegistry.renderBackgroundChartSnapshot(bars, {
          symbol,
          interval,
          includeCipherB: true,
          includeVol: true,
          barSpace: 9,
          offsetRight: 90,
        });
      } catch (e) {
        console.warn('Background chart render failed, falling back to container snapshot:', e);
      }
      if (!imageBase64 || imageBase64.length < 4000) {
        imageBase64 = fallbackImageBase64 || null;
      }
    }

    // 7. Cumulative Volume Delta (CVD & Divergences)
    let cvdSummary = null;
    try {
      const cvdResults = CVDCalculator.calculate(safeBars as any);
      if (cvdResults.length > 0) {
        const last = cvdResults[cvdResults.length - 1];
        cvdSummary = {
          delta: last.delta,
          cvd: last.cvd,
          divergence: last.divergence,
        };
      }
    } catch (e) {}

    // 8. Naked POC (Virgin POC Targets)
    let nakedPocsSummary = null;
    try {
      const npoc = NakedPocCalculator.calculate(safeBars as any, 10);
      if (npoc && npoc.items.length > 0) {
        nakedPocsSummary = npoc.items
          .filter((p) => !p.isMitigated)
          .slice(0, 4)
          .map((p) => ({
            price: Math.round(p.pocPrice * 100) / 100,
            date: p.dateStr,
            distancePct: Math.round(p.distancePercent * 10) / 10,
          }));
      }
    } catch (e) {}

    // 9. HTF Key Levels (PDH, PDL, Monday High/Low, Weekly Open)
    let htfLevelsSummary = null;
    try {
      const htfL = HtfLevelsCalculator.calculate(safeBars as any);
      if (htfL) {
        htfLevelsSummary = {
          pdh: htfL.pdh ? Math.round(htfL.pdh * 100) / 100 : undefined,
          pdl: htfL.pdl ? Math.round(htfL.pdl * 100) / 100 : undefined,
          pwh: htfL.pwh ? Math.round(htfL.pwh * 100) / 100 : undefined,
          pwl: htfL.pwl ? Math.round(htfL.pwl * 100) / 100 : undefined,
          mondayHigh: htfL.mondayHigh ? Math.round(htfL.mondayHigh * 100) / 100 : undefined,
          mondayLow: htfL.mondayLow ? Math.round(htfL.mondayLow * 100) / 100 : undefined,
        };
      }
    } catch (e) {}

    // 10. Liquidation Heatmap Clusters
    let liqSummary = null;
    try {
      const liq = LiquidationHeatmapCalculator.calculate(safeBars as any);
      if (liq && liq.magnetCluster) {
        liqSummary = {
          price: Math.round(liq.magnetCluster.price * 100) / 100,
          type: liq.magnetCluster.type,
          leverage: liq.magnetCluster.leverage,
          distancePct: Math.round(liq.magnetCluster.distancePct * 10) / 10,
        };
      }
    } catch (e) {}

    return {
      symbol,
      interval,
      currentPrice,
      barsCount: bars.length,
      cipherB: {
        wt1: Math.round(lastCipher.wt1 * 10) / 10,
        wt2: Math.round(lastCipher.wt2 * 10) / 10,
        mfi: Math.round(lastCipher.mfi * 10) / 10,
        hasBuyDot,
        hasSellDot,
        hasGoldDot,
      },
      cvd: cvdSummary,
      nakedPocs: nakedPocsSummary,
      htfLevels: htfLevelsSummary,
      liquidationMagnet: liqSummary,
      volumeProfile: vpResult,
      sessionVolume: svResult,
      smc: smcSummary,
      supplyDemand: sdSummary,
      htfContext,
      imageBase64,
      htfImageBase64,
    };
  }

  /**
   * Request Strategy Setup from the Thinking Brain (Claude / Gemini)
   */
  async generateStrategyPlan(params: {
    apiKey: string;
    model: string;
    snapshot: MarketSnapshot;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<TradingPlan> {
    const { apiKey, model, snapshot } = params;

    const cleanKey = cleanApiKey(apiKey);
    if (!cleanKey || cleanKey === 'undefined' || cleanKey === 'null') {
      throw new Error('Klucz OpenRouter API Key jest pusty lub niepoprawny. Wklej swój klucz w zakładce Ustawienia (np. sk-or-v1-...).');
    }

    const systemPrompt = `You are an elite, institutional crypto proprietary trader.
Your mission is to analyze the multi-timeframe quantitative market data, institutional order flow metrics, and the attached high-fidelity chart screenshots for ${snapshot.symbol} (Execution timeframe: ${snapshot.interval}, Live Market Price: $${snapshot.currentPrice}).

OBJECTIVE:
Formulate the most logical, high-expectancy trading plan based on real market structure (SMC, Order Blocks, Liquidity Sweeps, CVD absorptions, Volume Profile, and Market Cipher B).
If the market is in erratic consolidation, low-conviction chop, or lacks a clear statistical edge from the current market structure, choose direction: "NEUTRAL". Capital preservation is priority #1.

TRADING GUIDELINES:
1. Direction: "LONG", "SHORT", or "NEUTRAL".
2. Order Location & Execution:
   - Formulate a realistic, actionable entry plan that makes sense in the current market context.
   - You may propose an entry near current market price (if price is currently reacting to/retesting a key level), OR a limit order on a natural pullback/retest into an unmitigated Order Block, Fair Value Gap (FVG), or Demand/Supply zone.
   - Avoid proposing distant levels that have no relevance to the current price action.
3. Logical Risk Management:
   - For LONG: Stop Loss must be placed below a logical structural invalidation level (e.g. recent swing low or Order Block base). Targets (TP1, TP2) must offer a positive risk-to-reward ratio.
   - For SHORT: Stop Loss must be placed above a logical structural invalidation level (e.g. recent swing high or Order Block top). Targets (TP1, TP2) must offer a positive risk-to-reward ratio.
4. Summary & Thesis:
   - Provide a concise, clear explanation in Polish explaining the technical thesis behind the trade (why this level, what liquidity was swept, what Cipher B / CVD confirms).

Return ONLY a pure, valid JSON object matching this schema without any markdown code fences, comments, or extra text:
{
  "direction": "LONG" | "SHORT" | "NEUTRAL",
  "confidence": number (1-100),
  "title": string,
  "summary": string,
  "marketStructure": {
    "bias": "BULLISH" | "BEARISH" | "SIDEWAYS",
    "keyLevel": number,
    "trendComment": string
  },
  "setup": {
    "entryPrice": number,
    "entryZone": [number, number],
    "stopLoss": number,
    "takeProfit1": number,
    "takeProfit2": number,
    "riskRewardRatio": number,
    "riskPercent": number,
    "rewardPercent": number
  },
  "cipherBAnalysis": {
    "wtCondition": string,
    "mfiTrend": "INFLOW" | "OUTFLOW" | "NEUTRAL",
    "expectedTrigger": string
  }
}`;

    let htfBreakdown = '';
    if (snapshot.htfContext) {
      const { macro, structure } = snapshot.htfContext;
      htfBreakdown = `
=== HIGHER TIMEFRAME (HTF) QUANTITATIVE REGIME ===
1. Macro HTF (${macro.timeframe}):
   - Trend / Structure: ${macro.trend}
   - Cipher B: WT1 = ${macro.wt1}, WT2 = ${macro.wt2}, MFI = ${macro.mfi} (State: ${macro.momentum})
   - Volume Profile: POC = $${macro.poc || 'N/A'}, VAH = $${macro.vah || 'N/A'}, VAL = $${macro.val || 'N/A'}
   - Key Order Blocks: Bullish OB = ${JSON.stringify(macro.nearestBullishOB || 'none')}, Bearish OB = ${JSON.stringify(macro.nearestBearishOB || 'none')}

2. Structure HTF (${structure.timeframe}):
   - Trend / Structure: ${structure.trend}
   - Cipher B: WT1 = ${structure.wt1}, WT2 = ${structure.wt2}, MFI = ${structure.mfi} (State: ${structure.momentum})
   - Volume Profile: POC = $${structure.poc || 'N/A'}, VAH = $${structure.vah || 'N/A'}, VAL = $${structure.val || 'N/A'}
   - Key Order Blocks: Bullish OB = ${JSON.stringify(structure.nearestBullishOB || 'none')}, Bearish OB = ${JSON.stringify(structure.nearestBearishOB || 'none')}
`;
    }

    let institutionalBlock = '';
    const instParts: string[] = [];

    if (snapshot.cvd) {
      instParts.push(
        `- Cumulative Volume Delta (CVD): Delta = ${snapshot.cvd.delta > 0 ? '+' : ''}${Math.round(
          snapshot.cvd.delta
        )}, Divergence = ${
          snapshot.cvd.divergence
            ? `${snapshot.cvd.divergence} DIVERGENCE (Absorption detected)`
            : 'None'
        }`
      );
    }

    if (snapshot.nakedPocs && snapshot.nakedPocs.length > 0) {
      const pocList = snapshot.nakedPocs
        .map((p) => `$${p.price} (${p.distancePct > 0 ? '+' : ''}${p.distancePct}%, ${p.date})`)
        .join(', ');
      instParts.push(`- Virgin / Naked POCs (Unmitigated High-Volume Magnets): ${pocList}`);
    }

    if (snapshot.htfLevels) {
      const { pdh, pdl, pwh, pwl, mondayHigh, mondayLow } = snapshot.htfLevels;
      const levels: string[] = [];
      if (pdh) levels.push(`PDH: $${pdh}`);
      if (pdl) levels.push(`PDL: $${pdl}`);
      if (pwh) levels.push(`PWH: $${pwh}`);
      if (pwl) levels.push(`PWL: $${pwl}`);
      if (mondayHigh) levels.push(`Monday High: $${mondayHigh}`);
      if (mondayLow) levels.push(`Monday Low: $${mondayLow}`);
      if (levels.length > 0) {
        instParts.push(`- HTF Key Levels / Session Liquidity: ${levels.join(' | ')}`);
      }
    }

    if (snapshot.liquidationMagnet) {
      instParts.push(
        `- Liquidation Heatmap Magnet Cluster: $${snapshot.liquidationMagnet.price} (${
          snapshot.liquidationMagnet.type === 'SHORT_LIQ' ? 'Short Squeeze' : 'Long Flush'
        }, ~${snapshot.liquidationMagnet.leverage} leverage cluster, distance: ${
          snapshot.liquidationMagnet.distancePct
        }%)`
      );
    }

    if (instParts.length > 0) {
      institutionalBlock = `
=== INSTITUTIONAL ORDER FLOW & LIQUIDITY FILTERS ===
${instParts.join('\n')}
`;
    }

    const userMessageContent: any[] = [
      {
        type: 'text',
        text: `Analyze current market data for ${snapshot.symbol}:

${htfBreakdown}
${institutionalBlock}
=== EXECUTION TIMEFRAME (${snapshot.interval}) - ATTACHED SCREENSHOT & LOCAL DATA ===
Current Live Price: $${snapshot.currentPrice}
Cipher B (${snapshot.interval}): WT1 = ${snapshot.cipherB.wt1}, WT2 = ${snapshot.cipherB.wt2}, MFI = ${snapshot.cipherB.mfi}, Recent BuyDot = ${snapshot.cipherB.hasBuyDot}, SellDot = ${snapshot.cipherB.hasSellDot}, GoldDot = ${snapshot.cipherB.hasGoldDot}
Volume Profile (${snapshot.interval}): POC = $${snapshot.volumeProfile?.poc ?? 'N/A'}, VAH = $${snapshot.volumeProfile?.vah ?? 'N/A'}, VAL = $${snapshot.volumeProfile?.val ?? 'N/A'}
Daily Session POC: $${snapshot.sessionVolume?.todayPOC ?? 'N/A'}
SMC Trend Bias (${snapshot.interval}): ${snapshot.smc?.trendBias ?? 'N/A'}, Bullish OB: ${JSON.stringify(snapshot.smc?.bullishOB ?? 'none')}, Bearish OB: ${JSON.stringify(snapshot.smc?.bearishOB ?? 'none')}
Demand Zone: ${JSON.stringify(snapshot.supplyDemand?.nearestDemand ?? 'none')}, Supply Zone: ${JSON.stringify(snapshot.supplyDemand?.nearestSupply ?? 'none')}

Review the visual chart screenshots attached below (both rendered off-screen with optimal framing and high fidelity):
1. Macro HTF Chart (${snapshot.htfContext?.macro.timeframe || '4h'}): Key swings, volume, and macro trend.
2. Execution Chart (${snapshot.interval}): Candle anatomy, wicks, zones, and Market Cipher B (WaveTrend & MFI).

Formulate a trading plan conforming to the Macro HTF bias with execution on ${snapshot.interval}.
Return strictly the JSON trade plan.`,
      },
    ];

    if (snapshot.htfImageBase64) {
      userMessageContent.push({
        type: 'text',
        text: `Attached Image 1: Higher Timeframe Macro Chart (${snapshot.htfContext?.macro.timeframe || '4h'}) rendered in background (showing macro candle structure, swings, and volume context):`,
      });
      userMessageContent.push({
        type: 'image_url',
        image_url: {
          url: snapshot.htfImageBase64,
        },
      });
    }

    if (snapshot.imageBase64) {
      userMessageContent.push({
        type: 'text',
        text: `Attached Image ${snapshot.htfImageBase64 ? '2' : '1'}: Execution Timeframe Chart (${snapshot.interval}) rendered in background with Cipher B + Volume (showing exact candle anatomy, wicks, zones, and Cipher B wave slope):`,
      });
      userMessageContent.push({
        type: 'image_url',
        image_url: {
          url: snapshot.imageBase64,
        },
      });
    }

    const config = getProviderConfig(cleanKey);

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), params.timeoutMs || 40000);
    const effectiveSignal = combineSignals(params.signal, timeoutController.signal);

    // Launch Kronos statistical forecast in parallel with LLM Brain (Double-Blind execution)
    const kronosPromise = this.fetchKronosForecast(snapshot.symbol, snapshot.interval);

    let response: Response;
    try {
      response = await fetch(config.chatUrl, {
        method: 'POST',
        headers: config.headers,
        signal: effectiveSignal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent },
          ],
          temperature: 0.2,
        }),
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        if (params.signal?.aborted) {
          throw new Error('Skanowanie zostało anulowane przez użytkownika.');
        }
        throw new Error(
          `Przekroczono limit czasu oczekiwania na model AI (${Math.round(
            (params.timeoutMs || 40000) / 1000
          )}s). Serwer AI nie odpowiedział na czas.`
        );
      }
      throw fetchErr;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `${config.provider === 'opencode' ? 'OpenCode' : 'OpenRouter'} API Błąd (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        const rawMsg = errJson.error?.message || errJson.message || '';
        if (rawMsg.includes('Insufficient account funds')) {
          errorMsg = 'Brak środków na koncie OpenCode (Insufficient account funds). Doładuj konto na opencode.ai lub skorzystaj z modeli w pakiecie OpenCode Go (np. deepseek-v4.1-flash, beam-free, kimi-k3).';
        } else if (errJson.error?.type === 'FreeTierError' || rawMsg.includes('FreeTierError')) {
          errorMsg = 'Model -free poza OpenCode Go jest zablokowany poza oficjalną aplikacją OpenCode. Użyj modelu deepseek-v4.1-flash lub beam-free z OpenCode Go.';
        } else if (rawMsg) {
          errorMsg = `${config.provider === 'opencode' ? 'OpenCode' : 'OpenRouter'}: ${rawMsg}`;
        }
      } catch (e) {
        if (errText) errorMsg += `: ${errText.slice(0, 150)}`;
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Clean JSON markdown blocks if any exist
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Attempt substring regex recovery
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Model nie zwrócił poprawnego formatu JSON. Spróbuj ponownie.');
      }
    }

    const plan: TradingPlan = {
      id: `plan_${Date.now()}`,
      createdAt: Date.now(),
      symbol: snapshot.symbol,
      timeframe: snapshot.interval,
      direction: parsed.direction || 'NEUTRAL',
      confidence: parsed.confidence || 75,
      title: parsed.title || `${snapshot.symbol} ${parsed.direction || 'Setup'}`,
      summary: parsed.summary || 'Analiza przygotowana przez AI Mózg.',
      marketStructure: parsed.marketStructure || {
        bias: 'SIDEWAYS',
        keyLevel: snapshot.currentPrice,
        trendComment: '',
      },
      setup: {
        entryPrice: Number(parsed.setup?.entryPrice) || snapshot.currentPrice,
        entryZone: parsed.setup?.entryZone || [snapshot.currentPrice * 0.995, snapshot.currentPrice * 1.005],
        stopLoss: Number(parsed.setup?.stopLoss) || snapshot.currentPrice * 0.98,
        takeProfit1: Number(parsed.setup?.takeProfit1) || snapshot.currentPrice * 1.05,
        takeProfit2: Number(parsed.setup?.takeProfit2) || snapshot.currentPrice * 1.08,
        riskRewardRatio: Number(parsed.setup?.riskRewardRatio) || 2.5,
        riskPercent: Number(parsed.setup?.riskPercent) || 1.5,
        rewardPercent: Number(parsed.setup?.rewardPercent) || 4.5,
      },
      cipherBAnalysis: parsed.cipherBAnalysis || {
        wtCondition: 'Neutral',
        mfiTrend: 'NEUTRAL',
        expectedTrigger: 'Oczekiwanie na sygnał',
      },
      jevCriteria: parsed.jevCriteria || {
        targetZoneMin: snapshot.currentPrice * 0.995,
        targetZoneMax: snapshot.currentPrice * 1.005,
        requiredCipherSignal: 'NONE',
        invalidationPrice: snapshot.currentPrice * 0.98,
        executionTrigger: 'Cena w strefie',
      },
      htfContext: snapshot.htfContext,
      appliedToChart: false,
    };

    // Logical Sanity Guard (only filter out mathematically broken numbers or extreme hallucinations)
    if (plan.direction === 'SHORT') {
      const isTpIllogical = plan.setup.takeProfit1 >= plan.setup.entryPrice;
      const isSlIllogical = plan.setup.stopLoss <= plan.setup.entryPrice;
      const isEntryExtremelyFar = Math.abs(plan.setup.entryPrice - snapshot.currentPrice) / snapshot.currentPrice > 0.08;
      if (isTpIllogical || isSlIllogical || isEntryExtremelyFar) {
        console.warn('AI generated an illogical SHORT setup:', plan.setup);
        plan.direction = 'NEUTRAL';
        plan.title = `${snapshot.symbol} NEUTRAL - Oczekiwanie na klarowność`;
        plan.summary = `Brak spójnego układu poziomów dla pozycji krótkiej (błędna relacja celu lub stop lossa). Zalecane oczekiwanie na nową strukturę.`;
      }
    } else if (plan.direction === 'LONG') {
      const isTpIllogical = plan.setup.takeProfit1 <= plan.setup.entryPrice;
      const isSlIllogical = plan.setup.stopLoss >= plan.setup.entryPrice;
      const isEntryExtremelyFar = Math.abs(plan.setup.entryPrice - snapshot.currentPrice) / snapshot.currentPrice > 0.08;
      if (isTpIllogical || isSlIllogical || isEntryExtremelyFar) {
        console.warn('AI generated an illogical LONG setup:', plan.setup);
        plan.direction = 'NEUTRAL';
        plan.title = `${snapshot.symbol} NEUTRAL - Oczekiwanie na klarowność`;
        plan.summary = `Brak spójnego układu poziomów dla pozycji długiej (błędna relacja celu lub stop lossa). Zalecane oczekiwanie na nową strukturę.`;
      }
    }

    // 3-Level Consensus & Statistical Radar Validation with Kronos
    try {
      const kronos = await kronosPromise;
      if (kronos && kronos.status === 'VERIFIED') {
        plan.kronos = kronos;
        if (plan.direction === 'LONG') {
          if (kronos.direction === 'BULLISH') {
            if (kronos.envelopeLow && plan.setup.stopLoss > kronos.envelopeLow) {
              plan.summary += `\n\n🛡️ [Konsensus Kronos A+]: Zgodność kierunku (+${kronos.driftPct}%). Dolna wstęga szumu statystycznego sięga $${kronos.envelopeLow.toLocaleString()} – SL zweryfikowany pod kątem fałszywych knotów.`;
            }
          } else if (kronos.direction === 'NEUTRAL') {
            plan.summary += `\n\nℹ️ [Kronos Radar]: Model statystyczny widzi konsolidację (${kronos.confidence}% korytarz $${kronos.envelopeLow}-$${kronos.envelopeHigh}). Mózg celuje w wybicie popytowe z retestu.`;
          } else {
            plan.summary += `\n\n⚠️ [Ostrzeżenie Kronos]: Mózg planuje LONG, ale Kronos wskazuje pęd ${kronos.direction} (${kronos.driftPct}%). Wymagany ścisły Stop Loss.`;
          }
        } else if (plan.direction === 'SHORT') {
          if (kronos.direction === 'BEARISH') {
            if (kronos.envelopeHigh && plan.setup.stopLoss < kronos.envelopeHigh) {
              plan.summary += `\n\n🛡️ [Konsensus Kronos A+]: Zgodność kierunku (${kronos.driftPct}%). Górna wstęga szumu statystycznego sięga $${kronos.envelopeHigh.toLocaleString()} – SL zweryfikowany.`;
            }
          } else if (kronos.direction === 'NEUTRAL') {
            plan.summary += `\n\nℹ️ [Kronos Radar]: Model statystyczny widzi konsolidację (${kronos.confidence}% korytarz $${kronos.envelopeLow}-$${kronos.envelopeHigh}). Mózg celuje w impuls podażowy.`;
          } else {
            plan.summary += `\n\n⚠️ [Ostrzeżenie Kronos]: Mózg planuje SHORT, ale Kronos wskazuje pęd ${kronos.direction} (${kronos.driftPct}%). Wymagany ścisły Stop Loss.`;
          }
        }
      } else {
        plan.kronos = { status: 'OFFLINE' };
      }
    } catch {
      plan.kronos = { status: 'OFFLINE' };
    }

    plan.status = 'PENDING';
    plan.guardRules = {
      entryZone: [
        parsed.guardRules?.entryZone?.[0] ?? parsed.jevCriteria?.targetZoneMin ?? parsed.setup?.entryZone?.[0] ?? plan.setup.entryPrice,
        parsed.guardRules?.entryZone?.[1] ?? parsed.jevCriteria?.targetZoneMax ?? parsed.setup?.entryZone?.[1] ?? plan.setup.entryPrice,
      ],
      targetPrice: Number(parsed.guardRules?.targetPrice) || plan.setup.takeProfit1,
      stopLoss: Number(parsed.guardRules?.stopLoss) || plan.setup.stopLoss,
      invalidationPrice:
        Number(parsed.guardRules?.invalidationPrice) ||
        Number(parsed.jevCriteria?.invalidationPrice) ||
        plan.setup.stopLoss,
      invalidationReason:
        parsed.guardRules?.invalidationReason || 'Wybicie poziomu unieważnienia tezy Mózgu',
      requiredCipherSignal:
        parsed.guardRules?.requiredCipherSignal ||
        parsed.jevCriteria?.requiredCipherSignal ||
        'NONE',
      cancelIfTpHitFirst: true,
      expiresAt: Date.now() + 12 * 3600 * 1000,
    };

    return plan;
  }

  /**
   * Fetch Kronos statistical K-line foundation model forecast
   */
  async fetchKronosForecast(symbol: string, interval: string): Promise<KronosConsensus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(
        `/api/kronos/forecast?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&steps=12&samples=3`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!res.ok) {
        return { status: 'OFFLINE' };
      }
      const data = await res.json();
      return {
        status: 'VERIFIED',
        direction: data.direction,
        driftPct: data.drift_pct,
        confidence: data.confidence,
        envelopeLow: data.envelope_low,
        envelopeHigh: data.envelope_high,
        meanPath: data.mean_path,
        latencyMs: data.latency_ms,
      };
    } catch {
      return { status: 'OFFLINE' };
    }
  }

  /**
   * Evaluate trade condition using Jev (High-speed 1m Sentinel)
   */
  async evaluateJevSentinel(params: {
    apiKey: string;
    model: string;
    plan: TradingPlan;
    snapshot: MarketSnapshot;
  }): Promise<JevDecision> {
    const { apiKey, model, plan, snapshot } = params;

    const prompt = `You are Jev, a high-frequency trading execution guardian.
Evaluate whether the active trading setup for ${plan.symbol} should be ENTERED right now, WAITED for, or INVALIDATED.

Active Plan Setup:
Direction: ${plan.direction}
Entry Target Zone: [${plan.setup.entryZone[0]}, ${plan.setup.entryZone[1]}]
Stop Loss / Invalidation Level: ${plan.setup.stopLoss}
Target TP1: ${plan.setup.takeProfit1}
Required Cipher Signal: ${plan.jevCriteria.requiredCipherSignal}

Live Market State Right Now:
Current Price: $${snapshot.currentPrice}
Cipher B: WT1=${snapshot.cipherB.wt1}, WT2=${snapshot.cipherB.wt2}, MFI=${snapshot.cipherB.mfi}
Signals on Bar: BuyDot=${snapshot.cipherB.hasBuyDot}, SellDot=${snapshot.cipherB.hasSellDot}, GoldDot=${snapshot.cipherB.hasGoldDot}

Instructions:
1. If price has violated stopLoss/invalidation level -> "INVALIDATED".
2. If price is within entry zone AND required Cipher B condition is confirmed -> "ENTER".
3. Otherwise -> "WAIT".

Respond ONLY with this exact JSON format without markdown fences:
{
  "decision": "ENTER" | "WAIT" | "INVALIDATED",
  "confidence": 90,
  "reason": "Clear 1-sentence explanation of current trigger state.",
  "urgency": "HIGH" | "MEDIUM" | "LOW"
}`;

    const cleanKey = cleanApiKey(apiKey);
    if (!cleanKey || cleanKey === 'undefined' || cleanKey === 'null') {
      throw new Error('Klucz API jest pusty lub niepoprawny.');
    }

    const config = getProviderConfig(cleanKey);

    const response = await fetch(config.chatUrl, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jev evaluation failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '{}';
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { decision: 'WAIT', reason: raw };
    }

    const decision: JevDecision = {
      decision: parsed.decision === 'ENTER' || parsed.decision === 'INVALIDATED' ? parsed.decision : 'WAIT',
      confidence: parsed.confidence || 85,
      reason: parsed.reason || 'Skanowanie warunków wejścia w strefę.',
      urgency: parsed.urgency || 'MEDIUM',
      timestamp: Date.now(),
    };

    if (decision.decision === 'ENTER') {
      this.playTriggerChime();
    }

    return decision;
  }

  cleanApiKey(rawKey: string): string {
    return cleanApiKey(rawKey);
  }

  detectProvider(rawKey: string): AIProvider {
    return detectProvider(rawKey);
  }

  /**
   * Verify API key validity against official endpoint (OpenCode or OpenRouter)
   */
  async testApiKey(rawKey: string): Promise<{ ok: boolean; message: string; provider: AIProvider }> {
    const clean = cleanApiKey(rawKey);
    if (!clean || clean === 'undefined' || clean === 'null') {
      return { ok: false, message: 'Wprowadź klucz API (np. oc_sk_... lub sk-or-...)', provider: 'openrouter' };
    }
    const provider = detectProvider(clean);

    if (provider === 'opencode') {
      try {
        const baseUrl = import.meta.env.DEV ? '/api/opencode' : 'https://opencode.ai';
        const res = await fetch(`${baseUrl}/console/api/v2/config`, {
          headers: {
            Authorization: `Bearer ${clean}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          const hasGo = !!json.providers?.['opencode-go'];
          const modelsCount = hasGo ? Object.keys(json.providers['opencode-go'].models || {}).length : 0;
          return {
            ok: true,
            message: hasGo
              ? `✅ Połączono z OpenCode Go! (Subskrypcja aktywna, ${modelsCount} modeli gotowych do działania)`
              : '✅ Połączono z OpenCode Console! (Klucz aktywny)',
            provider: 'opencode',
          };
        } else {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson.error?.message || errJson.message || `Błąd autoryzacji OpenCode (${res.status})`;
          return { ok: false, message: `❌ ${msg}`, provider: 'opencode' };
        }
      } catch (e: any) {
        return { ok: false, message: `❌ Błąd sieci OpenCode: ${e.message}`, provider: 'opencode' };
      }
    } else {
      try {
        const baseUrl = import.meta.env.DEV ? '/api/openrouter' : 'https://openrouter.ai';
        const res = await fetch(`${baseUrl}/api/v1/auth/key`, {
          headers: {
            Authorization: `Bearer ${clean}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          const d = json.data;
          const label = d?.label || 'Klucz aktywny';
          const usage = typeof d?.usage === 'number' ? `$${d.usage.toFixed(2)}` : '$0.00';
          const limit = d?.limit !== null && d?.limit !== undefined ? `$${d.limit}` : 'Bez limitu';
          return {
            ok: true,
            message: `✅ Połączono z OpenRouter! (${label} | Zużycie: ${usage} / Limit: ${limit})`,
            provider: 'openrouter',
          };
        } else {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson.error?.message || `Błąd autoryzacji OpenRouter (${res.status})`;
          return { ok: false, message: `❌ ${msg}`, provider: 'openrouter' };
        }
      } catch (e: any) {
        return { ok: false, message: `❌ Błąd sieci OpenRouter: ${e.message}`, provider: 'openrouter' };
      }
    }
  }

  /**
   * Automatically draws the Long/Short Position Tool onto the active Klinecharts canvas
   */
  applyPlanToChart(plan: TradingPlan, chartId?: string): boolean {
    const controllers = chartRegistry.getAll();
    const matching = controllers.filter((c) => c.symbol === plan.symbol);
    if (matching.length === 0) {
      const active = chartRegistry.getActive(chartId);
      if (active && active.symbol === plan.symbol) {
        matching.push(active);
      }
    }
    if (matching.length === 0) return false;

    if (plan.direction === 'NEUTRAL') {
      return false;
    }

    const direction: 'LONG' | 'SHORT' = plan.direction;

    let success = false;
    matching.forEach((controller) => {
      const res = controller.createPositionOverlay({
        direction,
        entryPrice: plan.setup.entryPrice,
        takeProfit: plan.setup.takeProfit1,
        stopLoss: plan.setup.stopLoss,
        overlayId: `ai_setup_${plan.symbol}`,
      });
      if (res) success = true;
    });

    return success;
  }

  /**
   * Removes a plan's position overlay from matching charts
   */
  removePlanFromChart(plan: TradingPlan): void {
    const controllers = chartRegistry.getAll();
    const matching = controllers.filter((c) => c.symbol === plan.symbol);
    matching.forEach((controller) => {
      if (controller.removePositionOverlay) {
        controller.removePositionOverlay(`ai_setup_${plan.symbol}`);
      }
    });
  }

  /**
   * Optimizes chart view for AI analysis: sets ideal zoom (~85 bars), right margin and scrolls to live candle.
   */
  autoFrameActiveChart(chartId?: string): boolean {
    const controller = chartRegistry.getActive(chartId);
    if (!controller || !controller.autoFrameForAI) return false;
    controller.autoFrameForAI();
    return true;
  }

  /**
   * Sentinel Subscription Management
   */
  subscribeSentinel(cb: (decision: JevDecision) => void): () => void {
    this.sentinelSubscribers.add(cb);
    return () => this.sentinelSubscribers.delete(cb);
  }

  notifySentinel(decision: JevDecision): void {
    this.sentinelLogs = [decision, ...this.sentinelLogs.slice(0, 19)];
    this.sentinelSubscribers.forEach((cb) => cb(decision));
  }

  getSentinelLogs(): JevDecision[] {
    return this.sentinelLogs;
  }
}

export const aiTraderService = new AITraderService();
