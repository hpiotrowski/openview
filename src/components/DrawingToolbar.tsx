import React from 'react';
import {
  MousePointer,
  Minus,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  Square,
  Circle,
  Type,
  Trash2,
  Magnet,
  Maximize2,
  GitCommit,
  SplitSquareHorizontal,
  BarChart2,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';

export interface DrawingTool {
  id: string;
  name: string;
  icon: React.ElementType;
  overlayName?: string;
  tooltip: string;
}

interface DrawingToolbarProps {
  activeTool: string;
  onSelectTool: (overlayName: string | null) => void;
  onClearDrawings: () => void;
  magnetEnabled: boolean;
  onToggleMagnet: () => void;
}

export const DRAWING_TOOLS: DrawingTool[] = [
  { id: 'cursor', name: 'Cursor', icon: MousePointer, tooltip: 'Cursor (Pointer)' },
  { id: 'longPosition', name: 'Long Position', icon: ArrowUpCircle, overlayName: 'longPosition', tooltip: 'Long Position (Click 1: Entry, 2: Target, 3: Stop)' },
  { id: 'shortPosition', name: 'Short Position', icon: ArrowDownCircle, overlayName: 'shortPosition', tooltip: 'Short Position (Click 1: Entry, 2: Target, 3: Stop)' },
  { id: 'segment', name: 'Trend Line', icon: TrendingUp, overlayName: 'segment', tooltip: 'Trend Line' },
  { id: 'rayLine', name: 'Ray', icon: ArrowUpRight, overlayName: 'rayLine', tooltip: 'Ray' },
  { id: 'straightLine', name: 'Extended Line', icon: Minus, overlayName: 'straightLine', tooltip: 'Extended Line' },
  { id: 'horizontalStraightLine', name: 'Horizontal Line', icon: SlidersHorizontal, overlayName: 'horizontalStraightLine', tooltip: 'Horizontal Line' },
  { id: 'horizontalRayLine', name: 'Horizontal Ray', icon: ArrowUpRight, overlayName: 'horizontalRayLine', tooltip: 'Horizontal Ray' },
  { id: 'fibonacciLine', name: 'Fibonacci Retracement', icon: GitCommit, overlayName: 'fibonacciLine', tooltip: 'Fibonacci Retracement' },
  { id: 'frvp', name: 'Fixed Range Volume Profile', icon: BarChart2, overlayName: 'frvp', tooltip: 'Fixed Range Volume Profile (Click start & end candle)' },
  { id: 'priceChannelLine', name: 'Parallel Channel', icon: SplitSquareHorizontal, overlayName: 'priceChannelLine', tooltip: 'Parallel Channel' },
  { id: 'rect', name: 'Rectangle', icon: Square, overlayName: 'rect', tooltip: 'Rectangle / Box' },
  { id: 'circle', name: 'Circle', icon: Circle, overlayName: 'circle', tooltip: 'Circle' },
  { id: 'simpleAnnotation', name: 'Text', icon: Type, overlayName: 'simpleAnnotation', tooltip: 'Text Note' },
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  onClearDrawings,
  magnetEnabled,
  onToggleMagnet,
}) => {
  return (
    <aside className="w-12 bg-[#1e222d] border-r border-[#2a2e39] flex flex-col items-center py-2 z-20 select-none">
      <div className="flex flex-col space-y-1 w-full px-1.5">
        {DRAWING_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === (tool.overlayName || 'cursor');
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.overlayName || null)}
              title={tool.tooltip}
              className={`w-9 h-9 flex items-center justify-center rounded transition-colors group relative ${
                isActive
                  ? 'bg-[#2962ff] text-white shadow-sm'
                  : 'text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
              }`}
            >
              <Icon size={18} />
              <span className="sr-only">{tool.name}</span>
            </button>
          );
        })}
      </div>

      <div className="w-6 h-[1px] bg-[#2a2e39] my-2" />

      {/* Auxiliary tools */}
      <div className="flex flex-col space-y-1 w-full px-1.5">
        <button
          onClick={onToggleMagnet}
          title={magnetEnabled ? 'Magnet mode on (snaps to OHLC)' : 'Magnet mode off'}
          className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
            magnetEnabled
              ? 'bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/40'
              : 'text-[#868993] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
          }`}
        >
          <Magnet size={18} />
        </button>

        <button
          onClick={onClearDrawings}
          title="Clear all drawings"
          className="w-9 h-9 flex items-center justify-center rounded text-[#868993] hover:text-[#f23645] hover:bg-[#2a2e39] transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </aside>
  );
};
