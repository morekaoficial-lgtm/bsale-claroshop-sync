import { AuthProvider } from "./hooks/useAuth";
import { Link, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import LogsPage from "./pages/LogsPage";
import ConfigPage from "./pages/ConfigPage";

function AppRoutes() {
  const { token } = useAuth();
  if (!token) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { path: "/", label: "📊 Dashboard" },
    { path: "/products", label: "📦 Productos" },
    { path: "/orders", label: "🛒 Pedidos" },
    { path: "/logs", label: "📋 Logs" },
    { path: "/config", label: "⚙️ Config" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#1a1a2e", color: "#fff", padding: 20 }}>
        <h2 style={{ marginBottom: 30, fontSize: 18 }}>🔄 Bsale↔ClaroShop</h2>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "block",
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 4,
                textDecoration: "none",
                color: location.pathname === item.path ? "#fff" : "#aaa",
                background: location.pathname === item.path ? "#16213e" : "transparent",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 40 }}>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: 10,
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 30, overflow: "auto" }}>{children}</main>
    </div>
  );
}
