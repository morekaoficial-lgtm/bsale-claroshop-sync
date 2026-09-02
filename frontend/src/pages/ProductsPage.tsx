import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

type Tab = "synced" | "available";
type SyncStatus = "synced" | "error" | "pending" | "inactive" | null;

interface AvailableProduct {
  bsale_variant_id: number;
  bsale_product_id: number;
  name: string;
  description: string;
  sku: string;
  bar_code: string;
  state: number;
  price: number;
  images: string[];
  brand: string;
  category_id: string;
  category_name: string;
  sync_status: SyncStatus;
  sync_error: string | null;
  last_sync_at: string | null;
  claroshop_product_id: string | null;
  is_synced: boolean;
  has_error: boolean;
}

export default function ProductsPage() {
  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<Tab>("synced");

  // ── Sincronizados ──
  const [syncedProducts, setSyncedProducts] = useState<any[]>([]);
  const [syncedPage, setSyncedPage] = useState(1);
  const [syncedTotalPages, setSyncedTotalPages] = useState(1);
  const [syncedSearch, setSyncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [syncedLoading, setSyncedLoading] = useState(false);

  // ── Disponibles ──
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableHasMore, setAvailableHasMore] = useState(false);
  const [availableSearch, setAvailableSearch] = useState("");
  const [availableLoading, setAvailableLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const token = localStorage.getItem("token");

  // ── Fetch sincronizados ──
  useEffect(() => {
    if (activeTab !== "synced") return;
    fetchSynced();
  }, [activeTab, syncedPage, syncedSearch, statusFilter]);

  const fetchSynced = async () => {
    setSyncedLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: syncedPage, limit: 25, search: syncedSearch, status: statusFilter },
      });
      setSyncedProducts(res.data.products);
      setSyncedTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncedLoading(false);
    }
  };

  // ── Fetch disponibles ──
  useEffect(() => {
    if (activeTab !== "available") return;
    fetchAvailable();
  }, [activeTab, availablePage, availableSearch]);

  const fetchAvailable = async () => {
    setAvailableLoading(true);
    setSelectedIds(new Set());
    setPublishResult(null);
    try {
      const res = await axios.get(`${API_URL}/api/products/available`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: availablePage, limit: 25, search: availableSearch },
      });
      setAvailableProducts(res.data.products);
      setAvailableHasMore(res.data.pagination.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setAvailableLoading(false);
    }
  };

  // ── Acciones ──
  const retryProduct = async (id: number) => {
    try {
      await axios.post(`${API_URL}/api/products/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Reintento encolado");
    } catch (err) {
      alert("Error al reintentar");
    }
  };

  const retryAvailable = async (variantId: number) => {
    setRetryingId(variantId);
    try {
      await axios.post(`${API_URL}/api/products/${variantId}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPublishResult(`🔄 Reintento encolado para variante ${variantId}`);
      setTimeout(() => fetchAvailable(), 2000);
    } catch (err) {
      setPublishResult(`❌ Error al reintentar variante ${variantId}`);
    } finally {
      setRetryingId(null);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === availableProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableProducts.map((p) => p.bsale_variant_id)));
    }
  };

  const publishSelected = async () => {
    if (selectedIds.size === 0) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/products/publish`,
        { variantIds: Array.from(selectedIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const results = res.data.results as Array<{ success: boolean; error?: string }>;
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      setPublishResult(`✅ ${ok} publicados, ❌ ${fail} errores`);
      setTimeout(() => fetchAvailable(), 2000);
    } catch (err: any) {
      setPublishResult("❌ Error al publicar: " + (err.response?.data?.error || err.message));
    } finally {
      setPublishing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced": return "#2ecc71";
      case "error": return "#e74c3c";
      case "pending": return "#f39c12";
      default: return "#999";
    }
  };

  const getSyncStatusBadge = (product: AvailableProduct) => {
    if (product.is_synced) {
      return { text: "✅ Sincronizado", bg: "#d4edda", color: "#155724" };
    }
    if (product.has_error) {
      return { text: "❌ Error", bg: "#f8d7da", color: "#721c24" };
    }
    if (product.sync_status === "pending") {
      return { text: "⏳ Pendiente", bg: "#fff3cd", color: "#856404" };
    }
    return { text: "🆕 No publicado", bg: "#e2e3e5", color: "#383d41" };
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>📦 Productos</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #eee" }}>
        <button
          onClick={() => setActiveTab("synced")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: "transparent",
            borderBottom: activeTab === "synced" ? "3px solid #3498db" : "3px solid transparent",
            fontWeight: activeTab === "synced" ? 700 : 400,
            cursor: "pointer",
            color: activeTab === "synced" ? "#3498db" : "#666",
          }}
        >
          ✅ Sincronizados con Claroshop
        </button>
        <button
          onClick={() => setActiveTab("available")}
          style={{
            padding: "10px 20px",
            border: "none",
            background: "transparent",
            borderBottom: activeTab === "available" ? "3px solid #27ae60" : "3px solid transparent",
            fontWeight: activeTab === "available" ? 700 : 400,
            cursor: "pointer",
            color: activeTab === "available" ? "#27ae60" : "#666",
          }}
        >
          🛒 Disponibles en Bsale
        </button>
      </div>

      {/* ════════════════════════════════════
          PESTAÑA: SINCRONIZADOS
         ════════════════════════════════════ */}
      {activeTab === "synced" && (
        <>
          {/* Filtros */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Buscar..."
              value={syncedSearch}
              onChange={(e) => { setSyncedSearch(e.target.value); setSyncedPage(1); }}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", flex: 1 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSyncedPage(1); }}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            >
              <option value="">Todos los estados</option>
              <option value="synced">✅ Sincronizado</option>
              <option value="error">❌ Error</option>
              <option value="pending">⏳ Pendiente</option>
            </select>
          </div>

          {/* Tabla */}
          <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th style={thStyle}>ID Bsale</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Último sync</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {syncedLoading && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center" }}>Cargando...</td></tr>
                )}
                {!syncedLoading && syncedProducts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tdStyle}>{p.bsale_variant_id}</td>
                    <td style={tdStyle}><code>{p.claroshop_sku}</code></td>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>{p.stock ?? "-"}</td>
                    <td style={tdStyle}>${p.price ?? "-"}</td>
                    <td style={tdStyle}>
                      <span style={{ color: getStatusColor(p.status), fontWeight: 600 }}>
                        {p.status}
                      </span>
                      {p.sync_error && <div style={{ fontSize: 11, color: "#e74c3c" }}>{p.sync_error.substring(0, 60)}...</div>}
                    </td>
                    <td style={tdStyle}>{p.last_sync_at ? new Date(p.last_sync_at).toLocaleString() : "Nunca"}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => retryProduct(p.bsale_variant_id)}
                        style={{ padding: "4px 12px", background: "#3498db", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                      >
                        🔄 Reintentar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={syncedPage <= 1} onClick={() => setSyncedPage(syncedPage - 1)} style={pageBtnStyle}>← Anterior</button>
            <span style={{ padding: "8px 16px" }}>Página {syncedPage} de {syncedTotalPages}</span>
            <button disabled={syncedPage >= syncedTotalPages} onClick={() => setSyncedPage(syncedPage + 1)} style={pageBtnStyle}>Siguiente →</button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════
          PESTAÑA: DISPONIBLES EN BSALE
         ════════════════════════════════════ */}
      {activeTab === "available" && (
        <>
          {/* Barra superior: búsqueda + botón publicar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Buscar productos de Bsale..."
              value={availableSearch}
              onChange={(e) => { setAvailableSearch(e.target.value); setAvailablePage(1); }}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", flex: 1 }}
            />
            <span style={{ fontSize: 13, color: "#666" }}>
              {selectedIds.size} seleccionados
            </span>
            <button
              onClick={publishSelected}
              disabled={publishing || selectedIds.size === 0}
              style={{
                padding: "8px 20px",
                background: publishing || selectedIds.size === 0 ? "#bdc3c7" : "#27ae60",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: publishing || selectedIds.size === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {publishing ? "⏳ Publicando..." : "🚀 Publicar en Claroshop"}
            </button>
          </div>

          {publishResult && (
            <div style={{ 
              padding: 10, 
              background: publishResult.includes("❌") ? "#f8d7da" : "#e8f8f5", 
              borderRadius: 6, 
              marginBottom: 12, 
              color: publishResult.includes("❌") ? "#721c24" : "#27ae60", 
              fontWeight: 600 
            }}>
              {publishResult}
            </div>
          )}

          {/* Tabla mejorada */}
          <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={availableProducts.length > 0 && selectedIds.size === availableProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={thStyle}>Imagen</th>
                  <th style={thStyle}>ID / SKU</th>
                  <th style={thStyle}>Nombre y Descripción</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Características</th>
                  <th style={thStyle}>Estado Sync</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {availableLoading && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center" }}>Cargando productos de Bsale...</td></tr>
                )}
                {!availableLoading && availableProducts.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                    No hay productos disponibles para publicar.
                  </td></tr>
                )}
                {!availableLoading && availableProducts.map((p) => {
                  const statusBadge = getSyncStatusBadge(p);
                  const isExpanded = expandedId === p.bsale_variant_id;
                  
                  return (
                    <>
                      <tr
                        key={p.bsale_variant_id}
                        style={{
                          borderBottom: "1px solid #eee",
                          background: selectedIds.has(p.bsale_variant_id) ? "#e8f8f5" : "transparent",
                        }}
                      >
                        <td style={tdStyle}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.bsale_variant_id)}
                            onChange={() => toggleSelect(p.bsale_variant_id)}
                          />
                        </td>
                        <td style={tdStyle}>
                          {p.images && p.images.length > 0 ? (
                            <div style={{ position: "relative" }}>
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
                                onClick={() => setExpandedId(isExpanded ? null : p.bsale_variant_id)}
                              />
                              {p.images.length > 1 && (
                                <span style={{
                                  position: "absolute",
                                  bottom: -2,
                                  right: -2,
                                  background: "#3498db",
                                  color: "#fff",
                                  borderRadius: "50%",
                                  width: 18,
                                  height: 18,
                                  fontSize: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}>
                                  +{p.images.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ width: 50, height: 50, background: "#f0f0f0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#999" }}>
                              Sin img
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 11, color: "#666" }}>ID: {p.bsale_variant_id}</div>
                          <code style={{ fontSize: 12 }}>{p.sku}</code>
                          {p.bar_code && <div style={{ fontSize: 10, color: "#999" }}>EAN: {p.bar_code}</div>}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#666", marginTop: 2, maxWidth: 250 }}>
                            {p.description ? p.description.substring(0, 100) + (p.description.length > 100 ? "..." : "") : "Sin descripción"}
                          </div>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : p.bsale_variant_id)}
                            style={{
                              marginTop: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              background: "#f8f9fa",
                              border: "1px solid #ddd",
                              borderRadius: 4,
                              cursor: "pointer",
                              color: "#3498db",
                            }}
                          >
                            {isExpanded ? "▲ Ocultar detalles" : "▼ Ver detalles"}
                          </button>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>${p.price || "-"}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 11 }}>
                            {p.brand && <div>🏷️ <strong>Marca:</strong> {p.brand}</div>}
                            {p.category_name && <div>📁 <strong>Cat:</strong> {p.category_name}</div>}
                            {p.category_id && <div style={{ color: "#999" }}>ID: {p.category_id}</div>}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            display: "inline-block",
                          }}>
                            {statusBadge.text}
                          </span>
                          {p.last_sync_at && (
                            <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                              {new Date(p.last_sync_at).toLocaleString()}
                            </div>
                          )}
                          {p.sync_error && (
                            <div style={{ fontSize: 10, color: "#e74c3c", marginTop: 4, maxWidth: 150 }}>
                              ⚠️ {p.sync_error.substring(0, 60)}{p.sync_error.length > 60 ? "..." : ""}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {p.has_error && (
                            <button
                              onClick={() => retryAvailable(p.bsale_variant_id)}
                              disabled={retryingId === p.bsale_variant_id}
                              style={{
                                padding: "4px 10px",
                                background: retryingId === p.bsale_variant_id ? "#bdc3c7" : "#e74c3c",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: retryingId === p.bsale_variant_id ? "not-allowed" : "pointer",
                                fontSize: 11,
                                marginBottom: 4,
                              }}
                            >
                              {retryingId === p.bsale_variant_id ? "⏳..." : "🔄 Reintentar"}
                            </button>
                          )}
                          {p.is_synced && p.claroshop_product_id && (
                            <div style={{ fontSize: 10, color: "#27ae60" }}>
                              ID: {p.claroshop_product_id}
                            </div>
                          )}
                        </td>
                      </tr>
                      
                      {/* Fila expandida con detalles completos */}
                      {isExpanded && (
                        <tr style={{ background: "#f8f9fa" }}>
                          <td colSpan={8} style={{ padding: 16 }}>
                            <div style={{ display: "flex", gap: 20 }}>
                              {/* Imágenes */}
                              <div style={{ flexShrink: 0 }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>🖼️ Imágenes ({p.images?.length || 0})</h4>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {p.images && p.images.map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt={`${p.name} - ${idx}`}
                                      style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }}
                                    />
                                  ))}
                                  {(!p.images || p.images.length === 0) && (
                                    <span style={{ color: "#999", fontSize: 12 }}>No hay imágenes</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Detalles */}
                              <div style={{ flex: 1 }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>📝 Descripción completa</h4>
                                <div style={{
                                  padding: 10,
                                  background: "#fff",
                                  borderRadius: 4,
                                  border: "1px solid #e0e0e0",
                                  fontSize: 12,
                                  maxHeight: 150,
                                  overflow: "auto",
                                  whiteSpace: "pre-wrap",
                                }}>
                                  {p.description || "Sin descripción"}
                                </div>
                                
                                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Marca:</strong> {p.brand || "No especificada"}
                                  </div>
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Categoría:</strong> {p.category_name || "No especificada"} {p.category_id && `(ID: ${p.category_id})`}
                                  </div>
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Precio:</strong> ${p.price || "-"}
                                  </div>
                                  <div style={{ fontSize: 12 }}>
                                    <strong>Código de barras:</strong> {p.bar_code || "-"}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Estado */}
                              <div style={{ flexShrink: 0, minWidth: 150 }}>
                                <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>📊 Estado de Sync</h4>
                                <div style={{
                                  padding: 10,
                                  background: statusBadge.bg,
                                  borderRadius: 4,
                                  fontSize: 12,
                                  color: statusBadge.color,
                                }}>
                                  <div style={{ fontWeight: 600 }}>{statusBadge.text}</div>
                                  {p.last_sync_at && (
                                    <div style={{ marginTop: 4 }}>
                                      Último intento:<br/>
                                      {new Date(p.last_sync_at).toLocaleString()}
                                    </div>
                                  )}
                                  {p.sync_error && (
                                    <div style={{ marginTop: 8, color: "#721c24" }}>
                                      <strong>Error:</strong><br/>
                                      {p.sync_error}
                                    </div>
                                  )}
                                  {p.is_synced && p.claroshop_product_id && (
                                    <div style={{ marginTop: 4 }}>
                                      <strong>Claroshop ID:</strong><br/>
                                      {p.claroshop_product_id}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={availablePage <= 1} onClick={() => setAvailablePage(availablePage - 1)} style={pageBtnStyle}>← Anterior</button>
            <span style={{ padding: "8px 16px" }}>Página {availablePage}</span>
            <button disabled={!availableHasMore} onClick={() => setAvailablePage(availablePage + 1)} style={pageBtnStyle}>Siguiente →</button>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: 12, textAlign: "left", fontWeight: 600, fontSize: 13, color: "#666" };
const tdStyle: React.CSSProperties = { padding: 12, fontSize: 13 };
const pageBtnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" };
