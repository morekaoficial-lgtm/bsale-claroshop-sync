import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, typeFilter, statusFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 50, type: typeFilter, status: statusFilter },
      });
      setLogs(res.data.logs);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "#2ecc71";
      case "error": return "#e74c3c";
      case "skipped": return "#f39c12";
      default: return "#999";
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>📋 Logs de Sincronización</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}>
          <option value="">Todos los tipos</option>
          <option value="product">Producto</option>
          <option value="stock">Stock</option>
          <option value="price">Precio</option>
          <option value="order">Pedido</option>
          <option value="webhook">Webhook</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}>
          <option value="">Todos los estados</option>
          <option value="success">✅ Éxito</option>
          <option value="error">❌ Error</option>
          <option value="skipped">⏭️ Saltado</option>
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Dirección</th>
              <th style={thStyle}>Entidad</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center" }}>Cargando...</td></tr>}
            {!loading && logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}>{new Date(log.created_at).toLocaleString()}</td>
                <td style={tdStyle}><span style={badgeStyle}>{log.sync_type}</span></td>
                <td style={tdStyle}>{log.direction === "bsale_to_claroshop" ? "Bsale → Claro" : "Claro → Bsale"}</td>
                <td style={tdStyle}><code>{log.entity_id}</code></td>
                <td style={tdStyle}>
                  <span style={{ color: getStatusColor(log.status), fontWeight: 600 }}>{log.status}</span>
                </td>
                <td style={tdStyle}>{log.message || log.error_detail || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
const badgeStyle: React.CSSProperties = { background: "#e8f4fd", color: "#2980b9", padding: "2px 8px", borderRadius: 4, fontSize: 12 };
