import React from 'react';
import { Play, Pause, SkipForward, SkipBack, X, FastForward, Clock } from 'lucide-react';

interface ReplayBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  speed: number;
  onSelectSpeed: (speed: number) => void;
  onExitReplay: () => void;
  currentBarTime?: string;
  currentBarPrice?: number;
}

export const ReplayBar: React.FC<ReplayBarProps> = ({
  isPlaying,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  speed,
  onSelectSpeed,
  onExitReplay,
  currentBarTime,
  currentBarPrice,
}) => {
  const speeds = [0.2, 0.5, 1, 2, 5, 10];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1e222d]/95 backdrop-blur-md border border-[#363c4e] shadow-2xl rounded-xl px-4 py-2.5 flex items-center space-x-4 select-none">
      {/* Title & Info */}
      <div className="flex items-center space-x-2 border-r border-[#2a2e39] pr-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#f23645] animate-ping" />
        <span className="font-bold text-xs text-[#d1d4dc]">BAR REPLAY</span>
        {currentBarTime && (
          <div className="flex items-center space-x-1 text-[11px] text-[#868993]">
            <Clock size={12} />
            <span>{currentBarTime}</span>
            {currentBarPrice && (
              <span className="font-mono text-[#d1d4dc] font-semibold ml-1">
                ${currentBarPrice.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Step Backward */}
      <button
        onClick={onStepBackward}
        className="w-8 h-8 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-[#d1d4dc] flex items-center justify-center transition-colors"
        title="Step back (1 bar)"
      >
        <SkipBack size={15} />
      </button>

      {/* Play / Pause */}
      <button
        onClick={onTogglePlay}
        className="w-10 h-10 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      {/* Step Forward */}
      <button
        onClick={onStepForward}
        className="w-8 h-8 rounded-lg bg-[#2a2e39] hover:bg-[#363c4e] text-[#d1d4dc] flex items-center justify-center transition-colors"
        title="Step forward (1 bar)"
      >
        <SkipForward size={15} />
      </button>

      {/* Speed Selector */}
      <div className="flex items-center space-x-1 bg-[#131722] p-1 rounded-lg border border-[#2a2e39]">
        <FastForward size={13} className="text-[#868993] ml-1 mr-0.5" />
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSelectSpeed(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              speed === s ? 'bg-[#2962ff] text-white' : 'text-[#868993] hover:text-[#d1d4dc]'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Exit Replay Button */}
      <button
        onClick={onExitReplay}
        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#f23645]/20 hover:bg-[#f23645]/30 text-[#f23645] border border-[#f23645]/40 text-xs font-semibold transition-colors ml-2"
        title="Exit Replay and return to real-time prices"
      >
        <X size={14} />
        <span>Exit to Live</span>
      </button>
    </div>
  );
};
