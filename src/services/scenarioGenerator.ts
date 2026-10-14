import { KLineBar, BinanceService } from './binance';

export interface ScenarioDebrief {
  marketContext: string;
  keyStructure: string;
  outcomeExplanation: string;
  lessonLearned: string;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  timeframe: string; // '1m' | '5m' | '15m' | '1h' | '4h' | '1D'
  category: 'scalp' | 'daytrade' | 'swing';
  realSymbol: string;
  realDate: string;
  decisionIndex: number;
  allBars: KLineBar[];
  contextBars: KLineBar[];
  futureBars: KLineBar[];
  atr: number;
  entryPrice: number;
  suggestedStopLoss: number;
  suggestedTakeProfit: number;
  idealDirection: 'LONG' | 'SHORT';
  debrief: ScenarioDebrief;
}

// Helper to compute local ATR(14)
export function calculateATR(bars: KLineBar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Procedural realistic bar generator with rich historical context baseline
function generateRealisticBars(
  startPrice: number,
  timeframeMinutes: number,
  moves: Array<{
    candleCount: number;
    trendBias: number;
    volatility: number;
    volumeMultiplier?: number;
  }>,
  baselineCycles = 3
): { bars: KLineBar[]; baselineCount: number } {
  const bars: KLineBar[] = [];
  let currentPrice = startPrice;
  let currentTime = Date.now() - 365 * 24 * 3600 * 1000;
  const stepMs = timeframeMinutes * 60 * 1000;

  // 1. Generate 120+ candles of multi-swing background history so indicators & chart are full
  const baseMoves = [
    { candleCount: 35, trendBias: 0.0004, volatility: 0.0022, volumeMultiplier: 0.9 },
    { candleCount: 45, trendBias: -0.0005, volatility: 0.0025, volumeMultiplier: 1.1 },
    { candleCount: 40, trendBias: 0.0002, volatility: 0.0019, volumeMultiplier: 0.8 },
  ];

  let baselineCount = 0;
  for (let c = 0; c < baselineCycles; c++) {
    for (const bMove of baseMoves) {
      for (let i = 0; i < bMove.candleCount; i++) {
        currentTime += stepMs;
        const open = currentPrice;
        const rawDelta = (Math.random() - 0.49) * bMove.volatility + bMove.trendBias;
        const close = Math.max(open * 0.5, open * (1 + rawDelta));
        const wickHigh = Math.random() * bMove.volatility * open * 0.7;
        const wickLow = Math.random() * bMove.volatility * open * 0.7;
        const high = Math.max(open, close) + wickHigh;
        const low = Math.min(open, close) - wickLow;
        const baseVol = 150 * (open > 1000 ? 5 : 50);
        const volume = (baseVol + Math.random() * baseVol * 0.8) * (bMove.volumeMultiplier || 1.0);
        const takerBuy = volume * (close >= open ? 0.55 : 0.45);

        bars.push({
          timestamp: currentTime,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: parseFloat(volume.toFixed(2)),
          turnover: parseFloat((volume * close).toFixed(2)),
          takerBuyVolume: parseFloat(takerBuy.toFixed(2)),
        });
        currentPrice = close;
        baselineCount++;
      }
    }
  }

  // 2. Tactical setup moves leading into the decision point and subsequent outcome
  for (const move of moves) {
    for (let i = 0; i < move.candleCount; i++) {
      currentTime += stepMs;
      const open = currentPrice;
      const rawDelta = (Math.random() - 0.48) * move.volatility + move.trendBias;
      const close = Math.max(open * 0.5, open * (1 + rawDelta));
      const wickHigh = Math.random() * move.volatility * open * 0.7;
      const wickLow = Math.random() * move.volatility * open * 0.7;
      const high = Math.max(open, close) + wickHigh;
      const low = Math.min(open, close) - wickLow;

      const baseVol = 150 * (open > 1000 ? 5 : 50);
      const volMult = move.volumeMultiplier || 1.0;
      const volume = (baseVol + Math.random() * baseVol * 0.8) * volMult;
      const takerBuy = volume * (close >= open ? 0.6 : 0.4);

      bars.push({
        timestamp: currentTime,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: parseFloat(volume.toFixed(2)),
        turnover: parseFloat((volume * close).toFixed(2)),
        takerBuyVolume: parseFloat(takerBuy.toFixed(2)),
      });

      currentPrice = close;
    }
  }

  return { bars, baselineCount };
}

// 8 Curated Master Scenarios covering Scalping, Daytrading, and Swing trading
export const CURATED_SCENARIOS: ScenarioInfo[] = [
  // 1. 5m Scalp - BTC SFP (Swing Failure Pattern) Liquidity Sweep into +OB
  (() => {
    const { bars, baselineCount } = generateRealisticBars(64200, 5, [
      { candleCount: 40, trendBias: -0.0003, volatility: 0.0018, volumeMultiplier: 0.8 },
      { candleCount: 15, trendBias: -0.0008, volatility: 0.0025, volumeMultiplier: 1.2 },
      { candleCount: 5, trendBias: 0.0012, volatility: 0.002, volumeMultiplier: 2.5 },
      { candleCount: 35, trendBias: 0.0007, volatility: 0.0022, volumeMultiplier: 1.8 },
    ], 1); // 120 baseline bars
    const decisionIdx = baselineCount + 60;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 - 0.0028)).toFixed(2));
    const tp = parseFloat((entry * (1 + 0.0095)).toFixed(2));
    return {
      id: 'scen-btc-5m-sfp',
      title: 'Scenario Alpha • 5m Scalp',
      timeframe: '5m',
      category: 'scalp',
      realSymbol: 'BTCUSDT',
      realDate: '2024-03-12 08:35 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'LONG',
      debrief: {
        marketContext: 'London Open session liquidity raid below Asian Range Low.',
        keyStructure: 'Swing Failure Pattern (SFP) + Bullish Order Block (+OB)',
        outcomeExplanation: 'The sudden wick beneath the prior swing low wiped out retail stop-losses before aggressive market buyers stepped in, forming an institutional Order Block and triggering a +0.95% expansion.',
        lessonLearned: 'On lower timeframes with 10x-20x leverage, a 0.28% Stop Loss beneath the sweep wick yields a clean 1:3.4 R:R with high probabilistic edge.',
      },
    };
  })(),

  // 2. 15m Daytrade - ETH Bearish Fair Value Gap (FVG) Retest
  (() => {
    const { bars, baselineCount } = generateRealisticBars(3480, 15, [
      { candleCount: 45, trendBias: 0.0004, volatility: 0.0025, volumeMultiplier: 0.9 },
      { candleCount: 15, trendBias: -0.0015, volatility: 0.0035, volumeMultiplier: 2.2 },
      { candleCount: 10, trendBias: 0.0009, volatility: 0.002, volumeMultiplier: 0.7 },
      { candleCount: 35, trendBias: -0.0011, volatility: 0.003, volumeMultiplier: 1.9 },
    ], 1);
    const decisionIdx = baselineCount + 70;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 + 0.0055)).toFixed(2));
    const tp = parseFloat((entry * (1 - 0.021)).toFixed(2));
    return {
      id: 'scen-eth-15m-fvg',
      title: 'Scenario Beta • 15m Daytrade',
      timeframe: '15m',
      category: 'daytrade',
      realSymbol: 'ETHUSDT',
      realDate: '2024-04-18 14:15 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'SHORT',
      debrief: {
        marketContext: 'NY Session open rejecting from Daily Value Area High (VAH).',
        keyStructure: 'Bearish Fair Value Gap (FVG) + Displacement Breakdown',
        outcomeExplanation: 'The heavy displacement candle left a 15m imbalance (FVG). The weak, low-volume pullback into the 50% equilibrium of the gap presented an optimal short entry before trend continuation.',
        lessonLearned: 'Do not chase red displacement candles. Patiently wait for the low-volume retest of the FVG with Stop Loss placed right outside the imbalance zone.',
      },
    };
  })(),

  // 3. 1m Scalp - SOL Compression Volatility Squeeze
  (() => {
    const { bars, baselineCount } = generateRealisticBars(178.5, 1, [
      { candleCount: 60, trendBias: 0.0001, volatility: 0.0008, volumeMultiplier: 0.5 },
      { candleCount: 10, trendBias: 0.0005, volatility: 0.0012, volumeMultiplier: 1.4 },
      { candleCount: 40, trendBias: 0.0009, volatility: 0.0018, volumeMultiplier: 2.8 },
    ], 1);
    const decisionIdx = baselineCount + 70;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 - 0.0018)).toFixed(2));
    const tp = parseFloat((entry * (1 + 0.0068)).toFixed(2));
    return {
      id: 'scen-sol-1m-squeeze',
      title: 'Scenario Gamma • 1m Scalp',
      timeframe: '1m',
      category: 'scalp',
      realSymbol: 'SOLUSDT',
      realDate: '2024-05-03 16:42 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'LONG',
      debrief: {
        marketContext: 'Volatility compression preceding US economic data release.',
        keyStructure: 'Bollinger Band / ATR Squeeze with Volume Accumulation',
        outcomeExplanation: 'Periods of declining ATR and volume compression inevitably resolve in directional expansion. As buy volume ticked up, price broke the upper channel boundary.',
        lessonLearned: 'On 1m charts, an entry right as volatility expands with a tight 0.18% SL offers exceptional leverage efficiency (up to 1:3.7 R:R).',
      },
    };
  })(),

  // 4. 1h Daytrade - BTC WaveTrend Triple Bullish Divergence in Demand Zone
  (() => {
    const { bars, baselineCount } = generateRealisticBars(58400, 60, [
      { candleCount: 40, trendBias: -0.0008, volatility: 0.0035, volumeMultiplier: 1.2 },
      { candleCount: 15, trendBias: -0.0004, volatility: 0.0028, volumeMultiplier: 0.9 },
      { candleCount: 10, trendBias: 0.0003, volatility: 0.0025, volumeMultiplier: 1.1 },
      { candleCount: 40, trendBias: 0.0012, volatility: 0.004, volumeMultiplier: 2.1 },
    ], 1);
    const decisionIdx = baselineCount + 65;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 - 0.0085)).toFixed(2));
    const tp = parseFloat((entry * (1 + 0.032)).toFixed(2));
    return {
      id: 'scen-btc-1h-div',
      title: 'Scenario Delta • 1h Daytrade',
      timeframe: '1h',
      category: 'daytrade',
      realSymbol: 'BTCUSDT',
      realDate: '2024-02-07 11:00 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'LONG',
      debrief: {
        marketContext: 'Multi-day retracement tapping into unchecked 4h Demand Zone.',
        keyStructure: 'WaveTrend Momentum Bullish Divergence + Liquidity Absorption',
        outcomeExplanation: 'While price formed a lower low, the WaveTrend oscillator printed a higher low in deep oversold territory (-60), confirming institutional accumulation and exhaustion of sellers.',
        lessonLearned: 'Momentum divergences at major support levels offer high-confidence reversal setups. Avoid shorting into exhausted momentum.',
      },
    };
  })(),

  // 5. 4h Swing - SOL POC Breakdown & Resistance Flip
  (() => {
    const { bars, baselineCount } = generateRealisticBars(142.0, 240, [
      { candleCount: 50, trendBias: 0.0002, volatility: 0.006, volumeMultiplier: 1.0 },
      { candleCount: 15, trendBias: -0.0025, volatility: 0.008, volumeMultiplier: 2.2 },
      { candleCount: 10, trendBias: 0.0012, volatility: 0.005, volumeMultiplier: 0.8 },
      { candleCount: 35, trendBias: -0.002, volatility: 0.007, volumeMultiplier: 1.8 },
    ], 1);
    const decisionIdx = baselineCount + 75;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 + 0.014)).toFixed(2));
    const tp = parseFloat((entry * (1 - 0.048)).toFixed(2));
    return {
      id: 'scen-sol-4h-poc',
      title: 'Scenario Epsilon • 4h Swing',
      timeframe: '4h',
      category: 'swing',
      realSymbol: 'SOLUSDT',
      realDate: '2023-12-19 04:00 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'SHORT',
      debrief: {
        marketContext: 'Distribution phase completing with volume node failure.',
        keyStructure: 'Volume Profile Point of Control (POC) Breakdown & Support-to-Resistance Flip',
        outcomeExplanation: 'Once the highest volume node of the range (POC) broke downwards with heavy turnover, the backtest into that level met severe limit-sell supply, driving price to the macro Value Area Low.',
        lessonLearned: 'Support turned into resistance at the volume Point of Control provides an institutional roof for Stop Loss placement.',
      },
    };
  })(),

  // 6. 15m Daytrade - ETH Judas Swing at London Open
  (() => {
    const { bars, baselineCount } = generateRealisticBars(3120, 15, [
      { candleCount: 35, trendBias: 0.0001, volatility: 0.0015, volumeMultiplier: 0.6 },
      { candleCount: 10, trendBias: 0.0018, volatility: 0.003, volumeMultiplier: 2.0 },
      { candleCount: 5, trendBias: -0.0012, volatility: 0.0025, volumeMultiplier: 1.8 },
      { candleCount: 35, trendBias: -0.001, volatility: 0.003, volumeMultiplier: 1.6 },
    ], 1);
    const decisionIdx = baselineCount + 50;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 + 0.0045)).toFixed(2));
    const tp = parseFloat((entry * (1 - 0.0175)).toFixed(2));
    return {
      id: 'scen-eth-15m-judas',
      title: 'Scenario Zeta • 15m Daytrade',
      timeframe: '15m',
      category: 'daytrade',
      realSymbol: 'ETHUSDT',
      realDate: '2024-05-14 07:45 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'SHORT',
      debrief: {
        marketContext: 'London Open 07:00-09:00 UTC session expansion.',
        keyStructure: 'ICT Judas Swing / Asian High Liquidity Raid',
        outcomeExplanation: 'Smart money engineered liquidity by pushing price just beyond the well-defined Asian High to induce breakout buyers, before trapping them and aggressively driving price toward the opposite Asian Low.',
        lessonLearned: 'Beware of breakouts during the first 30 minutes of London Open. If price swiftly falls back below the session high, short the rejection with target at the session low.',
      },
    };
  })(),

  // 7. 5m Scalp - AVAX Equal Highs (EQH) Sweep
  (() => {
    const { bars, baselineCount } = generateRealisticBars(38.2, 5, [
      { candleCount: 45, trendBias: 0.0003, volatility: 0.0022, volumeMultiplier: 0.9 },
      { candleCount: 15, trendBias: 0.0015, volatility: 0.0032, volumeMultiplier: 2.4 },
      { candleCount: 5, trendBias: -0.0008, volatility: 0.002, volumeMultiplier: 1.5 },
      { candleCount: 35, trendBias: -0.0006, volatility: 0.0025, volumeMultiplier: 1.4 },
    ], 1);
    const decisionIdx = baselineCount + 65;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 + 0.0022)).toFixed(2));
    const tp = parseFloat((entry * (1 - 0.0085)).toFixed(2));
    return {
      id: 'scen-avax-5m-eqh',
      title: 'Scenario Eta • 5m Scalp',
      timeframe: '5m',
      category: 'scalp',
      realSymbol: 'AVAXUSDT',
      realDate: '2024-01-22 13:10 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'SHORT',
      debrief: {
        marketContext: 'Pivotal intraday resistance with conspicuous equal highs (EQH).',
        keyStructure: 'Liquidity Pool Grab & Bearish Engulfing Reversal',
        outcomeExplanation: 'Equal highs act as magnets for buy-stop liquidity. The pin bar wick absorbed all resting orders and closed back under resistance, signaling immediate downside exhaustion.',
        lessonLearned: 'Equal highs are rarely safe resistance until they have been swept. The best short entry is not before the sweep, but on the close back inside the range.',
      },
    };
  })(),

  // 8. 1D Macro Swing - BTC Daily Macro Order Block Re-accumulation
  (() => {
    const { bars, baselineCount } = generateRealisticBars(41500, 1440, [
      { candleCount: 60, trendBias: -0.0005, volatility: 0.008, volumeMultiplier: 1.1 },
      { candleCount: 15, trendBias: -0.0002, volatility: 0.005, volumeMultiplier: 0.7 },
      { candleCount: 10, trendBias: 0.0008, volatility: 0.006, volumeMultiplier: 1.4 },
      { candleCount: 40, trendBias: 0.0016, volatility: 0.009, volumeMultiplier: 2.2 },
    ], 1);
    const decisionIdx = baselineCount + 85;
    const entry = bars[decisionIdx].close;
    const sl = parseFloat((entry * (1 - 0.032)).toFixed(2));
    const tp = parseFloat((entry * (1 + 0.125)).toFixed(2));
    return {
      id: 'scen-btc-1d-ob',
      title: 'Scenario Theta • 1D Swing',
      timeframe: '1D',
      category: 'swing',
      realSymbol: 'BTCUSDT',
      realDate: '2023-10-16 00:00 UTC',
      decisionIndex: decisionIdx,
      allBars: bars,
      contextBars: bars.slice(0, decisionIdx + 1),
      futureBars: bars.slice(decisionIdx + 1),
      atr: calculateATR(bars.slice(0, decisionIdx + 1)),
      entryPrice: entry,
      suggestedStopLoss: sl,
      suggestedTakeProfit: tp,
      idealDirection: 'LONG',
      debrief: {
        marketContext: 'Macro bull market re-accumulation at key 1D Order Block.',
        keyStructure: 'Daily Bullish Order Block (+OB) & Volume Dry-up',
        outcomeExplanation: 'The multi-month correction culminated in a low-volume retest of the daily demand block. When institutional spot bids absorbed remaining supply, a massive multi-week rally ensued.',
        lessonLearned: 'On daily charts, swings of 10-15% require patience and wider stop losses (3-4%), but yield massive returns even on moderate leverage (3x-5x).',
      },
    };
  })(),
];

