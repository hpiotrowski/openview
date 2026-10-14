import React, { useState, useRef, useEffect } from 'react';
import {
  CandlestickChart,
  LineChart,
  BarChart2,
  TrendingUp,
  LayoutGrid,
  PlayCircle,
  Bell,
  Sliders,
  ChevronDown,
  Layers,
  RotateCcw,
  Search,
  Check,
  PanelRight,
  Home,
  Flame,
} from 'lucide-react';
import { POPULAR_SYMBOLS, TIMEFRAMES } from '../services/binance';

export type ChartType = 'candle_solid' | 'candle_stroke' | 'ohlc' | 'area';
export type GridLayout = '1x1' | '1x2' | '2x1' | '2x2' | '1+3';

interface TopNavbarProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  currentInterval: string;
  onSelectInterval: (interval: string) => void;
  chartType: ChartType;
  onSelectChartType: (type: ChartType) => void;
  onOpenIndicators: () => void;
  activeIndicatorsCount: number;
  isReplaying: boolean;
  onToggleReplay: () => void;
  volumeProfileEnabled: boolean;
  onToggleVolumeProfile: () => void;
  gridLayout: GridLayout;
  onSelectGridLayout: (layout: GridLayout) => void;
  onOpenAlerts: () => void;
  alertsCount: number;
  watchlistOpen: boolean;
  onToggleWatchlist: () => void;
  onBackToLobby?: () => void;
  onOpenArena?: () => void;
  currentPrice?: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentSymbol,
  onSelectSymbol,
  currentInterval,
  onSelectInterval,
  chartType,
  onSelectChartType,
  onOpenIndicators,
  activeIndicatorsCount,
  isReplaying,
  onToggleReplay,
  volumeProfileEnabled,
  onToggleVolumeProfile,
  gridLayout,
  onSelectGridLayout,
  onOpenAlerts,
  alertsCount,
  watchlistOpen,
  onToggleWatchlist,
  onBackToLobby,
  onOpenArena,
  currentPrice,
}) => {
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState(false);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPriceRef = useRef<number>(currentPrice || 0);

  useEffect(() => {
    if (!currentPrice || currentPrice === prevPriceRef.current) return;
    if (prevPriceRef.current > 0) {
      if (currentPrice > prevPriceRef.current) {
        setPriceFlash('up');
      } else if (currentPrice < prevPriceRef.current) {
        setPriceFlash('down');
      }
    }
    prevPriceRef.current = currentPrice;
    const timer = setTimeout(() => setPriceFlash(null), 300);
    return () => clearTimeout(timer);
  }, [currentPrice]);

  const filteredSymbols = POPULAR_SYMBOLS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <header className="h-11 bg-[#1e222d] border-b border-[#2a2e39] flex items-center justify-between px-3 text-xs select-none z-30">
      {/* Left: Brand + Symbol selector + Timeframes */}
      <div className="flex items-center space-x-2">
        {/* Brand */}
        <div className="flex items-center space-x-1.5 mr-2">
          <div className="w-6 h-6 rounded bg-[#2962ff] flex items-center justify-center text-white font-bold text-xs shadow-sm">
            OV
          </div>
          <span className="font-bold text-[#d1d4dc] tracking-tight hidden sm:inline">OpenView</span>
        </div>

        {/* Navigation to Lobby & Arena */}
        {onBackToLobby && (
          <button
            onClick={onBackToLobby}
            className="flex items-center space-x-1 bg-[#2a2e39]/60 hover:bg-[#2a2e39] text-[#868993] hover:text-[#d1d4dc] px-2 py-1 rounded transition-colors"
            title="Return to Mode Lobby"
          >
            <Home size={13} className="text-cyan-400" />
            <span className="font-medium text-[11px]">Lobby</span>
          </button>
        )}

        {onOpenArena && (
          <button
            onClick={onOpenArena}
            className="flex items-center space-x-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded transition-colors"
            title="Open Trading Gym / Price Action Arena"
          >
            <Flame size={13} />
            <span className="font-semibold text-[11px]">Trading Gym</span>
          </button>
        )}

        {/* Symbol Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setSymbolMenuOpen(!symbolMenuOpen)}
            className="flex items-center space-x-1.5 bg-[#2a2e39]/60 hover:bg-[#2a2e39] text-[#d1d4dc] font-semibold px-2.5 py-1.5 rounded transition-colors"
          >
            <span>{currentSymbol}</span>
            <ChevronDown size={14} className="text-[#868993]" />
          </button>

          {symbolMenuOpen && (
            <div className="absolute left-0 top-9 w-64 bg-[#1e222d] border border-[#363c4e] rounded-lg shadow-2xl py-2 z-50">
              <div className="px-3 pb-2 border-b border-[#2a2e39] flex items-center space-x-2">
                <Search size={14} className="text-[#868993]" />
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  autoFocus
                  className="bg-transparent text-[#d1d4dc] text-xs outline-none w-full placeholder-[#50535e]"
                />
              </div>
              <div className="max-h-60 overflow-y-auto mt-1">
                {filteredSymbols.map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => {
                      onSelectSymbol(item.symbol);
                      setSymbolMenuOpen(false);
                      setSearchFilter('');
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#2a2e39] transition-colors ${
                      item.symbol === currentSymbol ? 'bg-[#2962ff]/10 text-[#2962ff]' : 'text-[#d1d4dc]'
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{item.symbol}</span>
                      <span className="ml-2 text-[10px] text-[#868993]">{item.name}</span>
                    </div>
                    {item.symbol === currentSymbol && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Ticking Price Pill */}
        {currentPrice !== undefined && currentPrice > 0 && (
          <div
            className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded font-mono font-bold text-xs transition-colors duration-150 border ${
              priceFlash === 'up'
                ? 'bg-[#089981]/20 text-[#089981] border-[#089981]/50 shadow-xs'
                : priceFlash === 'down'
                ? 'bg-[#f23645]/20 text-[#f23645] border-[#f23645]/50 shadow-xs'
                : 'bg-[#131722] text-[#d1d4dc] border-[#2a2e39]'
            }`}
            title="Binance real-time tick price"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                priceFlash === 'up'
                  ? 'bg-[#089981]'
                  : priceFlash === 'down'
                  ? 'bg-[#f23645]'
                  : 'bg-emerald-400'
              } animate-pulse`}
            />
            <span>
              ${currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
          </div>
        )}

        {/* Timeframes Bar */}
        <div className="flex items-center space-x-0.5 bg-[#131722]/50 p-0.5 rounded border border-[#2a2e39]">
          {TIMEFRAMES.slice(0, 9).map((tf) => (
            <button
              key={tf.value}
              onClick={() => onSelectInterval(tf.value)}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                currentInterval === tf.value
                  ? 'bg-[#2962ff] text-white'
                  : 'text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart Style Selector */}
        <div className="relative">
          <button
            onClick={() => setChartTypeMenuOpen(!chartTypeMenuOpen)}
            className="flex items-center space-x-1 p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-[#d1d4dc] transition-colors"
            title="Chart style"
          >
            <CandlestickChart size={16} />
            <ChevronDown size={12} />
          </button>
          {chartTypeMenuOpen && (
            <div className="absolute left-0 top-9 w-36 bg-[#1e222d] border border-[#363c4e] rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={() => {
                  onSelectChartType('candle_solid');
                  setChartTypeMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#2a2e39] text-[#d1d4dc] flex items-center space-x-2"
              >
                <CandlestickChart size={14} />
                <span>Candles</span>
              </button>
              <button
                onClick={() => {
                  onSelectChartType('candle_stroke');
                  setChartTypeMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#2a2e39] text-[#d1d4dc] flex items-center space-x-2"
              >
                <CandlestickChart size={14} className="stroke-1" />
                <span>Hollow</span>
              </button>
              <button
                onClick={() => {
                  onSelectChartType('area');
                  setChartTypeMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#2a2e39] text-[#d1d4dc] flex items-center space-x-2"
              >
                <TrendingUp size={14} />
                <span>Line</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle & Right: Indicators, Replay, Volume Profile, Layout Grid, Alerts, Watchlist */}
      <div className="flex items-center space-x-2">
        {/* Indicators Button with Active Count */}
        <button
          onClick={onOpenIndicators}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-[#2a2e39]/60 hover:bg-[#2a2e39] text-[#d1d4dc] transition-colors border border-transparent hover:border-[#363c4e]"
          title="Indicators & Studies"
        >
          <Sliders size={14} className="text-[#2962ff]" />
          <span className="font-medium">Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#2962ff] text-white flex items-center justify-center text-[10px] font-bold">
              {activeIndicatorsCount}
            </span>
          )}
        </button>

        {/* Volume Profile Quick Toggle */}
        <button
          onClick={onToggleVolumeProfile}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded transition-colors ${
            volumeProfileEnabled
              ? 'bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/40 font-semibold'
              : 'text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
          }`}
          title="Volume Profile (VRVP)"
        >
          <BarChart2 size={14} />
          <span className="hidden md:inline">Volume Profile</span>
        </button>

        {/* Market Replay (Bar Replay) Button */}
        <button
          onClick={onToggleReplay}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded transition-colors ${
            isReplaying
              ? 'bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/40 font-semibold animate-pulse'
              : 'bg-[#2a2e39]/60 hover:bg-[#2a2e39] text-[#d1d4dc]'
          }`}
          title="Bar Replay mode"
        >
          <RotateCcw size={14} className={isReplaying ? 'text-[#f23645]' : 'text-[#868993]'} />
          <span className="font-medium">Replay</span>
        </button>

        {/* Layout Grid Selector */}
        <div className="relative">
          <button
            onClick={() => setGridMenuOpen(!gridMenuOpen)}
            className="flex items-center space-x-1 p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-[#d1d4dc] transition-colors"
            title="Multi-chart layout"
          >
            <LayoutGrid size={16} />
            <span className="font-semibold text-[#d1d4dc] text-[11px]">{gridLayout}</span>
            <ChevronDown size={12} />
          </button>
          {gridMenuOpen && (
            <div className="absolute right-0 top-9 w-36 bg-[#1e222d] border border-[#363c4e] rounded-lg shadow-xl py-1 z-50">
              {[
                { id: '1x1', label: 'Single (1x1)' },
                { id: '1x2', label: '2 Charts (1x2)' },
                { id: '2x1', label: '2 Charts (2x1)' },
                { id: '2x2', label: '4 Charts (2x2)' },
                { id: '1+3', label: '1 Main + 3 (1+3)' },
              ].map((grid) => (
                <button
                  key={grid.id}
                  onClick={() => {
                    onSelectGridLayout(grid.id as GridLayout);
                    setGridMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-[#2a2e39] flex items-center justify-between ${
                    gridLayout === grid.id ? 'text-[#2962ff] font-semibold' : 'text-[#d1d4dc]'
                  }`}
                >
                  <span>{grid.label}</span>
                  {gridLayout === grid.id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price Alerts */}
        <button
          onClick={onOpenAlerts}
          className="relative p-1.5 rounded hover:bg-[#2a2e39] text-[#868993] hover:text-[#d1d4dc] transition-colors"
          title="Price alerts"
        >
          <Bell size={16} />
          {alertsCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#f23645]" />
          )}
        </button>

        {/* Watchlist Toggle */}
        <button
          onClick={onToggleWatchlist}
          className={`p-1.5 rounded transition-colors ${
            watchlistOpen
              ? 'bg-[#2962ff]/20 text-[#2962ff]'
              : 'text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
          }`}
          title="Watchlist"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
};
