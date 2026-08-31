import { Router } from "express";
import { ProductMapping } from "../models/product.mapping";
import { Order } from "../models/order";
import { SyncLog } from "../models/sync.log";
import { StockChange } from "../models/stock.change";

const router = Router();

/**
 * GET /api/dashboard/stats
 * Estadísticas generales para el panel.
 */
router.get("/stats", async (_req, res, next) => {
  try {
    const [
      totalProducts,
      syncedProducts,
      errorProducts,
      pendingProducts,
      totalOrders,
      pendingOrders,
      completedOrders,
      errorOrders,
      totalLogs,
      recentErrors,
      recentStockChanges,
    ] = await Promise.all([
      ProductMapping.count(),
      ProductMapping.count({ where: { status: "synced" } }),
      ProductMapping.count({ where: { status: "error" } }),
      ProductMapping.count({ where: { status: "pending" } }),
      Order.count(),
      Order.count({ where: { status: "pending" } }),
      Order.count({ where: { status: "completed" } }),
      Order.count({ where: { status: "error" } }),
      SyncLog.count(),
      SyncLog.count({ where: { status: "error", created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } as any } }),
      StockChange.count({ where: { synced_to_claroshop: false } }),
    ]);

    res.json({
      products: { total: totalProducts, synced: syncedProducts, error: errorProducts, pending: pendingProducts },
      orders: { total: totalOrders, pending: pendingOrders, completed: completedOrders, error: errorOrders },
      sync: { totalLogs, recentErrors, pendingStockChanges: recentStockChanges },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/activity
 * Actividad reciente para el panel.
 */
router.get("/activity", async (_req, res, next) => {
  try {
    const logs = await SyncLog.findAll({
      order: [["created_at", "DESC"]],
      limit: 50,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export default router;
