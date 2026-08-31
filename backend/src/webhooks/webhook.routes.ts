import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import { productSyncQueue, stockSyncQueue } from "../config/redis";

const router = Router();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * Verifica firma del webhook (si Bsale/Claro Shop la envían).
 * Por ahora Bsale no firma, solo envía JSON. Claro Shop tampoco menciona firma.
 */
function verifyWebhookSignature(req: Request): boolean {
  // TODO: Implementar verificación si las APIs lo soportan
  return true;
}

/**
 * POST /webhooks/bsale
 * Recibe webhooks de Bsale (productos, variantes, stock, precios).
 */
router.post("/bsale", async (req, res) => {
  try {
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: "Firma inválida" });
    }

    const { topic, action, resourceId, resource, officeId } = req.body;
    logger.info(`Webhook Bsale recibido: ${topic} ${action} id=${resourceId}`);

    switch (topic) {
      case "product":
      case "variant":
        if (action === "post" || action === "put") {
          await productSyncQueue.add("webhook-product", { variantId: parseInt(resourceId) });
        }
        break;

      case "stock":
        if (action === "put") {
          await stockSyncQueue.add("webhook-stock", {
            variantId: parseInt(resourceId),
            officeId: officeId ? parseInt(officeId) : undefined,
          });
        }
        break;

      case "price":
        // TODO: Encolar sincronización de precios
        break;

      default:
        logger.warn(`Webhook Bsale no manejado: ${topic}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error("Error en webhook Bsale:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /webhooks/claroshop
 * Recibe webhooks de Claro Shop (nuevas órdenes, cambios de estado).
 */
router.post("/claroshop", async (req, res) => {
  try {
    const { event, order_id, status } = req.body;
    logger.info(`Webhook Claro Shop recibido: ${event} order=${order_id}`);

    // Importar dinámicamente para evitar ciclo
    const { orderImportQueue } = await import("../config/redis");

    switch (event) {
      case "order.created":
      case "order.paid":
        await orderImportQueue.add("webhook-order", { orderId: order_id });
        break;

      case "order.cancelled":
        await orderImportQueue.add("cancel-order", { orderId: order_id });
        break;

      case "order.status_updated":
        // Actualizar estado en base de datos
        const { Order } = await import("../models/order");
        await Order.update(
          { claroshop_status: status },
          { where: { claroshop_order_id: order_id } }
        );
        break;

      default:
        logger.warn(`Webhook Claro Shop no manejado: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error("Error en webhook Claro Shop:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
