import React, { useState } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';

export interface IndicatorItem {
  id: string;
  name: string;
  shortName: string;
  category: 'Overlay' | 'Oscillators' | 'Order Flow & Volume';
  description: string;
  isOverlay: boolean;
}

export const AVAILABLE_INDICATORS: IndicatorItem[] = [
  {
    id: 'EMA',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    category: 'Overlay',
    description: 'Places greater weight on recent prices to track short and medium-term trend direction.',
    isOverlay: true,
  },
  {
    id: 'SMA',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    category: 'Overlay',
    description: 'Arithmetic mean of closing prices across a user-defined period.',
    isOverlay: true,
  },
  {
    id: 'BOLL',
    name: 'Bollinger Bands',
    shortName: 'BB',
    category: 'Overlay',
    description: 'Standard deviation volatility bands plotted around a simple moving average.',
    isOverlay: true,
  },
  {
    id: 'SAR',
    name: 'Parabolic SAR',
    shortName: 'SAR',
    category: 'Overlay',
    description: 'Trailing price-and-time stop and reversal system identifying trend exhaustion.',
    isOverlay: true,
  },
  {
    id: 'BBI',
    name: 'Bull and Bear Index',
    shortName: 'BBI',
    category: 'Overlay',
    description: 'Multi-period weighted composite moving average assessing overall directional bias.',
    isOverlay: true,
  },
  {
    id: 'VOL',
    name: 'Volume',
    shortName: 'VOL',
    category: 'Oscillators',
    description: 'Traded volume bars accompanied by an integrated volume moving average.',
    isOverlay: false,
  },
  {
    id: 'RSI',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    category: 'Oscillators',
    description: 'Momentum oscillator that gauges speed and velocity of directional price movements.',
    isOverlay: false,
  },
  {
    id: 'MACD',
    name: 'Moving Average Convergence Divergence',
    shortName: 'MACD',
    category: 'Oscillators',
    description: 'Relationship between two exponential moving averages paired with a signal line histogram.',
    isOverlay: false,
  },
  {
    id: 'KDJ',
    name: 'KDJ Stochastic Oscillator',
    shortName: 'KDJ',
    category: 'Oscillators',
    description: 'Stochastic indicator variant featuring an extra J-line to flag overbought/oversold extremes.',
    isOverlay: false,
  },
  {
    id: 'OBV',
    name: 'On-Balance Volume',
    shortName: 'OBV',
    category: 'Oscillators',
    description: 'Cumulative volume metric associating trade volume with positive and negative price action.',
    isOverlay: false,
  },
  {
    id: 'ATR',
    name: 'Average True Range',
    shortName: 'ATR',
    category: 'Oscillators',
    description: 'Quantifies market volatility by decomposing the entire range of an asset for that period.',
    isOverlay: false,
  },
  {
    id: 'CCI',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    category: 'Oscillators',
    description: 'Measures deviation of current price from its statistical average to identify cyclic turns.',
    isOverlay: false,
  },
  {
    id: 'WR',
    name: 'Williams %R',
    shortName: '%R',
    category: 'Oscillators',
    description: 'Negative scale momentum indicator reflecting closing level relative to the high-low range.',
    isOverlay: false,
  },
  {
    id: 'VP',
    name: 'Volume Profile (Visible Range VRVP)',
    shortName: 'VRVP',
    category: 'Order Flow & Volume',
    description: 'Volume distribution across price levels with Point of Control (POC), VAH, and VAL.',
    isOverlay: true,
  },
  {
    id: 'CIPHER_A',
    name: 'Multi-EMA Momentum Ribbon (Cipher A style)',
    shortName: 'Cipher A',
    category: 'Overlay',
    description: '8-EMA dynamic ribbon with trend breakout triangles, continuation diamonds, and divergence alerts (Market Cipher A equivalent).',
    isOverlay: true,
  },
  {
    id: 'CIPHER_B',
    name: 'WaveTrend & Money Flow (Cipher B style)',
    shortName: 'Cipher B',
    category: 'Order Flow & Volume',
    description: 'Dual WaveTrend momentum oscillator paired with volume-weighted Money Flow Index and dot triggers (Market Cipher B equivalent).',
    isOverlay: false,
  },
  {
    id: 'SMC',
    name: 'Smart Money Concepts (LuxAlgo / ICT style)',
    shortName: 'SMC',
    category: 'Overlay',
    description: 'Automated institutional Order Blocks (+OB/-OB), Fair Value Gaps (FVG), and Structure Breaks (BOS/CHoCH).',
    isOverlay: true,
  },
  {
    id: 'CVD',
    name: 'Cumulative Volume Delta',
    shortName: 'CVD',
    category: 'Order Flow & Volume',
    description: 'Net difference between aggressive market buying and selling volume to detect hidden absorption.',
    isOverlay: false,
  },
  {
    id: 'SUPPLY_DEMAND',
    name: 'Displacement Supply & Demand (Flux Charts style)',
    shortName: 'Flux S&D',
    category: 'Overlay',
    description: 'ATR displacement zones distinguishing fresh vs tested liquidity blocks.',
    isOverlay: true,
  },
  {
    id: 'LIQUIDITY_SWEEP',
    name: 'Liquidity Sweeps (SFP)',
    shortName: 'Sweeps',
    category: 'Overlay',
    description: 'Detects swing failure patterns where candle wicks sweep key highs/lows and immediately reject.',
    isOverlay: true,
  },
  {
    id: 'PREMIUM_DISCOUNT',
    name: 'Premium & Discount Zones',
    shortName: 'P&D Zones',
    category: 'Overlay',
    description: 'Divided 50% Equilibrium range mapping current price relative to institutional discount and premium areas.',
    isOverlay: true,
  },
  {
    id: 'KILLZONES',
    name: 'ICT Sessions & Killzones',
    shortName: 'Killzones',
    category: 'Overlay',
    description: 'Asian range high/low projection lines with London Open, NY Silver Bullet, and Judas Swing detection.',
    isOverlay: true,
  },
  {
    id: 'AVWAP',
    name: 'Anchored VWAP',
    shortName: 'AVWAP',
    category: 'Overlay',
    description: 'Volume-weighted average price anchored to high/low pivots with ±1σ and ±2σ standard deviation bands.',
    isOverlay: true,
  },
  {
    id: 'LIQUIDATION_HEATMAP',
    name: 'Leverage Liquidation Heatmap (Kingfisher style)',
    shortName: 'Kingfisher Liq',
    category: 'Order Flow & Volume',
    description: 'Leverage liquidation clusters (10x, 25x, 50x, 100x) and proximity-based liquidity magnets.',
    isOverlay: true,
  },
  {
    id: 'HTF_LEVELS',
    name: 'Higher Timeframe Key Levels (PDH/PDL, PWH/PWL, Opens, Monday Range)',
    shortName: 'HTF Levels',
    category: 'Overlay',
    description: 'Automated institutional levels: Previous Day High/Low, Previous Week High/Low, Daily/Weekly/Monthly Opens, and Monday Range with sweep detection.',
    isOverlay: true,
  },
  {
    id: 'NAKED_POC',
    name: 'Naked POC Tracker (Untested Volume Magnet)',
    shortName: 'nPOC',
    category: 'Order Flow & Volume',
    description: 'Historical virgin Point of Control (POC) levels from past daily sessions that have never been mitigated by price.',
    isOverlay: true,
  },
];

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: string[];
  onAddIndicator: (name: string, isOverlay: boolean) => void;
  onRemoveIndicator: (name: string) => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  isOpen,
  onClose,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Indicators' },
    { id: 'Overlay', label: 'Overlay' },
    { id: 'Oscillators', label: 'Oscillators' },
    { id: 'Order Flow & Volume', label: 'Order Flow & Volume' },
  ];

  const filtered = AVAILABLE_INDICATORS.filter((ind) => {
    const matchesSearch =
      ind.name.toLowerCase().includes(search.toLowerCase()) ||
      ind.shortName.toLowerCase().includes(search.toLowerCase()) ||
      ind.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || ind.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#1e222d] border border-[#363c4e] rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2a2e39] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base text-[#d1d4dc]">Indicators & Studies</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar & Category tabs */}
        <div className="p-4 border-b border-[#2a2e39] flex flex-col space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-[#868993]" />
            <input
              type="text"
              placeholder="Search indicators (e.g. EMA, RSI, Volume, SMC, AVWAP)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#131722] border border-[#2a2e39] focus:border-[#2962ff] rounded-lg pl-9 pr-4 py-2 text-xs text-[#d1d4dc] outline-none transition-colors"
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-[#2962ff] text-white'
                    : 'bg-[#131722] text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Indicators */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.map((ind) => {
            const isAdded = activeIndicators.includes(ind.id);
            return (
              <div
                key={ind.id}
                className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                  isAdded
                    ? 'bg-[#2962ff]/10 border-[#2962ff]/30'
                    : 'bg-[#131722]/50 border-[#2a2e39] hover:border-[#363c4e] hover:bg-[#131722]'
                }`}
              >
                <div className="pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-[#d1d4dc]">{ind.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#2a2e39] text-[#868993]">
                      {ind.shortName}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#868993] mt-0.5 leading-relaxed">
                    {ind.description}
                  </p>
                </div>

                {isAdded ? (
                  <button
                    onClick={() => onRemoveIndicator(ind.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#f23645]/20 hover:bg-[#f23645]/30 text-[#f23645] text-xs font-semibold flex items-center space-x-1 transition-colors whitespace-nowrap"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onAddIndicator(ind.id, ind.isOverlay)}
                    className="px-3 py-1.5 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-semibold flex items-center space-x-1 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#131722]/50 border-t border-[#2a2e39] text-[11px] text-[#868993] flex items-center justify-between">
          <span>Active indicators: <strong className="text-[#d1d4dc]">{activeIndicators.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-[#d1d4dc] text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
