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
 * Lista productos de Bsale activos que aún NO están en Claroshop.
 * NOTA: Bsale API v1 no expone descripción web ni imágenes en el endpoint base.
 * Se muestran todos los productos activos no mapeados para que el usuario seleccione.
 */
router.get("/available", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || "";

    logger.info(`[available] Buscando productos de Bsale - page=${page}, limit=${limit}, search="${search}"`);

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

      // Usar name como descripción si description es null
      const productDescription = product.description || product.name || "";

      try {
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
              description: productDescription,
              sku: variant.code || String(variant.id),
              bar_code: variant.barCode,
              state: variant.state,
              price,
            });
          }
        }
      } catch (err: any) {
        logger.warn(`[available] Error obteniendo variantes de producto ${product.id}: ${err.message}`);
      }
    }

    logger.info(`[available] Productos disponibles para publicar: ${availableProducts.length}`);

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
 * Debug: muestra información cruda de un producto en Bsale.
 */
router.get("/debug/:bsaleProductId", async (req, res, next) => {
  try {
    const productId = parseInt(req.params.bsaleProductId);
    const bsale = new BsaleClient();

    // Producto base
    const product = await bsale.getProduct(productId);

    // Intentar market_info (puede fallar)
    let marketInfo: any = null;
    let marketError: string = "";
    try {
      marketInfo = await bsale.getMarketInfo(productId);
    } catch (err: any) {
      marketError = err.message;
    }

    // Variantes
    const variants = await bsale.getVariants(productId, 50);

    res.json({
      product,
      marketInfo,
      marketError,
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
