import { Router } from "express";
import { BsaleClient } from "../integrations/bsale.client";
import { ProductMapping } from "../models/product.mapping";
import { ProductSyncService } from "../services/product.sync";
import { productSyncQueue } from "../config/redis";
import { logger } from "../utils/logger";

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

/**
 * GET /api/products/available
 * Lista productos de Bsale con DESCRIPCIÓN WEB + IMÁGENES (v2 market_info).
 * Incluye estado de sincronización si existe (para ver errores y reintentar).
 * Usa Bsale API v2 con paginación real (limit=50 + offset).
 */
router.get("/available", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);
    const search = (req.query.search as string) || "";

    const offset = (page - 1) * limit;

    logger.info(`[available] Buscando productos Bsale v2 - page=${page}, limit=${limit}, offset=${offset}, search="${search}"`);

    const bsale = new BsaleClient();

    // Obtener market_info de Bsale v2 paginado (solo los que necesitamos)
    const marketInfoList = await bsale.getMarketInfoListV2(limit, offset);
    logger.info(`[available] Bsale v2 devolvió ${marketInfoList.length} market_info (offset=${offset})`);

    // Obtener mapeos existentes
    const allMappings = await ProductMapping.findAll({
      attributes: ["bsale_variant_id", "status", "sync_error", "last_sync_at", "claroshop_product_id"],
    });
    const mappingMap = new Map<number, any>();
    for (const m of allMappings) {
      mappingMap.set(m.bsale_variant_id, m);
    }

    const availableProducts: any[] = [];

    for (const mi of marketInfoList) {
      // Solo productos activos (state=1) con descripción
      if (mi.state !== 1) continue;
      if (!mi.description || mi.description.trim().length < 10) continue;

      // Filtrar por búsqueda si aplica
      if (search && !mi.name?.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      try {
        // Obtener producto v1 por productId
        const productId = mi.productId;
        const product = await bsale.getProduct(productId);

        // Obtener variantes del producto v1
        const variants = await bsale.getVariants(productId, 50);

        // Obtener imágenes del market_info v2
        const imageUrls: string[] = [];
        if (mi.urlImg) imageUrls.push(mi.urlImg);
        if (Array.isArray(mi.pictures)) {
          for (const pic of mi.pictures) {
            if (pic.href) imageUrls.push(pic.href);
          }
        }

        for (const variant of variants) {
          // Solo variantes activas
          if (variant.state !== 0) continue;

          const existingMapping = mappingMap.get(variant.id);

          // Obtener precio
          let price = 0;
          try {
            const prices = await bsale.getPrices(variant.id, 1);
            price = prices[0]?.price || 0;
          } catch {
            price = 0;
          }

          availableProducts.push({
            bsale_product_id: productId,
            bsale_variant_id: variant.id,
            name: variant.description || mi.name || product.name,
            description: mi.description,
            sku: variant.code || String(variant.id),
            bar_code: variant.barCode || "",
            state: variant.state,
            price,
            images: imageUrls,
            brand: mi.brand?.name || "",
            category_id: mi.productType?.id || "",
            category_name: mi.productType?.name || "",
            sync_status: existingMapping?.status || null,
            sync_error: existingMapping?.sync_error || null,
            last_sync_at: existingMapping?.last_sync_at || null,
            claroshop_product_id: existingMapping?.claroshop_product_id || null,
            is_synced: existingMapping?.status === "synced",
            has_error: existingMapping?.status === "error",
          });
        }
      } catch (err: any) {
        logger.warn(`[available] Error procesando market_info ${mi.id}: ${err.message}`);
      }
    }

    logger.info(`[available] Productos procesados: ${availableProducts.length}`);

    // Si devolvió exactamente 'limit' items, asumimos que hay más páginas
    const hasMore = marketInfoList.length >= limit;

    res.json({
      products: availableProducts,
      pagination: { page, limit, hasMore },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/debug/:bsaleProductId
 * Debug: muestra información cruda de un producto en Bsale (v1 + v2).
 */
router.get("/debug/:bsaleProductId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.bsaleProductId);
    const bsale = new BsaleClient();

    // Producto base v1
    const product = await bsale.getProduct(productId);

    // Buscar market_info v2 por productId
    let marketInfoV2: any = null;
    try {
      const list = await bsale.getMarketInfoListV2(50, 0);
      marketInfoV2 = list.find((mi: any) => mi.productId === productId) || null;
    } catch (err: any) {
      logger.warn(`[debug] Error buscando market_info v2: ${err.message}`);
    }

    // Variantes v1
    const variants = await bsale.getVariants(productId, 50);

    res.json({
      product,
      marketInfoV2,
      variants,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products/publish
 * Publica productos seleccionados en Claroshop.
 */
router.post("/publish", async (req, res, next) => {
  try {
    const { variantIds } = req.body as { variantIds: number[] };
    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).json({ error: "Debes enviar un array de variantIds" });
    }

    const results = await productSync.publishToClaroshop(variantIds);
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

export default router;
