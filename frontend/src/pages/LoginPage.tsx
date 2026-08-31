import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_URL}/api/config/login`, { password });
      login(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: 40,
          borderRadius: 12,
          width: 360,
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ marginBottom: 8, textAlign: "center" }}>🔒 Panel de Control</h2>
        <p style={{ marginBottom: 24, textAlign: "center", color: "#666" }}>
          Bsale ↔ Claro Shop Sync
        </p>
        {error && <div style={{ color: "#e74c3c", marginBottom: 16, textAlign: "center" }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 6, border: "1px solid #ddd" }}
            placeholder="Ingresa la contraseña de admin"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#3498db",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
