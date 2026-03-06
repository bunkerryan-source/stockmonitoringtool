import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './data/types';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}. Please create a config.json file.`
    );
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  let config: AppConfig;

  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error('config.json is not valid JSON. Please check the file format.');
  }

  validateConfig(config);
  return config;
}

function validateConfig(config: AppConfig): void {
  if (!config.watchlists || typeof config.watchlists !== 'object') {
    throw new Error('config.json must contain a "watchlists" object.');
  }

  const watchlistNames = Object.keys(config.watchlists);
  if (watchlistNames.length === 0) {
    throw new Error('config.json must contain at least one watchlist.');
  }

  for (const name of watchlistNames) {
    const wl = config.watchlists[name];

    if (!Array.isArray(wl.tickers) || wl.tickers.length === 0) {
      throw new Error(
        `Watchlist "${name}" must have a non-empty "tickers" array.`
      );
    }

    for (const ticker of wl.tickers) {
      if (typeof ticker !== 'string' || ticker.trim() === '') {
        throw new Error(
          `Watchlist "${name}" contains an invalid ticker: ${JSON.stringify(ticker)}`
        );
      }
    }

    if (typeof wl.description !== 'string') {
      throw new Error(`Watchlist "${name}" must have a "description" string.`);
    }
  }

  if (!config.ai?.model) {
    throw new Error('config.json must contain an "ai.model" string.');
  }

  if (!config.email?.to || !config.email?.from) {
    throw new Error('config.json must contain "email.to" and "email.from" strings.');
  }

  if (
    typeof config.alerts?.bigMoverThresholdPercent !== 'number' ||
    typeof config.alerts?.unusualVolumeMultiplier !== 'number'
  ) {
    throw new Error(
      'config.json must contain numeric "alerts.bigMoverThresholdPercent" and "alerts.unusualVolumeMultiplier".'
    );
  }
}
