import { WatchlistReport, TickerData, AlertCondition, TickerSentiment, KeyThingToWatch, AlertSummaryItem } from '../data/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPercentSigned(value: number | null): string {
  if (value === null) return 'N/A';
  if (value >= 0) return `+${value.toFixed(2)}%`;
  return `\u2212${Math.abs(value).toFixed(2)}%`;
}

function changeClass(value: number | null): string {
  if (value === null) return '';
  return value >= 0 ? 'td-up' : 'td-down';
}

function rsiClass(rsi: number | null): string {
  if (rsi === null) return 'mid';
  if (rsi > 70) return 'ob';
  if (rsi < 30) return 'os';
  return 'mid';
}

function rsiLabel(rsi: number | null): string {
  if (rsi === null) return 'N/A';
  let label = rsi.toFixed(1);
  if (rsi > 70) label += ' (OB)';
  else if (rsi < 30) label += ' (OS)';
  return label;
}

function smaTag(relation: 'above' | 'below' | 'N/A'): string {
  if (relation === 'above') return '<span class="sma-tag above">&#9650; Above</span>';
  if (relation === 'below') return '<span class="sma-tag below">&#9660; Below</span>';
  return 'N/A';
}

function volumeDisplay(volume: number, avgVolume: number | null): string {
  if (!avgVolume || avgVolume <= 0) return 'N/A';
  const ratio = volume / avgVolume;
  const text = `${ratio.toFixed(1)}x`;
  if (ratio >= 2) {
    return `<span class="vol-flag">${text} (!)</span>`;
  }
  return text;
}

function sentimentClass(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('overbought') || lower.includes('caution') || lower.includes('dangerous')) return 'caution';
  if (lower.includes('bullish')) return 'bullish';
  if (lower.includes('bearish')) return 'bearish';
  return 'neutral';
}

function sentimentArrow(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('bullish')) return '&#9650;';
  if (lower.includes('bearish')) return '&#9660;';
  return '&#9898;';
}

function renderAlertPills(alerts: AlertCondition[], tickers: TickerData[]): string {
  if (alerts.length === 0) return '';

  const pills = alerts.map((a) => {
    if (a.type === 'big_mover') {
      const cls = a.value >= 0 ? 'up' : 'down';
      const sign = a.value >= 0 ? '+' : '\u2212';
      return `<span class="alert-pill ${cls}"><span class="a-ticker">${escapeHtml(a.ticker)}</span> ${sign}${Math.abs(a.value).toFixed(2)}%</span>`;
    } else {
      return `<span class="alert-pill vol"><span class="a-ticker">${escapeHtml(a.ticker)}</span> ${a.value.toFixed(1)}x vol</span>`;
    }
  }).join('\n      ');

  return `
  <div class="alerts-banner">
    <div class="alerts-title">Alerts</div>
    <div class="alerts-grid">
      ${pills}
    </div>
  </div>`;
}

function renderNarrative(narrative: string): string {
  if (!narrative) return '';
  const paragraphs = narrative.split(/\n\n+/).filter(p => p.trim());
  const pHtml = paragraphs.map(p => `    <p>${escapeHtml(p.trim())}</p>`).join('\n');
  return `
  <div class="section-heading">Market Narrative</div>
  <div class="narrative-box">
${pHtml}
  </div>`;
}

function renderTickerTable(tickers: TickerData[]): string {
  const rows = tickers.map((td) => {
    const q = td.quote;
    const t = td.technicals;
    const dailySign = q.dailyChange >= 0 ? '+' : '\u2212';
    return `
        <tr>
          <td><span class="td-ticker">${escapeHtml(q.ticker)}</span><span class="td-name">${escapeHtml(q.companyName)}</span></td>
          <td>$${q.currentPrice.toFixed(2)}</td>
          <td class="${changeClass(q.dailyChangePercent)}">${formatPercentSigned(q.dailyChangePercent)}<br><span class="td-sub">${dailySign}$${Math.abs(q.dailyChange).toFixed(2)}</span></td>
          <td class="${changeClass(q.weeklyChangePercent)}">${formatPercentSigned(q.weeklyChangePercent)}</td>
          <td class="${changeClass(q.monthlyChangePercent)}">${formatPercentSigned(q.monthlyChangePercent)}</td>
          <td><span class="rsi ${rsiClass(t.rsi14)}">${rsiLabel(t.rsi14)}</span></td>
          <td>${smaTag(t.priceVsSma50)}</td>
          <td>${smaTag(t.priceVsSma200)}</td>
          <td>${volumeDisplay(q.volume, q.avgVolume20d)}</td>
        </tr>`;
  }).join('');

  return `
  <div class="section-heading">Ticker Data</div>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Price</th>
          <th>Daily</th>
          <th>Weekly</th>
          <th>Monthly</th>
          <th>RSI(14)</th>
          <th>50-SMA</th>
          <th>200-SMA</th>
          <th>Vol / Avg</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </div>`;
}

