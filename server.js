/**
 * PROCORE MATERIALS HUB - BACKEND SERVER (SECRETS & INSTANCE SERVICE)
 * Servidor dedicado que gestiona las credenciales de Procore (Secrets en .env / entorno)
 * y expone endpoints seguros al cliente web de obra sin exponer los tokens.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. CARGA AUTOMÁTICA DE VARIABLES DE ENTORNO DESDE .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalIdx = trimmed.indexOf('=');
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim();
          let val = trimmed.slice(equalIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn('Advertencia al leer .env:', e.message);
    }
  }
}

loadEnv();

// 2. CONFIGURACIÓN DE LA INSTANCIA DE PROCORE
const PORT = parseInt(process.env.PORT, 10) || 4173;
const PROCORE_ENVIRONMENT = (process.env.PROCORE_ENVIRONMENT || 'sandbox').toLowerCase();
const PROCORE_BASE_URL = PROCORE_ENVIRONMENT === 'production'
  ? 'https://api.procore.com'
  : 'https://sandbox.procore.com';

const PROCORE_COMPANY_ID = (process.env.PROCORE_COMPANY_ID || '104928').trim();
const PROCORE_PROJECT_ID = (process.env.PROCORE_PROJECT_ID || '29814').trim();
const PROCORE_PROJECT_NAME = (process.env.PROCORE_PROJECT_NAME || 'Torre Skyline - Fase 2').trim();
const PROCORE_ACCESS_TOKEN = (process.env.PROCORE_ACCESS_TOKEN || '').trim();

// Utilidad para headers de Procore con el secret del servidor
function getProcoreHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Procore-Company-Id': PROCORE_COMPANY_ID
  };
  if (PROCORE_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${PROCORE_ACCESS_TOKEN}`;
  }
  return headers;
}

// 3. MAPA DE TIPOS MIME PARA SERVIR ARCHIVOS ESTÁTICOS
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// 4. CREACIÓN DEL SERVIDOR HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS headers locales por conveniencia
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // -------------------------------------------------------------
  // RUTAS DE LA API DEL SERVIDOR
  // -------------------------------------------------------------

  // GET /health o /api/health -> Health check para Docker / Kubernetes / Cloud
  if ((pathname === '/health' || pathname === '/api/health') && method === 'GET') {
    sendJSON(res, 200, {
      status: 'healthy',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      configured: Boolean(PROCORE_ACCESS_TOKEN && PROCORE_ACCESS_TOKEN.length > 5),
      environment: PROCORE_ENVIRONMENT,
      projectId: PROCORE_PROJECT_ID
    });
    return;
  }

  // GET /api/instance-config -> Información pública de la instancia (sin exponer el token)
  if (pathname === '/api/instance-config' && method === 'GET') {
    const hasToken = Boolean(PROCORE_ACCESS_TOKEN && PROCORE_ACCESS_TOKEN.length > 5);
    const tokenPreview = hasToken
      ? `${PROCORE_ACCESS_TOKEN.substring(0, 4)}...${PROCORE_ACCESS_TOKEN.substring(PROCORE_ACCESS_TOKEN.length - 4)}`
      : null;

    sendJSON(res, 200, {
      configured: hasToken,
      environment: PROCORE_ENVIRONMENT,
      baseUrl: PROCORE_BASE_URL,
      companyId: PROCORE_COMPANY_ID,
      projectId: PROCORE_PROJECT_ID,
      projectName: PROCORE_PROJECT_NAME,
      hasToken: hasToken,
      tokenPreview: tokenPreview,
      authMode: 'server_secrets'
    });
    return;
  }

  // GET /api/procore/status -> Prueba la conexión server-side con Procore API
  if (pathname === '/api/procore/status' && method === 'GET') {
    if (!PROCORE_ACCESS_TOKEN) {
      sendJSON(res, 200, {
        connected: false,
        live: false,
        mode: 'demo_fallback',
        message: 'No se ha configurado PROCORE_ACCESS_TOKEN en el archivo .env. La aplicación funciona en modo simulación (demo).'
      });
      return;
    }

    try {
      const procoreRes = await fetch(`${PROCORE_BASE_URL}/rest/v1.0/me`, {
        method: 'GET',
        headers: getProcoreHeaders()
      });

      if (!procoreRes.ok) {
        const errBody = await procoreRes.text();
        sendJSON(res, 200, {
          connected: false,
          live: true,
          status: procoreRes.status,
          statusText: procoreRes.statusText,
          error: errBody,
          message: `Procore respondió con error HTTP ${procoreRes.status} (${procoreRes.statusText}). Comprueba el token en .env.`
        });
        return;
      }

      const userData = await procoreRes.json();
      sendJSON(res, 200, {
        connected: true,
        live: true,
        user: userData,
        environment: PROCORE_ENVIRONMENT,
        message: `¡Conexión verificada con éxito con Procore! Conectado como: ${userData.name || userData.login_id || 'Usuario Procore'}`
      });
    } catch (err) {
      sendJSON(res, 500, {
        connected: false,
        live: true,
        error: err.message,
        message: `Fallo de red al conectar con Procore (${PROCORE_BASE_URL}): ${err.message}`
      });
    }
    return;
  }

  // GET /api/procore/purchase-orders -> Consulta las órdenes de compra en Procore
  if (pathname === '/api/procore/purchase-orders' && method === 'GET') {
    if (!PROCORE_ACCESS_TOKEN) {
      // Fallback a pedidos simulados si no hay token de Procore en .env
      const sampleOrders = [
        {
          id: 'po-procore-201',
          number: 'OC-PROCORE-2026-401',
          supplier: 'Votorantim Cimentos',
          description: 'Cemento Portland EN 197-1 CEM II/A-LL 42,5 R a granel',
          quantity: '3 cisternas (75 Tn)',
          expectedDate: new Date().toISOString().split('T')[0],
          urgent: true,
          status: 'pending'
        },
        {
          id: 'po-procore-202',
          number: 'OC-PROCORE-2026-402',
          supplier: 'Knauf Insulation',
          description: 'Paneles de lana mineral Ultracoustic Plus 600x1200x50 mm',
          quantity: '24 palets (1.152 m²)',
          expectedDate: getFutureDate(1),
          urgent: false,
          status: 'pending'
        },
        {
          id: 'po-procore-203',
          number: 'OC-PROCORE-2026-403',
          supplier: 'Tubacex Innovación',
          description: 'Tubo de acero inoxidable AISI 316L Ø50mm longitud 6m',
          quantity: '60 barras (360 m)',
          expectedDate: getFutureDate(2),
          urgent: false,
          status: 'pending'
        }
      ];

      sendJSON(res, 200, {
        source: 'simulation_fallback',
        orders: sampleOrders,
        message: 'Pedidos simulados de demostración (PROCORE_ACCESS_TOKEN no configurado en .env)'
      });
      return;
    }

    try {
      const procoreUrl = `${PROCORE_BASE_URL}/rest/v1.0/projects/${PROCORE_PROJECT_ID}/purchase_order_contracts`;
      const procoreRes = await fetch(procoreUrl, {
        method: 'GET',
        headers: getProcoreHeaders()
      });

      if (!procoreRes.ok) {
        const errText = await procoreRes.text();
        sendJSON(res, procoreRes.status, {
          error: errText,
          message: `Error ${procoreRes.status} al consultar Purchase Orders en Procore.`
        });
        return;
      }

      const contracts = await procoreRes.json();
      const orders = Array.isArray(contracts) ? contracts.map(po => ({
        id: 'po-' + (po.id || Date.now()),
        number: po.contract_number || po.number || `OC-${po.id}`,
        supplier: (po.vendor && po.vendor.name) ? po.vendor.name : 'Proveedor Procore',
        description: po.title || po.description || 'Materiales según orden de compra Procore',
        quantity: po.status || '1 lote',
        expectedDate: po.delivery_date || new Date().toISOString().split('T')[0],
        urgent: false,
        status: 'pending',
        procorePoId: po.id
      })) : [];

      sendJSON(res, 200, {
        source: 'live_procore_api',
        orders: orders,
        count: orders.length
      });
    } catch (err) {
      sendJSON(res, 500, {
        error: err.message,
        message: `Fallo al consultar órdenes de compra en Procore: ${err.message}`
      });
    }
    return;
  }

  // POST /api/procore/deliveries -> Envía la entrega a la bitácora diaria de Procore
  if (pathname === '/api/procore/deliveries' && method === 'POST') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyText || '{}');

        if (!PROCORE_ACCESS_TOKEN) {
          // Simulación cuando no hay token
          const fakeLogId = `DL-${Math.floor(10000 + Math.random() * 90000)}`;
          sendJSON(res, 201, {
            success: true,
            live: false,
            procoreLogId: fakeLogId,
            message: 'Entrega registrada en simulación (se guardó en el historial local)',
            payload: payload
          });
          return;
        }

        // Envío real a la API de Procore
        const procoreUrl = `${PROCORE_BASE_URL}/rest/v1.0/projects/${PROCORE_PROJECT_ID}/daily_logs/deliveries`;
        const procoreRes = await fetch(procoreUrl, {
          method: 'POST',
          headers: getProcoreHeaders(),
          body: JSON.stringify(payload)
        });

        if (!procoreRes.ok) {
          const errText = await procoreRes.text();
          sendJSON(res, procoreRes.status, {
            success: false,
            live: true,
            error: errText,
            message: `Procore Daily Log rechazó la entrega con código HTTP ${procoreRes.status}.`
          });
          return;
        }

        const resData = await procoreRes.json();
        const procoreId = resData.id ? `DL-${resData.id}` : `DL-${Math.floor(10000 + Math.random() * 90000)}`;

        sendJSON(res, 201, {
          success: true,
          live: true,
          procoreLogId: procoreId,
          data: resData,
          message: 'Entrega creada y sincronizada con éxito en Procore Daily Log.'
        });
      } catch (err) {
        sendJSON(res, 500, {
          success: false,
          error: err.message,
          message: `Error al procesar la entrega: ${err.message}`
        });
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // SERVIR ARCHIVOS ESTÁTICOS DE LA APLICACIÓN WEB
  // -------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Normalizar ruta para evitar directory traversal
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403);
    res.end('Acceso denegado');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback a index.html para SPA
      fs.readFile(path.join(__dirname, 'index.html'), (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Archivo no encontrado');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(safePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error leyendo archivo');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function getFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 PROCORE MATERIALS HUB (SECRETS & INSTANCE SERVICE)`);
  console.log(`=======================================================`);
  console.log(`📡 Servidor activo en: http://localhost:${PORT}`);
  console.log(`🌍 Entorno Procore:    ${PROCORE_ENVIRONMENT.toUpperCase()} (${PROCORE_BASE_URL})`);
  console.log(`🏢 Company ID:         ${PROCORE_COMPANY_ID}`);
  console.log(`🏗️ Project ID:         ${PROCORE_PROJECT_ID} (${PROCORE_PROJECT_NAME})`);
  console.log(`🔑 Procore Token:      ${PROCORE_ACCESS_TOKEN ? '✅ Configurado mediante Secret en .env' : '⚠️ No configurado (Modo Simulación activo)'}`);
  console.log(`=======================================================`);
});

// Manejo de apagado seguro (Graceful Shutdown) para contenedores y plataformas Cloud
function gracefulShutdown(signal) {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando conexiones HTTP...`);
  server.close(() => {
    console.log('✅ Servidor HTTP detenido correctamente.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forzando cierre del proceso tras timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

