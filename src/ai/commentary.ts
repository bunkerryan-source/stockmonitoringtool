import Anthropic from '@anthropic-ai/sdk';
import { TickerData, AICommentary, AlertCondition, TickerSentiment, KeyThingToWatch, AlertSummaryItem } from '../data/types';
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
2. For each ticker, a sentiment label (e.g., "Bullish", "Bearish", "Neutral", "Slightly Bullish", "Neutral / Cautious Bull", "Overbought / Dangerous", "Bullish w/ Caution", "Strongly Bullish / OB", "Bullish / Overbought") and a 1-2 sentence sentiment explanation
3. A "key things to watch" section with numbered items, each having a short title and a paragraph explanation
4. For each ticker that triggered an alert, a very brief (5-10 word) summary description of the situation

Be concise and actionable. I am an experienced investor, so no disclaimers needed.

Format your response EXACTLY as follows:
---NARRATIVE---
(your narrative paragraphs here, separated by blank lines)
---SENTIMENTS---
TICKER [Label]: sentiment explanation text
TICKER [Label]: sentiment explanation text
...
---KEYTHINGS---
1. Short Title Here
Explanation paragraph here.
2. Short Title Here
Explanation paragraph here.
...
---ALERTSUMMARY---
TICKER: brief description
TICKER: brief description
...`;

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
      keyThingsToWatch: [],
      alertSummaries: [],
      error: `AI commentary unavailable: ${message}`,
    };
  }
}

function parseAIResponse(text: string): AICommentary {
  const narrativeMatch = text.match(/---NARRATIVE---\s*([\s\S]*?)(?=---SENTIMENTS---|$)/);
  const sentimentsMatch = text.match(/---SENTIMENTS---\s*([\s\S]*?)(?=---KEYTHINGS---|$)/);
  const keyThingsMatch = text.match(/---KEYTHINGS---\s*([\s\S]*?)(?=---ALERTSUMMARY---|$)/);
  const alertSummaryMatch = text.match(/---ALERTSUMMARY---\s*([\s\S]*?)$/);

  const narrative = narrativeMatch?.[1]?.trim() || text;

  // Parse sentiments: "TICKER [Label]: text"
  const tickerSentiments: Record<string, TickerSentiment> = {};
  if (sentimentsMatch?.[1]) {
    const lines = sentimentsMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*\[([^\]]+)\]:\s*(.+)$/);
      if (match) {
        tickerSentiments[match[1].trim()] = {
          label: match[2].trim(),
          text: match[3].trim(),
        };
      } else {
        // Fallback: try old format "TICKER: text"
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const ticker = line.substring(0, colonIndex).trim().replace(/^\*+|\*+$/g, '');
          const sentiment = line.substring(colonIndex + 1).trim();
          if (ticker && sentiment) {
            const label = inferSentimentLabel(sentiment);
            tickerSentiments[ticker] = { label, text: sentiment };
          }
        }
      }
    }
  }

  // Parse key things: numbered items with title on first line, body on next
  const keyThingsToWatch: KeyThingToWatch[] = [];
  if (keyThingsMatch?.[1]) {
    const raw = keyThingsMatch[1].trim();
    const items = raw.split(/(?=^\d+\.\s)/m);
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const lines = trimmed.split('\n');
      const titleLine = lines[0].replace(/^\d+\.\s*/, '').trim();
      const bodyLines = lines.slice(1).join('\n').trim();
      if (titleLine) {
        keyThingsToWatch.push({
          title: titleLine,
          text: bodyLines || titleLine,
        });
      }
    }
  }

  // Parse alert summaries
  const alertSummaries: AlertSummaryItem[] = [];
  if (alertSummaryMatch?.[1]) {
    const lines = alertSummaryMatch[1].trim().split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const ticker = line.substring(0, colonIndex).trim().replace(/^\*+|\*+$/g, '');
        const description = line.substring(colonIndex + 1).trim();
        if (ticker && description) {
          alertSummaries.push({ ticker, description });
        }
      }
    }
  }

  return { narrative, tickerSentiments, keyThingsToWatch, alertSummaries };
}

function inferSentimentLabel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('strongly bullish')) return 'Strongly Bullish';
  if (lower.includes('overbought') && lower.includes('dangerous')) return 'Overbought / Dangerous';
  if (lower.includes('bullish') && lower.includes('caution')) return 'Bullish w/ Caution';
  if (lower.includes('bullish') && lower.includes('overbought')) return 'Bullish / Overbought';
  if (lower.includes('slightly bullish')) return 'Slightly Bullish';
  if (lower.includes('bullish')) return 'Bullish';
  if (lower.includes('bearish')) return 'Bearish';
  if (lower.includes('overbought')) return 'Overbought';
  return 'Neutral';
}
