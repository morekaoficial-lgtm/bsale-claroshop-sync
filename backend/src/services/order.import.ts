import { BsaleClient } from "../integrations/bsale.client";
import { ClaroshopClient } from "../integrations/claroshop.client";
import { Order } from "../models/order";
import { ProductMapping } from "../models/product.mapping";
import { SyncLog } from "../models/sync.log";
import { logger } from "../utils/logger";

export class OrderImportService {
  private bsale: BsaleClient;
  private claroshop: ClaroshopClient;

  constructor(bsale?: BsaleClient, claroshop?: ClaroshopClient) {
    this.bsale = bsale || new BsaleClient();
    this.claroshop = claroshop || new ClaroshopClient();
  }

  /**
   * Importa órdenes pendientes de Claro Shop hacia Bsale.
   */
  async importPendingOrders(): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;

    logger.info("Iniciando importación de órdenes desde Claro Shop...");

    try {
      const orders = await this.claroshop.getOrders("pending");
      logger.info(`Encontradas ${orders.length} órdenes pendientes`);

      for (const csOrder of orders) {
        try {
          // Verificar si ya fue importada
          const existing = await Order.findOne({ where: { claroshop_order_id: csOrder.order_id } });
          if (existing) {
            logger.info(`Orden ${csOrder.order_id} ya importada, saltando`);
            continue;
          }

          // Crear registro de orden
          const orderRecord = await Order.create({
            claroshop_order_id: csOrder.order_id,
            customer_name: csOrder.customer.name,
            customer_email: csOrder.customer.email,
            customer_phone: csOrder.customer.phone,
            shipping_address: csOrder.shipping_address,
            total: csOrder.total,
            shipping_cost: csOrder.shipping_cost,
            status: "pending",
            claroshop_status: csOrder.status,
            items: csOrder.items,
            imported_at: new Date(),
          });

          // Crear documento en Bsale (nota de venta / pedido web)
          await this.createBsaleDocument(orderRecord, csOrder);

          imported++;
        } catch (err: any) {
          errors++;
          logger.error(`Error importando orden ${csOrder.order_id}: ${err.message}`);

          await SyncLog.create({
            sync_type: "order",
            direction: "claroshop_to_bsale",
            entity_id: csOrder.order_id,
            entity_type: "order",
            status: "error",
            error_detail: err.message,
          });
        }
      }
    } catch (err: any) {
      logger.error(`Error en importPendingOrders: ${err.message}`);
    }

    logger.info(`Importación completada: ${imported} importadas, ${errors} errores`);
    return { imported, errors };
  }

  /**
   * Crea un documento de pedido en Bsale.
   */
  private async createBsaleDocument(order: Order, csOrder: any): Promise<void> {
    const officeId = parseInt(process.env.BSALE_OFFICE_ID || "1");
    const priceListId = parseInt(process.env.BSALE_PRICE_LIST_ID || "1");

    // Buscar o crear cliente en Bsale
    let client = await this.bsale.findClientByCode(order.customer_email || order.claroshop_order_id);
    if (!client) {
      client = await this.bsale.createClient({
        code: order.customer_email || order.claroshop_order_id,
        firstName: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
        city: (order.shipping_address as any)?.city,
        address: (order.shipping_address as any)?.street,
      });
    }

    // Preparar detalles de productos
    const details = [];
    for (const item of csOrder.items) {
      const mapping = await ProductMapping.findOne({ where: { claroshop_sku: item.sku } });
      if (!mapping) {
        logger.warn(`SKU ${item.sku} no mapeado, omitiendo de la orden`);
        continue;
      }

      details.push({
        variantId: mapping.bsale_variant_id,
        quantity: item.quantity,
        unitValue: item.unit_price,
        comment: `Claro Shop SKU: ${item.sku}`,
      });
    }

    if (details.length === 0) {
      throw new Error("Ningún ítem de la orden tiene mapeo válido");
    }

    // Crear documento tipo "pedido" en Bsale
    // documentTypeId: 1 = nota de venta, ajustar según configuración
    const documentData = {
      documentTypeId: parseInt(process.env.BSALE_DOCUMENT_TYPE_ID || "1"),
      officeId,
      priceListId,
      sellerId: parseInt(process.env.BSALE_SELLER_ID || "1"),
      client: {
        id: client.id,
        code: client.code,
      },
      details,
      comment: `Pedido Claro Shop #${order.claroshop_order_id}`,
      dispatch: 0, // No despachar automáticamente (es un pedido)
    };

    const result = await this.bsale.createDocument(documentData);

    await order.update({
      bsale_document_id: result.id,
      bsale_document_number: result.number,
      bsale_status: result.state || "created",
      status: "processing",
      processed_at: new Date(),
    });

    await SyncLog.create({
      sync_type: "order",
      direction: "claroshop_to_bsale",
      entity_id: order.claroshop_order_id,
      entity_type: "order",
      status: "success",
      message: `Documento Bsale creado: ${result.number}`,
      request_payload: documentData,
      response_payload: result,
    });

    logger.info(`Orden ${order.claroshop_order_id} → Bsale documento ${result.number}`);
  }

  /**
   * Reintentar importación de una orden fallida.
   */
  async retryOrder(orderId: number): Promise<boolean> {
    try {
      const order = await Order.findByPk(orderId);
      if (!order) return false;

      const csOrder = await this.claroshop.getOrder(order.claroshop_order_id);
      await this.createBsaleDocument(order, csOrder);
      return true;
    } catch (err: any) {
      logger.error(`Error en retryOrder ${orderId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Manejar cancelación de orden en Claro Shop.
   */
  async handleCancellation(claroshopOrderId: string): Promise<void> {
    try {
      const order = await Order.findOne({ where: { claroshop_order_id: claroshopOrderId } });
      if (!order) {
        logger.warn(`Orden ${claroshopOrderId} no encontrada para cancelar`);
        return;
      }

      await order.update({
        status: "cancelled",
        claroshop_status: "cancelled",
      });

      // TODO: Generar nota de crédito o anulación en Bsale si aplica
      logger.info(`Orden ${claroshopOrderId} marcada como cancelada`);
    } catch (err: any) {
      logger.error(`Error en handleCancellation: ${err.message}`);
    }
  }
}
