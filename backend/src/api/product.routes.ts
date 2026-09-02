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
 * Lista productos de Bsale con DESCRIPCIÓN WEB + IMÁGENES (v2 market_info) que aún NO están en Claroshop.
 * Usa Bsale API v2 para obtener descripción web e imágenes.
 */
router.get("/available", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || "";

    logger.info(`[available] Buscando productos de Bsale con desc web (v2) - page=${page}, limit=${limit}, search="${search}"`);

    const bsale = new BsaleClient();

    // Obtener market_info de Bsale v2 (productos con descripción web)
    const marketInfoList = await bsale.getMarketInfoListV2(200, 0);
    logger.info(`[available] Bsale v2 devolvió ${marketInfoList.length} market_info`);

    // Obtener IDs ya mapeados en Claroshop
    const mappedIds = await ProductMapping.findAll({
      attributes: ["bsale_variant_id"],
    });
    const mappedSet = new Set(mappedIds.map((m) => m.bsale_variant_id));
    logger.info(`[available] Productos ya mapeados en Claroshop: ${mappedSet.size}`);

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

        // Obtener imágenes del market_info
        const imageUrls: string[] = [];
        if (mi.urlImg) imageUrls.push(mi.urlImg);
        if (Array.isArray(mi.pictures)) {
          for (const pic of mi.pictures) {
            if (pic.href) imageUrls.push(pic.href);
          }
        }

        for (const variant of variants) {
          // Solo variantes activas y no mapeadas
          if (variant.state !== 0) continue;
          if (mappedSet.has(variant.id)) continue;

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
            bar_code: variant.barCode,
            state: variant.state,
            price,
            images: imageUrls,
            brand: mi.brand?.name || "",
            category_id: mi.productType?.id || "",
          });
        }
      } catch (err: any) {
        logger.warn(`[available] Error procesando market_info ${mi.id}: ${err.message}`);
      }
    }

    logger.info(`[available] Productos disponibles para publicar (con desc web + imagen): ${availableProducts.length}`);

    // Paginación
    const total = availableProducts.length;
    const start = (page - 1) * limit;
    const paginated = availableProducts.slice(start, start + limit);

    res.json({
      products: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
