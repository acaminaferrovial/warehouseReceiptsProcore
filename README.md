# 🏗️ Procore Materials Hub — Recepción de Materiales en Obra

Aplicación web progresiva (PWA) de alto rendimiento diseñada específicamente para jefes de obra, encargados y equipos de almacén. Permite registrar recepciones de materiales, capturar firmas digitales táctiles, digitalizar albaranes con fotos y sincronizar automáticamente cada entrega con la **Bitácora Diaria (Daily Log - Deliveries API)** y las **Órdenes de Compra (Purchase Orders)** de **Procore**.

---

## 🔒 Arquitectura de Seguridad (Single-Instance & Secrets)

Esta aplicación está diseñada para desplegarse como **instancia dedicada** (por proyecto o por empresa) con una arquitectura orientada a la seguridad:

1. **Protección de Secrets en Backend**: Los tokens de acceso de Procore (`PROCORE_ACCESS_TOKEN`, Client Secrets, etc.) se gestionan exclusivamente en el servidor mediante **variables de entorno / archivo `.env`**.
2. **Cero exposición en clientes**: Ningún operario, subcontratista o dispositivo móvil tiene acceso a las credenciales desde el navegador.
3. **Cero problemas de CORS**: Al comunicarse el backend Node.js directamente con `https://api.procore.com` o `https://sandbox.procore.com`, se evitan las restricciones de CORS de los navegadores.
4. **Resistencia Offline (PWA)**: Incluye un Service Worker (`sw.js`) que cachea la aplicación para permitir registrar entregas y firmas incluso en sótanos o zonas de obra sin cobertura 4G/5G.

---

## 📋 Variables de Entorno (`.env`)

Copia el archivo de plantilla `.env.example` a `.env`:

```bash
cp .env.example .env
```

Configura tus variables:

| Variable | Descripción | Ejemplo / Valor por defecto |
|---|---|---|
| `PROCORE_ENVIRONMENT` | Entorno de Procore (`sandbox` o `production`) | `sandbox` |
| `PROCORE_COMPANY_ID` | ID numérico de tu empresa/tenant en Procore | `104928` |
| `PROCORE_PROJECT_ID` | ID numérico del proyecto en Procore | `29814` |
| `PROCORE_PROJECT_NAME` | Nombre descriptivo del proyecto para la interfaz | `Torre Skyline - Fase 2` |
| `PROCORE_ACCESS_TOKEN` | Bearer Token / Personal Access Token con permisos de lectura/escritura | *(Tu secret)* |
| `PORT` | Puerto de escucha del servidor web | `4173` |

> [!NOTE]
> Si `PROCORE_ACCESS_TOKEN` está vacío, el servidor activa automáticamente el **Modo Simulación Inteligente**, permitiendo probar la interfaz, firmas y flujos sin necesidad de credenciales activas.

---

## 🚀 Despliegue Rápido

### Opción 1: Despliegue de Prueba en Vercel (1 Clic con HTTPS)

Ideal para probar la aplicación inmediatamente en tablets y móviles de obra:

1. **Subir el código a GitHub/GitLab** o usar la CLI de Vercel:
   ```bash
   npx vercel
   ```
2. **En el panel de Vercel** (*Project Settings* -> *Environment Variables*), añade los secrets:
   - `PROCORE_ENVIRONMENT`: `sandbox` o `production`
   - `PROCORE_COMPANY_ID`: Tu Company ID
   - `PROCORE_PROJECT_ID`: Tu Project ID
   - `PROCORE_PROJECT_NAME`: Nombre de tu proyecto
   - `PROCORE_ACCESS_TOKEN`: Tu Bearer Token
3. Vercel te dará una URL HTTPS pública (ej: `https://tu-proyecto.vercel.app`) donde los operarios podrán usar la app e instalarla como PWA.

---

### Opción 2: Con Docker Compose (Recomendado para servidores)

1. Asegúrate de tener tu archivo `.env` configurado.
2. Inicia el contenedor en segundo plano:
   ```bash
   docker compose up -d --build
   ```
3. Comprueba el estado:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

### Opción 2: Con Docker directo

```bash
# Construir la imagen
docker build -t procore-materials-hub .

# Ejecutar el contenedor inyectando el archivo de secrets
docker run -d \
  --name procore-hub \
  --restart unless-stopped \
  -p 4173:4173 \
  --env-file .env \
  procore-materials-hub
```

### Opción 3: Con Node.js directo (Local / VPS con PM2)

```bash
# Iniciar con Node.js
npm start

# O para producción con PM2 en un servidor Linux:
npm install -g pm2
pm2 start server.js --name "procore-materials-hub"
pm2 save
```

---

## ☁️ Guía de Despliegue en Plataformas Cloud

### 1. Azure (Container Apps / App Service)
1. Sube la imagen a **Azure Container Registry (ACR)** o Docker Hub.
2. Crea un **Azure Container App** o **App Service para Linux (Contenedor)**.
3. En la sección **Configuration / Environment Variables**, inyecta los secrets:
   - `PROCORE_ENVIRONMENT`
   - `PROCORE_COMPANY_ID`
   - `PROCORE_PROJECT_ID`
   - `PROCORE_ACCESS_TOKEN` (marcar como Secret en Azure)
4. Configura el puerto de escucha en `4173`.
5. Health probe: `GET /health`

### 2. Google Cloud Run
```bash
# Compilar y desplegar en 1 paso
gcloud run deploy procore-materials-hub \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 4173 \
  --set-env-vars PROCORE_ENVIRONMENT=sandbox,PROCORE_COMPANY_ID=104928,PROCORE_PROJECT_ID=29814 \
  --set-secrets PROCORE_ACCESS_TOKEN=procore-token:latest
```

### 3. AWS (App Runner o ECS Fargate)
1. Publica la imagen en **AWS ECR**.
2. Crea un servicio en **AWS App Runner**:
   - Puerto: `4173`
   - Health check path: `/health`
   - Variables de entorno: Inyecta los valores desde **AWS Secrets Manager**.

---

## 📡 Endpoints de la API del Servidor

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Healthcheck para orquestadores (Docker, K8s, Cloud Run). Devuelve `status: "healthy"` y `uptime`. |
| `GET` | `/api/instance-config` | Metadatos públicos de la instancia para la interfaz (proyecto, entorno, sin exponer el token). |
| `GET` | `/api/procore/status` | Comprueba la comunicación servidor ↔ Procore mediante `GET /rest/v1.0/me`. |
| `GET` | `/api/procore/purchase-orders` | Obtiene las órdenes de compra vigentes en Procore para cargarlas a la bandeja de recepción. |
| `POST` | `/api/procore/deliveries` | Registra la recepción en la bitácora diaria oficial de Procore (`daily_logs/deliveries`). |

---

## 📱 Capacidades de Campo en Obra

- **Firma Digital Táctil**: Canvas de alta precisión con escalado automático para pantallas Retina/HiDPI en tablets y smartphones.
- **Cámara & Compresión de Albaranes**: Captura fotos de remisiones en papel y las comprime automáticamente antes de enviarlas.
- **Importador Excel / CSV**: Detección inteligente de columnas para cargar compras masivas en 1 segundo (SheetJS).
- **Exportación CSV con BOM UTF-8**: Descarga el historial de recepciones con compatibilidad nativa para Microsoft Excel en español.
- **Instalable como PWA**: Se puede instalar como aplicación nativa en iOS (Safari -> Añadir a pantalla de inicio) y Android (Chrome -> Instalar app).
