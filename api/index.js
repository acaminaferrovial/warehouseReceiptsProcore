/**
 * VERCEL SERVERLESS FUNCTION - API PROXY PARA PROCORE
 * Maneja los endpoints /api/* y /health en Vercel
 * asegurando los secrets (variables de entorno) en el servidor.
 */

// 1. LECTURA DE SECRETS DESDE VARIABLES DE ENTORNO DE VERCEL
const PROCORE_ENVIRONMENT = (process.env.PROCORE_ENVIRONMENT || 'sandbox').toLowerCase();
const PROCORE_BASE_URL = PROCORE_ENVIRONMENT === 'production'
  ? 'https://api.procore.com'
  : 'https://sandbox.procore.com';

const PROCORE_COMPANY_ID = (process.env.PROCORE_COMPANY_ID || '104928').trim();
const PROCORE_PROJECT_ID = (process.env.PROCORE_PROJECT_ID || '29814').trim();
const PROCORE_PROJECT_NAME = (process.env.PROCORE_PROJECT_NAME || 'Torre Skyline - Fase 2').trim();
const PROCORE_ACCESS_TOKEN = (process.env.PROCORE_ACCESS_TOKEN || '').trim();

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

function sendJSON(res, status, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(data);
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  }
}

function getFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method.toUpperCase() === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. Healthcheck
  if (pathname === '/health' || pathname === '/api/health') {
    sendJSON(res, 200, {
      status: 'healthy',
      platform: 'Vercel Serverless',
      configured: Boolean(PROCORE_ACCESS_TOKEN && PROCORE_ACCESS_TOKEN.length > 5),
      environment: PROCORE_ENVIRONMENT,
      projectId: PROCORE_PROJECT_ID,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 2. Instance Config (sin exponer tokens)
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
      authMode: 'vercel_secrets'
    });
    return;
  }

  // 3. Status test
  if (pathname === '/api/procore/status' && method === 'GET') {
    if (!PROCORE_ACCESS_TOKEN) {
      sendJSON(res, 200, {
        connected: false,
        live: false,
        mode: 'demo_fallback',
        message: 'No se ha configurado PROCORE_ACCESS_TOKEN en las variables de entorno de Vercel. Modo simulación activo.'
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
          error: errBody,
          message: `Procore respondió con error HTTP ${procoreRes.status}. Comprueba el token configurado en Vercel.`
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
        message: `Fallo al comunicar con Procore: ${err.message}`
      });
    }
    return;
  }

  // 4. Purchase orders
  if (pathname === '/api/procore/purchase-orders' && method === 'GET') {
    if (!PROCORE_ACCESS_TOKEN) {
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
        message: 'Pedidos simulados de demostración (PROCORE_ACCESS_TOKEN no configurado)'
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

  // 5. Deliveries POST
  if (pathname === '/api/procore/deliveries' && method === 'POST') {
    try {
      const payload = await parseBody(req);

      if (!PROCORE_ACCESS_TOKEN) {
        const fakeLogId = `DL-${Math.floor(10000 + Math.random() * 90000)}`;
        sendJSON(res, 201, {
          success: true,
          live: false,
          procoreLogId: fakeLogId,
          message: 'Entrega registrada en simulación en Vercel',
          payload: payload
        });
        return;
      }

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
        message: `Error al procesar la entrega en Vercel: ${err.message}`
      });
    }
    return;
  }

  sendJSON(res, 404, { error: 'Ruta no encontrada' });
};