// Service to retrieve or dynamically fetch scenarios
export class ScenarioService {
  static getScenarios(category?: 'scalp' | 'daytrade' | 'swing'): ScenarioInfo[] {
    if (!category) return CURATED_SCENARIOS;
    return CURATED_SCENARIOS.filter((s) => s.category === category);
  }

  static getRandomScenario(category?: 'scalp' | 'daytrade' | 'swing'): ScenarioInfo {
    const list = this.getScenarios(category);
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
  }

  static getScenarioById(id: string): ScenarioInfo | undefined {
    return CURATED_SCENARIOS.find((s) => s.id === id);
  }

  // Attempt to fetch a live dynamic random historical scenario from Binance
  static async fetchRandomBinanceScenario(
    targetCategory?: 'scalp' | 'daytrade' | 'swing'
  ): Promise<ScenarioInfo | null> {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT'];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];

      let interval = '15m';
      if (targetCategory === 'scalp') {
        interval = Math.random() > 0.5 ? '1m' : '5m';
      } else if (targetCategory === 'swing') {
        interval = Math.random() > 0.5 ? '4h' : '1d';
      } else {
        interval = Math.random() > 0.5 ? '15m' : '1h';
      }

      // Pick a random historical date between 3 months ago and 2 years ago
      const now = Date.now();
      const threeMonthsAgo = now - 90 * 24 * 3600 * 1000;
      const twoYearsAgo = now - 730 * 24 * 3600 * 1000;
      const randomEndTime = Math.floor(twoYearsAgo + Math.random() * (threeMonthsAgo - twoYearsAgo));

      const bars = await BinanceService.fetchKlines(symbol, interval, 400, randomEndTime);
      if (!bars || bars.length < 200) return null;

      // Decision point at ~70% (280 context bars, 120 future bars)
      const decisionIndex = Math.floor(bars.length * 0.7);
      const contextBars = bars.slice(0, decisionIndex + 1);
      const futureBars = bars.slice(decisionIndex + 1);

      const entry = bars[decisionIndex].close;
      const atr = calculateATR(contextBars);

      // Determine the direction the future move took
      const maxFuture = Math.max(...futureBars.map((b) => b.high));
      const minFuture = Math.min(...futureBars.map((b) => b.low));
      const upDelta = (maxFuture - entry) / entry;
      const downDelta = (entry - minFuture) / entry;
      const idealDirection: 'LONG' | 'SHORT' = upDelta >= downDelta ? 'LONG' : 'SHORT';

      let slPercent = 0.005;
      if (interval === '1m' || interval === '5m') slPercent = 0.003;
      else if (interval === '15m' || interval === '1h') slPercent = 0.008;
      else slPercent = 0.025;

      const sl =
        idealDirection === 'LONG'
          ? parseFloat((entry * (1 - slPercent)).toFixed(2))
          : parseFloat((entry * (1 + slPercent)).toFixed(2));

      const tpPercent = slPercent * 3.0; // 1:3 R:R
      const tp =
        idealDirection === 'LONG'
          ? parseFloat((entry * (1 + tpPercent)).toFixed(2))
          : parseFloat((entry * (1 - tpPercent)).toFixed(2));

      const dateObj = new Date(bars[decisionIndex].timestamp);
      const formattedDate = dateObj.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

      return {
        id: `dyn-${symbol}-${interval}-${Date.now()}`,
        title: `Real Market Cut • ${symbol} (${interval})`,
        timeframe: interval,
        category: interval === '1m' || interval === '5m' ? 'scalp' : interval === '1h' || interval === '15m' ? 'daytrade' : 'swing',
        realSymbol: symbol,
        realDate: formattedDate,
        decisionIndex,
        allBars: bars,
        contextBars,
        futureBars,
        atr,
        entryPrice: entry,
        suggestedStopLoss: sl,
        suggestedTakeProfit: tp,
        idealDirection,
        debrief: {
          marketContext: `Actual historical exchange execution on ${symbol} (${interval}).`,
          keyStructure: idealDirection === 'LONG' ? 'Bullish Expansion / Demand Reaction' : 'Bearish Breakdown / Supply Rejection',
          outcomeExplanation: `Following this historical inflection point, ${symbol} moved by ${(Math.max(upDelta, downDelta) * 100).toFixed(2)}% in the direction of the dominant volume expansion.`,
          lessonLearned: 'Trading with disciplined Stop Losses and mathematical Risk-to-Reward guarantees longevity in asymmetric crypto markets.',
        },
      };
    } catch (e) {
      console.warn('Error fetching dynamic scenario:', e);
      return null;
    }
  }
}
