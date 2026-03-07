export interface WatchlistConfig {
  tickers: string[];
  description: string;
}

export interface AppConfig {
  watchlists: Record<string, WatchlistConfig>;
  ai: {
    model: string;
  };
  email: {
    to: string;
    from: string;
  };
  alerts: {
    bigMoverThresholdPercent: number;
    unusualVolumeMultiplier: number;
  };
}

export interface QuoteData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  previousClose: number;
  dailyChange: number;
  dailyChangePercent: number;
  weeklyChangePercent: number | null;
  monthlyChangePercent: number | null;
  volume: number;
  avgVolume20d: number | null;
  high52Week: number | null;
  low52Week: number | null;
  error?: string;
}

export interface TechnicalIndicators {
  ticker: string;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  priceVsSma50: 'above' | 'below' | 'N/A';
  priceVsSma200: 'above' | 'below' | 'N/A';
}

export interface NewsItem {
  ticker: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface TickerData {
  quote: QuoteData;
  technicals: TechnicalIndicators;
  news: NewsItem[];
}

export interface AlertCondition {
  ticker: string;
  type: 'big_mover' | 'unusual_volume';
  message: string;
  value: number;
}

export interface TickerSentiment {
  label: string;
  text: string;
}

export interface KeyThingToWatch {
  title: string;
  text: string;
}

export interface AlertSummaryItem {
  ticker: string;
  description: string;
}

export interface AICommentary {
  narrative: string;
  tickerSentiments: Record<string, TickerSentiment>;
  keyThingsToWatch: KeyThingToWatch[];
  alertSummaries: AlertSummaryItem[];
  error?: string;
}

export interface WatchlistReport {
  watchlistName: string;
  description: string;
  generatedAt: string;
  tickers: TickerData[];
  alerts: AlertCondition[];
  aiCommentary: AICommentary | null;
  failedTickers: string[];
  marketContext?: {
    sp500Change?: number;
    vixLevel?: number;
  };
}
