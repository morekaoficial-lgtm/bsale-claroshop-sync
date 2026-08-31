import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const { combine, timestamp, json, errors } = winston.format;

// Transport para consola (siempre)
const consoleTransport = new winston.transports.Console({
  format: combine(
    timestamp(),
    winston.format.printf(({ level, message, timestamp: ts, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
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

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: { service: "bsale-claroshop-sync" },
  transports: [consoleTransport, fileTransport],
  exceptionHandlers: [fileTransport],
  rejectionHandlers: [fileTransport],
});

// Helper para emitir logs a Socket.IO (dashboard en tiempo real)
export function emitLog(level: string, message: string, meta?: Record<string, unknown>) {
  // Se importa dinámicamente para evitar ciclo circular
  try {
    const { io } = require("../app");
    io?.emit("log", { level, message, meta, timestamp: new Date().toISOString() });
  } catch {
    // Socket.IO aún no inicializado
  }
}

// Sobrescribir logger.info para emitir a Socket.IO
const originalInfo = logger.info.bind(logger);
logger.info = (message: string, meta?: any) => {
  emitLog("info", message, meta);
  return originalInfo(message, meta);
};

const originalError = logger.error.bind(logger);
logger.error = (message: string, meta?: any) => {
  emitLog("error", message, meta);
  return originalError(message, meta);
};
