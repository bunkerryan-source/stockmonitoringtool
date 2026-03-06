import Anthropic from '@anthropic-ai/sdk';
import { TickerData, AICommentary, AlertCondition } from '../data/types';
import { withRetry } from '../utils/retry';

export async function generateCommentary(
  watchlistName: string,
  description: string,
  tickerData: TickerData[],
  alerts: AlertCondition[],
  model: string,
  thresholdPercent: number,
  volumeMultiplier: number
): Promise<AICommentary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[AI] ANTHROPIC_API_KEY not set. Skipping AI commentary.');
    return null;
  }

  const client = new Anthropic({ apiKey });

  const tickerSummaries = tickerData
    .map((td) => {
      const q = td.quote;
      const t = td.technicals;
      const newsHeadlines = td.news.map((n) => `  - ${n.title}`).join('\n');
      return `
**${q.ticker} (${q.companyName})**
- Price: $${q.currentPrice.toFixed(2)} | Daily: ${q.dailyChangePercent >= 0 ? '+' : ''}${q.dailyChangePercent.toFixed(2)}%
- Weekly: ${q.weeklyChangePercent !== null ? `${q.weeklyChangePercent >= 0 ? '+' : ''}${q.weeklyChangePercent.toFixed(2)}%` : 'N/A'} | Monthly: ${q.monthlyChangePercent !== null ? `${q.monthlyChangePercent >= 0 ? '+' : ''}${q.monthlyChangePercent.toFixed(2)}%` : 'N/A'}
- Volume: ${q.volume.toLocaleString()} | Avg Volume: ${q.avgVolume20d?.toLocaleString() || 'N/A'}
- RSI(14): ${t.rsi14 ?? 'N/A'} | 50-SMA: ${t.sma50 ? `$${t.sma50.toFixed(2)} (${t.priceVsSma50})` : 'N/A'} | 200-SMA: ${t.sma200 ? `$${t.sma200.toFixed(2)} (${t.priceVsSma200})` : 'N/A'}
- Recent News:
${newsHeadlines || '  (no recent news)'}`;
    })
    .join('\n');

  const alertsSummary = alerts.length > 0
    ? `\nAlert conditions triggered:\n${alerts.map((a) => `- ${a.message}`).join('\n')}`
    : '\nNo alert conditions triggered.';

  const prompt = `You are a seasoned market analyst. I'm providing you with data for my "${watchlistName}" watchlist: ${description}.

For each ticker, here is the current price data, recent price changes, technical indicators (RSI, 50-day SMA, 200-day SMA), volume data, and recent news headlines.

${tickerSummaries}
${alertsSummary}

Please provide:
1. A brief overall narrative (2-3 paragraphs) about what's happening in this sector/theme right now, synthesizing the data and news
2. For each ticker, a 1-2 sentence sentiment summary (bullish/bearish/neutral with reasoning)
3. A "key things to watch" section highlighting the most important developments
4. Call out any alert conditions: stocks that moved more than ${thresholdPercent}% today, or stocks with unusual volume (>${volumeMultiplier}x their average)

Be concise and actionable. I am an experienced investor, so no disclaimers needed.

Format your response as follows:
---NARRATIVE---
(your narrative here)
---SENTIMENTS---
TICKER: sentiment text
TICKER: sentiment text
...
---KEYTHINGS---
(your key things to watch here)`;

  try {
    return await withRetry(async () => {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return parseAIResponse(text);
    }, 'generateCommentary');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AI] Failed to generate commentary: ${message}`);
    return {
      narrative: '',
      tickerSentiments: {},
      keyThingsToWatch: '',
      error: `AI commentary unavailable: ${message}`,
    };
  }
}

function parseAIResponse(text: string): AICommentary {
  const narrativeMatch = text.match(/---NARRATIVE---\s*([\s\S]*?)(?=---SENTIMENTS---|$)/);
  const sentimentsMatch = text.match(/---SENTIMENTS---\s*([\s\S]*?)(?=---KEYTHINGS---|$)/);
  const keyThingsMatch = text.match(/---KEYTHINGS---\s*([\s\S]*?)$/);

  const narrative = narrativeMatch?.[1]?.trim() || text;
  const keyThingsToWatch = keyThingsMatch?.[1]?.trim() || '';

  const tickerSentiments: Record<string, string> = {};
  if (sentimentsMatch?.[1]) {
    const lines = sentimentsMatch[1].trim().split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const ticker = line.substring(0, colonIndex).trim().replace(/^\*+|\*+$/g, '');
        const sentiment = line.substring(colonIndex + 1).trim();
        if (ticker && sentiment) {
          tickerSentiments[ticker] = sentiment;
        }
      }
    }
  }

  return { narrative, tickerSentiments, keyThingsToWatch };
}
