export interface Logger {
  warn(context: Record<string, unknown>, message: string): void;
  error(error: unknown): void;
}

export function createLogger(level: string): Logger {
  const silent = level === "silent";
  return {
    warn(context, message) {
      if (!silent) console.warn(JSON.stringify({ level: "warn", message, ...context }));
    },
    error(error) {
      if (!silent) console.error(error);
    },
  };
}
