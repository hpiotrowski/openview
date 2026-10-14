import { KLineBar } from './binance';

export type ReplayEventType = 'start' | 'step' | 'backward' | 'play' | 'pause' | 'stop';

export interface ReplayEvent {
  type: ReplayEventType;
  bars: KLineBar[];
  currentBar: KLineBar | null;
  currentIndex: number;
  totalBars: number;
}

export type ReplayListener = (event: ReplayEvent) => void;

export class ReplayEngine {
  private allBars: KLineBar[] = [];
  private currentIndex = 0;
  private intervalTimer: any = null;
  private listeners: Set<ReplayListener> = new Set();

  public isReplaying = false;
  public isPlaying = false;
  public speed = 1; // 0.2x, 0.5x, 1x, 2x, 5x, 10x

  public subscribe(listener: ReplayListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(type: ReplayEventType) {
    const event: ReplayEvent = {
      type,
      bars: this.getVisibleBars(),
      currentBar: this.getCurrentBar(),
      currentIndex: this.currentIndex,
      totalBars: this.allBars.length,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in ReplayEngine listener:', err);
      }
    });
  }

  setBars(bars: KLineBar[]) {
    this.allBars = [...bars];
  }

  getBarsCount(): number {
    return this.allBars.length;
  }

  startReplay(cutTimestamp?: number): KLineBar[] {
    if (this.allBars.length === 0) return [];

    if (cutTimestamp !== undefined && cutTimestamp > 0) {
      const idx = this.allBars.findIndex((b) => b.timestamp >= cutTimestamp);
      this.currentIndex = idx !== -1 ? Math.max(0, idx) : Math.floor(this.allBars.length * 0.7);
    } else {
      // Default to 80% through the data so user has 20% future bars to replay immediately
      this.currentIndex = Math.max(10, Math.floor(this.allBars.length * 0.8));
    }

    this.isReplaying = true;
    this.isPlaying = false;
    this.clearTimer();
    this.emit('start');
    return this.getVisibleBars();
  }

  getVisibleBars(): KLineBar[] {
    if (this.allBars.length === 0) return [];
    const end = Math.min(this.currentIndex + 1, this.allBars.length);
    return this.allBars.slice(0, end);
  }

  getCurrentBar(): KLineBar | null {
    if (this.allBars.length === 0 || this.currentIndex < 0) return null;
    return this.allBars[this.currentIndex] || null;
  }

  getCurrentTimestamp(): number | null {
    const bar = this.getCurrentBar();
    return bar ? bar.timestamp : null;
  }

  stepForward(): KLineBar | null {
    // If replay mode hasn't been initialized with a cut point, initialize automatically
    if (!this.isReplaying) {
      this.startReplay();
    }

    if (this.currentIndex < this.allBars.length - 1) {
      this.currentIndex++;
      const nextBar = this.allBars[this.currentIndex];
      this.emit('step');
      return nextBar;
    }

    this.pause();
    return null;
  }

  stepBackward(): KLineBar[] | null {
    if (!this.isReplaying) {
      this.startReplay();
    }

    if (this.currentIndex > 5) {
      this.currentIndex--;
      this.emit('backward');
      return this.getVisibleBars();
    }
    return null;
  }

  play(onNextBar?: (bar: KLineBar) => void) {
    if (!this.isReplaying) {
      this.startReplay();
    }

    this.clearTimer();
    this.isPlaying = true;
    this.emit('play');

    const intervalMs = Math.max(50, Math.floor(1000 / this.speed));
    this.intervalTimer = setInterval(() => {
      const nextBar = this.stepForward();
      if (nextBar) {
        if (onNextBar) onNextBar(nextBar);
      } else {
        this.pause();
      }
    }, intervalMs);
  }

  pause() {
    this.isPlaying = false;
    this.clearTimer();
    this.emit('pause');
  }

  setSpeed(newSpeed: number, onNextBar?: (bar: KLineBar) => void) {
    this.speed = newSpeed;
    if (this.isPlaying) {
      this.play(onNextBar);
    }
  }

  stop(): KLineBar[] {
    this.clearTimer();
    this.isReplaying = false;
    this.isPlaying = false;
    this.emit('stop');
    return this.allBars;
  }

  private clearTimer() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