function renderSentiments(
  tickers: TickerData[],
  sentiments: Record<string, TickerSentiment>
): string {
  if (Object.keys(sentiments).length === 0) return '';

  const cards = tickers
    .map((td) => {
      const s = sentiments[td.quote.ticker];
      if (!s) return '';
      const cls = sentimentClass(s.label);
      const arrow = sentimentArrow(s.label);
      return `
    <div class="sentiment-card ${cls}">
      <div class="sentiment-header">
        <span class="sentiment-arrow">${arrow}</span>
        <span class="sentiment-ticker">${escapeHtml(td.quote.ticker)}</span>
        <span class="sentiment-label ${cls}">${escapeHtml(s.label)}</span>
      </div>
      <p class="sentiment-text">${escapeHtml(s.text)}</p>
    </div>`;
    })
    .filter(Boolean)
    .join('');

  return `
  <div class="section-heading">Per-Ticker Sentiment</div>
  <div class="sentiment-grid">${cards}
  </div>`;
}

function renderNews(tickers: TickerData[]): string {
  const groups = tickers
    .filter((td) => td.news.length > 0)
    .map((td) => {
      const items = td.news
        .map((n) => `
        <li class="news-item"><a href="${escapeHtml(n.url)}">${escapeHtml(n.title)}</a><span class="source">${escapeHtml(n.source)}</span></li>`)
        .join('');
      return `
    <div class="news-ticker-group">
      <div class="news-ticker-label">${escapeHtml(td.quote.ticker)}</div>
      <ul class="news-list">${items}
      </ul>
    </div>`;
    })
    .join('');

  if (!groups) return '';

  return `
  <div class="section-heading">Recent News</div>
  <div class="news-section">${groups}
  </div>`;
}

function renderKeyThings(items: KeyThingToWatch[]): string {
  if (items.length === 0) return '';

  const watchItems = items.map((item, i) => `
    <div class="watch-item">
      <div class="watch-item-title"><span class="watch-num">${i + 1}</span>${escapeHtml(item.title)}</div>
      <p class="watch-item-text">${escapeHtml(item.text)}</p>
    </div>`).join('');

  return `
  <div class="section-heading">Key Things to Watch</div>
  <div class="watch-section">${watchItems}
  </div>`;
}

function renderAlertSummary(
  alerts: AlertCondition[],
  tickers: TickerData[],
  alertSummaries: AlertSummaryItem[]
): string {
  if (alerts.length === 0) return '';

  const summaryMap = new Map(alertSummaries.map(s => [s.ticker, s.description]));
  const tickerMap = new Map(tickers.map(td => [td.quote.ticker, td]));

  // Group alerts by ticker, combining big_mover and volume info
  const tickerAlerts = new Map<string, { change?: number; volRatio?: number }>();
  for (const a of alerts) {
    const existing = tickerAlerts.get(a.ticker) || {};
    if (a.type === 'big_mover') existing.change = a.value;
    if (a.type === 'unusual_volume') existing.volRatio = a.value;
    tickerAlerts.set(a.ticker, existing);
  }

  const items = Array.from(tickerAlerts.entries()).map(([ticker, info]) => {
    const changeCls = info.change !== undefined ? (info.change >= 0 ? 'up' : 'down') : '';
    const changeStr = info.change !== undefined
      ? `<span class="as-change ${changeCls}">${info.change >= 0 ? '+' : '\u2212'}${Math.abs(info.change).toFixed(2)}%</span> daily`
      : '';
    const volStr = info.volRatio !== undefined ? `${info.volRatio.toFixed(1)}x vol` : '';
    const stats = [changeStr, volStr].filter(Boolean).join(', ');
    const desc = summaryMap.get(ticker) || '';
    const descHtml = desc ? ` &mdash; ${escapeHtml(desc)}` : '';

    return `
      <div class="alert-summary-item"><span class="as-ticker">${escapeHtml(ticker)}</span> ${stats}${descHtml}</div>`;
  }).join('');

  return `
  <div class="alert-summary">
    <div class="alert-summary-title">Alert Conditions Summary</div>
    <div class="alert-summary-grid">${items}
    </div>
  </div>`;
}

