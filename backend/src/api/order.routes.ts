import { Router } from "express";
import { Order } from "../models/order";
import { OrderImportService } from "../services/order.import";
import { orderImportQueue } from "../config/redis";

const router = Router();
const orderService = new OrderImportService();

/**
 * GET /api/orders
 * Lista órdenes con filtros.
 */
router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;

    const where: any = {};
    if (status) where.status = status;

    const { count, rows } = await Order.findAndCountAll({
      where,
      order: [["imported_at", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({
      orders: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/:id/retry
 * Reintentar importación de orden.
 */
router.post("/:id/retry", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const job = await orderImportQueue.add("retry-order", { orderId: id });
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/import
 * Forzar importación de órdenes pendientes.
 */
router.post("/import", async (_req, res, next) => {
  try {
    const job = await orderImportQueue.add("import-pending-orders", {});
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

export default router;
