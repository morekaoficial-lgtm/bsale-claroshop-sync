import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Stats {
  products: { total: number; synced: number; error: number; pending: number };
  orders: { total: number; pending: number; completed: number; error: number };
  sync: { totalLogs: number; recentErrors: number; pendingStockChanges: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const socket = io(API_URL || window.location.origin);
    socket.on("log", (log) => {
      setLogs((prev) => [log, ...prev].slice(0, 20));
    });
    return () => { socket.disconnect(); };
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (type: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/api/sync/${type}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(`Sincronización de ${type} iniciada`);
    } catch (err) {
      alert("Error al iniciar sincronización");
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>📊 Dashboard</h1>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard title="Productos" value={stats?.products.total || 0} sub={`✅ ${stats?.products.synced}  ❌ ${stats?.products.error}`} color="#3498db" />
        <StatCard title="Pedidos" value={stats?.orders.total || 0} sub={`⏳ ${stats?.orders.pending}  ✅ ${stats?.orders.completed}`} color="#2ecc71" />
        <StatCard title="Errores 24h" value={stats?.sync.recentErrors || 0} sub={`📋 ${stats?.sync.totalLogs} logs`} color="#e74c3c" />
        <StatCard title="Stock pendiente" value={stats?.sync.pendingStockChanges || 0} sub="Cambios sin sincronizar" color="#f39c12" />
      </div>

      {/* Quick Actions */}
      <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>⚡ Acciones rápidas</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ActionButton label="Sincronizar Productos" onClick={() => triggerSync("products")} color="#3498db" />
          <ActionButton label="Sincronizar Stock" onClick={() => triggerSync("stock")} color="#2ecc71" />
          <ActionButton label="Importar Pedidos" onClick={() => triggerSync("orders")} color="#9b59b6" />
          <ActionButton label="Sincronizar Todo" onClick={() => triggerSync("all")} color="#e67e22" />
        </div>
      </div>

      {/* Live Logs */}
      <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12 }}>📡 Logs en tiempo real</h3>
        <div style={{ maxHeight: 300, overflow: "auto", fontFamily: "monospace", fontSize: 13 }}>
          {logs.length === 0 && <p style={{ color: "#999" }}>Esperando eventos...</p>}
          {logs.map((log, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #eee", color: log.level === "error" ? "#e74c3c" : "#333" }}>
              <span style={{ color: "#999" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>{" "}
              <strong>[{log.level.toUpperCase()}]</strong> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, color }: { title: string; value: number; sub: string; color: string }) {
  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, borderLeft: `4px solid ${color}` }}>
      <div style={{ color: "#666", fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: "bold", color }}>{value}</div>
      <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ActionButton({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px",
        background: color,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
