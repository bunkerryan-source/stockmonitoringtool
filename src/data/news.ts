// eslint-disable-next-line @typescript-eslint/no-var-requires
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

import { NewsItem } from './types';
import { withRetry } from '../utils/retry';
import { createRateLimiter } from '../utils/rateLimiter';

const rateLimit = createRateLimiter(300);

async function fetchYahooNews(ticker: string): Promise<NewsItem[]> {
  await rateLimit();

  try {
    const result: any = await yahooFinance.search(ticker, { newsCount: 5 });
    const news: any[] = result.news || [];

    return news.map((item: any) => ({
      ticker,
      title: item.title,
      url: item.link,
      source: 'Yahoo Finance',
      publishedAt: item.providerPublishTime
        ? new Date(item.providerPublishTime).toISOString()
        : new Date().toISOString(),
    }));
  } catch {
    console.warn(`[News] Yahoo Finance news failed for ${ticker}`);
    return [];
  }
}

async function fetchNewsAPI(ticker: string): Promise<NewsItem[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(ticker)}&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[News] NewsAPI returned ${response.status} for ${ticker}`);
      return [];
    }

    const data = await response.json() as {
      articles?: Array<{
        title: string;
        url: string;
        source?: { name?: string };
        publishedAt?: string;
      }>;
    };

    return (data.articles || []).map((article) => ({
      ticker,
      title: article.title,
      url: article.url,
      source: article.source?.name || 'NewsAPI',
      publishedAt: article.publishedAt || new Date().toISOString(),
    }));
  } catch {
    console.warn(`[News] NewsAPI failed for ${ticker}`);
    return [];
  }
}

export async function fetchNews(ticker: string): Promise<NewsItem[]> {
  return withRetry(async () => {
    const [yahooNews, newsApiNews] = await Promise.all([
      fetchYahooNews(ticker),
      fetchNewsAPI(ticker),
    ]);

    // Combine and deduplicate by title, prefer Yahoo Finance
    const seen = new Set<string>();
    const combined: NewsItem[] = [];

    for (const item of [...yahooNews, ...newsApiNews]) {
      const normalizedTitle = item.title.toLowerCase().trim();
      if (!seen.has(normalizedTitle)) {
        seen.add(normalizedTitle);
        combined.push(item);
      }
    }

    // Return top 3 most recent
    return combined
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 3);
  }, `fetchNews(${ticker})`);
}
