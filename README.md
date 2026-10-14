# OpenView — Free Open-Source TradingView Alternative for Crypto

> **OpenView** is a high-performance, open-source technical analysis workstation and crypto charting platform designed as a **free alternative to TradingView with all premium features unlocked**. It eliminates subscriptions, paywalls, and API key setup, offering direct, real-time access to live Binance market feeds, unlimited indicators, multi-chart synchronization, intraday bar replay, and a blind historical Price Action Simulator (Trading Gym).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/hpiotrowski/openview?style=social)](https://github.com/hpiotrowski/openview)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![Electron](https://img.shields.io/badge/Electron-44-47848f.svg)](https://www.electronjs.org/)
[![TradingView Alternative](https://img.shields.io/badge/TradingView-Alternative-green.svg)](#why-openview-vs-tradingview)

---

> [!WARNING]
> ### 🤖 AI-Assisted Codebase Notice & Community Disclaimer
> **This project has been built in large part using AI coding models and autonomous pair programming (vibe-coding).**
> While the workstation provides an extensive suite of advanced tools, 60 FPS real-time canvas overlays, and fast execution, **there may be bugs, rough edges, edge-case quirks, or unhandled states**. 
> 
> If you encounter an issue or want to improve a calculation, please **[open an issue](https://github.com/hpiotrowski/openview/issues)** or submit a Pull Request! All community contributions, testing, and bug fixes are warmly welcomed.

---

## ⚡ Why OpenView? (vs. TradingView)

TradingView is an industry standard, but core day-trading features—such as multi-chart split screens, volume profiles, intraday bar replay, and running more than 2–3 indicators simultaneously—are locked behind expensive monthly subscriptions ($14.95 to $59.95/month).

**OpenView unlocks these professional features completely free for everyone:**

| Feature | TradingView (Free Tier) | OpenView (100% Free & Open-Source) |
|---|:---:|:---:|
| **Simultaneous Indicators** | Capped at 2–3 indicators | **Unlimited** (run 10+ overlays without warning banners) |
| **Multi-Chart Grid Layouts** | 1 chart only (Single view) | **1x1, 1x2, 2x1, 2x2, 1+3** with synchronized crosshairs |
| **Intraday Bar Replay** | Daily timeframe only (Intraday is paid) | **Free across all timeframes** (`1s`, `1m`, `5m`, `15m`, `1h`, `4h`, `1D`) |
| **Visible Range Volume Profile (VRVP)** | Paid (Essential/Plus plans) | **Included & Dynamic** (POC, VAH, VAL, Volume Delta) |
| **Account & API Keys** | Mandatory sign-up & tracking | **Zero accounts, zero API keys** (Direct Binance WSS) |
| **Smart Money Concepts (SMC)** | Requires community scripts / paid | **Built-in native engine** (Order Blocks, FVG, BOS, CHoCH) |
| **Institutional Overlays** | Mostly paid indicator tiers | **Cipher A/B, ICT Killzones, Anchored VWAP, Liquidation Maps** |
| **Price Action Simulator (Gym)** | Not available | **Built-in blind historical practice** with leverage & R:R |
| **Privacy & Local Execution** | Cloud-hosted & telemetry | **100% Client-side & Local desktop executable** (Electron) |

---

## 🎯 Workstations & Modules

### 1. Live Charting Terminal
A multi-window market surveillance terminal powered by public Binance Spot & Futures WebSockets.
- **Synchronized Multi-Panels**: Arrange up to 4 charts simultaneously (`1x1`, `1x2`, `2x1`, `2x2`, `1+3`). Moving your mouse on one chart mirrors crosshairs and timestamps across all panels.
- **Intraday Market Replay**: Jump back in time to any historical candle with a single click. Step forward candle-by-candle (`Space` to toggle, `→` to step, `←` to step back), or play at variable speeds (0.2x to 10x).
- **60 FPS Real-Time Overlays**: Canvas overlays subscribe directly to zoom, pan, and scroll events via `requestAnimationFrame`, maintaining sub-millisecond alignment with price action.
- **Watchlist & Live Alerts**: Search popular crypto assets, monitor 24h gainers/losers, and set WebAudio sound alerts for critical price levels.

### 2. Price Action Gym & Arena (Blind Simulation)
A deliberate practice arena for traders seeking to hone their asymmetric Risk-to-Reward edge without hindsight bias.
- **Anti-Hindsight Bias**: The asset ticker and historical dates remain completely confidential until you complete the scenario.
- **Calibrated Scenarios**: Scenarios across multiple time horizons:
  - **Scalps (1m / 5m)**: Tight volatility squeezes and liquidity sweeps calibrated for 10x–50x leverage.
  - **Daytrades (15m / 1h)**: Fair Value Gap retests and momentum divergences.
  - **Swing Trades (4h / 1D)**: Point of Control breakouts and macro support/resistance flips.
- **Interactive Execution Cockpit**: Pick `LONG` or `SHORT`, adjust leverage (1x to 50x), and fine-tune your Stop Loss and Take Profit with real-time R:R and projected ROE calculations.
- **Candle-by-Candle Simulation**: Simulate future price action bar-by-bar and analyze the post-trade structural breakdown debrief.

---

## 🔬 Built-In Institutional Technical Indicators

OpenView comes preloaded with popular institutional and order flow models built directly into the engine:

- **Smart Money Concepts (SMC)**:
  - Institutional Order Blocks (`+OB` / `-OB`) with displacement verification.
  - Fair Value Gaps (`FVG`) with dynamic fill levels.
  - Market structure shifts: Break of Structure (`BOS`) and Change of Character (`CHoCH`).
- **Visible Range Volume Profile (VRVP)**:
  - Dynamically recalculates based on the visible viewport range.
  - Point of Control (`POC`), Value Area High (`VAH`), and Value Area Low (`VAL`).
- **Displacement Supply & Demand**:
  - Base-and-impulse range detection with ATR expansion filtering and tested zone tracking.
- **Market Cipher A Style Ribbon**:
  - 8-period exponential moving average ribbon with volatility squeeze and breakout markers.
- **Market Cipher B / WaveTrend**:
  - Dual-smoothed momentum oscillators with overbought/oversold crossover signals and Money Flow volumetric cloud.
- **ICT Killzones & Silver Bullet**:
  - Automated session tracking for Asian Range, London Open, and NY Silver Bullet sessions with Judas Swing alerts.
- **Peak-Anchored VWAP (AVWAP)**:
  - Automatically anchors Volume-Weighted Average Price to major swing peaks (ATH/ATL) with $\pm 1\sigma$ and $\pm 2\sigma$ volatility bands.
- **Leverage Liquidation Heatmap**:
  - Estimated liquidation clusters across 10x, 25x, 50x, and 100x leverage tiers to identify high-probability magnet zones.
- **Swing Failure Patterns (SFP / Liquidity Sweeps)**:
  - High-precision wick sweeps of prior highs and lows followed by aggressive reclamation.

---

## 🛠️ Architecture & Tech Stack

- **UI Framework**: [React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charting Engine**: [KlineCharts v10](https://klinecharts.com/) + Custom Hardware-Accelerated Canvas Overlays
- **Desktop Runtime**: [Electron 44](https://www.electronjs.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Provider**: Public Binance REST & WebSocket API (no auth required)

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended, v20+ LTS preferred)
- npm, yarn, or pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/hpiotrowski/openview.git
cd openview

# 2. Install dependencies
npm install

# 3. Start local development server (Browser Mode)
npm run dev
```

Visit `http://localhost:3000` (or the port specified by Vite) in your browser.

### Desktop App (Electron Mode)

```bash
npm run electron
```

### Production Build

```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
|:---:|---|:---:|
| `1` | Switch to Live Charting Terminal | Lobby Switchboard |
| `2` | Switch to Price Action Arena / Gym | Lobby Switchboard |
| `Space` | Play / Pause Replay or Simulation | Replay Mode / Arena |
| `→` (Right Arrow) | Step 1 Candle Forward | Replay Mode / Arena |
| `←` (Left Arrow) | Step 1 Candle Backward | Replay Mode |
| `Esc` | Exit Replay Mode / Return to Lobby | Global |

---

## 📂 Project Structure

```text
openview/
├── electron/
│   ├── main.cjs                   # Electron desktop entry point
│   └── preload.cjs                # Electron secure bridge
├── src/
│   ├── components/
│   │   ├── Lobby.tsx              # Institutional switchboard & environment selector
│   │   ├── Chart.tsx              # KlineCharts canvas wrapper, sync engine & overlays
│   │   ├── TradingArena.tsx       # Blind price action simulator & R:R execution cockpit
│   │   ├── TopNavbar.tsx          # Symbol, interval, chart style & layout controls
│   │   ├── DrawingToolbar.tsx     # Technical analysis drawing & measurement tools
│   │   ├── IndicatorsModal.tsx    # Comprehensive indicator catalog & toggle manager
│   │   ├── WatchlistSidebar.tsx   # Live crypto ticker search & 24h market stats
│   │   ├── AlertsModal.tsx        # Audio & desktop price alert triggers
│   │   ├── ReplayBar.tsx          # Backtesting transport control bar
│   │   ├── VolumeProfileOverlay.tsx # Dynamic VRVP HTML5 canvas renderer
│   │   ├── ZonesOverlay.tsx       # Supply/Demand & Liquidity Sweep overlays
│   │   ├── SmcOverlay.tsx         # Order Blocks & Fair Value Gaps overlay
│   │   ├── CipherAOverlay.tsx     # EMA ribbon & breakout signal markers
│   │   ├── KillzonesOverlay.tsx   # ICT session boxes & Judas alert tags
│   │   ├── VwapOverlay.tsx        # Dynamic Peak-Anchored VWAP with sigma bands
│   │   ├── LiquidationOverlay.tsx # Leverage liquidation cluster heatmap
│   │   └── PositionOverlay.tsx    # Live Risk-to-Reward visual position box
│   ├── services/
│   │   ├── binance.ts             # Public REST & WebSocket data provider
│   │   ├── scenarioGenerator.ts   # Curated & procedural price action scenarios
│   │   ├── replayEngine.ts        # Event-driven bar-by-bar market replay engine
│   │   ├── volumeProfile.ts       # Viewport-based Volume Profile calculator
│   │   ├── smc.ts                 # Smart Money Concepts structural parser
│   │   ├── supplyDemand.ts        # Supply & Demand zone detection algorithm
│   │   ├── cipherA.ts             # Multi-EMA ribbon math
│   │   ├── cipherB.ts             # WaveTrend & Money Flow Index algorithm
│   │   ├── killzones.ts           # ICT session window & Judas calculation
│   │   ├── anchoredVwap.ts        # Peak-anchored VWAP algorithm
│   │   └── liquidationHeatmap.ts  # Leverage liquidation cluster model
│   ├── App.tsx                    # Root shell & multi-chart grid state
│   ├── main.tsx                   # React bootstrap
│   └── index.css                  # Global styling & Tailwind CSS v4 directives
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔍 SEO & Search Topics

`tradingview-alternative` • `open-source-tradingview` • `crypto-charting` • `technical-analysis` • `market-replay` • `bar-replay` • `volume-profile` • `smart-money-concepts` • `ict-trading` • `order-blocks` • `fair-value-gap` • `klinecharts` • `backtesting` • `order-flow` • `binance` • `react-trading-chart` • `desktop-trading-terminal` • `free-crypto-tools`

---

## ⚖️ Legal & Nominative Fair Use Disclaimer

- **Educational & Research Purpose**: OpenView is an open-source software project distributed solely for educational, research, and technical analysis purposes. It does not provide financial, investment, or trading advice.
- **Nominative Fair Use**: Any references to third-party methodologies, indicator naming conventions, or visual presentations (such as *TradingView*, *Market Cipher*, *LuxAlgo*, *Flux Charts*, *The Kingfisher*, or *ICT*) are made strictly under **Nominative Fair Use** to accurately describe the functional mathematical modeling and visual styling implemented. OpenView is an independent open-source project and is **not affiliated with, associated with, sponsored by, or endorsed by** any of these entities.
- **Trademarks**: All product names, logos, brands, and registered trademarks belong to their respective owners.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Feel free to use, fork, modify, and build upon it!
