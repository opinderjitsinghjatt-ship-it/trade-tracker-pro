# 📈 Trade Tracker Pro

A modern, dark-themed trading journal calculator — a single-page web application built with pure HTML, CSS and JavaScript. No frameworks, no dependencies, no build step. Just open `index.html` in your browser and start tracking.

---

## Features

### 📋 Trade Journal Dashboard
- Summary statistics: total trades, win rate, net P&L, profit factor, average win/loss, best/worst trade
- Cumulative P&L equity curve (canvas chart)
- Sortable trade table (click any column header)
- Filter trades by ticker, strategy, and date range
- Edit or delete individual trades

### 📝 Trade Entry Form
- Date, ticker/symbol, trade type (Long/Short), strategy
- Entry price, exit price, shares/units, fees/commission, notes
- Live P&L preview as you type
- Supports inline editing of existing trades

### 💰 P&L Calculator
- Gross & net P&L, percentage return, cost basis
- Long and short trade support
- Risk/Reward ratio calculator with break-even win-rate

### 📐 Position Size Calculator
- Input: account balance, risk %, entry price, stop-loss price
- Output: recommended shares, dollar risk, position value, % of account used

### ⚠️ Risk Management
- Daily loss limit tracker with warning and danger states
- Win/loss streak tracker (current, longest win, longest loss)
- Weekly and monthly P&L summaries
- Monthly P&L bar chart

### 💾 Data Persistence & Portability
- All trade data stored in `localStorage` — survives page refresh
- Export all trades to CSV
- Import trades from CSV (skips duplicates automatically)
- Clear all trades with one click

---

## Getting Started

1. **Clone or download** this repository.
2. Open `index.html` in any modern browser.
3. That's it — no installation required.

```
index.html   ← main app (all tabs/sections)
style.css    ← dark-themed responsive styles
script.js    ← all logic: calculations, charts, storage, CSV
README.md    ← this file
```

---

## Usage

### Logging a Trade
1. Click **Log Trade** in the navigation.
2. Fill in the required fields (date, ticker, type, entry, exit, quantity).
3. Optionally add fees, strategy, and notes.
4. Click **Save Trade** — you'll be taken to the Dashboard automatically.

### Editing a Trade
- In the Dashboard table, click the ✏ (pencil) icon on any row.
- Make changes in the form and click **Save Trade** again.

### Exporting / Importing
- **Export CSV**: Downloads a `trades_YYYY-MM-DD.csv` file with all logged trades.
- **Import CSV**: Upload a CSV file (must include columns: `date`, `ticker`, `type`, `entry`, `exit`, `qty`). Optional columns: `strategy`, `fees`, `notes`.

### Position Size Calculator
Enter your account balance, the maximum % you're willing to risk, the entry price, and the stop-loss price. The calculator will tell you exactly how many shares to buy.

### Daily Loss Limit
In the **Risk Mgmt** tab, set a dollar amount as your maximum daily loss. The status badge will turn **yellow** at 75% and **red** when the limit is hit.

---

## Browser Support
Works in all modern browsers: Chrome, Firefox, Edge, Safari. No Internet Explorer support.

---

## License
MIT — free to use, modify and distribute.
