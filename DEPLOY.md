# 🚀 Guía de Despliegue: Bsale ↔ Claro Shop Sync
## Proyecto ID: `PRJ-BSALE-CLARO-2024-001`

---

## Requisitos Previos

- **Droplet DigitalOcean**: Ubuntu 22.04, mínimo 2 vCPU / 2GB RAM / 50GB SSD
- **Dominio** (opcional pero recomendado): `tu-dominio.com` apuntando al droplet
- **Credenciales de APIs**:
  - Bsale: `access_token`, `client_id`, `client_secret` (OAuth2)
  - Claro Shop: `API Key` (formato `t1-...`)

---

## Paso 1: Crear Droplet en DigitalOcean

1. Ve a [DigitalOcean](https://cloud.digitalocean.com) y crea un nuevo droplet
2. **Imagen**: Ubuntu 22.04 (LTS)
3. **Plan**: Basic, $12/mo (2 vCPU / 2GB RAM) mínimo
4. **Datacenter**: El más cercano a tu ubicación (Santiago, São Paulo, etc.)
5. **Autenticación**: SSH Key (recomendado) o contraseña
6. **Nombre de host**: `bsale-claro-sync`
7. Crea el droplet y espera a que esté activo

---

## Paso 2: Configurar DNS (Opcional pero recomendado)

Si tienes un dominio, apunta un registro A:
```
tu-dominio.com    A    TU_IP_DEL_DROPLET
www.tu-dominio.com    A    TU_IP_DEL_DROPLET
```

---

## Paso 3: Conectar al Droplet

```bash
ssh root@TU_IP_DEL_DROPLET
```

---

## Paso 4: Instalar Docker y Docker Compose

```bash
# Actualizar sistema
apt-get update && apt-get upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verificar
docker --version
docker-compose --version
```

---

## Paso 5: Subir el Proyecto

Desde tu máquina local:

```bash
# Comprimir el proyecto
cd /ruta/al/proyecto/bsale-claroshop-sync
tar -czf bsale-claro-sync.tar.gz .

# Subir al droplet
scp bsale-claro-sync.tar.gz root@TU_IP:/opt/
```

En el droplet:

```bash
cd /opt
mkdir -p bsale-claroshop-sync
tar -xzf bsale-claro-sync.tar.gz -C bsale-claroshop-sync/
cd bsale-claroshop-sync
```

---

## Paso 6: Configurar Variables de Entorno

```bash
cp .env.example .env
nano .env
```

Edita las siguientes variables críticas:

```bash
# === POSTGRES ===
POSTGRES_USER=bsale_sync
POSTGRES_PASSWORD=GENERA_UNA_PASSWORD_SEGURA_AQUI
POSTGRES_DB=bsale_claro_sync

# === BSALE ===
BSALE_ACCESS_TOKEN=tu_access_token_de_bsale
BSALE_CLIENT_ID=tu_client_id
BSALE_CLIENT_SECRET=tu_client_secret
BSALE_PRICE_LIST_ID=1          # Ajusta según tu configuración
BSALE_OFFICE_ID=1              # ID de tu sucursal en Bsale
BSALE_DOCUMENT_TYPE_ID=1       # ID del tipo "pedido web" en Bsale

# === CLARO SHOP ===
CLAROSHOP_API_KEY=t1-tu_api_key_aqui
CLAROSHOP_BASE_URL=https://api.claroshop.com

# === SEGURIDAD ===
JWT_SECRET=genera_un_string_random_de_64_caracteres
ADMIN_PASSWORD=tu_password_para_el_panel
WEBHOOK_SECRET=otro_string_random_para_firmar_webhooks

# === SYNC ===
SYNC_INTERVAL_MINUTES=15
```

**Guarda** (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Paso 7: Construir e Iniciar Servicios

```bash
docker-compose up -d --build
```

Esto construye e inicia:
- PostgreSQL 15
- Redis 7
- Backend Node.js
- Frontend React
- Nginx

---

## Paso 8: Inicializar Base de Datos

```bash
# Esperar a que PostgreSQL esté listo
sleep 15

# Ejecutar script de inicialización
docker-compose exec -T postgres psql -U bsale_sync -d bsale_claro_sync < scripts/init-db.sql
```

---

## Paso 9: Verificar Despliegue

```bash
# Verificar contenedores
docker-compose ps

# Ver logs del backend
docker-compose logs -f backend

# Health check
curl http://localhost/health
```

Deberías ver:
```json
{"status":"ok","timestamp":"2024-..."}
```

---

## Paso 10: Acceder al Panel

Abre tu navegador:
- **Sin dominio**: `http://TU_IP_DEL_DROPLET/`
- **Con dominio**: `http://tu-dominio.com/`

Inicia sesión con la contraseña configurada en `ADMIN_PASSWORD`.

---

## Paso 11: Configurar Webhooks

### Bsale Webhooks

Envía un email a **ayuda@bsale.app** con:
- **Asunto**: "Solicitud de activación de webhooks"
- **Contenido**:
  ```
  Hola,

  Solicito activar webhooks para mi cuenta (RFC/CpnId: XXXXXXXX).

  URL de webhook: http://TU_IP/webhooks/bsale
  Eventos necesarios:
  - product (post, put)
  - variant (post, put)
  - stock (put)
  - price (put)

  Gracias.
  ```

### Claro Shop Webhooks

En tu panel de Claro Shop / T1, configura:
- **URL**: `http://TU_IP/webhooks/claroshop`
- **Eventos**: `order.created`, `order.paid`, `order.cancelled`, `order.status_updated`

---

## Paso 12: Configurar HTTPS con Let's Encrypt (Recomendado)

```bash
# Instalar Certbot
docker run -it --rm \
  -v /opt/bsale-claroshop-sync/nginx/ssl:/etc/letsencrypt \
  -v /opt/bsale-claroshop-sync/nginx:/data \
  certbot/certbot certonly \
  --standalone \
  -d tu-dominio.com \
  -d www.tu-dominio.com \
  --agree-tos \
  -m tu@email.com

# Actualizar nginx.conf para usar SSL
# Descomenta las líneas de HTTPS en nginx/nginx.conf
# Reiniciar nginx
docker-compose restart nginx
```

---

## Paso 13: Configurar Renovación Automática de Token Bsale (Opcional)

Bsale usa OAuth2. Si el token expira, necesitas un mecanismo de renovación.

Agrega a `backend/src/integrations/bsale.client.ts` un método de refresh, o configura un cron job:

```bash
# Editar crontab
crontab -e

# Agregar cada 6 horas
0 */6 * * * cd /opt/bsale-claroshop-sync && docker-compose exec -T backend node -e "require('./dist/integrations/bsale.client').refreshToken()"
```

---

## Comandos Útiles para Operación

```bash
# Ver logs en tiempo real
docker-compose logs -f backend
docker-compose logs -f nginx

# Reiniciar servicios específicos
docker-compose restart backend
docker-compose restart nginx

# Ver estado de colas Redis
docker-compose exec redis redis-cli
> LLEN bull:product-sync:wait
> LLEN bull:stock-sync:wait
> LLEN bull:order-import:wait

# Backup de base de datos
docker-compose exec postgres pg_dump -U bsale_sync bsale_claro_sync > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker-compose exec -T postgres psql -U bsale_sync -d bsale_claro_sync < backup_20240101.sql

# Actualizar código y rebuild
git pull  # o subir nuevos archivos
docker-compose up -d --build

# Escalar workers (si necesitas más capacidad)
# Editar docker-compose.yml para aumentar réplicas o recursos
```

---

## Troubleshooting

### El panel no carga
```bash
docker-compose logs nginx
docker-compose logs frontend
```

### Error de conexión a PostgreSQL
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U bsale_sync -d bsale_claro_sync -c "\dt"
```

### Webhooks no funcionan
1. Verifica que el droplet esté accesible desde internet
2. Revisa firewall: `ufw status`
3. Verifica logs: `docker-compose logs backend | grep webhook`

### Rate limiting de APIs
Bsale tiene límite de ~8 req/segundo. El cliente ya implementa 130ms de delay.
Si ves errores 429, aumenta el delay en `bsale.client.ts`.

---

## Monitoreo y Alertas (Opcional)

Para recibir alertas por Telegram cuando falle la sincronización:

1. Crea un bot en [@BotFather](https://t.me/botfather)
2. Obtén tu Chat ID hablando con [@userinfobot](https://t.me/userinfobot)
3. Configura en `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=tu_token
   TELEGRAM_CHAT_ID=tu_chat_id
   ```
4. El backend enviará alertas automáticamente cuando haya errores críticos.

---

## Estructura Final del Servidor

```
/opt/bsale-claroshop-sync/
├── docker-compose.yml
├── .env
├── nginx/
│   ├── nginx.conf
│   └── ssl/
├── backend/
│   ├── Dockerfile
│   └── src/
├── frontend/
│   ├── Dockerfile
│   └── src/
├── scripts/
│   ├── init-db.sql
│   └── deploy.sh
└── logs/
    └── backend/
```

---

## Soporte

Si encuentras problemas:
1. Revisa los logs: `docker-compose logs -f backend`
2. Verifica la salud: `curl http://localhost/health`
3. Revisa la cola de reintentos en el panel web

**Proyecto ID**: `PRJ-BSALE-CLARO-2024-001`
