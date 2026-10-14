import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, X, Search } from 'lucide-react';
import { BinanceService, WatchlistTicker } from '../services/binance';

interface WatchlistSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const WatchlistSidebar: React.FC<WatchlistSidebarProps> = ({
  isOpen,
  onClose,
  activeSymbol,
  onSelectSymbol,
}) => {
  const [tickers, setTickers] = useState<WatchlistTicker[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const loadTickers = async () => {
    setLoading(true);
    const data = await BinanceService.fetch24hTickers();
    setTickers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTickers();
    const interval = setInterval(loadTickers, 8000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const filtered = tickers.filter(
    (t) =>
      t.symbol.toLowerCase().includes(filter.toLowerCase()) ||
      t.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside className="w-64 bg-[#1e222d] border-l border-[#2a2e39] flex flex-col h-full z-20 select-none text-xs">
      {/* Header */}
      <div className="h-10 px-3 border-b border-[#2a2e39] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#d1d4dc]">Watchlist</span>
          <button
            onClick={loadTickers}
            className={`p-1 rounded text-[#868993] hover:text-[#d1d4dc] ${loading ? 'animate-spin' : ''}`}
            title="Refresh prices"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]"
        >
          <X size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[#2a2e39]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-[#868993]" />
          <input
            type="text"
            placeholder="Filter symbols..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-[#131722] border border-[#2a2e39] rounded pl-8 pr-2 py-1.5 text-xs text-[#d1d4dc] outline-none placeholder-[#50535e]"
          />
        </div>
      </div>

      {/* Tickers List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/50">
        {filtered.map((item) => {
          const isSelected = item.symbol === activeSymbol;
          const isPositive = item.change24h >= 0;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#2962ff]/15 border-l-2 border-[#2962ff]'
                  : 'hover:bg-[#2a2e39]/60'
              }`}
            >
              <div>
                <div className="font-bold text-[#d1d4dc] flex items-center space-x-1.5">
                  <span>{item.symbol.replace('USDT', '')}</span>
                  <span className="text-[10px] text-[#868993] font-normal">/USDT</span>
                </div>
                <div className="text-[10px] text-[#868993]">{item.name}</div>
              </div>

              <div className="text-right">
                <div className="font-mono font-semibold text-[#d1d4dc]">
                  ${item.price > 10 ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.price}
                </div>
                <div
                  className={`text-[10px] font-semibold flex items-center justify-end space-x-0.5 ${
                    isPositive ? 'text-[#089981]' : 'text-[#f23645]'
                  }`}
                >
                  {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span>{isPositive ? '+' : ''}{item.change24h.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="p-2 border-t border-[#2a2e39] text-[10px] text-[#868993] text-center">
        Binance Public Feed
      </div>
    </aside>
  );
};
