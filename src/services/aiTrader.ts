import { CipherBCalculator } from './cipherB';
import { VolumeProfileCalculator } from './volumeProfile';
import { SessionVolumeCalculator } from './sessionVolume';
import { SMCCalculator } from './smc';
import { SupplyDemandCalculator } from './supplyDemand';
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

export interface TradingPlan {
  id: string;
  createdAt: number;
  symbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
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
  htfContext?: {
    macro: HTFAnalysis;
    structure: HTFAnalysis;
  };
  appliedToChart?: boolean;
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
  htfContext?: {
    macro: HTFAnalysis;
    structure: HTFAnalysis;
  };
  imageBase64: string | null;
}

export interface AISettings {
  apiKey: string;
  brainModel: string;
  jevModel: string;
  autoSentinel: boolean;
}

export const BRAIN_MODEL_PRESETS = [
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 ($3.00/1M - Rekomendowany Mózg)', isRecommended: true },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 ($2.00/1M)', isRecommended: false },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 ($2.00/1M)', isRecommended: false },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro ($2.00/1M)', isRecommended: false },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash ($1.50/1M)', isRecommended: false },
  { id: 'deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Flash Vision ($0.14/1M)', isRecommended: false },
  { id: 'nemotron-3.5-super-vl-free', name: 'Nemotron 3.5 Super VL ($0.00 / Free)', isRecommended: false },
  { id: 'custom', name: 'Inny / Własny model...', isRecommended: false },
];

export const JEV_MODEL_PRESETS = [
  { id: 'jev-1.13-free', name: 'Jev 1.13 Free ($0.00 / Free - Rekomendowany)', isRecommended: true },
  { id: 'jev-1.13', name: 'Jev 1.13 ($0.04/1M in, $0 out)', isRecommended: false },
  { id: 'custom', name: 'Inny / Własny identyfikator...', isRecommended: false },
];

