import React, { useState, useRef, useEffect } from 'react';
import { TopNavbar, ChartType, GridLayout } from './components/TopNavbar';
import { DrawingToolbar } from './components/DrawingToolbar';
import { Chart } from './components/Chart';
import { IndicatorsModal } from './components/IndicatorsModal';
import { ReplayBar } from './components/ReplayBar';
import { WatchlistSidebar } from './components/WatchlistSidebar';
import { AlertsModal, PriceAlert } from './components/AlertsModal';
import { Lobby } from './components/Lobby';
import { TradingArena } from './components/TradingArena';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ReplayEngine } from './services/replayEngine';
import { Crosshair } from 'klinecharts';

interface ChartPanelConfig {
  id: string;
  symbol: string;
  interval: string;
}

import { StorageService } from './services/storage';

export const App: React.FC = () => {
  // Navigation Mode
  const [mode, setMode] = useState<'lobby' | 'terminal' | 'arena'>('lobby');

  // AI Copilot Drawer & Sentinel state
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [isSentinelActive, setIsSentinelActive] = useState(() => StorageService.getAutoSentinel());

  // Global settings
  const [currentSymbol, setCurrentSymbol] = useState(() => StorageService.getCurrentSymbol());
  const [currentInterval, setCurrentInterval] = useState(() => StorageService.getCurrentInterval());
  const [chartType, setChartType] = useState<ChartType>(() => StorageService.getChartType() as ChartType);

  // Drawing tools
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [clearDrawingsTrigger, setClearDrawingsTrigger] = useState(0);

  // Indicators & Overlays (Unlimited)
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(() => StorageService.getActiveIndicators());
  const [volumeProfileEnabled, setVolumeProfileEnabled] = useState(true);

  // Grid Layout
  const [gridLayout, setGridLayout] = useState<GridLayout>(() => StorageService.getGridLayout() as GridLayout);
  const [activeChartId, setActiveChartId] = useState('chart-1');

  // Watchlist Sidebar
  const [watchlistOpen, setWatchlistOpen] = useState(() => StorageService.getWatchlistOpen());

  // Sync state changes to localStorage
  useEffect(() => {
    StorageService.setActiveIndicators(activeIndicators);
  }, [activeIndicators]);

  useEffect(() => {
    StorageService.setCurrentInterval(currentInterval);
  }, [currentInterval]);

  useEffect(() => {
    StorageService.setCurrentSymbol(currentSymbol);
  }, [currentSymbol]);

  useEffect(() => {
    StorageService.setChartType(chartType);
  }, [chartType]);

  useEffect(() => {
    StorageService.setWatchlistOpen(watchlistOpen);
  }, [watchlistOpen]);

  useEffect(() => {
    StorageService.setGridLayout(gridLayout);
  }, [gridLayout]);

  // Multi-chart panels configuration
  const [panels, setPanels] = useState<ChartPanelConfig[]>([
    { id: 'chart-1', symbol: 'BTCUSDT', interval: '15m' },
    { id: 'chart-2', symbol: 'BTCUSDT', interval: '1h' },
    { id: 'chart-3', symbol: 'ETHUSDT', interval: '15m' },
    { id: 'chart-4', symbol: 'SOLUSDT', interval: '15m' },
  ]);

  // Market Replay Engine
  const replayEngineRef = useRef(new ReplayEngine());
  const [isReplaying, setIsReplaying] = useState(false);
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [currentBarPrice, setCurrentBarPrice] = useState<number>(0);

  // Crosshair Sync
  const [syncedCrosshair, setSyncedCrosshair] = useState<{
    crosshair: Crosshair;
    sourceId: string;
  } | null>(null);

  // Alerts
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  // WebAudio Beep function for alerts
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {}
  };

  // Monitor price changes against active alerts
  const handlePriceUpdate = (price: number) => {
    setCurrentBarPrice(price);

    // Check alerts
    setAlerts((prevAlerts) =>
      prevAlerts.map((alert) => {
        if (alert.symbol === currentSymbol && !alert.triggered) {
          const isTriggered =
            (alert.condition === 'ABOVE' && price >= alert.targetPrice) ||
            (alert.condition === 'BELOW' && price <= alert.targetPrice);

          if (isTriggered) {
            playAlertSound();
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Price Alert: ${alert.symbol}`, {
                body: `Price reached $${price.toLocaleString()}`,
              });
            }
            return { ...alert, triggered: true };
          }
        }
        return alert;
      })
    );
  };

  // Switch symbol for the currently focused chart panel
  const handleSelectSymbol = (sym: string) => {
    setCurrentSymbol(sym);
    setPanels((prev) =>
      prev.map((p) => (p.id === activeChartId ? { ...p, symbol: sym } : p))
    );
  };

  // Switch interval for the currently focused chart panel
  const handleSelectInterval = (intv: string) => {
    setCurrentInterval(intv);
    setPanels((prev) =>
      prev.map((p) => (p.id === activeChartId ? { ...p, interval: intv } : p))
    );
  };

  // Synchronize Replay Engine events with App state
  useEffect(() => {
    const unsub = replayEngineRef.current.subscribe((event) => {
      setIsPlaybackRunning(replayEngineRef.current.isPlaying);
      if (event.currentBar) {
        setCurrentBarPrice(event.currentBar.close);
      }
    });
    return () => unsub();
  }, []);

  // Replay actions
  const handleToggleReplay = () => {
    if (isReplaying) {
      replayEngineRef.current.stop();
      setIsReplaying(false);
      setIsPlaybackRunning(false);
    } else {
      setIsReplaying(true);
      setIsPlaybackRunning(false);
      // Auto-initialize cut point at 80% if not yet sliced
      if (!replayEngineRef.current.isReplaying) {
        replayEngineRef.current.startReplay();
      }
    }
  };

  const handleStepForward = () => {
    replayEngineRef.current.stepForward();
  };

  const handleStepBackward = () => {
    replayEngineRef.current.stepBackward();
  };

  const handleTogglePlay = () => {
    const engine = replayEngineRef.current;
    if (engine.isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
  };

  const handleSelectSpeed = (speed: number) => {
    setReplaySpeed(speed);
    replayEngineRef.current.setSpeed(speed);
  };

  // Global keyboard shortcuts for Replay mode (Space = play/pause, Left/Right = step, Esc = exit)
  useEffect(() => {
    if (!isReplaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepBackward();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleToggleReplay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReplaying]);

  // Crosshair move from one chart broadcasts to others
  const handleCrosshairMove = (crosshair: Crosshair, sourceId: string) => {
    setSyncedCrosshair({ crosshair, sourceId });
  };

  // Add & Remove Indicators
  const handleAddIndicator = (name: string, _isOverlay: boolean) => {
    if (name === 'VP') {
      setVolumeProfileEnabled(true);
    }
    setActiveIndicators((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const handleRemoveIndicator = (name: string) => {
    if (name === 'VP') {
      setVolumeProfileEnabled(false);
    }
    setActiveIndicators((prev) => prev.filter((i) => i !== name));
  };

  // Active panels based on grid layout
  const getVisiblePanels = () => {
    switch (gridLayout) {
      case '1x1':
        return [panels[0]];
      case '1x2':
        return [panels[0], panels[1]];
      case '2x1':
        return [panels[0], panels[1]];
      case '2x2':
        return panels.slice(0, 4);
      case '1+3':
        return panels.slice(0, 4);
      default:
        return [panels[0]];
    }
  };

  const visiblePanels = getVisiblePanels();

  if (mode === 'lobby') {
    return (
      <Lobby
        onSelectTerminal={() => setMode('terminal')}
        onSelectArena={() => setMode('arena')}
      />
    );
  }

  if (mode === 'arena') {
    return <TradingArena onBackToLobby={() => setMode('lobby')} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131722] text-[#d1d4dc] overflow-hidden select-none font-sans">
      {/* Top Navbar */}
      <TopNavbar
        currentSymbol={currentSymbol}
        onSelectSymbol={handleSelectSymbol}
        currentInterval={currentInterval}
        onSelectInterval={handleSelectInterval}
        chartType={chartType}
        onSelectChartType={setChartType}
        onOpenIndicators={() => setIndicatorsModalOpen(true)}
        activeIndicatorsCount={activeIndicators.length}
        isReplaying={isReplaying}
        onToggleReplay={handleToggleReplay}
        volumeProfileEnabled={volumeProfileEnabled}
        onToggleVolumeProfile={() => {
          const nextVal = !volumeProfileEnabled;
          setVolumeProfileEnabled(nextVal);
          if (nextVal) {
            setActiveIndicators((prev) => (prev.includes('VP') ? prev : [...prev, 'VP']));
          } else {
            setActiveIndicators((prev) => prev.filter((i) => i !== 'VP'));
          }
        }}
        gridLayout={gridLayout}
        onSelectGridLayout={setGridLayout}
        onOpenAlerts={() => setAlertsModalOpen(true)}
        alertsCount={alerts.filter((a) => !a.triggered).length}
        watchlistOpen={watchlistOpen}
        onToggleWatchlist={() => setWatchlistOpen(!watchlistOpen)}
        onBackToLobby={() => setMode('lobby')}
        onOpenArena={() => setMode('arena')}
        currentPrice={currentBarPrice}
        isAICopilotOpen={aiCopilotOpen}
        onToggleAICopilot={() => setAiCopilotOpen(!aiCopilotOpen)}
        isSentinelActive={isSentinelActive}
      />

      {/* Main Workspace: Left Drawing Toolbar + Central Chart Area + Right Watchlist */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Drawing Toolbar */}
        <DrawingToolbar
          activeTool={activeDrawingTool || 'cursor'}
          onSelectTool={(tool) => setActiveDrawingTool(tool)}
          onClearDrawings={() => {
            StorageService.clearDrawings(currentSymbol);
            setClearDrawingsTrigger(Date.now());
          }}
          magnetEnabled={magnetEnabled}
          onToggleMagnet={() => setMagnetEnabled(!magnetEnabled)}
        />

        {/* Central Charts Grid */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#131722]">
          <div
            className={`w-full h-full p-1 gap-1 grid ${
              gridLayout === '1x1'
                ? 'grid-cols-1 grid-rows-1'
                : gridLayout === '1x2'
                ? 'grid-cols-2 grid-rows-1'
                : gridLayout === '2x1'
                ? 'grid-cols-1 grid-rows-2'
                : gridLayout === '2x2'
                ? 'grid-cols-2 grid-rows-2'
                : 'grid-cols-3 grid-rows-2'
            }`}
          >
            {visiblePanels.map((p, idx) => {
              const isFirstInOnePlusThree = gridLayout === '1+3' && idx === 0;
              const isFocused = p.id === activeChartId;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveChartId(p.id);
                    setCurrentSymbol(p.symbol);
                    setCurrentInterval(p.interval);
                  }}
                  className={`relative rounded overflow-hidden border transition-all ${
                    isFirstInOnePlusThree ? 'col-span-2 row-span-2' : ''
                  } ${
                    isFocused
                      ? 'border-[#2962ff]/60 shadow-md ring-1 ring-[#2962ff]/30'
                      : 'border-[#2a2e39] hover:border-[#363c4e]'
                  }`}
                >
                  <Chart
                    id={p.id}
                    symbol={p.symbol}
                    interval={p.interval}
                    chartType={chartType}
                    activeDrawingTool={isFocused ? activeDrawingTool : null}
                    onOverlayCreated={() => setActiveDrawingTool(null)}
                    activeIndicators={activeIndicators}
                    onRemoveIndicator={handleRemoveIndicator}
                    volumeProfileEnabled={volumeProfileEnabled}
                    replayEngine={replayEngineRef.current}
                    isReplayActive={isReplaying}
                    onCrosshairMove={handleCrosshairMove}
                    externalCrosshair={
                      syncedCrosshair && syncedCrosshair.sourceId !== p.id
                        ? syncedCrosshair.crosshair
                        : null
                    }
                    onPriceUpdate={isFocused ? handlePriceUpdate : undefined}
                    clearDrawingsTrigger={clearDrawingsTrigger}
                  />
                </div>
              );
            })}
          </div>

          {/* Floating Replay Bar at Bottom */}
          {isReplaying && (
            <ReplayBar
              isPlaying={isPlaybackRunning}
              onTogglePlay={handleTogglePlay}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              speed={replaySpeed}
              onSelectSpeed={handleSelectSpeed}
              onExitReplay={handleToggleReplay}
              currentBarPrice={currentBarPrice}
            />
          )}
        </main>

        {/* Right Watchlist Sidebar */}
        <WatchlistSidebar
          isOpen={watchlistOpen}
          onClose={() => setWatchlistOpen(false)}
          activeSymbol={currentSymbol}
          onSelectSymbol={handleSelectSymbol}
        />
      </div>

      {/* Indicators Modal */}
      <IndicatorsModal
        isOpen={indicatorsModalOpen}
        onClose={() => setIndicatorsModalOpen(false)}
        activeIndicators={activeIndicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
      />

      {/* Alerts Modal */}
      <AlertsModal
        isOpen={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        currentSymbol={currentSymbol}
        currentPrice={currentBarPrice}
        alerts={alerts}
        onAddAlert={(alert) => {
          setAlerts([
            ...alerts,
            {
              ...alert,
              id: Date.now().toString(),
              createdAt: Date.now(),
              triggered: false,
            },
          ]);
        }}
        onDeleteAlert={(id) => setAlerts(alerts.filter((a) => a.id !== id))}
      />

      {/* AI Copilot Drawer */}
      <AICopilotDrawer
        isOpen={aiCopilotOpen}
        onClose={() => setAiCopilotOpen(false)}
        activeChartId={activeChartId}
        currentSymbol={currentSymbol}
        currentInterval={currentInterval}
        currentPrice={currentBarPrice}
      />
    </div>
  );
};

export default App;
