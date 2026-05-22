# Stock Monitoring Tool

## What This Is
A Node.js/TypeScript CLI tool that monitors stock watchlists, fetches market data, calculates technical indicators, generates AI-powered commentary via Claude, and delivers styled HTML/PDF reports by email. Stateless — no database, all data flows from APIs to report to inbox.

## Tech Stack
- **Runtime:** Node.js 18+ with TypeScript 5.9.3 (ts-node)
- **CLI:** Commander.js
- **APIs:**
  - Yahoo Finance (via yahoo-finance2) — price data, technicals, historical, news
  - Anthropic Claude API — AI market commentary
  - NewsAPI.org — optional secondary news source
  - Gmail SMTP (via nodemailer) — email delivery
- **Key Libraries:** puppeteer (HTML→PDF), dotenv, open (browser preview)
- **No database** — intentionally stateless; config in `config.json`, keys in `.env`

## Architecture

```
src/
├── index.ts              # CLI entry point (commander)
├── config.ts             # Config loading & validation
├── data/
│   ├── types.ts          # 28 TypeScript interfaces
│   ├── priceData.ts      # Yahoo Finance quotes + market context (S&P 500, VIX)
│   ├── technicals.ts     # RSI(14), SMA(50), SMA(200) calculations
│   └── news.ts           # Yahoo Finance + NewsAPI news, deduplication
├── ai/
│   └── commentary.ts     # Claude API integration, structured response parsing
├── email/
│   ├── template.ts       # HTML report template (responsive, color-coded)
│   ├── sender.ts         # Gmail SMTP via nodemailer
│   └── pdfGenerator.ts   # Puppeteer HTML→PDF (A4 landscape)
└── utils/
    ├── retry.ts          # Exponential backoff (3 attempts)
    └── rateLimiter.ts    # Rate limiting for API calls
```

## Pipeline Flow
```
Yahoo Finance → Price/Volume/Technicals/News
                    ↓
              Alert Detection (big movers, unusual volume)
                    ↓
              Claude API → AI commentary + sentiment labels
                    ↓
              HTML Template → PDF attachment
                    ↓
              Gmail SMTP → Recipients
```

## Features Built (All Working)
- **Price Data:** Current quotes, daily/weekly/monthly % change, 52-week range, volume
- **Technical Indicators:** RSI(14) with overbought/oversold detection, SMA(50), SMA(200), price position relative to SMAs
- **Market Context:** S&P 500 change and VIX level in every report
- **Alert Detection:** Big movers (default ≥3% daily change), unusual volume (default ≥2x 20-day avg)
- **AI Commentary:** Market narrative, per-ticker sentiment (Bullish/Bearish/Neutral/Overbought), "Key Things to Watch," alert summaries
- **News:** Yahoo Finance + NewsAPI, deduplication, top 3 per ticker
- **HTML Report:** Responsive design, color-coded gains/losses, alert badges, sentiment cards, news links
- **PDF Generation:** Puppeteer, A4 landscape, attached to email
- **Email:** Gmail SMTP, multiple recipients, HTML body + PDF attachment
- **CLI:** `report --list "Name"`, `report --all`, `report --preview`, `lists`
- **Error Handling:** Retry with backoff, rate limiting, graceful degradation (individual ticker failures don't block report; Claude failures still send report without AI section)

## Configuration

**config.json:**
- 2 watchlists: "Commodities" (14 tickers), "Dividends" (7 tickers)
- AI model: claude-opus-4-6
- Recipients: bunker.ryan@gmail.com, nathan@corso.com
- Alert thresholds: 3% big mover, 2x unusual volume

**.env keys:**
- `ANTHROPIC_API_KEY` — Claude API
- `NEWSAPI_KEY` — NewsAPI.org (optional)
- `GMAIL_USER` — Gmail address
- `GMAIL_APP_PASSWORD` — Gmail app-specific password

## CLI Commands
```bash
# Single watchlist report
npx ts-node src/index.ts report --list "Commodities"

# All watchlists
npx ts-node src/index.ts report --all

# Preview in browser (no email)
npx ts-node src/index.ts report --list "Commodities" --preview

# List watchlists
npx ts-node src/index.ts lists
```

## Current State (as of 2026-03-25)
**Status: Production-ready, actively used.**

- All features fully implemented and working
- Recent fix: replaced deprecated Yahoo Finance `historical()` with `chart()` API
- Multi-recipient email support added
- No known bugs or incomplete features
- Well-structured with clear separation of concerns

## Development History (Git)
1. Initial CLI tool setup
2. Gmail integration config
3. HTML template redesign
4. PDF generation + email attachments
5. Multiple email recipient support
6. Yahoo Finance API deprecation fix (`historical()` → `chart()`)
