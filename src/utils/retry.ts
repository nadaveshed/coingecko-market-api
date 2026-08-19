export async function withRetries<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoffSeconds: number;
    shouldRetry: (error: unknown) => boolean;
    retryAfterSeconds?: (error: unknown) => number | undefined;
  },
): Promise<T> {
  const attempts = Math.max(1, options.maxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !options.shouldRetry(error)) {
        throw error;
      }
      const retryAfter = options.retryAfterSeconds?.(error);
      const delaySeconds = retryAfter ?? options.backoffSeconds * 2 ** (attempt - 1);
      if (delaySeconds > 0) {
        await sleep(delaySeconds * 1000);
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
