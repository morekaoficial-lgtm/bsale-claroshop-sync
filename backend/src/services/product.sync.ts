import { BsaleClient } from "../integrations/bsale.client";
import { ClaroshopClient, ClaroshopProductPayload } from "../integrations/claroshop.client";
import { ProductMapping } from "../models/product.mapping";
import { SyncLog } from "../models/sync.log";
import { logger } from "../utils/logger";

export class ProductSyncService {
  private bsale: BsaleClient;
  private claroshop: ClaroshopClient;

  constructor(bsale?: BsaleClient, claroshop?: ClaroshopClient) {
    this.bsale = bsale || new BsaleClient();
    this.claroshop = claroshop || new ClaroshopClient();
  }

  /**
   * Publica productos seleccionados de Bsale a Claroshop (modo manual desde panel).
   * Usa descripción web e imágenes de Bsale API v2 (market_info).
   */
  async publishToClaroshop(variantIds: number[]): Promise<
    Array<{ variantId: number; success: boolean; result?: string; error?: string }>
  > {
    const results: Array<{ variantId: number; success: boolean; result?: string; error?: string }> = [];

    // Pre-cargar market_info v2 para mapear por productId
    const marketInfoList = await this.bsale.getMarketInfoListV2(200, 0);
    const marketInfoMap = new Map<number, any>();
    for (const mi of marketInfoList) {
      if (mi.productId) {
        marketInfoMap.set(mi.productId, mi);
      }
    }

    for (const variantId of variantIds) {
      try {
        const variant = await this.bsale.getVariant(variantId);
        const product = await this.bsale.getProduct(variant.productId);
        
        // Buscar market_info v2 para este producto
        const marketInfo = marketInfoMap.get(variant.productId);
        const webDescription = marketInfo?.description || product.description || variant.description || product.name;
        const webImages: string[] = [];
        if (marketInfo?.urlImg) webImages.push(marketInfo.urlImg);
        if (Array.isArray(marketInfo?.pictures)) {
          for (const pic of marketInfo.pictures) {
            if (pic.href) webImages.push(pic.href);
          }
        }

        const result = await this.syncVariant(product, variant, webDescription, webImages);
        results.push({ variantId, success: result === "created" || result === "updated", result });
      } catch (err: any) {
        logger.error(`Error publicando variante ${variantId}: ${err.message}`);
        results.push({ variantId, success: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Sincroniza TODOS los productos activos de Bsale hacia Claro Shop.
   * Para uso en sync masivo o scheduler.
   */
  async syncAllProducts(): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0;
    let updated = 0;
    let errors = 0;

    logger.info("Iniciando sincronización completa de productos...");

    try {
      const products = await this.bsale.getProducts(50, 0, 0); // state=0 = activos
      logger.info(`Encontrados ${products.length} productos activos en Bsale`);

      for (const product of products) {
        try {
          const variants = await this.bsale.getVariants(product.id, 50);

          for (const variant of variants) {
            const result = await this.syncVariant(product, variant);
            if (result === "created") created++;
            else if (result === "updated") updated++;
          }
        } catch (err: any) {
          errors++;
          logger.error(`Error sincronizando producto ${product.id}: ${err.message}`);
          await SyncLog.create({
            sync_type: "product",
            direction: "bsale_to_claroshop",
            entity_id: String(product.id),
            entity_type: "product",
            status: "error",
            error_detail: err.message,
          });
        }
      }
    } catch (err: any) {
      logger.error(`Error en syncAllProducts: ${err.message}`);
    }

    logger.info(`Sincronización completada: ${created} creados, ${updated} actualizados, ${errors} errores`);
    return { created, updated, errors };
  }

  /**
   * Sincroniza una variante específica (usado por webhooks y publicación manual).
   * @param product - Producto Bsale v1
   * @param variant - Variante Bsale v1
   * @param description - Descripción web (opcional, de market_info v2)
   * @param images - Imágenes web (opcional, de market_info v2)
   */
  async syncVariant(
    product: any, 
    variant: any, 
    description?: string, 
    images?: string[]
  ): Promise<"created" | "updated" | "skipped" | "error"> {
    const bsaleVariantId = variant.id;
    const sku = variant.code || String(variant.id);

    try {
      // Buscar mapeo existente
      let mapping = await ProductMapping.findOne({ where: { bsale_variant_id: bsaleVariantId } });

      // Obtener precios
      const priceListId = parseInt(process.env.BSALE_PRICE_LIST_ID || "1");
      const prices = await this.bsale.getPrices(bsaleVariantId, priceListId);
      const price = prices[0]?.price || 0;

      const payload: ClaroshopProductPayload = {
        sku,
        title: variant.description || product.name,
        description: description || product.description || variant.description || product.name,
        ean: variant.barCode,
        status: variant.state === 0 ? "active" : "inactive",
        price,
        images: images || [],
      };

      if (mapping) {
        // Actualizar en Claro Shop
        await this.claroshop.updateProduct(mapping.claroshop_sku, payload);
        await mapping.update({
          name: payload.title,
          description: payload.description,
          price: price,
          images: images || [],
          status: variant.state === 0 ? "synced" : "inactive",
          last_sync_at: new Date(),
          sync_error: undefined,
        });

        await SyncLog.create({
          sync_type: "product",
          direction: "bsale_to_claroshop",
          entity_id: String(bsaleVariantId),
          entity_type: "variant",
          status: "success",
          message: `Actualizado: ${sku}`,
        });

        return "updated";
      } else {
        // Crear en Claro Shop
        const result = await this.claroshop.createProduct(payload);
        const claroshopProductId = result.product_id || result.id || sku;

        await ProductMapping.create({
          bsale_product_id: product.id,
          bsale_variant_id: bsaleVariantId,
          claroshop_product_id: String(claroshopProductId),
          bsale_sku: sku,
          claroshop_sku: sku,
          name: payload.title,
          description: payload.description,
          price: price,
          images: images || [],
          status: "synced",
          last_sync_at: new Date(),
        });

        await SyncLog.create({
          sync_type: "product",
          direction: "bsale_to_claroshop",
          entity_id: String(bsaleVariantId),
          entity_type: "variant",
          status: "success",
          message: `Creado: ${sku}`,
        });

        return "created";
      }
    } catch (err: any) {
      logger.error(`Error sincronizando variante ${bsaleVariantId}: ${err.message}`);

      await SyncLog.create({
        sync_type: "product",
        direction: "bsale_to_claroshop",
        entity_id: String(bsaleVariantId),
        entity_type: "variant",
        status: "error",
        error_detail: err.message,
      });

      // Actualizar mapping con error si existe
      const mapping = await ProductMapping.findOne({ where: { bsale_variant_id: bsaleVariantId } });
      if (mapping) {
        await mapping.update({ status: "error", sync_error: err.message });
      }

      return "error";
    }
  }

  /**
   * Reintentar sincronización de un producto específico.
   */
  async retryProduct(bsaleVariantId: number): Promise<boolean> {
    try {
      const variant = await this.bsale.getVariant(bsaleVariantId);
      const product = await this.bsale.getProduct(variant.productId);
      const result = await this.syncVariant(product, variant);
      return result === "created" || result === "updated";
    } catch (err: any) {
      logger.error(`Error en retryProduct ${bsaleVariantId}: ${err.message}`);
      return false;
    }
  }
}