export function buildEmailHtml(report: WatchlistReport): string {
  const ai = report.aiCommentary;
  const now = new Date(report.generatedAt);
  const timestamp = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const shortDate = now.toLocaleDateString('en-US');

  const marketCtxParts: string[] = [];
  if (report.marketContext?.sp500Change !== undefined) {
    const sp500Val = report.marketContext.sp500Change;
    const sp500Color = sp500Val >= 0 ? 'var(--green)' : 'var(--red)';
    const sp500Sign = sp500Val >= 0 ? '+' : '\u2212';
    marketCtxParts.push(`<span><span class="ctx-label">S&amp;P 500 </span><span style="color:${sp500Color};font-weight:600">${sp500Sign}${Math.abs(sp500Val).toFixed(2)}%</span></span>`);
  }
  if (report.marketContext?.vixLevel !== undefined) {
    const vix = report.marketContext.vixLevel;
    const vixColor = vix >= 25 ? 'var(--amber)' : 'var(--text)';
    marketCtxParts.push(`<span><span class="ctx-label">VIX </span><span style="color:${vixColor};font-weight:600">${vix.toFixed(2)}</span></span>`);
  }
  const marketCtxHtml = marketCtxParts.length > 0
    ? `\n      <div class="market-ctx">\n        ${marketCtxParts.join('\n        ')}\n      </div>`
    : '';

  const failedTickersHtml = report.failedTickers.length > 0
    ? `\n  <div style="background:var(--red-bg);border:1px solid var(--red-border);padding:1rem 1.25rem;margin-bottom:2rem;color:var(--red);">
    Data unavailable for: ${report.failedTickers.join(', ')}
  </div>`
    : '';

  const alertsHtml = renderAlertPills(report.alerts, report.tickers);

  let narrativeHtml = '';
  if (ai && !ai.error) {
    narrativeHtml = renderNarrative(ai.narrative);
  } else if (ai?.error) {
    narrativeHtml = `
  <div class="section-heading">Market Narrative</div>
  <div class="narrative-box">
    <p style="color:var(--red);">${escapeHtml(ai.error)}</p>
  </div>`;
  }

  const tickerTableHtml = renderTickerTable(report.tickers);
  const sentimentsHtml = renderSentiments(report.tickers, ai?.tickerSentiments || {});
  const newsHtml = renderNews(report.tickers);
  const keyThingsHtml = renderKeyThings(ai?.keyThingsToWatch || []);
  const alertSummaryHtml = renderAlertSummary(report.alerts, report.tickers, ai?.alertSummaries || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Watchlist Report: ${escapeHtml(report.watchlistName)} &mdash; ${shortDate}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {
--bg: #ffffff;
--surface: #ffffff;
--surface-alt: #f8f9fa;
--border: #e2e5e9;
--border-strong: #d0d4da;
--text: #1a1a1a;
--text-secondary: #2d2d2d;
--text-muted: #1a1a1a;
--accent: #2563eb;
--accent-light: #2563eb;
--green: #059669;
--green-bg: #ecfdf5;
--green-border: #6ee7b7;
--red: #dc2626;
--red-bg: #fef2f2;
--red-border: #fca5a5;
--amber: #b45309;
--amber-bg: #fffbeb;
--amber-border: #fcd34d;
--blue-bg: #eff6ff;
--blue-border: #93c5fd;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
font-family: 'Inter', system-ui, -apple-system, sans-serif;
background: var(--bg);
color: var(--text);
line-height: 1.6;
padding: 2.5rem 2rem;
min-height: 100vh;
-webkit-font-smoothing: antialiased;
}

.container { max-width: 1300px; margin: 0 auto; }

/* -- HEADER -- */
.header {
display: flex;
justify-content: space-between;
align-items: flex-end;
margin-bottom: 2rem;
padding-bottom: 1.5rem;
border-bottom: 2px solid var(--text);
flex-wrap: wrap;
gap: 1rem;
}
.header h1 {
font-size: 1.6rem;
font-weight: 800;
letter-spacing: -.04em;
color: var(--text);
line-height: 1.2;
}
.header .subtitle {
font-size: .82rem;
color: var(--text-muted);
font-weight: 400;
margin-top: .15rem;
}
.header-meta {
text-align: right;
font-size: .78rem;
color: var(--text-secondary);
}
.market-ctx {
display: inline-flex;
gap: .75rem;
margin-top: .4rem;
border: 1px solid var(--border);
padding: .35rem .75rem;
font-size: .78rem;
font-weight: 500;
}
.market-ctx .ctx-label { color: var(--text-muted); font-weight: 400; }

/* -- SECTION HEADINGS -- */
.section-heading {
font-size: .72rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: .1em;
color: var(--text-muted);
margin-bottom: .85rem;
margin-top: 2.25rem;
}
.section-heading:first-of-type { margin-top: 0; }

/* -- ALERTS -- */
.alerts-banner {
border: 1px solid var(--amber-border);
background: var(--amber-bg);
padding: 1rem 1.25rem;
margin-bottom: 2rem;
border-left: 4px solid var(--amber);
}
.alerts-title {
font-size: .68rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: .08em;
color: var(--amber);
margin-bottom: .6rem;
}
.alerts-grid {
display: flex;
flex-wrap: wrap;
gap: .35rem;
}
.alert-pill {
font-size: .74rem;
font-weight: 500;
padding: .25rem .6rem;
border: 1px solid;
display: inline-flex;
align-items: center;
gap: .3rem;
background: var(--surface);
}
.alert-pill .a-ticker { font-weight: 700; }
.alert-pill.up { border-color: var(--green-border); color: var(--green); }
.alert-pill.down { border-color: var(--red-border); color: var(--red); }
.alert-pill.vol { border-color: var(--blue-border); color: var(--accent); }

/* -- NARRATIVE -- */
.narrative-box {
border: 1px solid var(--border);
padding: 1.5rem;
margin-bottom: 2rem;
}
.narrative-box p {
font-size: .875rem;
color: var(--text-secondary);
line-height: 1.8;
margin-bottom: .85rem;
}
.narrative-box p:last-child { margin-bottom: 0; }

/* -- TICKER TABLE -- */
.table-wrapper {
border: 1px solid var(--border);
overflow-x: auto;
margin-bottom: 2rem;
}
table { width: 100%; border-collapse: collapse; }
thead th {
background: var(--surface-alt);
padding: .65rem .75rem;
text-align: left;
font-size: .65rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: .07em;
color: var(--text-muted);
border-bottom: 2px solid var(--border-strong);
white-space: nowrap;
}
tbody td {
padding: .6rem .75rem;
border-bottom: 1px solid var(--border);
font-size: .8rem;
white-space: nowrap;
vertical-align: middle;
}
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--surface-alt); }
.td-ticker {
font-weight: 700;
font-size: .85rem;
color: var(--text);
}
.td-name {
color: var(--text-muted);
font-size: .72rem;
font-weight: 400;
display: block;
margin-top: .05rem;
}
.td-up { color: var(--green); font-weight: 600; }
.td-down { color: var(--red); font-weight: 600; }
.td-sub { font-size: .68rem; color: var(--text-muted); font-weight: 400; }
.sma-tag {
display: inline-block;
font-size: .65rem;
font-weight: 600;
padding: .1rem .4rem;
border: 1px solid;
}
.sma-tag.above { border-color: var(--green-border); color: var(--green); background: var(--green-bg); }
.sma-tag.below { border-color: var(--red-border); color: var(--red); background: var(--red-bg); }
.rsi { font-weight: 600; }
.rsi.ob { color: var(--red); }
.rsi.os { color: var(--accent); }
.rsi.mid { color: var(--text); }
.vol-flag { font-weight: 700; color: var(--amber); }

