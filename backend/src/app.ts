import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";

import { sequelize } from "./config/database";
import { redisClient } from "./config/redis";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error.handler";
import { authMiddleware } from "./middleware/auth";

// Rutas API
import dashboardRoutes from "./api/dashboard.routes";
import productRoutes from "./api/product.routes";
import orderRoutes from "./api/order.routes";
import syncRoutes from "./api/sync.routes";
import configRoutes from "./api/config.routes";
import logRoutes from "./api/log.routes";

// Webhooks
import webhookRoutes from "./webhooks/webhook.routes";

// Workers / Schedulers
import { startSyncScheduler } from "./workers/scheduler";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Middlewares globales ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting para API y webhooks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// ── Webhooks (sin auth, con verificación de firma propia) ──
app.use("/webhooks", webhookRoutes);

// ── API REST (protegida con JWT) ──
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/products", authMiddleware, productRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/sync", authMiddleware, syncRoutes);
app.use("/api/config", authMiddleware, configRoutes);
app.use("/api/logs", authMiddleware, logRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// ── Socket.IO para logs en tiempo real ──
io.on("connection", (socket) => {
  logger.info(`Cliente conectado al dashboard: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// Exportar io para usar en loggers
export { io };

// ── Inicialización ──
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Conectar a PostgreSQL
    await sequelize.authenticate();
    logger.info("✅ PostgreSQL conectado");

    // Sincronizar modelos (en prod usar migraciones)
    await sequelize.sync({ alter: process.env.NODE_ENV !== "production" });
    logger.info("✅ Modelos sincronizados");

    // Verificar Redis
    await redisClient.ping();
    logger.info("✅ Redis conectado");

    // Iniciar scheduler de sincronización
    startSyncScheduler();
    logger.info("✅ Scheduler de sincronización iniciado");

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    logger.error("❌ Error al iniciar:", error);
    process.exit(1);
  }
}

bootstrap();
