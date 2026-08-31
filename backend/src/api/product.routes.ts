import { Router } from "express";
import { ProductMapping } from "../models/product.mapping";
import { ProductSyncService } from "../services/product.sync";
import { productSyncQueue } from "../config/redis";

const router = Router();
const productSync = new ProductSyncService();

/**
 * GET /api/products
 * Lista productos con filtros y paginación.
 */
router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where[Symbol.for("or")] = [
        { name: { $iLike: `%${search}%` } },
        { bsale_sku: { $iLike: `%${search}%` } },
        { claroshop_sku: { $iLike: `%${search}%` } },
      ];
    }

    const { count, rows } = await ProductMapping.findAndCountAll({
      where,
      order: [["updated_at", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({
      products: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products/:id/retry
 * Reintentar sincronización de un producto.
 */
router.post("/:id/retry", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const job = await productSyncQueue.add("retry-product", { bsaleVariantId: id });
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products/sync-all
 * Forzar sincronización completa de productos.
 */
router.post("/sync-all", async (_req, res, next) => {
  try {
    const job = await productSyncQueue.add("sync-all-products", {});
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

export default router;