/* -- SENTIMENT -- */
.sentiment-grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
gap: .75rem;
margin-bottom: 2rem;
}
.sentiment-card {
border: 1px solid var(--border);
padding: 1rem 1.15rem;
border-left: 3px solid var(--border);
}
.sentiment-card.bullish { border-left-color: var(--green); }
.sentiment-card.bearish { border-left-color: var(--red); }
.sentiment-card.neutral { border-left-color: var(--text-muted); }
.sentiment-card.caution { border-left-color: var(--amber); }
.sentiment-header {
display: flex;
align-items: center;
gap: .45rem;
margin-bottom: .45rem;
}
.sentiment-arrow { font-size: .8rem; line-height: 1; }
.sentiment-ticker {
font-weight: 700;
font-size: .88rem;
}
.sentiment-label {
font-size: .62rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: .04em;
padding: .15rem .4rem;
border: 1px solid;
margin-left: auto;
}
.sentiment-label.bullish { border-color: var(--green-border); color: var(--green); background: var(--green-bg); }
.sentiment-label.bearish { border-color: var(--red-border); color: var(--red); background: var(--red-bg); }
.sentiment-label.neutral { border-color: var(--border); color: var(--text-muted); background: var(--surface-alt); }
.sentiment-label.caution { border-color: var(--amber-border); color: var(--amber); background: var(--amber-bg); }
.sentiment-text {
font-size: .82rem;
color: var(--text-secondary);
line-height: 1.65;
}

