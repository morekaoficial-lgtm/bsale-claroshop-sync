import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/api/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_URL}/api/config`, config, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const updateValue = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const configGroups = [
    {
      title: "⏱️ Sincronización",
      keys: ["sync.interval_minutes", "sync.products.enabled", "sync.stock.enabled", "sync.orders.enabled"],
    },
    {
      title: "🏢 Bsale",
      keys: ["bsale.price_list_id", "bsale.office_id"],
    },
    {
      title: "📦 Claro Shop",
      keys: ["claroshop.shipping_time_days"],
    },
    {
      title: "🔔 Notificaciones",
      keys: ["notifications.telegram.enabled", "notifications.email.enabled"],
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>⚙️ Configuración</h1>

      {configGroups.map((group) => (
        <div key={group.title} style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{group.title}</h3>
          {group.keys.map((key) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
                {key}
              </label>
              <input
                type="text"
                value={config[key] || ""}
                onChange={(e) => updateValue(key, e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
          ))}
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={saveConfig}
          disabled={loading}
          style={{
            padding: "12px 24px",
            background: "#2ecc71",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Guardando..." : "💾 Guardar configuración"}
        </button>
        {saved && <span style={{ color: "#2ecc71", fontWeight: 600 }}>✅ Guardado</span>}
      </div>
    </div>
  );
}
