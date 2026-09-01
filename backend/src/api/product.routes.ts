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
 * Lista productos de Bsale con DESCRIPCIÓN WEB + IMÁGENES que aún NO están en Claroshop.
 */
router.get("/available", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || "";

    logger.info(`[available] Buscando productos de Bsale completos (desc web + imagen) - page=${page}, limit=${limit}, search="${search}"`);

    // Obtener productos de Bsale (activos)
    const bsale = new BsaleClient();
    const bsaleProducts = await bsale.getProducts(200, 0, 0); // state=0 = activos
    logger.info(`[available] Bsale devolvió ${bsaleProducts.length} productos activos`);

    // Obtener IDs ya mapeados
    const mappedIds = await ProductMapping.findAll({
      attributes: ["bsale_variant_id"],
    });
    const mappedSet = new Set(mappedIds.map((m) => m.bsale_variant_id));
    logger.info(`[available] Productos ya mapeados en Claroshop: ${mappedSet.size}`);

    const availableProducts: any[] = [];

    for (const product of bsaleProducts) {
      // Filtrar por búsqueda si aplica
      if (search && !product.name?.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      try {
        // Obtener descripción web (market_info) - contiene descripción + imágenes
        const marketInfo = await bsale.getMarketInfo(product.id);
        const webDescription = marketInfo?.description || marketInfo?.data?.description || "";
        const urlImg = marketInfo?.urlImg || marketInfo?.data?.urlImg || "";
        const pictures = marketInfo?.pictures || marketInfo?.data?.pictures || [];

        // Verificar que tenga descripción web
        if (!webDescription || webDescription.trim().length < 10) {
          logger.debug(`[available] Producto ${product.id} sin descripción web suficiente`);
          continue;
        }

        // Verificar que tenga al menos una imagen
        const hasImages = urlImg || (Array.isArray(pictures) && pictures.length > 0);
        if (!hasImages) {
          logger.debug(`[available] Producto ${product.id} sin imágenes`);
          continue;
        }

        // Obtener imágenes como array de URLs
        const imageUrls: string[] = [];
        if (urlImg) imageUrls.push(urlImg);
        if (Array.isArray(pictures)) {
          for (const pic of pictures) {
            if (pic.href || pic.urlImg) {
              imageUrls.push(pic.href || pic.urlImg);
            }
          }
        }

        // Obtener variantes no mapeadas
        const variants = await bsale.getVariants(product.id, 50);
        for (const variant of variants) {
          if (!mappedSet.has(variant.id)) {
            const priceListId = parseInt(process.env.BSALE_PRICE_LIST_ID || "1");
            const prices = await bsale.getPrices(variant.id, priceListId);
            const price = prices[0]?.price || 0;

            availableProducts.push({
              bsale_product_id: product.id,
              bsale_variant_id: variant.id,
              name: variant.description || product.name,
              description: webDescription,
              sku: variant.code || String(variant.id),
              bar_code: variant.barCode,
              state: variant.state,
              price,
              images: imageUrls,
            });
          }
        }
      } catch (err: any) {
        logger.warn(`[available] Error obteniendo market_info de producto ${product.id}: ${err.message}`);
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
