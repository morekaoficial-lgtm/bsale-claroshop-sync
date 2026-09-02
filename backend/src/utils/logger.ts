import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const { combine, timestamp, json } = winston.format;

// Helper para stringify seguro que evita errores circulares
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      const cache = new Set();
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (cache.has(value)) return "[Circular]";
          cache.add(value);
        }
        return value;
      });
    } catch {
      return String(obj);
    }
  }
}

// Transport para consola (siempre)
const consoleTransport = new winston.transports.Console({
  format: combine(
    timestamp(),
    winston.format.printf(({ level, message, timestamp: ts, ...meta }) => {
      const metaStr = Object.keys(meta).length ? safeStringify(meta) : "";
      return `${ts} [${level.toUpperCase()}]: ${message} ${metaStr}`;
    })
  ),
});

// Transport rotativo para archivo
const fileTransport = new DailyRotateFile({
  filename: path.join(process.env.LOG_FILE || "./logs", "app-%DATE.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  format: combine(timestamp(), json()),
});

// Logger base
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: { service: "bsale-claroshop-sync" },
  transports: [consoleTransport, fileTransport],
  exceptionHandlers: [fileTransport],
  rejectionHandlers: [fileTransport],
});

// Helper para emitir logs a Socket.IO (dashboard en tiempo real)
function emitLog(level: string, message: string, meta?: Record<string, unknown>) {
  try {
    const { io } = require("../app");
    io?.emit("log", { level, message, meta, timestamp: new Date().toISOString() });
  } catch {
    // Socket.IO aun no inicializado
  }
}

// Logger wrapper que emite a Socket.IO
export const logger = {
  info: (message: string, meta?: any) => {
    emitLog("info", message, meta);
    baseLogger.info(message, meta);
  },
  error: (message: string, meta?: any) => {
    emitLog("error", message, meta);
    baseLogger.error(message, meta);
  },
  warn: (message: string, meta?: any) => {
    emitLog("warn", message, meta);
    baseLogger.warn(message, meta);
  },
  debug: (message: string, meta?: any) => {
    baseLogger.debug(message, meta);
  },
};
