import { WatchlistReport, TickerData, AlertCondition } from '../data/types';

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

function colorForChange(value: number | null): string {
  if (value === null) return '#666';
  return value >= 0 ? '#16a34a' : '#dc2626';
}

function rsiColor(rsi: number | null): string {
  if (rsi === null) return '#666';
  if (rsi > 70) return '#ea580c'; // overbought - orange
  if (rsi < 30) return '#2563eb'; // oversold - blue
  return '#666';
}

function rsiLabel(rsi: number | null): string {
  if (rsi === null) return 'N/A';
  let label = rsi.toFixed(1);
  if (rsi > 70) label += ' (OB)';
  else if (rsi < 30) label += ' (OS)';
  return label;
}

function smaArrow(relation: 'above' | 'below' | 'N/A'): string {
  if (relation === 'above') return '<span style="color:#16a34a;">&#9650; Above</span>';
  if (relation === 'below') return '<span style="color:#dc2626;">&#9660; Below</span>';
  return 'N/A';
}

function renderAlertBanner(alerts: AlertCondition[]): string {
  if (alerts.length === 0) return '';

  const items = alerts
    .map((a) => {
      const color = a.type === 'big_mover'
        ? (a.value >= 0 ? '#16a34a' : '#dc2626')
        : '#ea580c';
      return `<li style="margin:4px 0;color:${color};font-weight:600;">${escapeHtml(a.message)}</li>`;
    })
    .join('');

  return `
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <h2 style="margin:0 0 8px;color:#92400e;font-size:16px;">Alerts</h2>
      <ul style="margin:0;padding-left:20px;">${items}</ul>
    </div>`;
}

