import React from 'react';
import {
  BarChart3,
  Target,
  Layers,
  Repeat,
  Zap,
  TrendingUp,
  ShieldCheck,
  Globe2,
  Cpu,
  ArrowRight,
  Flame,
  LineChart,
} from 'lucide-react';

interface LobbyProps {
  onSelectTerminal: () => void;
  onSelectArena: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onSelectTerminal,
  onSelectArena,
}) => {
  return (
    <div className="min-h-screen w-screen bg-[#0d1117] text-[#d1d4dc] font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar */}
      <header className="h-16 border-b border-[#21262d] px-8 flex items-center justify-between bg-[#161b22]/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <LineChart className="w-5 h-5 text-black" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-white tracking-wider">
                OPENVIEW
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                PRO v1.0
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              Institutional Crypto Workstation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#21262d] border border-[#30363d] text-emerald-400 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Binance Data Feed: Connected
          </div>

          <a
            href="https://github.com/hpiotrowski/openview"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white transition-colors border border-[#30363d]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Hero Content / Mode Selection */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-12 flex flex-col justify-center gap-10">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            Zero Paywalls • Direct Public Market Streams
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            Choose Your Workspace
          </h1>
          <p className="text-gray-400 max-w-2xl text-sm md:text-base leading-relaxed">
            Analyze live markets with multi-chart synchronization and unlimited indicators,
            or master asymmetric Risk-to-Reward in the blind historical Trading Gym.
          </p>
        </div>

        {/* 2 Main Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Live Terminal */}
          <div
            onClick={onSelectTerminal}
            className="group relative bg-[#161b22] hover:bg-[#1a202c] border border-[#30363d] hover:border-cyan-500/60 rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

            <div className="flex flex-col gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-7 h-7" />
              </div>

              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                  Live Trading Station
                </span>
                <h2 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Live Charting Terminal
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-2 leading-relaxed">
                  High-speed multi-chart workstation equipped with real-time Binance WebSocket feeds,
                  VRVP Volume Profile, bar-by-bar Replay, and unlimited indicator overlays.
                </p>
              </div>

              {/* Feature Chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  '1x1 to 1+3 Grid',
                  'Crosshair Sync',
                  'Unlimited Indicators',
                  'Binance Live Feed',
                  'Bar Replay',
                  'Drawing Tools',
                ].map((chip) => (
                  <span
                    key={chip}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#21262d] border border-[#30363d] text-gray-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-8 relative z-10">
              <button
                onClick={onSelectTerminal}
                className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 group-hover:translate-x-1"
              >
                Launch Terminal
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Trading Arena / Gym */}
          <div
            onClick={onSelectArena}
            className="group relative bg-[#161b22] hover:bg-[#1a202c] border border-[#30363d] hover:border-amber-500/60 rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />

            <div className="flex flex-col gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Flame className="w-7 h-7" />
              </div>

              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 block mb-1">
                  Deliberate Practice Mode
                </span>
                <h2 className="text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Trading Gym & Arena
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-2 leading-relaxed">
                  Train your technical eye on real historical inflection points without hindsight bias.
                  Formulate asymmetric R:R setups with leverage, simulate candle-by-candle, and review debriefs.
                </p>
              </div>

              {/* Feature Chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  'Blind Historical Data',
                  'Leverage Calibrated (1x-50x)',
                  'Scalp, Daytrade & Swing',
                  'Inflection Points',
                  'Candle Simulation',
                  'Post-Trade Debrief',
                ].map((chip) => (
                  <span
                    key={chip}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#21262d] border border-[#30363d] text-gray-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-8 relative z-10">
              <button
                onClick={onSelectArena}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 group-hover:translate-x-1"
              >
                Enter Trading Arena
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="h-14 border-t border-[#21262d] px-8 flex items-center justify-between text-xs text-gray-500 bg-[#161b22]/50">
        <div className="flex items-center gap-4">
          <span>OpenView Crypto Workstation</span>
          <span>•</span>
          <span>Released under MIT License</span>
          <span>•</span>
          <span>Nominative Fair Use Protected</span>
        </div>
        <div>
          <span>Crafted for high-frequency & price action crypto traders</span>
        </div>
      </footer>
    </div>
  );
};