export function cleanApiKey(rawKey: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();
  key = key.replace(/^["']+|["']+$/g, '');
  key = key.replace(/^Bearer\s+/i, '');
  return key.trim();
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

    const currentBar = bars[bars.length - 1];
    const currentPrice = currentBar.close;

    // Background fetch of Multi-Timeframe data (e.g. 4h Macro & 1h Structure)
    let htfContext: { macro: HTFAnalysis; structure: HTFAnalysis } | undefined = undefined;
    if (fetchHTF) {
      try {
        const { macro, structure } = getHigherTimeframes(controller.interval);
        const [macroBars, structBars] = await Promise.all([
          BinanceService.fetchKlines(controller.symbol, macro, 100),
          BinanceService.fetchKlines(controller.symbol, structure, 100),
        ]);

        const macroAnalysis = analyzeHTF(macro, macroBars);
        const structAnalysis = analyzeHTF(structure, structBars);

        if (macroAnalysis && structAnalysis) {
          htfContext = {
            macro: macroAnalysis,
            structure: structAnalysis,
          };
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

    // 6. Screenshot (from active chart container)
    const imageBase64 = controller.getSnapshotBase64();

    return {
      symbol: controller.symbol,
      interval: controller.interval,
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
      volumeProfile: vpResult,
      sessionVolume: svResult,
      smc: smcSummary,
      supplyDemand: sdSummary,
      htfContext,
      imageBase64,
    };
  }

  /**
   * Request Strategy Setup from the Thinking Brain (Claude / Gemini)
   */
  async generateStrategyPlan(params: {
    apiKey: string;
    model: string;
    snapshot: MarketSnapshot;
  }): Promise<TradingPlan> {
    const { apiKey, model, snapshot } = params;

    const cleanKey = cleanApiKey(apiKey);
    if (!cleanKey || cleanKey === 'undefined' || cleanKey === 'null') {
      throw new Error('Klucz OpenRouter API Key jest pusty lub niepoprawny. Wklej swój klucz w zakładce Ustawienia (np. sk-or-v1-...).');
    }

    const systemPrompt = `You are an elite, institutional crypto proprietary trader and quantitative strategist specialized in Multi-Timeframe Top-Down Analysis (Macro HTF -> Structure HTF -> Execution LTF), Smart Money Concepts (SMC), Volume Profile (POC/VAH/VAL), Order Blocks, Liquidity Sweeps, and Market Cipher B (WaveTrend & MFI).

Your objective:
Analyze the provided multi-timeframe quantitative metrics AND the attached chart screenshot for ${snapshot.symbol} (Execution on ${snapshot.interval}).
Formulate a concrete, institutional trade setup with a minimum Risk:Reward of 1:2.5.
If the market is currently chopping in no-man's land or has no high-probability edge, respond with direction: "NEUTRAL".

TOP-DOWN MULTI-TIMEFRAME RULES:
1. Macro Alignment: Align execution with the Macro HTF regime. Do not fight strong higher-timeframe momentum unless playing a confirmed rejection at an HTF extreme.
2. Direction must be "LONG", "SHORT", or "NEUTRAL".
3. If setup is actionable (LONG/SHORT):
   - entryPrice must be a realistic price near key confluence on the execution timeframe (${snapshot.interval}) (e.g. Daily POC, Order Block, Demand/Supply).
   - entryZone must be [min, max] bounding the entry trigger area.
   - stopLoss must be placed beyond the invalidation level (below demand/OB for long, above supply/OB for short).
   - takeProfit1 and takeProfit2 must target untapped liquidity pools, HTF POC, or opposite VAH/VAL.
   - riskRewardRatio must be calculated accurately as |TP1 - Entry| / |Entry - SL| and MUST be >= 2.5 (unless NEUTRAL).
4. Cipher B criteria: define exact conditions (e.g. green dot below 0, bullish divergence, MFI cross).
5. Jev criteria: provide clear numerical parameters so a high-frequency execution guardian can evaluate the setup every 60 seconds.

Return ONLY a pure, valid JSON object matching this TypeScript interface without any markdown code fences, comments, or extra text:
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
  },
  "jevCriteria": {
    "targetZoneMin": number,
    "targetZoneMax": number,
    "requiredCipherSignal": "GREEN_DOT" | "RED_DOT" | "GOLD_DOT" | "MFI_ABOVE_ZERO" | "NONE",
    "invalidationPrice": number,
    "executionTrigger": string
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

    const userMessageContent: any[] = [
      {
        type: 'text',
        text: `Analyze current market data for ${snapshot.symbol}:

${htfBreakdown}
=== EXECUTION TIMEFRAME (${snapshot.interval}) - ATTACHED SCREENSHOT & LOCAL DATA ===
Current Live Price: $${snapshot.currentPrice}
Cipher B (${snapshot.interval}): WT1 = ${snapshot.cipherB.wt1}, WT2 = ${snapshot.cipherB.wt2}, MFI = ${snapshot.cipherB.mfi}, Recent BuyDot = ${snapshot.cipherB.hasBuyDot}, SellDot = ${snapshot.cipherB.hasSellDot}, GoldDot = ${snapshot.cipherB.hasGoldDot}
Volume Profile (${snapshot.interval}): POC = $${snapshot.volumeProfile?.poc ?? 'N/A'}, VAH = $${snapshot.volumeProfile?.vah ?? 'N/A'}, VAL = $${snapshot.volumeProfile?.val ?? 'N/A'}
Daily Session POC: $${snapshot.sessionVolume?.todayPOC ?? 'N/A'}
SMC Trend Bias (${snapshot.interval}): ${snapshot.smc?.trendBias ?? 'N/A'}, Bullish OB: ${JSON.stringify(snapshot.smc?.bullishOB ?? 'none')}, Bearish OB: ${JSON.stringify(snapshot.smc?.bearishOB ?? 'none')}
Demand Zone: ${JSON.stringify(snapshot.supplyDemand?.nearestDemand ?? 'none')}, Supply Zone: ${JSON.stringify(snapshot.supplyDemand?.nearestSupply ?? 'none')}

Review the visual chart screenshot attached below (${snapshot.interval} showing candle anatomy, wicks, zones, and Cipher B wave slope).
Formulate a trading plan conforming to the Macro HTF bias with execution on ${snapshot.interval}.
Return strictly the JSON trade plan.`,
      },
    ];

    if (snapshot.imageBase64) {
      userMessageContent.push({
        type: 'image_url',
        image_url: {
          url: snapshot.imageBase64,
        },
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
        'HTTP-Referer': 'https://openview.local',
        'X-Title': 'OpenView Crypto AI Copilot',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessageContent },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `OpenRouter API Błąd (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) errorMsg = errJson.error.message;
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

    return plan;
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
      throw new Error('Klucz OpenRouter API Key jest pusty lub niepoprawny.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
        'HTTP-Referer': 'https://openview.local',
        'X-Title': 'OpenView Crypto Jev Sentinel',
      },
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

  /**
   * Verify OpenRouter API key validity against official auth/key endpoint
   */
  async testApiKey(rawKey: string): Promise<{ ok: boolean; message: string }> {
    const clean = cleanApiKey(rawKey);
    if (!clean || clean === 'undefined' || clean === 'null') {
      return { ok: false, message: 'Wprowadź klucz API (np. sk-or-v1-...)' };
    }
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
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
        return { ok: true, message: `✅ Połączono! (${label} | Zużycie: ${usage} / Limit: ${limit})` };
      } else {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || `Błąd autoryzacji (${res.status})`;
        return { ok: false, message: `❌ ${msg}` };
      }
    } catch (e: any) {
      return { ok: false, message: `❌ Błąd sieci: ${e.message}` };
    }
  }

  /**
   * Automatically draws the Long/Short Position Tool onto the active Klinecharts canvas
   */
  applyPlanToChart(plan: TradingPlan, chartId?: string): boolean {
    const controller = chartRegistry.getActive(chartId);
    if (!controller) return false;

    if (plan.direction === 'NEUTRAL') {
      return false;
    }

    const res = controller.createPositionOverlay({
      direction: plan.direction,
      entryPrice: plan.setup.entryPrice,
      takeProfit: plan.setup.takeProfit1,
      stopLoss: plan.setup.stopLoss,
    });

    return !!res;
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
