import { KLineBar } from './binance';

export class ReplayEngine {
  private allBars: KLineBar[] = [];
  private currentIndex = 0;
  private intervalTimer: any = null;
  public isReplaying = false;
  public isPlaying = false;
  public speed = 1; // 1x, 2x, 5x, 10x

  setBars(bars: KLineBar[]) {
    this.allBars = [...bars];
  }

  startReplay(cutTimestamp: number): KLineBar[] {
    const idx = this.allBars.findIndex((b) => b.timestamp >= cutTimestamp);
    this.currentIndex = idx !== -1 ? idx : Math.floor(this.allBars.length * 0.7);
    this.isReplaying = true;
    this.isPlaying = false;
    this.clearTimer();
    return this.getVisibleBars();
  }

  getVisibleBars(): KLineBar[] {
    return this.allBars.slice(0, this.currentIndex + 1);
  }

  stepForward(): KLineBar | null {
    if (this.currentIndex < this.allBars.length - 1) {
      this.currentIndex++;
      return this.allBars[this.currentIndex];
    }
    this.pause();
    return null;
  }

  stepBackward(): KLineBar[] | null {
    if (this.currentIndex > 10) {
      this.currentIndex--;
      return this.getVisibleBars();
    }
    return null;
  }

  play(onNextBar: (bar: KLineBar) => void) {
    this.clearTimer();
    this.isPlaying = true;

    const intervalMs = Math.max(50, Math.floor(1000 / this.speed));
    this.intervalTimer = setInterval(() => {
      const nextBar = this.stepForward();
      if (nextBar) {
        onNextBar(nextBar);
      } else {
        this.pause();
      }
    }, intervalMs);
  }

  pause() {
    this.isPlaying = false;
    this.clearTimer();
  }

  setSpeed(newSpeed: number, onNextBar?: (bar: KLineBar) => void) {
    this.speed = newSpeed;
    if (this.isPlaying && onNextBar) {
      this.play(onNextBar);
    }
  }

  stop(): KLineBar[] {
    this.clearTimer();
    this.isReplaying = false;
    this.isPlaying = false;
    return this.allBars;
  }

  private clearTimer() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