function renderTickerTable(tickers: TickerData[]): string {
  const rows = tickers
    .map((td, i) => {
      const q = td.quote;
      const t = td.technicals;
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const volumeRatio = q.avgVolume20d && q.avgVolume20d > 0
        ? (q.volume / q.avgVolume20d).toFixed(1)
        : 'N/A';
      const volumeFlag = q.avgVolume20d && q.avgVolume20d > 0 && q.volume > q.avgVolume20d * 2
        ? ' <span style="color:#ea580c;font-weight:600;">(!)</span>'
        : '';

      return `
      <tr style="background:${bgColor};">
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(q.ticker)}<br><span style="font-weight:400;font-size:12px;color:#6b7280;">${escapeHtml(q.companyName)}</span></td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">$${q.currentPrice.toFixed(2)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;color:${colorForChange(q.dailyChangePercent)};">${formatPercent(q.dailyChangePercent)}<br><span style="font-size:12px;">${q.dailyChange >= 0 ? '+' : ''}$${q.dailyChange.toFixed(2)}</span></td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;color:${colorForChange(q.weeklyChangePercent)};">${formatPercent(q.weeklyChangePercent)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;color:${colorForChange(q.monthlyChangePercent)};">${formatPercent(q.monthlyChangePercent)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;color:${rsiColor(t.rsi14)};">${rsiLabel(t.rsi14)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${smaArrow(t.priceVsSma50)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${smaArrow(t.priceVsSma200)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${volumeRatio}x${volumeFlag}</td>
      </tr>`;
    })
    .join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0;" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="background:#1e293b;color:#ffffff;">
          <th style="padding:12px 8px;text-align:left;">Ticker</th>
          <th style="padding:12px 8px;text-align:left;">Price</th>
          <th style="padding:12px 8px;text-align:left;">Daily</th>
          <th style="padding:12px 8px;text-align:left;">Weekly</th>
          <th style="padding:12px 8px;text-align:left;">Monthly</th>
          <th style="padding:12px 8px;text-align:left;">RSI(14)</th>
          <th style="padding:12px 8px;text-align:left;">vs 50-SMA</th>
          <th style="padding:12px 8px;text-align:left;">vs 200-SMA</th>
          <th style="padding:12px 8px;text-align:left;">Vol/Avg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSentiments(
  tickers: TickerData[],
  sentiments: Record<string, string>
): string {
  if (Object.keys(sentiments).length === 0) return '';

  const items = tickers
    .map((td) => {
      const sentiment = sentiments[td.quote.ticker] || 'No sentiment available';
      const lower = sentiment.toLowerCase();
      let badge = '&#9898;'; // neutral
      let badgeColor = '#6b7280';
      if (lower.includes('bullish')) {
        badge = '&#9650;';
        badgeColor = '#16a34a';
      } else if (lower.includes('bearish')) {
        badge = '&#9660;';
        badgeColor = '#dc2626';
      }

      return `
      <div style="padding:12px;margin:8px 0;background:#f9fafb;border-radius:6px;border-left:4px solid ${badgeColor};">
        <strong style="color:${badgeColor};">${badge} ${escapeHtml(td.quote.ticker)}</strong>
        <span style="color:#374151;margin-left:8px;">${escapeHtml(sentiment)}</span>
      </div>`;
    })
    .join('');

  return `
    <div style="margin:20px 0;">
      <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Per-Ticker Sentiment</h2>
      ${items}
    </div>`;
}

function renderNews(tickers: TickerData[]): string {
  const sections = tickers
    .filter((td) => td.news.length > 0)
    .map((td) => {
      const headlines = td.news
        .map(
          (n) =>
            `<li style="margin:4px 0;"><a href="${escapeHtml(n.url)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(n.title)}</a> <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(n.source)})</span></li>`
        )
        .join('');
      return `
      <div style="margin:12px 0;">
        <strong>${escapeHtml(td.quote.ticker)}</strong>
        <ul style="margin:4px 0;padding-left:20px;">${headlines}</ul>
      </div>`;
    })
    .join('');

  if (!sections) return '';

  return `
    <div style="margin:20px 0;">
      <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Recent News</h2>
      ${sections}
    </div>`;
}

export function buildEmailHtml(report: WatchlistReport): string {
  const ai = report.aiCommentary;
  const timestamp = new Date(report.generatedAt).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const marketContextHtml = report.marketContext
    ? `<div style="color:#94a3b8;font-size:13px;margin-top:4px;">
        ${report.marketContext.sp500Change !== undefined ? `S&amp;P 500: <span style="color:${colorForChange(report.marketContext.sp500Change)};">${formatPercent(report.marketContext.sp500Change)}</span>` : ''}
        ${report.marketContext.vixLevel !== undefined ? ` | VIX: ${report.marketContext.vixLevel.toFixed(2)}` : ''}
      </div>`
    : '';

  const failedTickersHtml = report.failedTickers.length > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:12px 0;color:#991b1b;">
        Data unavailable for: ${report.failedTickers.join(', ')}
      </div>`
    : '';

  const aiNarrative = ai && !ai.error
    ? `<div style="margin:20px 0;">
        <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Market Narrative</h2>
        <div style="color:#374151;line-height:1.6;">${ai.narrative.replace(/\n\n/g, '</p><p style="margin:12px 0;">').replace(/\n/g, '<br>')}</div>
      </div>`
    : ai?.error
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;margin:20px 0;">
          <strong style="color:#991b1b;">AI Commentary Unavailable</strong>
          <p style="color:#991b1b;margin:4px 0;">${escapeHtml(ai.error)}</p>
        </div>`
      : '';

  const keyThingsHtml = ai?.keyThingsToWatch
    ? `<div style="margin:20px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
        <h2 style="color:#166534;font-size:18px;margin:0 0 8px;">Key Things to Watch</h2>
        <div style="color:#166534;line-height:1.6;">${ai.keyThingsToWatch.replace(/\n/g, '<br>')}</div>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:800px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#0f172a;color:#ffffff;padding:24px 20px;">
      <h1 style="margin:0;font-size:24px;">${escapeHtml(report.watchlistName)} Report</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">${escapeHtml(report.description)}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${timestamp}</p>
      ${marketContextHtml}
    </div>

    <div style="padding:20px;">
      ${failedTickersHtml}
      ${renderAlertBanner(report.alerts)}
      ${aiNarrative}

      <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Ticker Data</h2>
      <div style="overflow-x:auto;">
        ${renderTickerTable(report.tickers)}
      </div>

      ${renderSentiments(report.tickers, ai?.tickerSentiments || {})}
      ${renderNews(report.tickers)}
      ${keyThingsHtml}
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:16px 20px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e5e7eb;">
      Generated by Watchlist Report Tool
    </div>
  </div>
</body>
</html>`;
}
