export function createRateLimiter(delayMs: number) {
  let lastCallTime = 0;

  return async function rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed));
    }
    lastCallTime = Date.now();
  };
}
