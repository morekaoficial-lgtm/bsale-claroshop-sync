#!/bin/bash
set -e

# ============================================================
# Deploy Script: Bsale ↔ Claro Shop Sync
# DigitalOcean Droplet - Ubuntu 22.04
# IMPORTANTE: Este script EVITA conflictos con procesos existentes
# ============================================================

echo "🚀 Iniciando despliegue de Bsale-ClaroShop Sync..."
echo ""
echo "⚠️  ESTE SCRIPT ESTA DISEÑADO PARA NO AFECTAR TUS PROCESOS EXISTENTES"
echo ""

# ============================================================
# CONFIGURACION - EDITAR ESTAS VARIABLES
# ============================================================

# Opcion de despliegue:
#   1 = Puerto alternativo 8080 (recomendado si tienes nginx en 80/443)
#   2 = Integrar con nginx existente (subdominio)
#   3 = Nginx propio en 80/443 (solo si NO hay nginx)
DEPLOY_OPTION=${DEPLOY_OPTION:-1}

# Puerto del backend (cambiar si 3001 esta ocupado)
BACKEND_PORT=${BACKEND_PORT:-3001}

# Puerto del panel (cambiar si 8080 esta ocupado)
PANEL_PORT=${PANEL_PORT:-8080}

# Credenciales (CAMBIAR ESTAS!)
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-CambiaEstaPassword123!}"
BSALE_ACCESS_TOKEN="${BSALE_ACCESS_TOKEN:-}"
BSALE_CLIENT_ID="${BSALE_CLIENT_ID:-}"
BSALE_CLIENT_SECRET="${BSALE_CLIENT_SECRET:-}"
CLAROSHOP_API_KEY="${CLAROSHOP_API_KEY:-}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-$(openssl rand -hex 16)}"

# URL publica para webhooks (ajustar segun tu configuracion)
# Ejemplos:
#   Opcion 1: http://TU_IP:8080
#   Opcion 2: https://bsale-sync.tu-dominio.com
#   Opcion 3: http://TU_IP
PUBLIC_URL="${PUBLIC_URL:-http://$(curl -s ifconfig.me):${PANEL_PORT}}"

# ============================================================
# 1. Update system
# ============================================================
echo "📦 Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq 2>/dev/null || true

# ============================================================
# 2. Verificar conflictos de puertos
# ============================================================
echo "🔍 Verificando puertos..."

# Verificar si hay nginx en 80/443
if ss -tuln | grep -q ':80 '; then
    echo "⚠️  Puerto 80 ya esta en uso (probablemente nginx)"
    HAS_NGINX=1
else
    HAS_NGINX=0
fi

if ss -tuln | grep -q ':443 '; then
    echo "⚠️  Puerto 443 ya esta en uso"
fi

if ss -tuln | grep -q ":${BACKEND_PORT} "; then
    echo "❌ Puerto ${BACKEND_PORT} ya esta en uso! Cambia BACKEND_PORT en este script"
    exit 1
fi

if ss -tuln | grep -q ":${PANEL_PORT} "; then
    echo "❌ Puerto ${PANEL_PORT} ya esta en uso! Cambia PANEL_PORT en este script"
    exit 1
fi

# ============================================================
# 3. Install Docker (si no esta instalado)
# ============================================================
echo "🐳 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "   Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker root
    rm -f get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo "   Instalando Docker Compose..."
    curl -sSL "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "   Docker: $(docker --version)"
echo "   Docker Compose: $(docker-compose --version)"

# ============================================================
# 4. Clone/Update repository
# ============================================================
echo "📁 Descargando proyecto..."
PROJECT_DIR="/opt/bsale-claroshop-sync"
mkdir -p /opt
cd /opt

if [ -d "$PROJECT_DIR/.git" ]; then
    echo "   Actualizando repositorio existente..."
    cd "$PROJECT_DIR"
    git pull origin main
else
    echo "   Clonando repositorio..."
    rm -rf "$PROJECT_DIR" 2>/dev/null || true
    git clone https://github.com/morekaoficial-lgtm/bsale-claroshop-sync.git
    cd "$PROJECT_DIR"
fi

# ============================================================
# 5. Configurar Docker Compose segun opcion
# ============================================================
echo "⚙️  Configurando para opcion de despliegue ${DEPLOY_OPTION}..."

case $DEPLOY_OPTION in
    1)
        echo "   Opcion 1: Puerto alternativo ${PANEL_PORT}"
        # Usar nginx-alt.conf
        cp nginx/nginx-alt.conf nginx/nginx.conf
        # No exponer postgres/redis al host
        # Backend en puerto alternativo
        sed -i "s/127.0.0.1:3001:3000/127.0.0.1:${BACKEND_PORT}:3000/" docker-compose.yml
        # Nginx en puerto alternativo
        sed -i "s/\"80:80\"/\"${PANEL_PORT}:80\"/" docker-compose.yml
        sed -i "s/\"443:443\"/\"8443:443\"/" docker-compose.yml || true
        ;;
    2)
        echo "   Opcion 2: Integrar con nginx existente"
        echo "   ⚠️  Recuerda copiar nginx/nginx-existing.conf a tu nginx!"
        # No iniciar nginx container
        sed -i 's/  nginx:/  # nginx:/' docker-compose.yml || true
        # Backend en puerto alternativo (accesible desde nginx host)
        sed -i "s/127.0.0.1:3001:3000/127.0.0.1:${BACKEND_PORT}:3000/" docker-compose.yml
        ;;
    3)
        echo "   Opcion 3: Nginx propio en 80/443"
        echo "   ⚠️  Asegurate de que los puertos 80/443 esten libres!"
        # Usar nginx por defecto
        ;;
    *)
        echo "Opcion invalida. Usa 1, 2 o 3."
        exit 1
        ;;
