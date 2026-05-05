#  ETF Portfolio & Smart PAC Manager

A React PWA for tracking an ETF portfolio on Borsa Italiana and computing monthly rebalancing orders via a greedy buy-only algorithm. Built for personal use, deployed in production.

🔗 **Live app:** [etf-tracker-three.vercel.app](https://etf-tracker-three.vercel.app)

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
| Data | Yahoo Finance API (EOD prices) |
| Deploy | Vercel (auto-deploy on push to main) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
src/
├── components/     # Dashboard, PAC calculator, chart wrappers
├── hooks/          # usePortfolio, usePrices, usePAC
├── utils/          # PAC algorithm, rebalancing logic
└── App.jsx
tickers.json        # ETF configuration: tickers, targets, cost basis
```

---

## Investment Philosophy

The PAC algorithm embeds a deliberate constraint: **no selling**. This eliminates transaction costs on sales, avoids triggering capital gains events, and forces long-term discipline. The tradeoff is slower convergence to target weights in volatile markets — accepted as a feature, not a bug.

---

*Part of [Davide Incaini's portfolio](https://github.com/davideincaini)*
