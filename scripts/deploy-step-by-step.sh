# ============================================================
# DESPLIEGUE PASO A PASO - Bsale Claro Shop Sync
# Para consola web de DigitalOcean (pegar paso por paso)
# ============================================================

# ═════════════════════════════════════════════════════════════
# PASO 1: ACTUALIZAR SISTEMA E INSTALAR DOCKER
# Copia y pega ESTE BLOQUE completo, espera que termine
# ═════════════════════════════════════════════════════════════

apt-get update -qq && apt-get upgrade -y -qq

# Instalar Docker si no existe
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker root
fi

# Instalar Docker Compose si no existe
if ! command -v docker-compose &> /dev/null; then
    curl -sSL "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Docker instalado"
docker --version
docker-compose --version


# ═════════════════════════════════════════════════════════════
# PASO 2: DESCARGAR EL PROYECTO
# Espera que termine el paso 1, luego pega ESTE BLOQUE
# ═════════════════════════════════════════════════════════════

cd /opt
rm -rf bsale-claroshop-sync 2>/dev/null || true
git clone https://github.com/morekaoficial-lgtm/bsale-claroshop-sync.git
cd bsale-claroshop-sync
ls -la


# ═════════════════════════════════════════════════════════════
# PASO 3: CONFIGURAR VARIABLES DE ENTORNO
# ⚠️  IMPORTANTE: Edita las credenciales antes de pegar
# Reemplaza los valores entre comillas con tus credenciales reales
# ═════════════════════════════════════════════════════════════

# ============ EDITAR ESTOS VALORES ============
# Reemplaza con TUS credenciales:
BSALE_ACCESS_TOKEN="tu_access_token_bsale_aqui"
CLAROSHOP_API_KEY="t1-tu_api_key_claroshop_aqui"
ADMIN_PASSWORD="tu_password_segura_para_el_panel"
# =============================================

# Generar secretos aleatorios
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
WEBHOOK_SECRET=$(openssl rand -hex 16)

# Obtener IP publica
IP_PUBLICA=$(curl -s ifconfig.me)
PANEL_PORT=8080
PUBLIC_URL="http://${IP_PUBLICA}:${PANEL_PORT}"

# Crear archivo .env
cat > .env << EOF
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_USER=bcsync
DB_PASSWORD=${POSTGRES_PASSWORD}
DB_NAME=bsale_claroshop
REDIS_URL=redis://redis:6379
BSALE_ACCESS_TOKEN=${BSALE_ACCESS_TOKEN}
BSALE_BASE_URL=https://api.bsale.io/v1
BSALE_PRICE_LIST_ID=1
BSALE_OFFICE_ID=1
BSALE_DOCUMENT_TYPE_ID=1
CLAROSHOP_API_KEY=${CLAROSHOP_API_KEY}
CLAROSHOP_BASE_URL=https://api.claroshop.com
PUBLIC_URL=${PUBLIC_URL}
JWT_SECRET=${JWT_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
SYNC_INTERVAL_MINUTES=15
EOF

echo "✅ Archivo .env creado"
echo "PUBLIC_URL: ${PUBLIC_URL}"


# ═════════════════════════════════════════════════════════════
# PASO 4: CONFIGURAR PUERTOS (PARA NO AFECTAR PROCESOS EXISTENTES)
# Usamos puerto 8080 para el panel y 3001 para backend
# ═════════════════════════════════════════════════════════════

# Copiar configuracion nginx para puerto alternativo
cp nginx/nginx-alt.conf nginx/nginx.conf

# Modificar docker-compose.yml para usar puertos alternativos
sed -i 's/127.0.0.1:3001:3000/127.0.0.1:3001:3000/' docker-compose.yml
sed -i 's/"80:80"/"8080:80"/' docker-compose.yml
sed -i '/443:443/d' docker-compose.yml

echo "✅ Puertos configurados: Panel=8080, Backend=3001"


# ═════════════════════════════════════════════════════════════
# PASO 5: CONSTRUIR E INICIAR CONTENEDORES
# Este paso tarda 3-5 minutos. Espera que termine completamente.
# ═════════════════════════════════════════════════════════════

docker-compose up -d --build

echo "✅ Contenedores iniciados"
docker-compose ps


# ═════════════════════════════════════════════════════════════
# PASO 6: INICIALIZAR BASE DE DATOS
# Espera 20 segundos para que PostgreSQL este listo
# ═════════════════════════════════════════════════════════════

echo "⏳ Esperando PostgreSQL (20 segundos)..."
sleep 20

# Verificar que PostgreSQL esta saludable
until docker-compose exec -T postgres pg_isready -U bcsync -d bsale_claroshop > /dev/null 2>&1; do
    echo "   PostgreSQL aun no listo, esperando 3 segundos..."
    sleep 3
done

# Crear tablas
docker-compose exec -T postgres psql -U bcsync -d bsale_claroshop < scripts/init-db.sql

echo "✅ Base de datos inicializada"


# ═════════════════════════════════════════════════════════════
# PASO 7: VERIFICAR QUE TODO FUNCIONA
# ═════════════════════════════════════════════════════════════

echo "🏥 Verificando backend..."
sleep 5
curl -s http://127.0.0.1:3001/health || echo "⚠️  Revisa los logs: docker-compose logs backend"

# Mostrar resumen
echo ""
echo "=========================================="
echo "✅ DESPLIEGUE COMPLETADO!"
echo "=========================================="
echo ""
echo "📊 Panel de Admin:    http://${IP_PUBLICA}:8080"
echo "🔌 API:               http://${IP_PUBLICA}:8080/api/"
echo ""
echo "🪝 Webhook Bsale:     http://${IP_PUBLICA}:8080/webhooks/bsale"
echo "🪝 Webhook Claro:     http://${IP_PUBLICA}:8080/webhooks/claroshop"
echo ""
echo "🔐 Login del panel:"
echo "   URL: http://${IP_PUBLICA}:8080"
echo "   Password: ${ADMIN_PASSWORD}"
echo ""
echo "📋 Proximos pasos:"
echo "1. Configurar webhook en Bsale:"
echo "   Escribe a ayuda@bsale.app"
echo "   URL: http://${IP_PUBLICA}:8080/webhooks/bsale"
echo ""
echo "2. Configurar webhook en Claro Shop:"
echo "   Panel T1 -> Webhooks -> http://${IP_PUBLICA}:8080/webhooks/claroshop"
echo ""
echo "📋 Comandos utiles:"
echo "   Ver logs:    docker-compose logs -f backend"
echo "   Estado:      docker-compose ps"
echo "   Reiniciar:   docker-compose restart backend"
echo "   Detener:     docker-compose down"
echo "=========================================="
