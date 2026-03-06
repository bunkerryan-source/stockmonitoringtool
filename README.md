# Watchlist Report

AI-powered stock market briefing emails for TradingView watchlists.

This CLI tool fetches price data, technical indicators, and news for stocks in your watchlists, generates AI commentary using Claude, and sends rich HTML email reports via Gmail.

## Features

- **Price Data**: Current quotes, daily/weekly/monthly changes via Yahoo Finance
- **Technical Indicators**: RSI(14), 50-day SMA, 200-day SMA
- **News Aggregation**: Yahoo Finance + NewsAPI headlines
- **AI Commentary**: Claude-powered market narrative, per-ticker sentiment, and key things to watch
- **Alert Detection**: Big movers (>3% daily change) and unusual volume (>2x average)
- **Rich HTML Emails**: Responsive design with color-coded tables and inline CSS
- **Preview Mode**: Open reports in your browser before sending

## Setup

### 1. Prerequisites

- Node.js 18+ installed
- A Gmail account with an app-specific password
- An Anthropic API key (for Claude AI commentary)
- (Optional) A NewsAPI.org free-tier API key

### 2. Install Dependencies

```bash
npm install
```

### 3. Get a Gmail App Password

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** > **2-Step Verification** (enable if not already)
3. At the bottom, click **App passwords**
4. Select "Mail" and your device, then click **Generate**
5. Copy the 16-character password

### 4. Get API Keys

**Anthropic API Key:**
1. Sign up at https://console.anthropic.com/
2. Create an API key in your account settings

**NewsAPI Key (optional, for additional news sources):**
1. Sign up at https://newsapi.org/register
2. Copy your API key from the dashboard

### 5. Configure Environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
NEWSAPI_KEY=your-newsapi-key
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### 6. Configure Watchlists

Edit `config.json` to set up your watchlists, email addresses, and preferences:

```json
{
  "watchlists": {
    "My Watchlist": {
      "tickers": ["AAPL", "MSFT", "GOOGL"],
      "description": "Tech stocks I follow"
    }
  },
  "ai": {
    "model": "claude-opus-4-6"
  },
  "email": {
    "to": "you@gmail.com",
    "from": "you@gmail.com"
  },
  "alerts": {
    "bigMoverThresholdPercent": 3,
    "unusualVolumeMultiplier": 2
  }
}
```

## Usage

### Generate and Email a Report

```bash
npx ts-node src/index.ts report --list "Commodities"
```

### Generate Reports for All Watchlists

```bash
npx ts-node src/index.ts report --all
```

### Preview a Report in Browser

```bash
npx ts-node src/index.ts report --list "Commodities" --preview
```

### List All Configured Watchlists

```bash
npx ts-node src/index.ts lists
```

## Project Structure

```
watchlist-report/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Config loading and validation
│   ├── data/
│   │   ├── priceData.ts      # Yahoo Finance price/quote fetching
│   │   ├── technicals.ts     # RSI, SMA calculations
│   │   ├── news.ts           # News fetching (Yahoo + NewsAPI)
│   │   └── types.ts          # TypeScript interfaces
│   ├── ai/
│   │   └── commentary.ts     # Claude API integration
│   ├── email/
│   │   ├── template.ts       # HTML email template
│   │   └── sender.ts         # Nodemailer Gmail sending
│   └── utils/
│       ├── retry.ts          # Retry with exponential backoff
│       └── rateLimiter.ts    # Rate limiting utility
├── config.json               # Watchlist configuration
├── .env.example              # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

- If a single ticker fails, the report continues with remaining tickers and notes the failure
- API calls retry up to 3 times with exponential backoff
- Yahoo Finance requests are rate-limited to avoid blocking
- If Claude API fails, the report is still sent without AI commentary sections

## License

ISC
