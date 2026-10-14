# OpenView

> A high-performance, open-source crypto desktop charting and technical analysis platform modeled after TradingView, built to eliminate artificial paywalls.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-44-47848f.svg)](https://www.electronjs.org/)

---

## Overview

**OpenView** is an institutional-grade technical analysis workstation for crypto traders. It provides direct, zero-configuration access to Binance spot market data with no account creation, no API keys, and no rate-limit hurdles, while unlocking professional features traditionally gated behind expensive subscriptions.

---

## Key Features

### 1. Unlimited Concurrent Indicators
- Overlay unlimited indicators simultaneously on the main chart (EMA, SMA, Bollinger Bands, Parabolic SAR, BBI) and across multiple sub-windows (RSI, MACD, KDJ, OBV, ATR, Volume).
- No arbitrary 2–3 indicator tier caps.

### 2. Multi-Chart Grid Workspaces
- Flexible layouts: **1x1**, **1x2 (vertical)**, **2x1 (horizontal)**, **2x2 (quad)**, and **1+3 (master + 3 secondary)**.
- **Synchronized Crosshair**: Real-time cross-pane cursor and timestamp tracking across all panes.
- Independent symbol and interval selection per chart tile (e.g., monitor BTCUSDT across 15m, 1h, 4h, and 1D simultaneously).

### 3. Intraday Market Replay (Bar-by-Bar Backtesting)
- Step through historical price action candle-by-candle across all supported intervals (`1s`, `1m`, `3m`, `5m`, `15m`, `1h`, `4h`, `1D`).
- Interactive transport controls: Step Backward, Play / Pause, Step Forward, and variable speed slider (0.2x to 10x).

### 4. Visible Range Volume Profile (VRVP)
- Dynamic on-chart volume distribution computed from the visible candle range.
- Automatic computation and rendering of:
  - **Point of Control (POC)**: The price level with the highest traded volume.
  - **Value Area High (VAH) & Value Area Low (VAL)**: The 70% volume concentration band.
  - Two-tone buy/sell volume delta histogram.

### 5. Institutional & Smart Money Indicator Suite

- **Smart Money Concepts (LuxAlgo / ICT style)**:
  - Institutional Order Blocks (`+OB` / `-OB`) with displacement validation.
  - Fair Value Gaps (FVG) with dynamic fill tracking.
  - Market structure shifts: Break of Structure (BOS) and Change of Character (CHoCH).
- **Displacement Supply & Demand (Flux Charts style)**:
  - Base-and-impulse range detection with ATR expansion filtering.
  - Fresh vs. tested zone lifecycle tracking with ray extensions.
- **Multi-EMA Momentum Ribbon (Cipher A style)**:
  - 8-period exponential moving average ribbon (EMA 5 to 48).
  - Volatility squeeze breakouts, continuation signals, and divergence alerts.
- **WaveTrend & Money Flow (Cipher B style)**:
  - Dual-smoothed momentum oscillators with overbought / oversold crossover signals.
  - Money Flow Index (MFI) volumetric area cloud.
- **ICT Killzones & Silver Bullet**:
  - Automatically highlighted institutional trading sessions (Asian Range with session highs/lows, London Open, and NY Silver Bullet).
  - Judas Swing false breakout detection.
- **Anchored VWAP (Auto-Peak)**:
  - Volume-Weighted Average Price anchored dynamically to major swing highs (ATH) and lows (ATL).
  - Real-time $\pm 1\sigma$ and $\pm 2\sigma$ standard deviation volatility bands.
- **Leverage Liquidation Heatmap (Kingfisher style)**:
  - High-density liquidation cluster estimation across major leverage tiers (10x, 25x, 50x, 100x).
  - Proximity magnet tags for anticipated liquidity grabs.
- **Liquidity Sweeps / SFP (Swing Failure Patterns)**:
  - Automated detection of key high/low wick sweeps followed by rapid reclaiming.
- **Premium vs. Discount Zones**:
  - 50% Equilibrium swing boundary mapping for value-based entries.

### 6. Zero-Config Market Feed
- High-frequency data pipeline using public Binance REST endpoints and WebSockets.
- Zero API keys or tokens required.
- High-resolution timeframes: `1s`, `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1D`, `1W`.

### 7. Professional Drawing & Measurement Tools
- Trend lines, rays, horizontal levels, Fibonacci retracements, parallel channels, supply/demand rectangles, circles, and price callouts.
- High-precision magnet snapping to bar OHLC values.

---

## Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/) |
| **Bundler & Tooling** | [Vite 8](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Chart Engine** | [KlineCharts v10](https://klinecharts.com/) + Custom HTML5 Canvas Overlays |
| **Desktop Runtime** | [Electron 44](https://www.electronjs.org/) |
| **Icons** | [Lucide React](https://lucide.dev/) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended, v20+ LTS preferred)
- npm, yarn, or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/hpiotrowski/openview.git
cd openview

# Install dependencies
npm install
```

### Running Locally

#### Development Web Server (Browser Mode)
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

#### Desktop App (Electron Mode)
```bash
npm run electron
```

#### Production Build
```bash
npm run build
```

---

## Project Structure

```text
openview/
├── electron/
│   ├── main.cjs               # Electron main process
│   └── preload.cjs            # Electron preload bridge
├── src/
│   ├── components/
│   │   ├── Chart.tsx                  # Core KlineCharts canvas wrapper & sync engine
│   │   ├── TopNavbar.tsx              # Symbol, timeframe, style & grid controls
│   │   ├── DrawingToolbar.tsx         # Technical analysis drawing tools
│   │   ├── IndicatorsModal.tsx        # Indicator catalog & toggle manager
│   │   ├── WatchlistSidebar.tsx       # Live 24h ticker feed & search
│   │   ├── AlertsModal.tsx            # Price alert rules & notifications
│   │   ├── ReplayBar.tsx              # Backtesting transport control bar
│   │   ├── VolumeProfileOverlay.tsx   # VRVP canvas rendering layer
│   │   ├── ZonesOverlay.tsx           # Supply/Demand & SFP canvas overlay
│   │   ├── SmcOverlay.tsx             # Order Blocks & FVG overlay
│   │   ├── CipherAOverlay.tsx         # EMA ribbon & Cipher A signals
│   │   ├── KillzonesOverlay.tsx       # ICT session ranges & Judas alerts
│   │   ├── VwapOverlay.tsx            # Anchored VWAP with standard deviation bands
│   │   └── LiquidationOverlay.tsx     # Leverage liquidation clusters
│   ├── services/
│   │   ├── binance.ts                 # Public REST & WebSocket data provider
│   │   ├── volumeProfile.ts           # Visible Range Volume Profile engine
│   │   ├── replayEngine.ts            # Bar-by-bar market replay state machine
│   │   ├── supplyDemand.ts            # S&D zone detection algorithms
│   │   ├── smc.ts                     # Smart Money Concepts structural analysis
│   │   ├── cipherA.ts                 # Ribbon EMAs & breakout detection
│   │   ├── cipherB.ts                 # WaveTrend & Money Flow Index
│   │   ├── killzones.ts               # ICT session window & Judas calculation
│   │   ├── anchoredVwap.ts            # Dynamic peak-anchored VWAP algorithm
│   │   ├── liquidationHeatmap.ts      # Estimated leverage liquidation model
│   │   ├── cvd.ts                     # Cumulative Volume Delta computation
│   │   └── customIndicators.ts        # Indicator registrations & math
│   ├── App.tsx                        # Root application shell & grid state
│   ├── main.tsx                       # React application bootstrap
│   └── index.css                      # Global styles & Tailwind entry
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Legal & Nominative Fair Use Disclaimer

- **Educational Purpose**: OpenView is an open-source software project provided solely for educational, research, and technical analysis purposes. It does not constitute financial, investment, or trading advice.
- **Nominative Fair Use**: Any references to third-party methodologies, indicator naming conventions, or brand styles (including, but not limited to, *Market Cipher*, *LuxAlgo*, *Flux Charts*, *The Kingfisher*, or *ICT*) are made strictly under **Nominative Fair Use** to accurately describe the functional mathematical modeling and visual presentation styles implemented. OpenView is an independent open-source project and is **not affiliated with, associated with, authorized by, endorsed by, or in any way officially connected** with any of these entities or their respective owners.
- **Trademarks**: All product names, logos, brands, and registered trademarks belong to their respective holders.

---

## License

This project is licensed under the [MIT License](LICENSE).
