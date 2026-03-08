type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

function createEntry(level: LogLevel, message: string, context?: string, data?: unknown): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
    ...(data !== undefined && { data }),
  };
}

function emit(entry: LogEntry) {
  const method = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";
  console[method](`[${entry.level.toUpperCase()}]`, JSON.stringify(entry));
}

export const logger = {
  info: (message: string, context?: string, data?: unknown) =>
    emit(createEntry("info", message, context, data)),
  warn: (message: string, context?: string, data?: unknown) =>
    emit(createEntry("warn", message, context, data)),
  error: (message: string, context?: string, data?: unknown) =>
    emit(createEntry("error", message, context, data)),
};
