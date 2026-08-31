import { BsaleClient } from "../integrations/bsale.client";
import { ClaroshopClient } from "../integrations/claroshop.client";
import { ProductMapping } from "../models/product.mapping";
import { StockChange } from "../models/stock.change";
import { SyncLog } from "../models/sync.log";
import { logger } from "../utils/logger";

export class StockSyncService {
  private bsale: BsaleClient;
  private claroshop: ClaroshopClient;

  constructor(bsale?: BsaleClient, claroshop?: ClaroshopClient) {
    this.bsale = bsale || new BsaleClient();
    this.claroshop = claroshop || new ClaroshopClient();
  }

  /**
   * Sincroniza stock de TODAS las variantes mapeadas.
   */
  async syncAllStock(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    logger.info("Iniciando sincronización de stock...");

    try {
      // Obtener variantes mapeadas
      const mappings = await ProductMapping.findAll({ where: { status: "synced" } });
      logger.info(`Sincronizando stock de ${mappings.length} productos mapeados`);

      const officeId = parseInt(process.env.BSALE_OFFICE_ID || "1");

      for (const mapping of mappings) {
        try {
          const stocks = await this.bsale.getStock(mapping.bsale_variant_id, officeId);
          const stockItem = stocks[0];
          const quantity = stockItem?.quantity || 0;

          // Guardar cambio en historial
          const lastChange = await StockChange.findOne({
            where: { bsale_variant_id: mapping.bsale_variant_id },
            order: [["created_at", "DESC"]],
          });

          if (!lastChange || lastChange.new_stock !== quantity) {
            await StockChange.create({
              bsale_variant_id: mapping.bsale_variant_id,
              bsale_office_id: officeId,
              old_stock: lastChange?.new_stock || 0,
              new_stock: quantity,
              change_reason: "sync",
              synced_to_claroshop: false,
            });
          }

          // Enviar a Claro Shop
          await this.claroshop.updateStock(mapping.claroshop_sku, quantity);

          // Actualizar mapping
          await mapping.update({ stock: quantity, last_sync_at: new Date() });

          // Marcar cambio como sincronizado
          await StockChange.update(
            { synced_to_claroshop: true },
            { where: { bsale_variant_id: mapping.bsale_variant_id, synced_to_claroshop: false } }
          );

          await SyncLog.create({
            sync_type: "stock",
            direction: "bsale_to_claroshop",
            entity_id: String(mapping.bsale_variant_id),
            entity_type: "stock",
            status: "success",
            message: `Stock actualizado: ${mapping.claroshop_sku} = ${quantity}`,
          });

          synced++;
        } catch (err: any) {
          errors++;
          logger.error(`Error sincronizando stock de ${mapping.claroshop_sku}: ${err.message}`);

          await SyncLog.create({
            sync_type: "stock",
            direction: "bsale_to_claroshop",
            entity_id: String(mapping.bsale_variant_id),
            entity_type: "stock",
            status: "error",
            error_detail: err.message,
          });
        }
      }
    } catch (err: any) {
      logger.error(`Error en syncAllStock: ${err.message}`);
    }

    logger.info(`Sincronización de stock completada: ${synced} sincronizados, ${errors} errores`);
    return { synced, errors };
  }

  /**
   * Sincroniza stock de una variante específica (usado por webhooks).
   */
  async syncVariantStock(variantId: number, officeId?: number): Promise<boolean> {
    try {
      const mapping = await ProductMapping.findOne({ where: { bsale_variant_id: variantId } });
      if (!mapping) {
        logger.warn(`No hay mapeo para variante ${variantId}, saltando sync de stock`);
        return false;
      }

      const stocks = await this.bsale.getStock(variantId, officeId);
      const quantity = stocks[0]?.quantity || 0;

      await this.claroshop.updateStock(mapping.claroshop_sku, quantity);
      await mapping.update({ stock: quantity, last_sync_at: new Date() });

      logger.info(`Stock webhook sincronizado: ${mapping.claroshop_sku} = ${quantity}`);
      return true;
    } catch (err: any) {
      logger.error(`Error en syncVariantStock ${variantId}: ${err.message}`);
      return false;
    }
  }
}
