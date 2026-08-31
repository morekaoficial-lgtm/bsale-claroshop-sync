import { productSyncQueue, stockSyncQueue, orderImportQueue } from "../config/redis";
import { ProductSyncService } from "../services/product.sync";
import { StockSyncService } from "../services/stock.sync";
import { OrderImportService } from "../services/order.import";
import { logger } from "../utils/logger";

// ── Procesadores de colas ──

productSyncQueue.process("sync-all-products", async (_job) => {
  const service = new ProductSyncService();
  return service.syncAllProducts();
});

productSyncQueue.process("retry-product", async (job) => {
  const service = new ProductSyncService();
  const { bsaleVariantId } = job.data;
  return service.retryProduct(bsaleVariantId);
});

productSyncQueue.process("webhook-product", async (job) => {
  const service = new ProductSyncService();
  const { variantId } = job.data;
  // Obtener variante completa de Bsale y sincronizar
  const bsale = new (await import("../integrations/bsale.client")).BsaleClient();
  const variant = await bsale.getVariant(variantId, ["product"]);
  const product = variant.product || await bsale.getProduct(variant.productId);
  return service.syncVariant(product, variant);
});

stockSyncQueue.process("sync-all-stock", async (_job) => {
  const service = new StockSyncService();
  return service.syncAllStock();
});

stockSyncQueue.process("webhook-stock", async (job) => {
  const service = new StockSyncService();
  const { variantId, officeId } = job.data;
  return service.syncVariantStock(variantId, officeId);
});

orderImportQueue.process("import-pending-orders", async (_job) => {
  const service = new OrderImportService();
  return service.importPendingOrders();
});

orderImportQueue.process("retry-order", async (job) => {
  const service = new OrderImportService();
  const { orderId } = job.data;
  return service.retryOrder(orderId);
});

orderImportQueue.process("webhook-order", async (job) => {
  const service = new OrderImportService();
  // Importar orden específica
  const { orderId } = job.data;
  const claroshop = new (await import("../integrations/claroshop.client")).ClaroshopClient();
  const order = await claroshop.getOrder(orderId);
  // Crear orden en base de datos
  const { Order } = await import("../models/order");
  await Order.create({
    claroshop_order_id: order.order_id,
    customer_name: order.customer.name,
    customer_email: order.customer.email,
    customer_phone: order.customer.phone,
    shipping_address: order.shipping_address,
    total: order.total,
    shipping_cost: order.shipping_cost,
    status: "pending",
    claroshop_status: order.status,
    items: order.items,
    imported_at: new Date(),
  });
  // Crear documento en Bsale
  const savedOrder = await Order.findOne({ where: { claroshop_order_id: order.order_id } });
  if (savedOrder) {
    await service.createBsaleDocument(savedOrder, order);
  }
  return { imported: true };
});

orderImportQueue.process("cancel-order", async (job) => {
  const service = new OrderImportService();
  const { orderId } = job.data;
  return service.handleCancellation(orderId);
});

logger.info("✅ Procesadores de colas registrados");
