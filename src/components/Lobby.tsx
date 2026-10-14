import React, { useState, useEffect } from 'react';
import {
  Activity,
  Terminal,
  Crosshair,
  TrendingUp,
  Sliders,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  Clock,
} from 'lucide-react';

interface LobbyProps {
  onSelectTerminal: () => void;
  onSelectArena: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onSelectTerminal,
  onSelectArena,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation shortcuts: '1' -> Terminal, '2' -> Arena
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === '1') {
        onSelectTerminal();
      } else if (e.key === '2') {
        onSelectArena();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTerminal, onSelectArena]);

  return (
    <div className="h-screen w-screen bg-[#0a0d12] text-[#c9d1d9] font-mono flex flex-col justify-between selection:bg-[#238636] selection:text-white select-none overflow-hidden">
      {/* 1. Hardware-style Telemetry Header */}
      <header className="h-12 border-b border-[#21262d] bg-[#0d1117] px-6 flex items-center justify-between z-20 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#238636] rounded-xs" />
            <span className="font-bold tracking-wider text-white text-sm">
              OPENVIEW
            </span>
            <span className="text-gray-500 text-[11px]">/</span>
            <span className="text-gray-400 text-[11px] font-semibold tracking-wide">
              TERMINAL DISPATCH
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#21262d]" />

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
            <span className="text-[#3fb950] font-semibold">FEED: BINANCE WSS</span>
            <span className="text-gray-600">•</span>
            <span>ENGINE: KLINECHARTS v10</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">LATENCY: &lt;15ms</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>{utcTime || 'UTC CLOCK'}</span>
          </div>

          <a
            href="https://github.com/hpiotrowski/openview"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161b22] hover:bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d] transition-colors text-[11px]"
          >
            <span>GITHUB</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        </div>
      </header>

      {/* 2. Main Workstation Selector Console */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col justify-center gap-8">
        <div className="flex flex-col gap-1.5 border-b border-[#21262d] pb-5">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Terminal className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span className="font-semibold uppercase tracking-wider text-[#58a6ff]">
              OPERATIONAL ENVIRONMENT DISPATCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
            Select Trading Environment
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-sans max-w-2xl leading-relaxed">
            Institutional workstation architecture. Zero paywalls, zero cloud telemetry, direct exchange stream execution.
          </p>
        </div>

        {/* Dual Workstation Switchboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel 01: Live Charting Station */}
          <div
            onClick={onSelectTerminal}
            className="group bg-[#0d1117] hover:bg-[#121720] border border-[#30363d] hover:border-[#58a6ff] rounded-lg p-6 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-gray-300">
                    MODULE // 01
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#161b22] border border-[#30363d] text-gray-400">
                  PRESS [1]
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white font-sans group-hover:text-[#58a6ff] transition-colors flex items-center justify-between">
                  <span>Live Charting Terminal</span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#58a6ff] transition-transform group-hover:translate-x-1" />
                </h2>
                <p className="text-xs text-gray-400 font-sans mt-1.5 leading-relaxed">
                  Real-time market surveillance station with multi-panel synchronization, institutional indicators, and candle-level replay.
                </p>
              </div>

              {/* Technical Specifications Matrix */}
              <div className="bg-[#161b22] border border-[#21262d] rounded p-3 text-[11px] flex flex-col gap-2 font-mono">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-gray-500">FEED PROTOCOL</span>
                  <span className="text-gray-200">Binance Spot & Futures WSS</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">GRID TOPOLOGY</span>
                  <span className="text-gray-200">1x1, 1x2, 2x1, 2x2, 1+3 Sync</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">ANALYTICS ENGINE</span>
                  <span className="text-gray-200">VRVP, SMC, AVWAP, Liq Heatmap</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">HISTORICAL REPLAY</span>
                  <span className="text-gray-200">Tick-level scrub & playback</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={onSelectTerminal}
                className="w-full py-2.5 px-4 rounded bg-[#1f6feb] hover:bg-[#388bfd] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 font-sans tracking-wide"
              >
                <span>Launch Live Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Panel 02: Price Action Simulation Arena */}
          <div
            onClick={onSelectArena}
            className="group bg-[#0d1117] hover:bg-[#121720] border border-[#30363d] hover:border-[#d29922] rounded-lg p-6 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#21262d] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#d29922]" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-gray-300">
                    MODULE // 02
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#161b22] border border-[#30363d] text-gray-400">
                  PRESS [2]
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white font-sans group-hover:text-[#d29922] transition-colors flex items-center justify-between">
                  <span>Price Action Gym & Arena</span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#d29922] transition-transform group-hover:translate-x-1" />
                </h2>
                <p className="text-xs text-gray-400 font-sans mt-1.5 leading-relaxed">
                  Blind historical scenario simulator. Formulate asymmetric R:R entries at critical decision points without hindsight bias.
                </p>
              </div>

              {/* Technical Specifications Matrix */}
              <div className="bg-[#161b22] border border-[#21262d] rounded p-3 text-[11px] flex flex-col gap-2 font-mono">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-gray-500">BIAS MITIGATION</span>
                  <span className="text-gray-200">Asset & Timestamp Confidential</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">RISK ENGINE</span>
                  <span className="text-gray-200">Leverage (1x-50x), Dynamic R:R</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">TIMEFRAME SUITE</span>
                  <span className="text-gray-200">Scalp (1m/5m), Day (15m/1h), Swing</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 border-t border-[#21262d] pt-1.5">
                  <span className="text-gray-500">POST-MORTEM</span>
                  <span className="text-gray-200">Structural breakdown & debrief</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={onSelectArena}
                className="w-full py-2.5 px-4 rounded bg-[#d29922] hover:bg-[#e3b341] text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 font-sans tracking-wide"
              >
                <span>Enter Trading Arena</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Hotkeys Quick Reference Bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 py-2 px-4 rounded bg-[#161b22]/60 border border-[#21262d] text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-gray-200 font-mono text-[10px]">
              1
            </kbd>
            <span>Live Terminal</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-gray-200 font-mono text-[10px]">
              2
            </kbd>
            <span>Trading Arena</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-gray-200 font-mono text-[10px]">
              Space
            </kbd>
            <span>Playback Toggle</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-gray-200 font-mono text-[10px]">
              Esc
            </kbd>
            <span>Return to Lobby</span>
          </div>
        </div>
      </main>

      {/* 3. System Diagnostic Telemetry Footer */}
      <footer className="h-10 border-t border-[#21262d] bg-[#0d1117] px-6 flex items-center justify-between text-[11px] text-gray-500 font-mono">
        <div className="flex items-center gap-4">
          <span>HOST: LOCALHOST:3000</span>
          <span>•</span>
          <span>BUILD: STANDALONE CLIENT</span>
          <span>•</span>
          <span>LICENSE: MIT OPEN SOURCE</span>
        </div>
        <div className="hidden sm:block">
          <span>HIGH-DENSITY FINANCIAL INTERFACE</span>
        </div>
      </footer>
    </div>
  );
};
