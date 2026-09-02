import axios, { AxiosInstance, AxiosResponse } from "axios";
import { logger } from "../utils/logger";

export interface BsaleVariant {
  id: number;
  productId: number;
  description: string;
  code: string;
  barCode?: string;
  state: number;
  unlimitedStock: number;
  allowNegativeStock: number;
  sku?: string;
  // Precios y stock se obtienen por separado
}

export interface BsaleProduct {
  id: number;
  name: string;
  description?: string;
  productTypeId?: number;
  state: number;
  stockControl: number;
  classification: number;
}

export interface BsaleStock {
  variantId: number;
  officeId: number;
  quantity: number;
}

export interface BsalePrice {
  variantId: number;
  priceListId: number;
  price: number;
}

export class BsaleClient {
  private client: AxiosInstance;
  private clientV2: AxiosInstance;
  private accessToken: string;

  constructor(accessToken?: string, baseURL?: string) {
    this.accessToken = accessToken || process.env.BSALE_ACCESS_TOKEN || "";

    // Cliente V1
    this.client = axios.create({
      baseURL: baseURL || process.env.BSALE_BASE_URL || "https://api.bsale.io/v1",
      headers: {
        access_token: this.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    // Cliente V2 (para market_info, imágenes web, descripciones)
    this.clientV2 = axios.create({
      baseURL: "https://api.bsale.io/v2",
      headers: {
        access_token: this.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    // Rate limit: 8 req/segundo segun changelog Bsale 10/2025
    const rateLimitInterceptor = async (config: any) => {
      await this.rateLimitDelay();
      return config;
    };
    this.client.interceptors.request.use(rateLimitInterceptor);
    this.clientV2.interceptors.request.use(rateLimitInterceptor);

    const errorInterceptor = (error: any) => {
      logger.error("Bsale API error:", { message: error.message, data: error.response?.data });
      throw error;
    };
    this.client.interceptors.response.use((response: any) => response, errorInterceptor);
    this.clientV2.interceptors.response.use((response: any) => response, errorInterceptor);
  }

  private lastRequestTime = 0;
  private async rateLimitDelay() {
    const now = Date.now();
    const minInterval = 130; // ~8 req/segundo = 125ms + margen
    const elapsed = now - this.lastRequestTime;
    if (elapsed < minInterval) {
      await new Promise((r) => setTimeout(r, minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // ── Productos ──
  async getProducts(limit = 25, offset = 0, state?: number): Promise<BsaleProduct[]> {
    const params: Record<string, number> = { limit, offset };
    if (state !== undefined) params.state = state;
    const res = await this.client.get("/products.json", { params });
    return res.data.items || [];
  }

  async getProduct(productId: number): Promise<BsaleProduct> {
    const res = await this.client.get(`/products/${productId}.json`);
    return res.data;
  }

  async getVariants(productId: number, limit = 50): Promise<BsaleVariant[]> {
    const res = await this.client.get(`/products/${productId}/variants.json`, { params: { limit } });
    return res.data.items || [];
  }

  async getVariant(variantId: number, expand?: string[]): Promise<BsaleVariant> {
    const params: Record<string, string> = {};
    if (expand) params.expand = expand.join(",");
    const res = await this.client.get(`/variants/${variantId}.json`, { params });
    return res.data;
  }

  // ── Stock ──
  async getStock(variantId?: number, officeId?: number): Promise<BsaleStock[]> {
    const params: Record<string, number> = {};
    if (variantId) params.variantid = variantId;
    if (officeId) params.officeid = officeId;
    const res = await this.client.get("/stocks.json", { params });
    return (res.data.items || []).map((item: any) => ({
      variantId: item.variant?.id,
      officeId: item.office?.id,
      quantity: item.quantity,
    }));
  }

  // ── Precios ──
  async getPrices(variantId: number, priceListId?: number): Promise<BsalePrice[]> {
    const params: Record<string, number> = {};
    if (priceListId) params.price_list_id = priceListId;
    const res = await this.client.get(`/variants/${variantId}.json`, { params });
    // Los precios pueden venir en diferentes formatos según la respuesta de Bsale
    let prices = res.data.prices || res.data.price || [];
    if (!Array.isArray(prices)) {
      prices = [];
    }
    return prices.map((p: any) => ({
      variantId,
      priceListId: p.priceListId,
      price: p.variantValue,
    }));
  }

  async getPriceLists() {
    const res = await this.client.get("/price_lists.json");
    return res.data.items || [];
  }

  // ── Descripción Web V2 (market_info) ──
  async getMarketInfoV2(marketInfoId: number): Promise<any> {
    const res = await this.clientV2.get(`/products/market_info/${marketInfoId}.json`);
    return res.data?.data || null;
  }

  async getMarketInfoListV2(limit = 50, offset = 0): Promise<any[]> {
    const res = await this.clientV2.get(`/products/list/market_info.json`, {
      params: { limit, offset },
    });
    return res.data?.data || [];
  }

  async getMarketInfoPicturesV2(marketInfoId: number): Promise<any[]> {
    const res = await this.clientV2.get(`/products/market_info/${marketInfoId}/pictures.json`);
    return res.data?.data || [];
  }

  // ── Imágenes V1 ──
  async getProductImages(productId: number): Promise<any[]> {
    const res = await this.client.get(`/products/${productId}/images.json`);
    return res.data?.items || [];
  }

  // ── Documentos / Órdenes ──
  async createDocument(documentData: any): Promise<any> {
    const res = await this.client.post("/documents.json", documentData);
    return res.data;
  }

  async getDocuments(limit = 25, offset = 0, filters?: Record<string, any>) {
    const params: Record<string, any> = { limit, offset, ...filters };
    const res = await this.client.get("/documents.json", { params });
    return res.data;
  }

  // ── Clientes ──
  async getClients(limit = 25, offset = 0) {
    const res = await this.client.get("/clients.json", { params: { limit, offset } });
    return res.data.items || [];
  }

  async createClient(clientData: any) {
    const res = await this.client.post("/clients.json", clientData);
    return res.data;
  }

  async findClientByCode(code: string) {
    const res = await this.client.get("/clients.json", { params: { code } });
    const items = res.data.items || [];
    return items.find((c: any) => c.code === code);
  }

  // ── Atributos dinámicos (para guardar ID de Claro Shop) ──
  async setProductAttribute(productId: number, attributeId: number, value: string) {
    // Bsale soporta atributos dinámicos en productos
    const res = await this.client.post(`/products/${productId}/attributes.json`, {
      dynamicAttributeId: attributeId,
      value,
    });
    return res.data;
  }
}
