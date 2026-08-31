#!/bin/bash
set -e

# ============================================================
# Deploy Script: Bsale ↔ Claro Shop Sync
# DigitalOcean Droplet - Ubuntu 22.04
# ============================================================

echo "🚀 Iniciando despliegue de Bsale-ClaroShop Sync..."

# 1. Update system
echo "📦 Actualizando sistema..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
echo "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# 3. Install Docker Compose
echo "🔧 Instalando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 4. Create project directory
echo "📁 Creando directorio del proyecto..."
PROJECT_DIR="/opt/bsale-claroshop-sync"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# 5. Clone or copy project files (manual step - copy files via SCP)
echo "📂 Copia los archivos del proyecto a $PROJECT_DIR"
echo "   scp -r ./bsale-claroshop-sync/* root@TU_IP:$PROJECT_DIR/"

# 6. Create .env file
echo "⚙️  Configurando variables de entorno..."
cat > $PROJECT_DIR/.env << 'EOF'
# === POSTGRES ===
POSTGRES_USER=bsale_sync
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD
POSTGRES_DB=bsale_claro_sync
DATABASE_URL=postgres://bsale_sync:CHANGE_THIS_PASSWORD@postgres:5432/bsale_claro_sync

# === REDIS ===
REDIS_URL=redis://redis:6379

# === BSALE ===
BSALE_ACCESS_TOKEN=YOUR_BSALE_ACCESS_TOKEN
BSALE_CLIENT_ID=YOUR_BSALE_CLIENT_ID
BSALE_CLIENT_SECRET=YOUR_BSALE_CLIENT_SECRET
BSALE_PRICE_LIST_ID=1
BSALE_OFFICE_ID=1
BSALE_DOCUMENT_TYPE_ID=1

# === CLARO SHOP ===
CLAROSHOP_API_KEY=YOUR_CLAROSHOP_API_KEY
CLAROSHOP_BASE_URL=https://api.claroshop.com

# === PANEL ===
JWT_SECRET=CHANGE_THIS_JWT_SECRET_MIN_32_CHARS
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# === SYNC ===
SYNC_INTERVAL_MINUTES=15
NODE_ENV=production

# === OPTIONAL: SSL ===
# DOMAIN=tu-dominio.com
# EMAIL=tu@email.com
EOF

echo "✏️  IMPORTANTE: Edita $PROJECT_DIR/.env con tus credenciales reales"

# 7. Start services
echo "🚀 Iniciando servicios con Docker Compose..."
cd $PROJECT_DIR
docker-compose up -d

# 8. Initialize database
echo "🗄️  Inicializando base de datos..."
sleep 10  # Wait for postgres to be ready
docker-compose exec -T postgres psql -U bsale_sync -d bsale_claro_sync < scripts/init-db.sql

# 9. Check health
echo "🏥 Verificando estado..."
sleep 5
curl -s http://localhost/health || echo "⚠️  Health check falló - revisa los logs: docker-compose logs backend"

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "📊 Panel de admin: http://TU_IP/"
echo "🔌 API: http://TU_IP/api/"
echo "🪝 Webhooks: http://TU_IP/webhooks/"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Configura webhooks en Bsale apuntando a http://TU_IP/webhooks/bsale"
echo "   2. Configura webhooks en Claro Shop apuntando a http://TU_IP/webhooks/claroshop"
echo "   3. Accede al panel con la contraseña configurada en ADMIN_PASSWORD"
echo "   4. Revisa logs: docker-compose logs -f backend"
