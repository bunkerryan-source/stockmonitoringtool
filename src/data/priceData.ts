// eslint-disable-next-line @typescript-eslint/no-var-requires
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

import { QuoteData } from './types';
import { withRetry } from '../utils/retry';
import { createRateLimiter } from '../utils/rateLimiter';

const rateLimit = createRateLimiter(500);

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  await rateLimit();

  return withRetry(async () => {
    const quote = await yahooFinance.quote(ticker);

    const currentPrice = quote.regularMarketPrice ?? 0;
    const previousClose = quote.regularMarketPreviousClose ?? 0;
    const dailyChange = currentPrice - previousClose;
    const dailyChangePercent = previousClose !== 0
      ? (dailyChange / previousClose) * 100
      : 0;

    // Fetch historical data for weekly/monthly change
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 35);

    let weeklyChangePercent: number | null = null;
    let monthlyChangePercent: number | null = null;

    try {
      const historical = await yahooFinance.historical(ticker, {
        period1: oneMonthAgo,
        period2: now,
        interval: '1d',
      });

      if (historical.length >= 5) {
        const weekAgoPrice = historical[historical.length - 5]?.close;
        if (weekAgoPrice) {
          weeklyChangePercent = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;
        }
      }

      if (historical.length >= 20) {
        const monthAgoPrice = historical[0]?.close;
        if (monthAgoPrice) {
          monthlyChangePercent = ((currentPrice - monthAgoPrice) / monthAgoPrice) * 100;
        }
      }
    } catch {
      console.warn(`[PriceData] Could not fetch historical data for ${ticker}`);
    }

    return {
      ticker,
      companyName: quote.shortName || quote.longName || ticker,
      currentPrice,
      previousClose,
      dailyChange,
      dailyChangePercent,
      weeklyChangePercent,
      monthlyChangePercent,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume20d: quote.averageDailyVolume10Day ?? null,
      high52Week: quote.fiftyTwoWeekHigh ?? null,
      low52Week: quote.fiftyTwoWeekLow ?? null,
    };
  }, `fetchQuote(${ticker})`);
}

export async function fetchMarketContext(): Promise<{
  sp500Change?: number;
  vixLevel?: number;
}> {
  const result: { sp500Change?: number; vixLevel?: number } = {};

  try {
    await rateLimit();
    const spyQuote = await yahooFinance.quote('^GSPC');
    if (spyQuote.regularMarketChangePercent != null) {
      result.sp500Change = spyQuote.regularMarketChangePercent;
    }
  } catch {
    console.warn('[PriceData] Could not fetch S&P 500 data');
  }

  try {
    await rateLimit();
    const vixQuote = await yahooFinance.quote('^VIX');
    if (vixQuote.regularMarketPrice != null) {
      result.vixLevel = vixQuote.regularMarketPrice;
    }
  } catch {
    console.warn('[PriceData] Could not fetch VIX data');
  }

  return result;
}
