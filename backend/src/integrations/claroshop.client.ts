import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger";

export interface ClaroshopProductPayload {
  sku: string;
  title: string;
  description?: string;
  ean?: string;
  upc?: string;
  brand?: string;
  category_id?: string;
  price?: number;
  offer_price?: number;
  stock?: number;
  status?: "active" | "inactive" | "paused";
  shipping_time?: number;
  images?: string[];
  height?: number;
  length?: number;
  width?: number;
  weight?: number;
}

export interface ClaroshopOrder {
  order_id: string;
  status: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  total: number;
  shipping_cost?: number;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
  }>;
  shipping_address?: object;
  created_at: string;
}

export class ClaroshopClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string, baseURL?: string) {
    this.apiKey = apiKey || process.env.CLAROSHOP_API_KEY || "";
    this.client = axios.create({
      baseURL: baseURL || process.env.CLAROSHOP_BASE_URL || "https://api.t1.com",
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        logger.error("Claro Shop API error:", error.response?.data || error.message);
        throw error;
      }
    );
  }

  // ── Productos ──
  async getProducts(page = 1, perPage = 50): Promise<any[]> {
    const res = await this.client.get("/products", { params: { page, per_page: perPage } });
    return res.data.products || res.data.items || [];
  }

  async getProduct(sku: string): Promise<any> {
    const res = await this.client.get(`/products/${sku}`);
    return res.data;
  }

  async createProduct(payload: ClaroshopProductPayload): Promise<any> {
    const res = await this.client.post("/products", payload);
    return res.data;
  }

  async updateProduct(sku: string, payload: Partial<ClaroshopProductPayload>): Promise<any> {
    const res = await this.client.put(`/products/${sku}`, payload);
    return res.data;
  }

  async updateStock(sku: string, quantity: number): Promise<any> {
    const res = await this.client.put(`/products/${sku}/stock`, { stock: quantity });
    return res.data;
  }

  async updatePrice(sku: string, price: number, offerPrice?: number): Promise<any> {
    const data: any = { price };
    if (offerPrice !== undefined) data.offer_price = offerPrice;
    const res = await this.client.put(`/products/${sku}/price`, data);
    return res.data;
  }

  async deleteProduct(sku: string): Promise<any> {
    const res = await this.client.delete(`/products/${sku}`);
    return res.data;
  }

  // ── Órdenes ──
  async getOrders(
    status?: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    perPage = 50
  ): Promise<ClaroshopOrder[]> {
    const params: Record<string, any> = { page, per_page: perPage };
    if (status) params.status = status;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const res = await this.client.get("/orders", { params });
    return res.data.orders || [];
  }

  async getOrder(orderId: string): Promise<ClaroshopOrder> {
    const res = await this.client.get(`/orders/${orderId}`);
    return res.data;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    const res = await this.client.put(`/orders/${orderId}/status`, { status });
    return res.data;
  }

  // ── Categorías ──
  async getCategories(): Promise<any[]> {
    const res = await this.client.get("/categories");
    return res.data.categories || [];
  }

  async getBrands(): Promise<any[]> {
    const res = await this.client.get("/brands");
    return res.data.brands || [];
  }
}
