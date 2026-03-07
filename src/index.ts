import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { loadConfig } from './config';
import { fetchQuote, fetchMarketContext } from './data/priceData';
import { fetchTechnicals } from './data/technicals';
import { fetchNews } from './data/news';
import { generateCommentary } from './ai/commentary';
import { buildEmailHtml } from './email/template';
import { sendEmail } from './email/sender';
import { generatePdfFromHtml } from './email/pdfGenerator';
import {
  TickerData,
  AlertCondition,
  WatchlistReport,
} from './data/types';

dotenv.config();

const program = new Command();

program
  .name('watchlist-report')
  .description('AI-powered stock market briefing emails for your watchlists')
  .version('1.0.0');

program
  .command('report')
  .description('Generate a watchlist report')
  .option('-l, --list <name>', 'Watchlist name to report on')
  .option('-a, --all', 'Generate reports for all watchlists')
  .option('-p, --preview', 'Preview in browser instead of emailing')
  .action(async (options) => {
    const config = loadConfig();

    if (!options.list && !options.all) {
      console.error('Error: specify --list <name> or --all');
      process.exit(1);
    }

    const watchlistNames = options.all
      ? Object.keys(config.watchlists)
      : [options.list as string];

    for (const name of watchlistNames) {
      if (!config.watchlists[name]) {
        console.error(`Error: watchlist "${name}" not found in config.json`);
        console.error(`Available: ${Object.keys(config.watchlists).join(', ')}`);
        process.exit(1);
      }
    }

    for (const name of watchlistNames) {
      console.log(`\nGenerating report for "${name}"...`);
      const report = await generateReport(name, config);
      const html = buildEmailHtml(report);

      if (options.preview) {
        const tmpFile = path.join(os.tmpdir(), `watchlist-report-${name.replace(/\s+/g, '-')}.html`);
        fs.writeFileSync(tmpFile, html, 'utf-8');
        console.log(`Preview saved to: ${tmpFile}`);

        // Open in default browser (Windows compatible)
        const platform = os.platform();
        const cmd = platform === 'win32'
          ? `start "" "${tmpFile}"`
          : platform === 'darwin'
            ? `open "${tmpFile}"`
            : `xdg-open "${tmpFile}"`;

        exec(cmd, (err) => {
          if (err) {
            console.warn(`Could not open browser automatically. Open manually: ${tmpFile}`);
          }
        });
      } else {
        const subject = `Watchlist Report: ${name} - ${new Date().toLocaleDateString('en-US')}`;
        console.log('  Generating PDF...');
        const pdfBuffer = await generatePdfFromHtml(html);
        const pdfFilename = `watchlist-report-${name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
        await sendEmail(config.email.to, config.email.from, subject, html, [
          { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
        ]);
      }
    }

    console.log('\nDone!');
  });

program
  .command('lists')
  .description('List all configured watchlists')
  .action(() => {
    const config = loadConfig();
    console.log('\nConfigured Watchlists:\n');
    for (const [name, wl] of Object.entries(config.watchlists)) {
      console.log(`  ${name}`);
      console.log(`    Description: ${wl.description}`);
      console.log(`    Tickers: ${wl.tickers.join(', ')}`);
      console.log();
    }
  });

async function generateReport(
  watchlistName: string,
  config: ReturnType<typeof loadConfig>
): Promise<WatchlistReport> {
  const watchlist = config.watchlists[watchlistName];
  const tickers: TickerData[] = [];
  const failedTickers: string[] = [];

  // Fetch market context
  console.log('  Fetching market context...');
  const marketContext = await fetchMarketContext();

  // Fetch data for each ticker
  for (const ticker of watchlist.tickers) {
    console.log(`  Fetching data for ${ticker}...`);
    try {
      const quote = await fetchQuote(ticker);
      const technicals = await fetchTechnicals(ticker, quote.currentPrice);
      const news = await fetchNews(ticker);

      tickers.push({ quote, technicals, news });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  Warning: Failed to fetch data for ${ticker}: ${message}`);
      failedTickers.push(ticker);
    }
  }

  // Identify alert conditions
  const alerts = identifyAlerts(
    tickers,
    config.alerts.bigMoverThresholdPercent,
    config.alerts.unusualVolumeMultiplier
  );

  if (alerts.length > 0) {
    console.log(`  ${alerts.length} alert(s) triggered`);
  }

  // Generate AI commentary
  console.log('  Generating AI commentary...');
  const aiCommentary = await generateCommentary(
    watchlistName,
    watchlist.description,
    tickers,
    alerts,
    config.ai.model,
    config.alerts.bigMoverThresholdPercent,
    config.alerts.unusualVolumeMultiplier
  );

  return {
    watchlistName,
    description: watchlist.description,
    generatedAt: new Date().toISOString(),
    tickers,
    alerts,
    aiCommentary,
    failedTickers,
    marketContext,
  };
}

function identifyAlerts(
  tickers: TickerData[],
  thresholdPercent: number,
  volumeMultiplier: number
): AlertCondition[] {
  const alerts: AlertCondition[] = [];

  for (const td of tickers) {
    const q = td.quote;

    // Big mover check
    if (Math.abs(q.dailyChangePercent) >= thresholdPercent) {
      const direction = q.dailyChangePercent >= 0 ? 'up' : 'down';
      alerts.push({
        ticker: q.ticker,
        type: 'big_mover',
        message: `${q.ticker} moved ${direction} ${Math.abs(q.dailyChangePercent).toFixed(2)}% today`,
        value: q.dailyChangePercent,
      });
    }

    // Unusual volume check
    if (q.avgVolume20d && q.avgVolume20d > 0) {
      const ratio = q.volume / q.avgVolume20d;
      if (ratio >= volumeMultiplier) {
        alerts.push({
          ticker: q.ticker,
          type: 'unusual_volume',
          message: `${q.ticker} volume is ${ratio.toFixed(1)}x average (${q.volume.toLocaleString()} vs avg ${q.avgVolume20d.toLocaleString()})`,
          value: ratio,
        });
      }
    }
  }

  return alerts;
}

program.parse(process.argv);
