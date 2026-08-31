import { productSyncQueue, stockSyncQueue, orderImportQueue } from "../config/redis";
import { logger } from "../utils/logger";

/**
 * Inicia el scheduler que ejecuta sincronizaciones periódicas.
 * Usa setInterval como fallback si no hay cron externo.
 */
export function startSyncScheduler() {
  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || "15");
  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`Scheduler configurado: cada ${intervalMinutes} minutos`);

  // Sincronizar stock cada intervalo (más frecuente)
  setInterval(async () => {
    logger.info("⏰ Scheduler: encolando sincronización de stock");
    await stockSyncQueue.add("sync-all-stock", {});
  }, intervalMs);

  // Sincronizar productos cada 4 intervalos (menos frecuente)
  setInterval(async () => {
    logger.info("⏰ Scheduler: encolando sincronización de productos");
    await productSyncQueue.add("sync-all-products", {});
  }, intervalMs * 4);

  // Importar órdenes cada 2 intervalos
  setInterval(async () => {
    logger.info("⏰ Scheduler: encolando importación de órdenes");
    await orderImportQueue.add("import-pending-orders", {});
  }, intervalMs * 2);

  // Ejecutar inmediatamente al iniciar
  setTimeout(async () => {
    logger.info("🚀 Ejecución inicial del scheduler");
    await stockSyncQueue.add("sync-all-stock", {});
    await orderImportQueue.add("import-pending-orders", {});
  }, 5000);
}
