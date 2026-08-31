import { Router } from "express";
import { SyncLog } from "../models/sync.log";

const router = Router();

/**
 * GET /api/logs
 * Logs de sincronización con filtros.
 */
router.get("/", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const syncType = req.query.type as string;
    const status = req.query.status as string;

    const where: any = {};
    if (syncType) where.sync_type = syncType;
    if (status) where.status = status;

    const { count, rows } = await SyncLog.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({
      logs: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