esac

# ============================================================
# 6. Crear .env
# ============================================================
echo "🔐 Configurando variables de entorno..."
cat > .env << EOF
# === Entorno ===
NODE_ENV=production

# === PostgreSQL (SOLO red interna Docker) ===
DB_HOST=postgres
DB_PORT=5432
DB_USER=bcsync
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_NAME=bsale_claroshop

# === Redis (SOLO red interna Docker) ===
REDIS_URL=redis://redis:6379

# === Bsale API ===
BSALE_ACCESS_TOKEN=${BSALE_ACCESS_TOKEN}
BSALE_CLIENT_ID=${BSALE_CLIENT_ID}
BSALE_CLIENT_SECRET=${BSALE_CLIENT_SECRET}
BSALE_BASE_URL=https://api.bsale.io/v1
BSALE_PRICE_LIST_ID=1
BSALE_OFFICE_ID=1
BSALE_DOCUMENT_TYPE_ID=1

# === Claro Shop API ===
CLAROSHOP_API_KEY=${CLAROSHOP_API_KEY}
CLAROSHOP_BASE_URL=https://api.claroshop.com

# === URL Publica para Webhooks ===
PUBLIC_URL=${PUBLIC_URL}

# === Seguridad ===
JWT_SECRET=${JWT_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# === Sync ===
SYNC_INTERVAL_MINUTES=15
EOF

echo ""
echo "✅ Variables configuradas:"
echo "   PUBLIC_URL: ${PUBLIC_URL}"
echo "   BACKEND_PORT: ${BACKEND_PORT}"
echo "   PANEL_PORT: ${PANEL_PORT}"

# ============================================================
# 7. Iniciar servicios
# ============================================================
echo ""
echo "🔨 Construyendo e iniciando contenedores..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

# ============================================================
# 8. Inicializar base de datos
# ============================================================
echo "⏳ Esperando PostgreSQL..."
sleep 20

until docker-compose exec -T postgres pg_isready -U bcsync -d bsale_claroshop > /dev/null 2>&1; do
    echo "   PostgreSQL aun no listo, esperando..."
    sleep 3
done

echo "🗄️  Inicializando base de datos..."
docker-compose exec -T postgres psql -U bcsync -d bsale_claroshop < scripts/init-db.sql

# ============================================================
# 9. Verificar salud
# ============================================================
echo "🏥 Verificando backend..."
sleep 5
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✅ Backend responde correctamente en ${HEALTH_URL}"
else
    echo "⚠️  Health check fallo. Revisa logs: docker-compose logs backend"
fi

# ============================================================
# 10. Resumen final
# ============================================================
IP_PUBLICA=$(curl -s ifconfig.me)

echo ""
echo "=========================================="
echo "✅ DESPLIEGUE COMPLETADO"
echo "=========================================="
echo ""

case $DEPLOY_OPTION in
    1)
        echo "📊 Panel de Administracion:  http://${IP_PUBLICA}:${PANEL_PORT}"
        echo "🔌 API REST:                 http://${IP_PUBLICA}:${PANEL_PORT}/api/"
        echo "🪝 Webhook Bsale:            http://${IP_PUBLICA}:${PANEL_PORT}/webhooks/bsale"
        echo "🪝 Webhook Claro Shop:       http://${IP_PUBLICA}:${PANEL_PORT}/webhooks/claroshop"
        ;;
    2)
        echo "📊 Panel de Administracion:  ${PUBLIC_URL}"
        echo "🔌 API REST:                 ${PUBLIC_URL}/api/"
        echo "🪝 Webhook Bsale:            ${PUBLIC_URL}/webhooks/bsale"
        echo "🪝 Webhook Claro Shop:       ${PUBLIC_URL}/webhooks/claroshop"
        echo ""
        echo "⚠️  RECUERDA: Configura tu nginx existente con nginx/nginx-existing.conf"
        ;;
    3)
        echo "📊 Panel de Administracion:  http://${IP_PUBLICA}/"
        echo "🔌 API REST:                 http://${IP_PUBLICA}/api/"
        echo "🪝 Webhook Bsale:            http://${IP_PUBLICA}/webhooks/bsale"
        echo "🪝 Webhook Claro Shop:       http://${IP_PUBLICA}/webhooks/claroshop"
        ;;
esac

echo ""
echo "🔐 Credenciales del Panel:"
echo "   URL: ${PUBLIC_URL}"
echo "   Password: ${ADMIN_PASSWORD}"
echo ""
echo "📋 Proximos pasos:"
echo "   1. Configura webhooks en Bsale:"
echo "      Escribe a ayuda@bsale.app con esta URL:"
echo "      ${PUBLIC_URL}/webhooks/bsale"
echo ""
echo "   2. Configura webhooks en Claro Shop (panel T1):"
echo "      ${PUBLIC_URL}/webhooks/claroshop"
echo ""
echo "   3. Para SSL/HTTPS con Let's Encrypt:"
echo "      sudo certbot --nginx -d tu-dominio.com"
echo ""
echo "📋 Comandos utiles:"
echo "   Ver logs:    docker-compose logs -f backend"
echo "   Estado:      docker-compose ps"
echo "   Reiniciar:   docker-compose restart backend"
echo "   Detener:     docker-compose down"
echo "=========================================="
