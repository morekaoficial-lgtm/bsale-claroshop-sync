import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

type Tab = "synced" | "available";

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
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableTotalPages, setAvailableTotalPages] = useState(1);
  const [availableSearch, setAvailableSearch] = useState("");
  const [availableLoading, setAvailableLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

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
      setAvailableTotalPages(res.data.pagination.totalPages);
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
      // Refrescar lista
      fetchAvailable();
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
            <div style={{ padding: 10, background: "#e8f8f5", borderRadius: 6, marginBottom: 12, color: "#27ae60", fontWeight: 600 }}>
              {publishResult}
            </div>
          )}

          {/* Tabla */}
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
                  <th style={thStyle}>ID Bsale</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Código de barras</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {availableLoading && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center" }}>Cargando productos de Bsale...</td></tr>
                )}
                {!availableLoading && availableProducts.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                    No hay productos disponibles para publicar.
                  </td></tr>
                )}
                {!availableLoading && availableProducts.map((p) => (
                  <tr
                    key={p.bsale_variant_id}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: selectedIds.has(p.bsale_variant_id) ? "#e8f8f5" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleSelect(p.bsale_variant_id)}
                  >
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.bsale_variant_id)}
                        onChange={() => toggleSelect(p.bsale_variant_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td style={tdStyle}>{p.bsale_variant_id}</td>
                    <td style={tdStyle}><code>{p.sku}</code></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                        {p.description ? p.description.substring(0, 80) + "..." : "Sin descripción"}
                      </div>
                    </td>
                    <td style={tdStyle}>${p.price || "-"}</td>
                    <td style={tdStyle}>{p.bar_code || "-"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: p.state === 0 ? "#d4edda" : "#f8d7da",
                        color: p.state === 0 ? "#155724" : "#721c24",
                      }}>
                        {p.state === 0 ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={availablePage <= 1} onClick={() => setAvailablePage(availablePage - 1)} style={pageBtnStyle}>← Anterior</button>
            <span style={{ padding: "8px 16px" }}>Página {availablePage} de {availableTotalPages}</span>
            <button disabled={availablePage >= availableTotalPages} onClick={() => setAvailablePage(availablePage + 1)} style={pageBtnStyle}>Siguiente →</button>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: 12, textAlign: "left", fontWeight: 600, fontSize: 13, color: "#666" };
const tdStyle: React.CSSProperties = { padding: 12, fontSize: 13 };
const pageBtnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" };
