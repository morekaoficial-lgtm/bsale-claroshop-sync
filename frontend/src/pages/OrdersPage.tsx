import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 25, status: statusFilter },
      });
      setOrders(res.data.orders);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const retryOrder = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/api/orders/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Reintento encolado");
    } catch (err) {
      alert("Error");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#2ecc71";
      case "pending": return "#f39c12";
      case "processing": return "#3498db";
      case "error": return "#e74c3c";
      case "cancelled": return "#95a5a6";
      default: return "#999";
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>🛒 Pedidos</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
        >
          <option value="">Todos</option>
          <option value="pending">⏳ Pendiente</option>
          <option value="processing">🔄 Procesando</option>
          <option value="completed">✅ Completado</option>
          <option value="error">❌ Error</option>
          <option value="cancelled">🚫 Cancelado</option>
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              <th style={thStyle}>ID Claro Shop</th>
              <th style={thStyle}>Doc Bsale</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Claro Shop</th>
              <th style={thStyle}>Importado</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center" }}>Cargando...</td></tr>}
            {!loading && orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={tdStyle}><code>{o.claroshop_order_id}</code></td>
                <td style={tdStyle}>{o.bsale_document_number || "-"}</td>
                <td style={tdStyle}>{o.customer_name}</td>
                <td style={tdStyle}>${o.total}</td>
                <td style={tdStyle}>
                  <span style={{ color: getStatusColor(o.status), fontWeight: 600 }}>{o.status}</span>
                  {o.sync_error && <div style={{ fontSize: 11, color: "#e74c3c" }}>{o.sync_error.substring(0, 60)}</div>}
                </td>
                <td style={tdStyle}>{o.claroshop_status || "-"}</td>
                <td style={tdStyle}>{new Date(o.imported_at).toLocaleString()}</td>
                <td style={tdStyle}>
                  <button
                    onClick={() => retryOrder(o.id)}
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
