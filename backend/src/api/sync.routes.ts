import { Router } from "express";
import { productSyncQueue, stockSyncQueue, orderImportQueue } from "../config/redis";

const router = Router();

/**
 * POST /api/sync/products
 * Encolar sincronización de productos.
 */
router.post("/products", async (_req, res, next) => {
  try {
    const job = await productSyncQueue.add("sync-all-products", {});
    res.json({ success: true, jobId: job.id, type: "products" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sync/stock
 * Encolar sincronización de stock.
 */
router.post("/stock", async (_req, res, next) => {
  try {
    const job = await stockSyncQueue.add("sync-all-stock", {});
    res.json({ success: true, jobId: job.id, type: "stock" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sync/orders
 * Encolar importación de órdenes.
 */
router.post("/orders", async (_req, res, next) => {
  try {
    const job = await orderImportQueue.add("import-pending-orders", {});
    res.json({ success: true, jobId: job.id, type: "orders" });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sync/all
 * Encolar todo.
 */
router.post("/all", async (_req, res, next) => {
  try {
    const productJob = await productSyncQueue.add("sync-all-products", {});
    const stockJob = await stockSyncQueue.add("sync-all-stock", {});
    const orderJob = await orderImportQueue.add("import-pending-orders", {});
    res.json({
      success: true,
      jobs: {
        products: productJob.id,
        stock: stockJob.id,
        orders: orderJob.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
