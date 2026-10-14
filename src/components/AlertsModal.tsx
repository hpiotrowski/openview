import React, { useState } from 'react';
import { X, Bell, Plus, Trash2, Volume2, CheckCircle2 } from 'lucide-react';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  createdAt: number;
  triggered: boolean;
}

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol: string;
  currentPrice: number;
  alerts: PriceAlert[];
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  onDeleteAlert: (id: string) => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  currentPrice,
  alerts,
  onAddAlert,
  onDeleteAlert,
}) => {
  const [targetPrice, setTargetPrice] = useState<string>(currentPrice ? currentPrice.toString() : '');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    onAddAlert({
      symbol: currentSymbol,
      targetPrice: priceNum,
      condition,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1e222d] border border-[#363c4e] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2a2e39] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell size={16} className="text-[#2962ff]" />
            <span className="font-bold text-sm text-[#d1d4dc]">Price Alerts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Add Alert Form */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-[#2a2e39] space-y-3 bg-[#131722]/40">
          <div className="flex items-center justify-between text-[#868993]">
            <span>Symbol: <strong className="text-[#d1d4dc]">{currentSymbol}</strong></span>
            <span>Current: <strong className="text-[#d1d4dc] font-mono">${currentPrice.toLocaleString()}</strong></span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-[#868993] block mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2.5 py-1.5 text-xs text-[#d1d4dc] outline-none"
              >
                <option value="ABOVE">Crossing Above (≥</option>
                <option value="BELOW">Crossing Below (≤)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#868993] block mb-1">Target Price ($)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 95000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[#1e222d] border border-[#2a2e39] rounded px-2.5 py-1.5 text-xs text-[#d1d4dc] outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white font-semibold flex items-center justify-center space-x-1 transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>Create Alert</span>
          </button>
        </form>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto max-h-60 p-4 divide-y divide-[#2a2e39]/50">
          <div className="text-[11px] font-bold text-[#868993] mb-2 uppercase tracking-wider">
            Active Alerts ({alerts.length})
          </div>

          {alerts.length === 0 ? (
            <div className="py-6 text-center text-[#868993]">No active alerts set.</div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded ${alert.triggered ? 'bg-[#089981]/20 text-[#089981]' : 'bg-[#2a2e39] text-[#2962ff]'}`}>
                    {alert.triggered ? <CheckCircle2 size={14} /> : <Volume2 size={14} />}
                  </div>
                  <div>
                    <div className="font-semibold text-[#d1d4dc] flex items-center space-x-1.5">
                      <span>{alert.symbol}</span>
                      <span className="font-mono text-[#2962ff]">
                        {alert.condition === 'ABOVE' ? '≥' : '≤'} ${alert.targetPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#868993]">
                      {alert.triggered ? 'Triggered' : 'Awaiting price trigger...'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteAlert(alert.id)}
                  className="p-1 rounded text-[#868993] hover:text-[#f23645] hover:bg-[#2a2e39] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#131722]/50 border-t border-[#2a2e39] text-[10px] text-[#868993] flex items-center justify-between">
          <span>Audio alert + desktop notification</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#2a2e39] hover:bg-[#363c4e] text-[#d1d4dc] font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