/* -- NEWS -- */
.news-section {
border: 1px solid var(--border);
margin-bottom: 2rem;
}
.news-ticker-group {
padding: .85rem 1.25rem;
border-bottom: 1px solid var(--border);
}
.news-ticker-group:last-child { border-bottom: none; }
.news-ticker-label {
font-weight: 700;
font-size: .8rem;
color: var(--text);
margin-bottom: .3rem;
}
.news-list { list-style: none; }
.news-item {
display: flex;
justify-content: space-between;
align-items: baseline;
padding: .3rem 0;
gap: 1rem;
}
.news-item a {
color: var(--text-secondary);
text-decoration: none;
font-size: .8rem;
line-height: 1.45;
}
.news-item a:hover { color: var(--accent); text-decoration: underline; }
.news-item .source {
font-size: .65rem;
color: var(--text-muted);
white-space: nowrap;
flex-shrink: 0;
}

/* -- KEY THINGS TO WATCH -- */
.watch-section {
border: 1px solid var(--border);
margin-bottom: 2rem;
}
.watch-item {
padding: 1rem 1.25rem;
border-bottom: 1px solid var(--border);
}
.watch-item:last-child { border-bottom: none; }
.watch-item-title {
font-size: .84rem;
font-weight: 700;
margin-bottom: .3rem;
display: flex;
align-items: center;
gap: .5rem;
}
.watch-num {
display: inline-flex;
align-items: center;
justify-content: center;
width: 20px;
height: 20px;
background: var(--text);
color: var(--surface);
font-size: .68rem;
font-weight: 700;
flex-shrink: 0;
}
.watch-item-text {
font-size: .82rem;
color: var(--text-secondary);
line-height: 1.75;
padding-left: 2.05rem;
}

/* -- ALERT SUMMARY -- */
.alert-summary {
background: var(--surface-alt);
border: 1px solid var(--border);
padding: 1.15rem 1.25rem;
margin-bottom: 2rem;
}
.alert-summary-title {
font-size: .68rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: .08em;
color: var(--text-muted);
margin-bottom: .65rem;
}
.alert-summary-grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
gap: .4rem;
}
.alert-summary-item {
font-size: .78rem;
color: var(--text-secondary);
padding: .35rem .6rem;
background: var(--surface);
border: 1px solid var(--border);
display: flex;
align-items: baseline;
gap: .35rem;
}
.as-ticker { font-weight: 700; color: var(--text); }
.as-change { font-weight: 600; }
.as-change.up { color: var(--green); }
.as-change.down { color: var(--red); }

/* -- FOOTER -- */
.footer {
margin-top: 2rem;
padding-top: 1.25rem;
border-top: 2px solid var(--text);
text-align: center;
font-size: .7rem;
color: var(--text-muted);
}

@media (max-width: 768px) {
body { padding: 1rem; }
.sentiment-grid { grid-template-columns: 1fr; }
table { font-size: .72rem; }
thead th, tbody td { padding: .45rem .5rem; }
}
</style>
</head>
<body>
<div class="container">

  <!-- HEADER -->
  <div class="header">
    <div>
      <h1>${escapeHtml(report.watchlistName)} Report</h1>
      <div class="subtitle">${escapeHtml(report.description)}</div>
    </div>
    <div class="header-meta">
      <div>${timestamp}</div>${marketCtxHtml}
    </div>
  </div>
${failedTickersHtml}${alertsHtml}${narrativeHtml}${tickerTableHtml}${sentimentsHtml}${newsHtml}${keyThingsHtml}${alertSummaryHtml}

  <!-- FOOTER -->
  <div class="footer">
    Generated by Watchlist Report Tool &middot; Data is for informational purposes only &middot; Not financial advice
  </div>

</div>
</body>
</html>`;
}
