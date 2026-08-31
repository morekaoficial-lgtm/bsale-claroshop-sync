import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [page, search, statusFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 25, search, status: statusFilter },
      });
      setProducts(res.data.products);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const retryProduct = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/api/products/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Reintento encolado");
    } catch (err) {
      alert("Error");
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

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", flex: 1 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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
            {loading && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center" }}>Cargando...</td></tr>
            )}
            {!loading && products.map((p) => (
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
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={pageBtnStyle}>← Anterior</button>
        <span style={{ padding: "8px 16px" }}>Página {page} de {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={pageBtnStyle}>Siguiente →</button>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: 12, textAlign: "left", fontWeight: 600, fontSize: 13, color: "#666" };
const tdStyle: React.CSSProperties = { padding: 12, fontSize: 13 };
const pageBtnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" };
