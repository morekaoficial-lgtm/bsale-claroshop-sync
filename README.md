# Bsale ↔ Claro Shop Sync
## ID de Proyecto: `PRJ-BSALE-CLARO-2024-001`
## Versión: 1.0.0
## Stack: Node.js + TypeScript + Express + PostgreSQL + Redis + React + Docker

---

Este proyecto implementa una integración bidireccional enterprise-grade entre **Bsale (ERP)** y **Claro Shop (marketplace T1/América Móvil)**.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DIGITALOCEAN DROPLET                           │
│                         Ubuntu 22.04 + Docker Compose                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│   │   Nginx      │────▶│   Backend    │────▶│  PostgreSQL  │              │
│   │  (Proxy +    │     │  Node.js/    │     │   (Datos)    │              │
│   │   SSL/HTTPS) │◀────│   Express    │◀────│              │              │
│   └──────────────┘     └──────┬───────┘     └──────────────┘              │
│          ▲                    │                                             │
│          │                    ▼                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│   │   Frontend   │◀────│   Redis      │     │   Bull       │              │
│   │   React/Vite │     │   (Colas)    │     │   Workers    │              │
│   └──────────────┘     └──────────────┘     └──────────────┘              │
│                                                                             │
│   Webhooks ◀──── Bsale API                  Claro Shop API ────▶ Webhooks │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flujos de Datos

```
FLUJO 1: Productos (Bsale → Claro Shop)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bsale Producto/Variante ──▶ Webhook/Polling ──▶ Backend ──▶ Cola Bull
                                                              │
                                                              ▼
                                                    Claroshop API (POST/PUT)
                                                              │
                                                              ▼
                                                    PostgreSQL (product_mappings)

FLUJO 2: Stock (Bsale → Claro Shop)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bsale Stock Change ──▶ Webhook ──▶ Backend ──▶ Cola Bull ──▶ Claroshop API
                                                              │
                                                              ▼
                                                    PostgreSQL (stock_changes)

FLUJO 3: Pedidos (Claro Shop → Bsale)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Claro Shop Pedido ──▶ Webhook/Polling ──▶ Backend ──▶ Cola Bull
                                                         │
                                                         ▼
                                               Bsale API (POST documento)
                                                         │
                                                         ▼
                                               PostgreSQL (orders)
```

### Estructura del Proyecto

```
bsale-claroshop-sync/
├── PROJECT_ID                    # ID único del proyecto
├── docker-compose.yml            # Orquestación completa
├── .env.example                  # Variables de entorno template
├── README.md                     # Este archivo
├── DEPLOY.md                     # Guía de despliegue paso a paso
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                # Entry point Express + Socket.IO
│       ├── config/
│       │   ├── database.ts       # Sequelize + PostgreSQL
│       │   └── redis.ts          # Bull + Redis
│       ├── integrations/
│       │   ├── bsale.client.ts   # Cliente HTTP Bsale v1
│       │   └── claroshop.client.ts # Cliente HTTP Claro Shop
│       ├── models/
│       │   ├── product.mapping.ts
│       │   ├── order.ts
│       │   ├── sync.log.ts
│       │   ├── stock.change.ts
│       │   └── config.ts
│       ├── services/
│       │   ├── product.sync.ts   # Lógica sync productos
│       │   ├── stock.sync.ts     # Lógica sync stock
│       │   └── order.import.ts   # Lógica import pedidos
│       ├── api/
│       │   ├── dashboard.routes.ts
│       │   ├── product.routes.ts
│       │   ├── order.routes.ts
│       │   ├── sync.routes.ts
│       │   ├── config.routes.ts
│       │   └── log.routes.ts
│       ├── webhooks/
│       │   └── webhook.routes.ts
│       ├── workers/
│       │   ├── processor.ts      # Procesadores de colas Bull
│       │   └── scheduler.ts      # Polling automático
│       ├── middleware/
│       │   ├── auth.ts           # JWT
│       │   └── error.handler.ts
│       └── utils/
│           └── logger.ts         # Winston + Socket.IO
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── hooks/
│       │   └── useAuth.tsx
│       └── pages/
│           ├── LoginPage.tsx
│           ├── DashboardPage.tsx
│           ├── ProductsPage.tsx
│           ├── OrdersPage.tsx
│           ├── LogsPage.tsx
│           └── ConfigPage.tsx
│
├── nginx/
│   └── nginx.conf                # Proxy inverso + SSL
│
└── scripts/
    ├── init-db.sql               # Esquema inicial PostgreSQL
    └── migrate.sh                # Script de migración
```

### Componentes Clave

| Componente | Tecnología | Propósito |
|-----------|-----------|-----------|
| Backend API | Node.js + Express | API REST, webhooks, workers |
| Frontend | React + Vite | Panel de administración |
| Base de datos | PostgreSQL 15 | Mapeos, logs, estados |
| Colas | Bull + Redis | Procesamiento asíncrono, reintentos |
| Proxy | Nginx | SSL, routing, static files |
| Logs en vivo | Socket.IO | Stream de eventos al panel |

### Variables de Entorno Críticas

```bash
# Bsale
BSALE_ACCESS_TOKEN=             # OAuth2 access_token
BSALE_CLIENT_ID=                # OAuth2 client_id (para refresh)
BSALE_CLIENT_SECRET=            # OAuth2 client_secret
BSALE_PRICE_LIST_ID=1           # Lista de precios por defecto
BSALE_OFFICE_ID=1               # Sucursal por defecto
BSALE_DOCUMENT_TYPE_ID=1        # Tipo documento pedido web

# Claro Shop
CLAROSHOP_API_KEY=              # API Key (formato t1-...)
CLAROSHOP_BASE_URL=             # URL base API

# Panel
JWT_SECRET=                     # Secreto para tokens JWT
ADMIN_PASSWORD=                 # Contraseña panel admin
WEBHOOK_SECRET=                 # Secreto para validar webhooks

# Infraestructura
DATABASE_URL=postgres://user:pass@postgres:5432/bsale_claro_sync
REDIS_URL=redis://redis:6379
SYNC_INTERVAL_MINUTES=15
```

### Estado del Proyecto

- ✅ Arquitectura definida
- ✅ Estructura de directorios
- ✅ Backend base (Express, Sequelize, Bull, Socket.IO)
- ✅ Clientes HTTP (Bsale, Claro Shop)
- ✅ Modelos de base de datos
- ✅ Servicios de sincronización
- ✅ API REST completa
- ✅ Workers y scheduler
- ✅ Webhooks
- ✅ Frontend React (login, dashboard, productos, pedidos, logs, config)
- ⏳ Nginx configuration
- ⏳ Scripts de inicialización
- ⏳ Guía de despliegue completa
