#  ETF Portfolio & Smart PAC Manager

A React PWA for tracking an ETF portfolio on Borsa Italiana and computing monthly rebalancing orders via a greedy buy-only algorithm. Built for personal use, deployed in production.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open%20App-blue?style=for-the-badge&logo=github)](https://davideincaini.github.io/ETF_Tracker/)
[![PWA](https://img.shields.io/badge/PWA-Installable%20on%20iPhone-brightgreen?style=for-the-badge&logo=pwa)](https://davideincaini.github.io/ETF_Tracker/)

---

## The Problem

Managing a multi-ETF portfolio with a monthly investment plan (PAC — Piano di Accumulo) requires answering the same question each month: *"Given my budget and current allocation, which ETFs should I buy and how many shares?"*

The constraint is strict: **never sell**. Rebalancing happens only by directing new capital toward the most underweight positions. Computing this manually across multiple ETFs with different prices, weights, and carryover cash is error-prone. This tool automates it.

---

## Smart PAC Algorithm

The rebalancing logic is a **greedy buy-only scheduler**:

```
Input:  monthly_budget + carryover_cash (from previous month)
        current_allocation vs target_weights (from tickers.json)

1. Compute deviation = current_weight - target_weight for each ETF
2. Sort ETFs by deviation (most underweight first)
3. For the most underweight ETF:
   a. Calculate max integer shares buyable within remaining budget
   b. If shares > 0: allocate, subtract cost from budget
   c. Move to next most underweight ETF
4. Remainder budget → carryover_cash for next month
   (fractional shares not supported on Borsa Italiana)

Output: list of (ETF, shares_to_buy, cost) + new carryover_cash
```

The no-sell constraint means the portfolio converges toward target weights asymptotically — faster when one position is significantly underweight relative to the others.

---

## Features

**Dashboard**
- Total portfolio value (EUR)
- Profit / Loss (€ and %)
- Equity / Bond split vs target

**Charts**
- Stacked bar: current allocation vs target weights
- Line chart: historical portfolio value growth

**PAC Section**
- Input: monthly budget
- Output: recommended buy orders for current month
- Carryover cash persisted across sessions

**Data**
- Live prices from Yahoo Finance API (Euronext Milan `.MI` tickers)
- Portfolio configuration in `tickers.json` — ETF list, target weights, cost basis

---

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS (mobile-first, iOS aesthetic) |
| Charts | Recharts |
| Icons | Lucide React |
| PWA | vite-plugin-pwa (installable on iOS) |
| Data | Yahoo Finance, fetched server-side by a GitHub Action (see below) |
| Deploy | GitHub Pages (auto-deploy on push to main) |
| CI/CD | GitHub Actions |

---

## Market Data Pipeline

The app never calls a third-party API from the browser. Until October 2026 it fetched Yahoo Finance through free public CORS proxies; when all of them shut down at once, the app broke without any code change. Prices are now produced by the repository itself:

```
GitHub Actions (Mon–Fri 17:23 UTC, or on demand)
  └─ scripts/update_market_data.py   Python, standard library only
       ├─ downloads price + full daily history per ticker in src/data/tickers.json
       ├─ validates: price > 0, currency EUR, move < 25% vs last run
       ├─ on any failure keeps the last good value, labelled stale/rejected
       └─ writes public/data/prices.json + history.json  → committed → deployed
PWA
  └─ reads /data/*.json from its own origin (service worker: network-first, offline copy)
```

Failure modes are designed to be visible, never silent:

| What fails | What you see | What to do |
|---|---|---|
| Yahoo down or blocking | Actions run turns red + email; app keeps last prices and shows their date | Usually nothing: the next run catches up |
| Scheduled runs stop (e.g. GitHub pauses them after inactivity) | Banner "Prezzi fermi al …" after 4 days | Actions tab → re-enable the workflow |
| A price is missing or old when you run the PAC | PAC refuses to compute / warns, price panel opens | Type the current price from your broker |
| A split makes a price jump > 25% | Price marked "rejected", last value kept | Actions → *Run workflow* with `accept_jumps` ticked |

**Refresh prices now:** Actions → *Update data & deploy* → *Run workflow* (also works from the GitHub mobile app).
**Known data gap:** Yahoo has no history for `SGLN.MI` (price only), so gold has no chart/ATH and the Monte Carlo models it with zero return and zero volatility (like cash).
**Tests:** `python3 -m unittest discover -s scripts`

---

## Project Structure

```
src/
├── components/     # Dashboard, PAC calculator, chart wrappers
├── hooks/          # usePortfolio, usePrices, usePAC
├── utils/          # PAC algorithm, rebalancing logic, market data access
├── data/tickers.json  # ETF configuration: tickers, targets, thresholds
└── App.jsx
scripts/            # market data updater (Python) + its tests
public/data/        # prices.json, history.json — generated, do not edit by hand
```

---

## Investment Philosophy

The PAC algorithm embeds a deliberate constraint: **no selling**. This eliminates transaction costs on sales, avoids triggering capital gains events, and forces long-term discipline. The tradeoff is slower convergence to target weights in volatile markets — accepted as a feature, not a bug.

---

*Part of [Davide Incaini's portfolio](https://github.com/davideincaini)*
