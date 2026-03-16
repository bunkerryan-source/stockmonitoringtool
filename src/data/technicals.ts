// eslint-disable-next-line @typescript-eslint/no-var-requires
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

import { TechnicalIndicators } from './types';
import { withRetry } from '../utils/retry';
import { createRateLimiter } from '../utils/rateLimiter';

const rateLimit = createRateLimiter(500);

function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(prices.length - period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export async function fetchTechnicals(
  ticker: string,
  currentPrice: number
): Promise<TechnicalIndicators> {
  await rateLimit();

  return withRetry(async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() - 10); // Extra buffer

    const chart = await yahooFinance.chart(ticker, {
      period1: oneYearAgo,
      period2: now,
      interval: '1d',
    });
    const historical = chart.quotes ?? [];

    const closePrices = (historical as any[]).map((d: any) => d.close as number);

    const rsi14 = calculateRSI(closePrices, 14);
    const sma50 = calculateSMA(closePrices, 50);
    const sma200 = calculateSMA(closePrices, 200);

    return {
      ticker,
      rsi14: rsi14 !== null ? Math.round(rsi14 * 100) / 100 : null,
      sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
      sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
      priceVsSma50: sma50 !== null ? (currentPrice >= sma50 ? 'above' : 'below') : 'N/A',
      priceVsSma200: sma200 !== null ? (currentPrice >= sma200 ? 'above' : 'below') : 'N/A',
    };
  }, `fetchTechnicals(${ticker})`);
}
