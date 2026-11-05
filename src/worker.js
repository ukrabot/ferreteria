/**
 * Ferretería Ukra — Worker API
 * Handles checkout (Flow and Mercado Pago), order management, product management, and admin panel API.
 * Static assets are served automatically by Cloudflare Workers Static Assets.
 */

const FLOW_API = 'https://www.flow.cl/api';
// Mercado Pago (Checkout Pro). Enabled when the MP_ACCESS_TOKEN secret exists.
// The token is a Cloudflare secret: never put it in wrangler.jsonc (public repo).
const MP_API = 'https://api.mercadopago.com';

// Digital products: delivered by a private download link after payment.
// The file is uploaded from /admin/ and stored in D1 (the repo is public, so
// paid files must never be committed). Stored in chunks to stay well under
// D1's per-value size limit.
const DIGITAL_PRODUCTS = {
  'pack-cuadro-de-cargas-unilineal-checklist-te1': {
    name: 'Pack Tablero Eléctrico RIC',
    filename: 'Pack-Tablero-Electrico-RIC-Ferreteria-Ukra.zip',
  },
  'pack-codigo-de-colores-etiquetas-tablero-ric': {
    name: 'Pack Identificación Eléctrica RIC',
    filename: 'Pack-Identificacion-Electrica-RIC-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-techo-de-zinc-excel': {
    name: 'Pack Calculadora de Techo de Zinc',
    filename: 'Pack-Calculadora-Techo-de-Zinc-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-consumo-soldadora-excel': {
    name: 'Pack Calculadora Soldadora',
    filename: 'Pack-Calculadora-Soldadora-Ferreteria-Ukra.zip',
  },
  'pack-soldadura-con-estano-guia-visual-pdf': {
    name: 'Pack Soldadura con Estaño',
    filename: 'Pack-Soldadura-con-Estano-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-de-pastelones-excel': {
    name: 'Pack Calculadora de Pastelones',
    filename: 'Pack-Calculadora-de-Pastelones-Ferreteria-Ukra.zip',
  },
  'pack-regularizacion-ley-del-mono-checklist-dom': {
    name: 'Pack Regularización Ley del Mono',
    filename: 'Pack-Regularizacion-Ley-del-Mono-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-cemento-y-ladrillos-muro-excel': {
    name: 'Pack Calculadora de Cemento para Muros',
    filename: 'Pack-Calculadora-de-Cemento-para-Muros-Ferreteria-Ukra.zip',
  },
  'pack-dilucion-acido-muriatico-ladrillo-visto-excel': {
    name: 'Pack Limpieza de Ladrillo Visto',
    filename: 'Pack-Limpieza-Ladrillo-Visto-Ferreteria-Ukra.zip',
  },
  'pack-comparador-ladrillo-fiscal-princesa-hormigon-celular-excel': {
    name: 'Pack Comparador de Ladrillos',
    filename: 'Pack-Comparador-de-Ladrillos-Ferreteria-Ukra.zip',
  },
  'pack-selector-remaches-pop-excel': {
    name: 'Pack Remaches POP',
    filename: 'Pack-Remaches-POP-Ferreteria-Ukra.zip',
  },
  'pack-planilla-fosa-septica-test-percolacion-excel': {
    name: 'Pack Fosa Séptica',
    filename: 'Pack-Fosa-Septica-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-radier-armado-malla-excel': {
    name: 'Pack Radier Armado',
    filename: 'Pack-Radier-Armado-Ferreteria-Ukra.zip',
  },
  'pack-presupuesto-construccion-casa-excel': {
    name: 'Pack Presupuesto de Casa',
    filename: 'Pack-Presupuesto-Casa-Ferreteria-Ukra.zip',
  },
  'pack-diagnostico-bomba-agua-no-corta-excel': {
    name: 'Pack Bomba que No Corta',
    filename: 'Pack-Bomba-No-Corta-Ferreteria-Ukra.zip',
  },
  'pack-enchufe-seguro-carga-circuito-excel': {
    name: 'Pack Enchufe Seguro',
    filename: 'Pack-Enchufe-Seguro-Ferreteria-Ukra.zip',
  },
  'pack-galpon-metalico-dimensiones-cotizaciones-excel': {
    name: 'Pack Galpón Metálico',
    filename: 'Pack-Galpon-Metalico-Ferreteria-Ukra.zip',
  },
  'pack-revision-enchufes-fase-neutro-tierra-excel': {
    name: 'Pack Fase y Neutro',
    filename: 'Pack-Fase-y-Neutro-Ferreteria-Ukra.zip',
  },
  'pack-calculadora-tabique-metalcon-excel': {
    name: 'Pack Tabique Metalcon',
    filename: 'Pack-Tabique-Metalcon-Ferreteria-Ukra.zip',
  },
  'pack-ducha-electrica-circuito-seguro-excel': {
    name: 'Pack Ducha Eléctrica',
    filename: 'Pack-Ducha-Electrica-Ferreteria-Ukra.zip',
  },
  'pack-hongos-humedad-diagnostico-repintado-excel': {
    name: 'Pack Hongos y Humedad',
    filename: 'Pack-Hongos-y-Humedad-Ferreteria-Ukra.zip',
  },
  'pack-muro-contencion-drenaje-supervision-excel': {
    name: 'Pack Muro de Contención',
    filename: 'Pack-Muro-de-Contencion-Ferreteria-Ukra.zip',
  },
  'pack-impermeabilizacion-radier-capilaridad-excel': {
    name: 'Pack Radier sin Humedad',
    filename: 'Pack-Radier-sin-Humedad-Ferreteria-Ukra.zip',
  },
  'pack-goteras-techo-zinc-reparacion-mantencion-excel': {
    name: 'Pack Goteras en Techo de Zinc',
    filename: 'Pack-Goteras-Techo-de-Zinc-Ferreteria-Ukra.zip',
  },
  'pack-tablero-transferencia-ats-generador-excel': {
    name: 'Pack Tablero ATS',
    filename: 'Pack-Tablero-ATS-Ferreteria-Ukra.zip',
  },
  'pack-tornillos-para-madera-calculadora-excel': {
    name: 'Pack Tornillos para Madera',
    filename: 'Pack-Tornillos-para-Madera-Ferreteria-Ukra.zip',
  },
  'pack-calefont-no-enciende-diagnostico-mantencion-excel': {
    name: 'Pack Calefont',
    filename: 'Pack-Calefont-Ferreteria-Ukra.zip',
  },
  'pack-malla-raschel-calculadora-estructura-excel': {
    name: 'Pack Malla Raschel',
    filename: 'Pack-Malla-Raschel-Ferreteria-Ukra.zip',
  },
  'pack-ruido-bomba-agua-diagnostico-succion-excel': {
    name: 'Pack Ruido en Bomba de Agua',
    filename: 'Pack-Ruido-en-Bomba-de-Agua-Ferreteria-Ukra.zip',
  },
  'pack-luces-led-interior-auto-fusible-excel': {
    name: 'Pack Luces LED Interior del Auto',
    filename: 'Pack-Luces-LED-Interior-Auto-Ferreteria-Ukra.zip',
  },
  'pack-llave-de-paso-instalacion-materiales-excel': {
    name: 'Pack Llave de Paso',
    filename: 'Pack-Llave-de-Paso-Ferreteria-Ukra.zip',
  },
  'pack-destapar-canerias-diagnostico-mantencion-excel': {
    name: 'Pack Destape de Cañerías',
    filename: 'Pack-Destape-Canerias-Ferreteria-Ukra.zip',
  },
  'pack-instalar-calefont-litros-tiro-cotizacion-excel': {
    name: 'Pack Instalar Calefont',
    filename: 'Pack-Instalar-Calefont-Ferreteria-Ukra.zip',
  },
  'pack-puesta-a-tierra-diagnostico-medicion-excel': {
    name: 'Pack Puesta a Tierra',
    filename: 'Pack-Puesta-a-Tierra-Ferreteria-Ukra.zip',
  },
  'pack-membrana-asfaltica-techo-materiales-excel': {
    name: 'Pack Membrana Asfáltica',
    filename: 'Pack-Membrana-Asfaltica-Ferreteria-Ukra.zip',
  },
  'pack-termofusion-ppr-tiempos-materiales-excel': {
    name: 'Pack Termofusión PPR',
    filename: 'Pack-Termofusion-PPR-Ferreteria-Ukra.zip',
  },
  'pack-cubierta-cocina-material-medicion-excel': {
    name: 'Pack Cubierta de Cocina',
    filename: 'Pack-Cubierta-de-Cocina-Ferreteria-Ukra.zip',
  },
  'pack-grosor-cable-extension-seccion-caida-excel': {
    name: 'Pack Grosor de Cable para Extensión',
    filename: 'Pack-Grosor-Cable-Extension-Ferreteria-Ukra.zip',
  },
  'pack-extractor-aire-bano-cocina-caudal-excel': {
    name: 'Pack Extractor de Aire',
    filename: 'Pack-Extractor-de-Aire-Ferreteria-Ukra.zip',
  },
  'pack-ascensor-salvaescaleras-elegir-cotizar-excel': {
    name: 'Pack Ascensor y Salvaescaleras',
    filename: 'Pack-Ascensor-Salvaescaleras-Ferreteria-Ukra.zip',
  },
  'pack-quincho-parrilla-dimensiones-materiales-excel': {
    name: 'Pack Quincho con Parrilla',
    filename: 'Pack-Quincho-Parrilla-Ferreteria-Ukra.zip',
  },
  'pack-ventanas-termopanel-medicion-valor-u-excel': {
    name: 'Pack Ventanas Termopanel',
    filename: 'Pack-Ventanas-Termopanel-Ferreteria-Ukra.zip',
  },
  'pack-pasto-natural-siembra-semilla-riego-excel': {
    name: 'Pack Pasto Natural',
    filename: 'Pack-Pasto-Natural-Ferreteria-Ukra.zip',
  },
  'pack-melamina-15-18-mm-repisas-despiece-excel': {
    name: 'Pack Melamina 15 o 18 mm',
    filename: 'Pack-Melamina-15-18-Ferreteria-Ukra.zip',
  },
  'pack-termo-electrico-litros-circuito-instalacion-excel': {
    name: 'Pack Termo Eléctrico',
    filename: 'Pack-Termo-Electrico-Ferreteria-Ukra.zip',
  },
  'pack-aumento-potencia-empalme-demanda-tramite-excel': {
    name: 'Pack Aumento de Potencia',
    filename: 'Pack-Aumento-de-Potencia-Ferreteria-Ukra.zip',
  },
  'pack-mascara-de-soldar-din-comparador-checklist-excel': {
    name: 'Pack Máscara de Soldar',
    filename: 'Pack-Mascara-de-Soldar-Ferreteria-Ukra.zip',
  },
  'pack-puerta-blindada-clase-rc-cotizaciones-excel': {
    name: 'Pack Puerta Blindada',
    filename: 'Pack-Puerta-Blindada-Ferreteria-Ukra.zip',
  },
  'pack-regular-mascara-fotosensible-ajuste-diagnostico-excel': {
    name: 'Pack Regular Máscara Fotosensible',
    filename: 'Pack-Regular-Mascara-Fotosensible-Ferreteria-Ukra.zip',
  },
};
const FILE_CHUNK = 90 * 1024; // keeps each statement under D1's 100 KB limit
const MAX_FILE = 20 * 1024 * 1024;
const MAX_DOWNLOADS = 25;
const isDigital = slug => Object.prototype.hasOwnProperty.call(DIGITAL_PRODUCTS, slug);
// Default shipping settings (editable from /admin/, stored in the settings table)
const DEFAULT_SHIPPING = { shipping_cost: 3990, free_shipping_min: 19990 };

// ── Helpers ──────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Columns/tables for digital delivery. Each ALTER fails harmlessly once it exists.
let downloadColsDone = false;
async function ensureDownloadColumns(env) {
  if (downloadColsDone) return;
  try { await env.DB.prepare('ALTER TABLE orders ADD COLUMN download_token TEXT').run(); } catch {}
  try { await env.DB.prepare('ALTER TABLE orders ADD COLUMN download_count INTEGER DEFAULT 0').run(); } catch {}
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS digital_files (slug TEXT PRIMARY KEY, filename TEXT NOT NULL,
      size INTEGER NOT NULL, chunks INTEGER NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS digital_file_chunks (slug TEXT NOT NULL, idx INTEGER NOT NULL,
      data BLOB NOT NULL, PRIMARY KEY (slug, idx))`),
  ]);
  downloadColsDone = true;
}

// Columns for Mercado Pago orders. Each ALTER fails harmlessly once it exists.
let mpColsDone = false;
async function ensureMpColumns(env) {
  if (mpColsDone) return;
  try { await env.DB.prepare('ALTER TABLE orders ADD COLUMN gateway TEXT').run(); } catch {}
  try { await env.DB.prepare('ALTER TABLE orders ADD COLUMN mp_payment_id TEXT').run(); } catch {}
  try { await env.DB.prepare('ALTER TABLE orders ADD COLUMN mp_preference_id TEXT').run(); } catch {}
  mpColsDone = true;
}

function toBytes(v) {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return Uint8Array.from(v || []);
}

async function readDigitalFile(env, slug) {
  const meta = await env.DB.prepare(`SELECT filename, size, chunks FROM digital_files WHERE slug = ?`).bind(slug).first();
  if (!meta) return null;
  const rows = await env.DB.prepare(`SELECT idx, data FROM digital_file_chunks WHERE slug = ? ORDER BY idx`).bind(slug).all();
  const parts = (rows.results || []).map(r => toBytes(r.data));
  if (parts.length !== meta.chunks) return null;
  const out = new Uint8Array(meta.size);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return off === meta.size ? { bytes: out, filename: meta.filename } : null;
}

function generateOrderNumber() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `UKRA-${date}-${rand}`;
}

// ── HMAC-SHA256 for Flow API ─────────────────────────────────────────

async function hmacSHA256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function flowSign(params, secretKey) {
  const sorted = Object.keys(params).sort();
  const concat = sorted.map(k => `${k}${params[k]}`).join('');
  return hmacSHA256(secretKey, concat);
}

// ── Flow API calls ───────────────────────────────────────────────────

async function flowCreatePayment(env, order) {
  const params = {
    apiKey: env.FLOW_API_KEY,
    commerceOrder: order.order_number,
    subject: `Ferreteria Ukra - Orden ${order.order_number}`,
    currency: 'CLP',
    amount: String(order.total),
    email: order.customer_email,
    urlConfirmation: `${env.SITE_URL}/api/flow/confirm`,
    urlReturn: `${env.SITE_URL}/api/flow/return`,
  };
  params.s = await flowSign(params, env.FLOW_SECRET_KEY);

  const body = new URLSearchParams(params);
  const res = await fetch(`${FLOW_API}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Flow create error:', res.status, text);
    throw new Error(`Flow ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function flowGetStatus(env, token) {
  const params = { apiKey: env.FLOW_API_KEY, token };
  params.s = await flowSign(params, env.FLOW_SECRET_KEY);

  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FLOW_API}/payment/getStatus?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Flow getStatus error:', res.status, text);
    throw new Error(`Flow getStatus error: ${res.status}`);
  }
  return res.json();
}

// ── Mercado Pago API calls ───────────────────────────────────────────

const MP_STATUS = {
  approved: 'paid', authorized: 'pending', pending: 'pending', in_process: 'pending', in_mediation: 'pending',
  rejected: 'rejected', cancelled: 'cancelled', refunded: 'cancelled', charged_back: 'cancelled',
};
const MP_TYPES = {
  credit_card: 'tarjeta de crédito', debit_card: 'tarjeta de débito', prepaid_card: 'tarjeta prepago',
  account_money: 'dinero en cuenta', bank_transfer: 'transferencia', ticket: 'efectivo', atm: 'cajero',
};

async function mpRequest(env, path, init = {}) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Mercado Pago error:', res.status, path, text.substring(0, 300));
    throw new Error(`Mercado Pago ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}

async function mpCreatePreference(env, order) {
  const lines = order.items.filter(i => i.price > 0);
  const body = {
    items: lines.map(i => ({
      id: String(i.slug).substring(0, 250),
      title: String(i.name).substring(0, 250),
      quantity: Number(i.quantity),
      unit_price: Math.round(Number(i.price)),
      currency_id: 'CLP',
    })),
    payer: { email: order.customer_email, name: order.customer_name },
    external_reference: order.order_number,
    back_urls: {
      success: `${env.SITE_URL}/api/mp/return?r=success`,
      pending: `${env.SITE_URL}/api/mp/return?r=pending`,
      failure: `${env.SITE_URL}/api/mp/return?r=failure`,
    },
    auto_return: 'approved',
    notification_url: `${env.SITE_URL}/api/mp/webhook`,
    statement_descriptor: 'FERRETERIA UKRA',
  };
  return mpRequest(env, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': order.order_number },
    body: JSON.stringify(body),
  });
}

// Reads the payment from Mercado Pago (never trusts query strings or webhook
// bodies) and updates the order. Returns the order status.
async function mpSyncOrder(env, orderNumber, paymentId) {
  await ensureMpColumns(env);
  const order = await env.DB.prepare(`SELECT total, status FROM orders WHERE order_number = ?`).bind(orderNumber).first();
  if (!order) return null;
  let payment = null;
  if (paymentId && /^\d+$/.test(String(paymentId))) {
    try {
      const p = await mpRequest(env, `/v1/payments/${paymentId}`);
      if (p.external_reference === orderNumber) payment = p;
    } catch {}
  }
  if (!payment) {
    const r = await mpRequest(env, `/v1/payments/search?external_reference=${encodeURIComponent(orderNumber)}&sort=date_created&criteria=desc`);
    const list = r.results || [];
    payment = list.find(p => p.status === 'approved') || list[0] || null;
  }
  if (!payment) return order.status;

  let status = MP_STATUS[payment.status] || 'pending';
  if (status === 'paid' && (payment.currency_id !== 'CLP' || Number(payment.transaction_amount) < Number(order.total))) {
    console.error('Mercado Pago amount mismatch', orderNumber, payment.transaction_amount, order.total);
    status = 'pending';
  }
  // A paid order only goes back if the payment was refunded or charged back.
  if (order.status === 'paid' && status !== 'paid' && status !== 'cancelled') status = 'paid';
  const method = `Mercado Pago · ${MP_TYPES[payment.payment_type_id] || payment.payment_type_id || ''}`.replace(/ · $/, '');
  await env.DB.prepare(
    `UPDATE orders SET status = ?, mp_payment_id = ?, payment_method = ?,
       paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END
     WHERE order_number = ?`
  ).bind(status, String(payment.id), method, status, new Date().toISOString(), orderNumber).run();
  return status;
}

// x-signature: "ts=...,v1=..." = HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")
async function mpSignatureValid(request, env, dataId) {
  const sig = request.headers.get('x-signature');
  if (!env.MP_WEBHOOK_SECRET || !sig) return null;
  const parts = Object.fromEntries(sig.split(',').map(p => p.trim().split('=').map(x => (x || '').trim())));
  const reqId = request.headers.get('x-request-id');
  let manifest = '';
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (reqId) manifest += `request-id:${reqId};`;
  if (parts.ts) manifest += `ts:${parts.ts};`;
  return safeEqual(await hmacSHA256(env.MP_WEBHOOK_SECRET, manifest), parts.v1 || '');
}

// ── Route: GET /api/products (public) ───────────────────────────────

async function handleGetProducts(request, env, url) {
  const slug = url.searchParams.get('slug');

  if (slug) {
    // Single product
    const row = await env.DB.prepare(
      `SELECT slug, name, price, image, category, status FROM products WHERE slug = ?`
    ).bind(slug).first();
    if (!row) return err('Producto no encontrado', 404);
    return json(row);
  }

  // All products
  const rows = await env.DB.prepare(
    `SELECT slug, name, price, image, category, status FROM products ORDER BY name`
  ).all();
  return json({ products: rows.results });
}

// ── Route: POST /api/checkout ────────────────────────────────────────

async function handleCheckout(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return err('JSON inválido');
  }

  const { customer_name, customer_email, customer_phone, customer_comuna, customer_address, customer_region, items } = data;
  const gateway = data.payment_method === 'mercadopago' && env.MP_ACCESS_TOKEN ? 'mercadopago' : 'flow';
  if (!customer_name || !customer_email || !Array.isArray(items) || !items.length) {
    return err('Faltan campos obligatorios: nombre, email y productos');
  }
  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    return err('Email inválido');
  }
  // Validate items
  for (const item of items) {
    if (item.slug === 'envio') return err('Producto inválido en el carrito');
    if (!item.name || !item.price || !item.quantity || item.quantity < 1) {
      return err('Producto inválido en el carrito');
    }
  }

  // Validate product availability and get real prices from DB
  const validatedItems = [];
  let total = 0;
  for (const item of items) {
    const dbProduct = await env.DB.prepare(
      `SELECT slug, name, price, status FROM products WHERE slug = ?`
    ).bind(item.slug).first();

    if (dbProduct) {
      if (dbProduct.status !== 'available') {
        return err(`El producto "${dbProduct.name}" no está disponible actualmente`);
      }
      // Use DB price (authoritative)
      validatedItems.push({ ...item, price: dbProduct.price, name: dbProduct.name });
      total += dbProduct.price * item.quantity;
    } else {
      // Product not in DB yet, use submitted price
      validatedItems.push(item);
      total += item.price * item.quantity;
    }
  }

  if (total < 350) { // Flow minimum is 350 CLP
    return err('El monto mínimo de compra es $350 CLP');
  }

  // Shipping from admin settings. Stored as an order line so admin and the
  // order page show it.
  // Digital products don't ship: shipping is computed on physical items only.
  const subtotal = total;
  const physicalItems = validatedItems.filter(i => !isDigital(i.slug));
  const hasDigital = physicalItems.length < validatedItems.length;
  const physicalSubtotal = physicalItems.reduce((s, i) => s + i.price * i.quantity, 0);
  let shipping = 0;
  if (physicalItems.length) {
    shipping = shippingFor(physicalSubtotal, await getShippingSettings(env));
    validatedItems.push({ slug: 'envio', name: shipping ? 'Envío' : 'Envío gratis', price: shipping, quantity: 1 });
  } else {
    validatedItems.push({ slug: 'envio', name: 'Descarga digital (sin envío)', price: 0, quantity: 1 });
  }
  total = subtotal + shipping;

  const order_number = generateOrderNumber();

  // Insert order into D1
  await env.DB.prepare(
    `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_comuna, customer_address, customer_region, products, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    order_number,
    customer_name.trim(),
    customer_email.trim().toLowerCase(),
    (customer_phone || '').trim(),
    (customer_comuna || '').trim(),
    (customer_address || '').trim(),
    (customer_region || '').trim(),
    JSON.stringify(validatedItems),
    total
  ).run();

  if (hasDigital) {
    await ensureDownloadColumns(env);
    await env.DB.prepare(`UPDATE orders SET download_token = ? WHERE order_number = ?`)
      .bind(randomToken(), order_number).run();
  }

  if (gateway === 'mercadopago') {
    await ensureMpColumns(env);
    try {
      const pref = await mpCreatePreference(env, {
        order_number, items: validatedItems,
        customer_email: customer_email.trim().toLowerCase(), customer_name: customer_name.trim(),
      });
      await env.DB.prepare(`UPDATE orders SET gateway = 'mercadopago', mp_preference_id = ? WHERE order_number = ?`)
        .bind(String(pref.id || ''), order_number).run();
      const test = String(env.MP_ACCESS_TOKEN).startsWith('TEST-');
      const paymentUrl = (test && pref.sandbox_init_point) || pref.init_point;
      if (!paymentUrl) throw new Error('sin enlace de pago');
      return json({ paymentUrl, orderNumber: order_number, subtotal, shipping, total });
    } catch (e) {
      console.error('Mercado Pago checkout error:', e);
      await env.DB.prepare(`UPDATE orders SET status = 'error' WHERE order_number = ?`).bind(order_number).run();
      return err('No pudimos abrir Mercado Pago. Intenta de nuevo o paga con Flow.', 502);
    }
  }

  // Create Flow payment
  try {
    const flow = await flowCreatePayment(env, {
      order_number,
      total,
      customer_email: customer_email.trim().toLowerCase(),
    });

    // Save Flow token
    await env.DB.prepare(
      `UPDATE orders SET flow_token = ? WHERE order_number = ?`
    ).bind(flow.token, order_number).run();

    const paymentUrl = `${flow.url}?token=${flow.token}`;
    return json({ paymentUrl, orderNumber: order_number, subtotal, shipping, total });
  } catch (e) {
    console.error('Checkout error:', e);
    // Mark order as failed
    await env.DB.prepare(
      `UPDATE orders SET status = 'error' WHERE order_number = ?`
    ).bind(order_number).run();
    return err(`Error al crear el pago: ${e.message || 'Error desconocido'}. Intenta de nuevo.`, 502);
  }
}

// ── Route: POST /api/flow/confirm (webhook) ──────────────────────────

async function handleFlowConfirm(request, env) {
  let token;
  try {
    const formData = await request.formData();
    token = formData.get('token');
  } catch {
    try {
      const body = await request.json();
      token = body.token;
    } catch {
      return err('Token no recibido', 400);
    }
  }

  if (!token) return err('Token no recibido', 400);

  try {
    const payment = await flowGetStatus(env, token);
    const statusMap = { 1: 'pending', 2: 'paid', 3: 'rejected', 4: 'cancelled' };
    const status = statusMap[payment.status] || 'unknown';

    await env.DB.prepare(
      `UPDATE orders SET status = ?, flow_order = ?, payment_method = ?, paid_at = ?
       WHERE flow_token = ?`
    ).bind(
      status,
      String(payment.flowOrder || ''),
      payment.paymentData?.media || '',
      status === 'paid' ? new Date().toISOString() : null,
      token
    ).run();

    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('Flow confirm error:', e);
    return err('Error procesando confirmación', 500);
  }
}

// ── Route: GET|POST /api/flow/return ────────────────────────────────

async function handleFlowReturn(request, env, url) {
  // Flow may send token via query string (GET) or form body (POST)
  let token = url.searchParams.get('token');
  if (!token && request.method === 'POST') {
    try {
      const form = await request.formData();
      token = form.get('token');
    } catch {
      try { const body = await request.json(); token = body.token; } catch {}
    }
  }
  if (!token) {
    return Response.redirect(`${env.SITE_URL}/orden/?error=no_token`, 302);
  }

  try {
    // Get payment status to ensure order is updated
    const payment = await flowGetStatus(env, token);
    const statusMap = { 1: 'pending', 2: 'paid', 3: 'rejected', 4: 'cancelled' };
    const status = statusMap[payment.status] || 'unknown';

    // Update order
    await env.DB.prepare(
      `UPDATE orders SET status = ?, flow_order = ?, payment_method = ?, paid_at = ?
       WHERE flow_token = ?`
    ).bind(
      status,
      String(payment.flowOrder || ''),
      payment.paymentData?.media || '',
      status === 'paid' ? new Date().toISOString() : null,
      token
    ).run();

    // Find order number (and the private download token for digital products)
    let row;
    try {
      row = await env.DB.prepare(
        `SELECT order_number, download_token FROM orders WHERE flow_token = ?`
      ).bind(token).first();
    } catch {
      row = await env.DB.prepare(
        `SELECT order_number FROM orders WHERE flow_token = ?`
      ).bind(token).first();
    }

    const orderNum = encodeURIComponent(row?.order_number || '');
    const dl = row?.download_token ? `&dl=${row.download_token}` : '';
    return Response.redirect(`${env.SITE_URL}/orden/?order=${orderNum}&status=${status}${dl}`, 302);
  } catch (e) {
    console.error('Flow return error:', e);
    return Response.redirect(`${env.SITE_URL}/orden/?error=payment_error`, 302);
  }
}

// ── Route: GET /api/mp/return (back_urls) ───────────────────────────

async function handleMpReturn(request, env, url) {
  const orderNum = url.searchParams.get('external_reference') || '';
  if (!/^UKRA-\d{8}-[A-Z0-9]{1,8}$/.test(orderNum)) {
    return Response.redirect(`${env.SITE_URL}/orden/?error=no_token`, 302);
  }
  const paymentId = url.searchParams.get('payment_id') || url.searchParams.get('collection_id');
  let status = 'pending';
  try {
    status = (await mpSyncOrder(env, orderNum, paymentId)) || 'pending';
    // Came back from "Volver al sitio" without paying.
    if (status === 'pending' && url.searchParams.get('r') === 'failure' && !/^\d+$/.test(paymentId || '')) {
      await env.DB.prepare(`UPDATE orders SET status = 'cancelled' WHERE order_number = ? AND status = 'pending'`).bind(orderNum).run();
      status = 'cancelled';
    }
  } catch (e) {
    console.error('Mercado Pago return error:', e);
  }
  let row = null;
  try { row = await env.DB.prepare(`SELECT download_token FROM orders WHERE order_number = ?`).bind(orderNum).first(); } catch {}
  const dl = row?.download_token ? `&dl=${row.download_token}` : '';
  return Response.redirect(`${env.SITE_URL}/orden/?order=${encodeURIComponent(orderNum)}&status=${status}${dl}`, 302);
}

// ── Route: POST /api/mp/webhook ─────────────────────────────────────

async function handleMpWebhook(request, env, url) {
  if (!env.MP_ACCESS_TOKEN) return new Response('OK');
  let body = {};
  try { body = await request.json(); } catch {}
  const type = url.searchParams.get('type') || url.searchParams.get('topic') || body.type || body.topic || '';
  const id = url.searchParams.get('data.id') || url.searchParams.get('id') || body.data?.id || '';
  const valid = await mpSignatureValid(request, env, url.searchParams.get('data.id') || body.data?.id);
  if (valid === false) console.warn('Mercado Pago webhook: firma no coincide', type, id);
  // Safe either way: the order is only updated with data read from the API.
  try {
    if (type === 'payment' && /^\d+$/.test(String(id))) {
      const p = await mpRequest(env, `/v1/payments/${id}`);
      if (p.external_reference) await mpSyncOrder(env, p.external_reference, p.id);
    } else if (type === 'merchant_order' && /^\d+$/.test(String(id))) {
      const mo = await mpRequest(env, `/merchant_orders/${id}`);
      if (mo.external_reference) await mpSyncOrder(env, mo.external_reference);
    }
  } catch (e) {
    console.error('Mercado Pago webhook error:', e);
    return new Response('Error', { status: 500 }); // Mercado Pago retries
  }
  return new Response('OK');
}

// ── Route: GET /api/order-status ─────────────────────────────────────

async function handleOrderStatus(request, env, url) {
  const orderNum = url.searchParams.get('order');
  if (!orderNum) return err('Número de orden requerido');

  const row = await env.DB.prepare(
    `SELECT order_number, customer_name, customer_email, products, total, status, created_at, paid_at
     FROM orders WHERE order_number = ?`
  ).bind(orderNum).first();

  if (!row) return err('Orden no encontrada', 404);

  const products = JSON.parse(row.products);
  return json({
    order_number: row.order_number,
    customer_name: row.customer_name,
    has_digital: products.some(p => isDigital(p.slug)),
    has_physical: products.some(p => p.slug !== 'envio' && !isDigital(p.slug)),
    products,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at,
  });
}

// ── Route: GET /api/download (digital products) ─────────────────────

function downloadPage(title, message, status) {
  const html = `<!DOCTYPE html><html lang="es-CL"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Ferretería Ukra</title><style>body{font-family:Inter,system-ui,sans-serif;background:#F8FAFC;color:#0F172A;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:460px;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:28px;text-align:center}h1{font-size:1.25rem}p{color:#475569;line-height:1.6}a{color:#D9381E;font-weight:700}</style></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="https://wa.me/56993514970">Escríbenos por WhatsApp</a> · <a href="/">Volver a la tienda</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleDownload(request, env, url) {
  const orderNum = url.searchParams.get('order') || '';
  const token = url.searchParams.get('token') || '';
  if (!orderNum || !/^[a-f0-9]{48}$/.test(token)) {
    return downloadPage('Enlace no válido', 'El enlace de descarga está incompleto. Usa el enlace de tu página de compra.', 400);
  }
  let row;
  await ensureMpColumns(env);
  try {
    row = await env.DB.prepare(
      `SELECT order_number, products, status, flow_token, gateway, download_token, download_count FROM orders WHERE order_number = ?`
    ).bind(orderNum).first();
  } catch {
    row = null;
  }
  if (!row || !safeEqual(row.download_token || '', token)) {
    return downloadPage('Enlace no válido', 'No encontramos una compra asociada a este enlace.', 404);
  }

  // Payment may still be pending if Flow's confirmation hasn't arrived: re-check it.
  let status = row.status;
  if (status !== 'paid' && row.gateway === 'mercadopago' && env.MP_ACCESS_TOKEN) {
    try { status = (await mpSyncOrder(env, row.order_number)) || status; } catch (e) { console.error('Download MP check error:', e); }
  } else if (status !== 'paid' && row.flow_token) {
    try {
      const payment = await flowGetStatus(env, row.flow_token);
      const statusMap = { 1: 'pending', 2: 'paid', 3: 'rejected', 4: 'cancelled' };
      status = statusMap[payment.status] || status;
      if (status !== row.status) {
        await env.DB.prepare(
          `UPDATE orders SET status = ?, flow_order = ?, payment_method = ?, paid_at = ? WHERE order_number = ?`
        ).bind(status, String(payment.flowOrder || ''), payment.paymentData?.media || '',
          status === 'paid' ? new Date().toISOString() : null, row.order_number).run();
      }
    } catch (e) {
      console.error('Download status check error:', e);
    }
  }
  if (status !== 'paid') {
    return downloadPage('Pago aún no confirmado', 'Tu descarga se habilita apenas se confirme el pago. Vuelve a abrir este enlace en unos minutos.', 403);
  }

  const item = JSON.parse(row.products).find(p => isDigital(p.slug));
  if (!item) return downloadPage('Sin descarga', 'Esta compra no incluye productos digitales.', 404);
  if ((row.download_count || 0) >= MAX_DOWNLOADS) {
    return downloadPage('Límite de descargas', 'Este enlace alcanzó el máximo de descargas. Escríbenos y te habilitamos uno nuevo.', 429);
  }
  const file = await readDigitalFile(env, item.slug);
  if (!file) {
    return downloadPage('Archivo en preparación', 'Tu pago está confirmado, pero el archivo no está disponible en este momento. Escríbenos y te lo enviamos de inmediato.', 503);
  }
  await env.DB.prepare(
    `UPDATE orders SET download_count = COALESCE(download_count, 0) + 1 WHERE order_number = ?`
  ).bind(row.order_number).run();
  return new Response(file.bytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

// ── Admin auth check ─────────────────────────────────────────────────

function checkAdmin(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === env.ADMIN_PASSWORD;
}

// ── Route: GET /api/admin/orders ─────────────────────────────────────

async function handleAdminOrders(request, env, url) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  const status = url.searchParams.get('status') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = 50;
  const offset = (page - 1) * limit;

  let where = '';
  const binds = [];
  if (status !== 'all') {
    where = 'WHERE status = ?';
    binds.push(status);
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM orders ${where}`
  ).bind(...binds).first();

  const cols = `id, order_number, customer_name, customer_email, customer_phone, customer_comuna,
            customer_address, customer_region, products, total, status, flow_order, payment_method, created_at, paid_at`;
  let rows;
  try {
    rows = await env.DB.prepare(
      `SELECT ${cols}, download_token, download_count FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();
  } catch {
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();
  }

  return json({
    orders: rows.results.map(r => ({
      ...r,
      products: JSON.parse(r.products),
      download_url: r.download_token
        ? `${env.SITE_URL}/api/download?order=${encodeURIComponent(r.order_number)}&token=${r.download_token}`
        : null,
    })),
    total: countRow.c,
    page,
    pages: Math.ceil(countRow.c / limit),
  });
}

// ── Routes: GET /api/admin/digital, PUT /api/admin/digital/:slug ─────

async function handleAdminDigitalList(request, env) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);
  await ensureDownloadColumns(env);
  const rows = await env.DB.prepare(`SELECT slug, filename, size, updated_at FROM digital_files`).all();
  const bySlug = Object.fromEntries((rows.results || []).map(r => [r.slug, r]));
  return json({
    files: Object.entries(DIGITAL_PRODUCTS).map(([slug, p]) => ({
      slug, name: p.name, uploaded: !!bySlug[slug],
      size: bySlug[slug]?.size || 0, updated_at: bySlug[slug]?.updated_at || null,
    })),
  });
}

// GET /api/admin/digital/:slug — the admin downloads the file to send it manually
async function handleAdminDigitalDownload(request, env, slug) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);
  if (!isDigital(slug)) return err('Producto digital no encontrado', 404);
  await ensureDownloadColumns(env);
  const file = await readDigitalFile(env, slug);
  if (!file) return err('Este producto aún no tiene archivo cargado', 404);
  return new Response(file.bytes, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

async function handleAdminDigitalUpload(request, env, slug) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);
  if (!isDigital(slug)) return err('Producto digital no encontrado', 404);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return err('Archivo vacío');
  if (buf.length > MAX_FILE) return err('Archivo demasiado grande (máx. 20 MB)');
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return err('El archivo debe ser un .zip');
  await ensureDownloadColumns(env);
  const chunks = Math.ceil(buf.length / FILE_CHUNK);
  const stmts = [
    env.DB.prepare(`DELETE FROM digital_file_chunks WHERE slug = ?`).bind(slug),
  ];
  for (let i = 0; i < chunks; i++) {
    const part = buf.slice(i * FILE_CHUNK, (i + 1) * FILE_CHUNK);
    stmts.push(env.DB.prepare(`INSERT INTO digital_file_chunks (slug, idx, data) VALUES (?, ?, ?)`).bind(slug, i, part.buffer));
  }
  stmts.push(env.DB.prepare(
    `INSERT INTO digital_files (slug, filename, size, chunks, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET filename = excluded.filename, size = excluded.size,
       chunks = excluded.chunks, updated_at = excluded.updated_at`
  ).bind(slug, DIGITAL_PRODUCTS[slug].filename, buf.length, chunks, new Date().toISOString()));
  await env.DB.batch(stmts);
  const check = await readDigitalFile(env, slug);
  if (!check || check.bytes.length !== buf.length) return err('El archivo no se guardó completo. Intenta de nuevo.', 500);
  return json({ slug, size: buf.length, chunks });
}

// ── Route: GET /api/admin/stats ──────────────────────────────────────

async function handleAdminStats(request, env) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  const total = await env.DB.prepare(`SELECT COUNT(*) as c FROM orders`).first();
  const paid = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as revenue FROM orders WHERE status='paid'`).first();
  const pending = await env.DB.prepare(`SELECT COUNT(*) as c FROM orders WHERE status='pending'`).first();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = await env.DB.prepare(
    `SELECT COUNT(*) as c, COALESCE(SUM(total),0) as revenue FROM orders WHERE status='paid' AND paid_at LIKE ?`
  ).bind(`${today}%`).first();

  return json({
    total_orders: total.c,
    paid_orders: paid.c,
    pending_orders: pending.c,
    total_revenue: paid.revenue,
    today_orders: todayOrders.c,
    today_revenue: todayOrders.revenue,
  });
}

// ── Route: GET /api/admin/products ───────────────────────────────────

async function handleAdminProducts(request, env) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  const rows = await env.DB.prepare(
    `SELECT id, slug, name, price, image, category, status, sku, updated_at FROM products ORDER BY name`
  ).all();

  return json({ products: rows.results });
}

// ── Route: PUT /api/admin/products/:slug ─────────────────────────────

async function handleAdminUpdateProduct(request, env, slug) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  let data;
  try {
    data = await request.json();
  } catch {
    return err('JSON inválido');
  }

  // Check product exists
  const existing = await env.DB.prepare(
    `SELECT id FROM products WHERE slug = ?`
  ).bind(slug).first();

  if (!existing) return err('Producto no encontrado', 404);

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (data.price !== undefined) {
    const price = parseInt(data.price);
    if (isNaN(price) || price < 0) return err('Precio inválido');
    updates.push('price = ?');
    values.push(price);
  }

  if (data.status !== undefined) {
    if (!['available', 'agotado', 'no_disponible'].includes(data.status)) {
      return err('Estado inválido. Usar: available, agotado, no_disponible');
    }
    updates.push('status = ?');
    values.push(data.status);
  }

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name.trim());
  }

  if (data.sku !== undefined) {
    updates.push('sku = ?');
    values.push(String(data.sku).trim());
  }

  if (!updates.length) return err('No hay campos para actualizar');

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  values.push(slug);

  await env.DB.prepare(
    `UPDATE products SET ${updates.join(', ')} WHERE slug = ?`
  ).bind(...values).run();

  // Return updated product
  const updated = await env.DB.prepare(
    `SELECT id, slug, name, price, image, category, status, sku, updated_at FROM products WHERE slug = ?`
  ).bind(slug).first();

  dbPriceCache = { map: null, at: 0 }; // static pages pick up the new price right away
  return json(updated);
}

// ── Route: DELETE /api/admin/orders/:id ─────────────────────────────

async function handleAdminDeleteOrder(request, env, orderId) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  const id = parseInt(orderId);
  if (isNaN(id)) return err('ID de orden inválido');

  const existing = await env.DB.prepare(
    `SELECT id, order_number FROM orders WHERE id = ?`
  ).bind(id).first();

  if (!existing) return err('Orden no encontrada', 404);

  await env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(id).run();

  return json({ deleted: true, order_number: existing.order_number });
}

// ── Route: POST /api/admin/products (create) ────────────────────────

async function handleAdminCreateProduct(request, env) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);

  let data;
  try {
    data = await request.json();
  } catch {
    return err('JSON inválido');
  }

  const { slug, name, price, image, category, status, sku } = data;
  if (!slug || !name || !price) {
    return err('Campos obligatorios: slug, name, price');
  }

  // Check slug doesn't already exist
  const existing = await env.DB.prepare(
    `SELECT id FROM products WHERE slug = ?`
  ).bind(slug).first();
  if (existing) return err('Ya existe un producto con ese slug', 409);

  const parsedPrice = parseInt(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) return err('Precio inválido');

  await env.DB.prepare(
    `INSERT INTO products (slug, name, price, image, category, status, sku)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slug.trim(),
    name.trim(),
    parsedPrice,
    (image || '').trim(),
    (category || '').trim(),
    status || 'available',
    String(sku || '').trim()
  ).run();

  const created = await env.DB.prepare(
    `SELECT id, slug, name, price, image, category, status, sku, updated_at FROM products WHERE slug = ?`
  ).bind(slug.trim()).first();

  return json(created, 201);
}

// ── Schema migration + product seed (runs once per isolate) ─────────

const SEED_PRODUCTS = [
  {
    slug: 'cable-libre-halogenos-lsoh-2-5-mm2-100m',
    name: 'Cable Libre de Halógenos H07Z1-K 2,5 mm² Rojo 100 m MADECO',
    price: 89990,
    image: '/producto/cable-libre-halogenos-lsoh-2-5-mm2-100m.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '113214489',
  },
  {
    slug: 'cable-neutro-blanco-2-5-mm2-libre-halogenos-100m',
    name: 'Cable Neutro Blanco 2,5 mm² Libre de Halógenos H07Z1-K 100 m MADECO',
    price: 89990,
    image: '/producto/cable-neutro-blanco-2-5-mm2-libre-halogenos-100m.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '113215940',
  },
  {
    slug: 'cable-tierra-verde-2-5-mm2-libre-halogenos-100m',
    name: 'Cable Tierra Verde 2,5 mm² Libre de Halógenos H07Z1-K 100 m MADECO',
    price: 89990,
    image: '/producto/cable-tierra-verde-2-5-mm2-libre-halogenos-100m.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '113217447',
  },
  {
    slug: 'adaptador-schuko-bipaso-16a-bticino',
    name: 'Adaptador Enchufe Chileno a Schuko Bticino S3625D 16 A',
    price: 22390,
    image: '/producto/adaptador-schuko-bipaso-16a-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110251053',
  },
  {
    slug: 'adaptador-schuko-a-enchufe-chileno-10a',
    name: 'Adaptador Schuko a Enchufe Chileno 10 A Blanco Halux',
    price: 5890,
    image: '/producto/adaptador-schuko-a-enchufe-chileno-10a.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '113360933',
  },
  {
    slug: 'adaptador-enchufe-americano-a-chileno-halux',
    name: 'Adaptador Enchufe Americano a Chileno 10 A Blanco Halux',
    price: 4490,
    image: '/producto/adaptador-enchufe-americano-a-chileno-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222597',
  },
  {
    slug: 'enchufe-triple-salvaespacio-halux',
    name: 'Enchufe Triple Salvaespacio 10 A Blanco Halux',
    price: 7690,
    image: '/producto/enchufe-triple-salvaespacio-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110227676',
  },
  {
    slug: 'adaptador-universal-multinorma-halux',
    name: 'Adaptador Universal Multinorma 10 A Blanco Halux',
    price: 4490,
    image: '/producto/adaptador-universal-multinorma-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223343',
  },
  {
    slug: 'adaptador-schuko-16a-bticino-toma-universal',
    name: 'Adaptador Schuko 16 A Bticino S3624D Toma Universal',
    price: 13290,
    image: '/producto/adaptador-schuko-16a-bticino-toma-universal.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '114482856',
  },
  {
    // Color variant: shares the white page (?color=negro), no separate URL
    slug: 'adaptador-enchufe-americano-a-chileno-halux-negro',
    name: 'Adaptador Enchufe Americano a Chileno 10 A Negro Halux',
    price: 4590,
    image: '/producto/adaptador-enchufe-americano-a-chileno-halux-negro.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110251437',
  },
  {
    slug: 'adaptador-triple-plano-16a-gewiss',
    name: 'Adaptador Triple Plano 16 A Gewiss GW28419 Blanco',
    price: 20990,
    image: '/producto/adaptador-triple-plano-16a-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136951085',
  },
  {
    slug: 'adaptador-triple-schuko-bipaso-halux',
    name: 'Adaptador Triple Schuko con Tomas Bipaso Halux OB1040A',
    price: 5590,
    image: '/producto/adaptador-triple-schuko-bipaso-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '121205296',
  },
  {
    slug: 'enchufe-triple-proteccion-sobrecarga-bticino',
    name: 'Enchufe Triple con Protección de Sobrecarga Bticino Schuko + 2 Bipaso',
    price: 14990,
    image: '/producto/enchufe-triple-proteccion-sobrecarga-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '116275874',
  },
  {
    slug: 'adaptador-proteccion-sobretension-fusible-halux',
    name: 'Adaptador con Protección de Sobretensión y Fusible 10 A Halux',
    price: 6590,
    image: '/producto/adaptador-proteccion-sobretension-fusible-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '133501276',
  },
  {
    slug: 'triple-estandar-3-tomas-con-tierra-halux',
    name: 'Triple Estándar 10 A con 3 Tomas con Tierra Halux',
    price: 3890,
    image: '/producto/triple-estandar-3-tomas-con-tierra-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110264364',
  },
  {
    slug: 'enchufe-triple-2p-t-10a-rema',
    name: 'Enchufe Triple 10 A 2P+T REMA Modelo 9091',
    price: 7990,
    image: '/producto/enchufe-triple-2p-t-10a-rema.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110243364',
  },
  {
    slug: 'enchufe-triple-con-toma-schuko-halux',
    name: 'Enchufe Triple con Toma Schuko 10 A Halux OB1110',
    price: 8990,
    image: '/producto/enchufe-triple-con-toma-schuko-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '121262389',
  },
  {
    slug: 'enchufe-industrial-hembra-16a-2p-t-220v-lexo',
    name: 'Enchufe Industrial Hembra Volante 16 A 2P+T 220 V LEXO',
    price: 6390,
    image: '/producto/enchufe-industrial-hembra-16a-2p-t-220v-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223097',
  },
  {
    slug: 'enchufe-macho-volante-articulado-10a-bticino',
    name: 'Enchufe Macho Volante Articulado 10 A 2P+T Bticino Gris',
    price: 4390,
    image: '/producto/enchufe-macho-volante-articulado-10a-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110254780',
  },
  {
    slug: 'kit-tablero-electrico-monofasico-8-modulos',
    name: 'Kit Tablero Eléctrico Monofásico 8 Módulos',
    price: 51890,
    image: '/producto/kit-tablero-electrico-monofasico-8-modulos.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'KIT-TDA-8M',
  },
  {
    slug: 'kit-tablero-electrico-monofasico-12-modulos',
    name: 'Kit Tablero Eléctrico Monofásico 12 Módulos',
    price: 83790,
    image: '/producto/kit-tablero-electrico-monofasico-12-modulos.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'KIT-TDA-12M',
  },
  {
    slug: 'pack-cuadro-de-cargas-unilineal-checklist-te1',
    name: 'Pack Tablero Eléctrico RIC: Cuadro de Cargas Excel + Unilineal + Checklist TE1',
    price: 9990,
    image: '/producto/pack-cuadro-de-cargas-unilineal-checklist-te1.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-RIC-TDA',
  },
  {
    slug: 'pack-codigo-de-colores-etiquetas-tablero-ric',
    name: 'Pack Identificación Eléctrica RIC: Lámina Código de Colores + Etiquetas + Tabla de Circuitos',
    price: 7990,
    image: '/producto/pack-codigo-de-colores-etiquetas-tablero-ric.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-RIC-COLORES',
  },
  {
    slug: 'pack-calculadora-techo-de-zinc-excel',
    name: 'Pack Calculadora de Techo de Zinc: Excel de Planchas, Cumbreras y Tornillos + Plantilla de Medición',
    price: 7990,
    image: '/producto/pack-calculadora-techo-de-zinc-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-TECHO-ZINC',
  },
  {
    slug: 'pack-calculadora-consumo-soldadora-excel',
    name: 'Pack Calculadora Soldadora: Excel de Consumo, Costo y Circuito + Tabla Rápida + Checklist',
    price: 7990,
    image: '/producto/pack-calculadora-consumo-soldadora-excel.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-SOLDADORA',
  },
  {
    slug: 'pack-soldadura-con-estano-guia-visual-pdf',
    name: 'Pack Soldadura con Estaño: Guía Visual de Defectos + Tabla de Temperaturas + Plan de Práctica + Checklist',
    price: 7990,
    image: '/producto/pack-soldadura-con-estano-guia-visual-pdf.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-ESTANO',
  },
  {
    slug: 'pack-calculadora-de-pastelones-excel',
    name: 'Pack Calculadora de Pastelones: Excel de Piezas, Base, Arena y Fragüe + Plantilla de Medición + Corte de Capas',
    price: 7990,
    image: '/producto/pack-calculadora-de-pastelones-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-PASTELONES',
  },
  {
    slug: 'pack-regularizacion-ley-del-mono-checklist-dom',
    name: 'Pack Regularización Ley del Mono: Evaluador en Excel + Checklist de Documentos + Autoevaluación para la DOM',
    price: 7990,
    image: '/producto/pack-regularizacion-ley-del-mono-checklist-dom.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-LEY-MONO',
  },
  {
    slug: 'pack-calculadora-cemento-y-ladrillos-muro-excel',
    name: 'Pack Calculadora de Cemento para Muros: Excel de Ladrillos, Pega y Estuco + Tabla Rápida + Guía de Mezcla',
    price: 7990,
    image: '/producto/pack-calculadora-cemento-y-ladrillos-muro-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-MURO',
  },
  {
    slug: 'pack-dilucion-acido-muriatico-ladrillo-visto-excel',
    name: 'Pack Limpieza de Ladrillo Visto: Calculadora de Dilución de Ácido Muriático + Tabla Segura + Diagnóstico de Manchas',
    price: 7990,
    image: '/producto/pack-dilucion-acido-muriatico-ladrillo-visto-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-LADRILLO',
  },
  {
    slug: 'pack-comparador-ladrillo-fiscal-princesa-hormigon-celular-excel',
    name: 'Pack Comparador de Ladrillos: Fiscal, Princesa y Hormigón Celular en Excel + Guía de Zonas Térmicas + Checklist',
    price: 7990,
    image: '/producto/pack-comparador-ladrillo-fiscal-princesa-hormigon-celular-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-LADRILLOS',
  },
  {
    slug: 'pack-selector-remaches-pop-excel',
    name: 'Pack Remaches POP: Selector en Excel de Diámetro, Broca y Largo + Tabla de Remaches + Defectos y Checklist',
    price: 7990,
    image: '/producto/pack-selector-remaches-pop-excel.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-REMACHES',
  },
  {
    slug: 'pack-planilla-fosa-septica-test-percolacion-excel',
    name: 'Pack Fosa Séptica: Planilla Excel de Volumen y Dren + Hoja de Test de Percolación + Checklist de Instalación y Mantención',
    price: 7990,
    image: '/producto/pack-planilla-fosa-septica-test-percolacion-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-FOSA',
  },
  {
    slug: 'pack-calculadora-radier-armado-malla-excel',
    name: 'Pack Radier Armado: Calculadora Excel de Hormigón, Malla y Sillas + Guía de Armado + Calendario de Curado',
    price: 7990,
    image: '/producto/pack-calculadora-radier-armado-malla-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-RADIER',
  },
  {
    slug: 'pack-presupuesto-construccion-casa-excel',
    name: 'Pack Presupuesto de Casa: Planilla Excel por Partidas, Cubicación y Flujo de Caja + Checklist de Permisos + Guía para Cotizar',
    price: 7990,
    image: '/producto/pack-presupuesto-construccion-casa-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-CASA',
  },
  {
    slug: 'pack-diagnostico-bomba-agua-no-corta-excel',
    name: 'Pack Bomba que No Corta: Diagnóstico en Excel, Presostato y Tanque Hidroneumático + 6 Pruebas + Guía de Ajuste',
    price: 7990,
    image: '/producto/pack-diagnostico-bomba-agua-no-corta-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-BOMBA',
  },
  {
    slug: 'pack-enchufe-seguro-carga-circuito-excel',
    name: 'Pack Enchufe Seguro: Planilla Excel de Carga del Circuito y Punto Nuevo + Checklist de Conexión + Pruebas y Fallas',
    price: 7990,
    image: '/producto/pack-enchufe-seguro-carga-circuito-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-ENCHUFE',
  },
  {
    slug: 'pack-galpon-metalico-dimensiones-cotizaciones-excel',
    name: 'Pack Galpón Metálico: Planilla Excel de Dimensiones, Cantidades y Costo + Comparador de Cotizaciones + Checklist de Obra',
    price: 7990,
    image: '/producto/pack-galpon-metalico-dimensiones-cotizaciones-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-GALPON',
  },
  {
    slug: 'pack-revision-enchufes-fase-neutro-tierra-excel',
    name: 'Pack Fase y Neutro: Planilla Excel de Revisión de Enchufes con Diagnóstico + Guía de Medición + Hoja de Terreno',
    price: 7990,
    image: '/producto/pack-revision-enchufes-fase-neutro-tierra-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-FASE',
  },
  {
    slug: 'pack-calculadora-tabique-metalcon-excel',
    name: 'Pack Tabique Metalcon: Calculadora Excel de Canales, Montantes, Placas y Presupuesto + Guía de Armado + Despiece y Hoja de Terreno',
    price: 7990,
    image: '/producto/pack-calculadora-tabique-metalcon-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-TABIQUE',
  },
  {
    slug: 'pack-ducha-electrica-circuito-seguro-excel',
    name: 'Pack Ducha Eléctrica: Calculadora Excel de Cable, Automático, Caída de Tensión y Consumo + Guía de Instalación + Diagnóstico de Fallas',
    price: 7990,
    image: '/producto/pack-ducha-electrica-circuito-seguro-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-DUCHA',
  },
  {
    slug: 'pack-hongos-humedad-diagnostico-repintado-excel',
    name: 'Pack Hongos y Humedad: Planilla Excel de Diagnóstico, Registro de Humedad y Materiales de Repintado + Protocolo de Limpieza + Hoja de Terreno',
    price: 7990,
    image: '/producto/pack-hongos-humedad-diagnostico-repintado-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-HONGOS',
  },
  {
    slug: 'pack-muro-contencion-drenaje-supervision-excel',
    name: 'Pack Muro de Contención: Planilla Excel de Empuje, Cubicación y Comparador de Cotizaciones + Checklist de Supervisión + Inspección',
    price: 7990,
    image: '/producto/pack-muro-contencion-drenaje-supervision-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-MURO',
  },
  {
    slug: 'pack-impermeabilizacion-radier-capilaridad-excel',
    name: 'Pack Radier sin Humedad: Calculadora Excel de Barreras contra Capilaridad, Presupuesto y Secado + Checklist de Obra + Diagnóstico y Retrofit',
    price: 7990,
    image: '/producto/pack-impermeabilizacion-radier-capilaridad-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-CAPILAR',
  },
  {
    slug: 'pack-goteras-techo-zinc-reparacion-mantencion-excel',
    name: 'Pack Goteras en Techo de Zinc: Planilla Excel de Mapa de Daños, Materiales, Reparar o Cambiar y Mantención + Guía de Reparación + Hoja de Inspección',
    price: 7990,
    image: '/producto/pack-goteras-techo-zinc-reparacion-mantencion-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-GOTERAS',
  },
  {
    slug: 'pack-tablero-transferencia-ats-generador-excel',
    name: 'Pack Tablero ATS: Planilla Excel de Cargas, Generador, ATS, Cable y Combustible + Checklist de Puesta en Marcha + Mantención y Registro',
    price: 7990,
    image: '/producto/pack-tablero-transferencia-ats-generador-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-ATS',
  },
  {
    slug: 'pack-tornillos-para-madera-calculadora-excel',
    name: 'Pack Tornillos para Madera: Calculadora Excel de Largo, Broca y Material + Guía de Selección + Tabla de Largos y Checklist de Taller',
    price: 7990,
    image: '/producto/pack-tornillos-para-madera-calculadora-excel.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-TORNILLOS',
  },
  {
    slug: 'pack-calefont-no-enciende-diagnostico-mantencion-excel',
    name: 'Pack Calefont: Planilla Excel de Diagnóstico por Síntoma, Reparar o Reemplazar y Presión de Agua + Diagnóstico Paso a Paso + Mantención y Seguridad',
    price: 7990,
    image: '/producto/pack-calefont-no-enciende-diagnostico-mantencion-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-CALEFONT',
  },
  {
    slug: 'pack-malla-raschel-calculadora-estructura-excel',
    name: 'Pack Malla Raschel: Calculadora Excel de Malla, Postes, Cable y Presupuesto + Instalación Paso a Paso + Lista de Compra y Mantención',
    price: 7990,
    image: '/producto/pack-malla-raschel-calculadora-estructura-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-RASCHEL',
  },
  {
    slug: 'pack-ruido-bomba-agua-diagnostico-succion-excel',
    name: 'Pack Ruido en Bomba de Agua: Planilla Excel de Diagnóstico por Sonido, Succión (NPSH) y Tanque Hidroneumático + Diagnóstico por Sonido + Succión, Tanque y Montaje',
    price: 7990,
    image: '/producto/pack-ruido-bomba-agua-diagnostico-succion-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-RUIDO-BOMBA',
  },
  {
    slug: 'pack-luces-led-interior-auto-fusible-excel',
    name: 'Pack Luces LED Interior del Auto: Calculadora Excel de Consumo, Fusible, Cable y Batería + Instalación Paso a Paso + Checklist y Solución de Problemas',
    price: 7990,
    image: '/producto/pack-luces-led-interior-auto-fusible-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-LED-AUTO',
  },
  {
    slug: 'pack-llave-de-paso-instalacion-materiales-excel',
    name: 'Pack Llave de Paso: Planilla Excel de Selección, Materiales y Medida de Corte + Instalación Paso a Paso + Mapa de Llaves de la Casa',
    price: 7990,
    image: '/producto/pack-llave-de-paso-instalacion-materiales-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-LLAVE-PASO',
  },
  {
    slug: 'pack-destapar-canerias-diagnostico-mantencion-excel',
    name: 'Pack Destape de Cañerías: Planilla Excel de Diagnóstico por Artefacto, Seguridad de Químicos y Registro + Guía Paso a Paso + Rutina Preventiva',
    price: 7990,
    image: '/producto/pack-destapar-canerias-diagnostico-mantencion-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-DESTAPE',
  },
  {
    slug: 'pack-instalar-calefont-litros-tiro-cotizacion-excel',
    name: 'Pack Instalar Calefont: Planilla Excel de Litros, Tipo de Tiro, Consumo de Gas y Cotizaciones + Guía para Elegir y Cotizar + Checklist de Recepción',
    price: 7990,
    image: '/producto/pack-instalar-calefont-litros-tiro-cotizacion-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-CALEFONT-INST',
  },
  {
    slug: 'pack-puesta-a-tierra-diagnostico-medicion-excel',
    name: 'Pack Puesta a Tierra: Planilla Excel de Autodiagnóstico, Revisión de Enchufes, Estimador de Resistencia y Registro de Mediciones + Guía Visual + Checklist de Medición',
    price: 7990,
    image: '/producto/pack-puesta-a-tierra-diagnostico-medicion-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-TIERRA',
  },
  {
    slug: 'pack-membrana-asfaltica-techo-materiales-excel',
    name: 'Pack Membrana Asfáltica: Planilla Excel de Tipo, Materiales por Sector, Pendiente y Presupuesto + Paso a Paso + Checklist de Control y Mantención',
    price: 7990,
    image: '/producto/pack-membrana-asfaltica-techo-materiales-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-MEMBRANA',
  },
  {
    slug: 'pack-termofusion-ppr-tiempos-materiales-excel',
    name: 'Pack Termofusión PPR: Planilla Excel de Tiempos, Tubería y Dilatación, Materiales y Prueba de Presión + Tarjeta de Obra + Control antes de Tabicar',
    price: 7990,
    image: '/producto/pack-termofusion-ppr-tiempos-materiales-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-PPR',
  },
  {
    slug: 'pack-cubierta-cocina-material-medicion-excel',
    name: 'Pack Cubierta de Cocina: Planilla Excel para Elegir Material, Medir el Mesón y Comparar Cotizaciones + Guía de Decisión + Checklist de Instalación y Mantención',
    price: 7990,
    image: '/producto/pack-cubierta-cocina-material-medicion-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-CUBIERTA',
  },
  {
    slug: 'pack-grosor-cable-extension-seccion-caida-excel',
    name: 'Pack Grosor de Cable para Extensión: Planilla Excel de Sección por Corriente y Caída de Tensión, Enchufe y Tipo de Cordón + Tabla Rápida + Armar y Revisar una Extensión',
    price: 7990,
    image: '/producto/pack-grosor-cable-extension-seccion-caida-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-EXTENSION',
  },
  {
    slug: 'pack-extractor-aire-bano-cocina-caudal-excel',
    name: 'Pack Extractor de Aire: Planilla Excel de Caudal y Ducto, Ubicación Segura (RIC N°11), Materiales y Diagnóstico + Guía de Obra + Diagnóstico y Mantención',
    price: 7990,
    image: '/producto/pack-extractor-aire-bano-cocina-caudal-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-EXTRACTOR',
  },
  {
    slug: 'pack-ascensor-salvaescaleras-elegir-cotizar-excel',
    name: 'Pack Ascensor y Salvaescaleras: Planilla Excel para Elegir la Solución, Medir, Comparar Cotizaciones, Costo de Uso y Trámites + Guía de Decisión + Trámites y Mantención',
    price: 7990,
    image: '/producto/pack-ascensor-salvaescaleras-elegir-cotizar-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-ASCENSOR',
  },
  {
    slug: 'pack-quincho-parrilla-dimensiones-materiales-excel',
    name: 'Pack Quincho con Parrilla: Planilla Excel de Dimensiones, Tiraje del Conducto, Ladrillos, Radier, Cubierta y Presupuesto + Guía de Diseño + Checklist de Obra y Permisos',
    price: 7990,
    image: '/producto/pack-quincho-parrilla-dimensiones-materiales-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-QUINCHO',
  },
  {
    slug: 'pack-ventanas-termopanel-medicion-valor-u-excel',
    name: 'Pack Ventanas Termopanel: Planilla Excel de Medición de Vanos, Valor U de la Ventana Completa, Condensación y Cotizaciones + Guía de Compra + Hoja de Medición e Instalación',
    price: 7990,
    image: '/producto/pack-ventanas-termopanel-medicion-valor-u-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-TERMOPANEL',
  },
  {
    slug: 'pack-pasto-natural-siembra-semilla-riego-excel',
    name: 'Pack Pasto Natural: Planilla Excel de Semilla, Tierra y Fertilizante por Zona, Semilla vs Rollo, Plan de Riego y Registro de Siembra + Guía de Siembra + Plan de 6 Semanas',
    price: 7990,
    image: '/producto/pack-pasto-natural-siembra-semilla-riego-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-PASTO',
  },
  {
    slug: 'pack-melamina-15-18-mm-repisas-despiece-excel',
    name: 'Pack Melamina 15 o 18 mm: Planilla Excel de Flecha de Repisas, Despiece, Planchas y Tapacanto, y Margen para Tornillos + Guía de Espesores + Hoja de Despiece',
    price: 7990,
    image: '/producto/pack-melamina-15-18-mm-repisas-despiece-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-MELAMINA',
  },
  {
    slug: 'pack-termo-electrico-litros-circuito-instalacion-excel',
    name: 'Pack Termo Eléctrico: Planilla Excel de Litros, Horas de Calentamiento y Costo Mensual, Peso y Fijación, Circuito, Checklist de Instalación y Mantención + Guía de Instalación + Puesta en Marcha',
    price: 7990,
    image: '/producto/pack-termo-electrico-litros-circuito-instalacion-excel.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: 'PACK-TERMO',
  },
  {
    slug: 'pack-aumento-potencia-empalme-demanda-tramite-excel',
    name: 'Pack Aumento de Potencia: Planilla Excel de Demanda Simultánea, Empalme y Tarifa BT1, Alternativas, Trámite y Presupuesto + Guía Rápida + Checklist del Trámite',
    price: 7990,
    image: '/producto/pack-aumento-potencia-empalme-demanda-tramite-excel.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: 'PACK-EMPALME',
  },
  {
    slug: 'pack-mascara-de-soldar-din-comparador-checklist-excel',
    name: 'Pack Máscara de Soldar: Planilla Excel de DIN por Proceso y Amperaje, Comparador de Caretas, Costo de Uso y Checklist + Guía para Elegir + Checklist Diario',
    price: 7990,
    image: '/producto/pack-mascara-de-soldar-din-comparador-checklist-excel.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-CARETA',
  },
  {
    slug: 'pack-puerta-blindada-clase-rc-cotizaciones-excel',
    name: 'Pack Puerta Blindada: Planilla Excel de Clase RC, Medición del Vano, Comparación de Cotizaciones, Recepción y Mantención + Guía de Compra + Hoja de Medición y Recepción',
    price: 7990,
    image: '/producto/pack-puerta-blindada-clase-rc-cotizaciones-excel.webp',
    category: 'Construcción',
    status: 'available',
    sku: 'PACK-PUERTA',
  },
  {
    slug: 'pack-regular-mascara-fotosensible-ajuste-diagnostico-excel',
    name: 'Pack Regular Máscara Fotosensible: Planilla Excel de Ajuste por Trabajo (DIN, Sensibilidad y Retardo), Diagnóstico de Fallas y Registro + Tarjeta de Ajustes + Prueba Diaria',
    price: 7990,
    image: '/producto/pack-regular-mascara-fotosensible-ajuste-diagnostico-excel.webp',
    category: 'Herramientas',
    status: 'available',
    sku: 'PACK-REGULAR-CARETA',
  },
  {
    slug: 'llave-de-paso-1-2-so-bronce-stretto',
    name: 'Llave de paso 1/2 pulgada SO bronce para soldar Stretto',
    price: 7990,
    image: '/producto/llave-de-paso-1-2-so-bronce-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110233967',
  },
  {
    slug: 'regulador-gas-licuado-3-8-hasta-15-kg-cemco',
    name: 'Regulador de gas licuado 3/8" GLP para cilindros hasta 15 kg Cemco',
    price: 18990,
    image: '/producto/regulador-gas-licuado-3-8-hasta-15-kg-cemco.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110288439',
  },
  {
    slug: 'llave-de-paso-1-2-he-bronce-nibsa',
    name: 'Llave de paso 1/2 pulgada HE-HI bronce Nibsa',
    price: 9990,
    image: '/producto/llave-de-paso-1-2-he-bronce-nibsa.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110267183',
  },
  {
    slug: 'llave-de-paso-gas-1-2-hi-he-bronce-nibsa',
    name: 'Llave de paso para gas 1/2 pulgada HI-HE bronce Nibsa',
    price: 12990,
    image: '/producto/llave-de-paso-gas-1-2-hi-he-bronce-nibsa.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110220499',
  },
  {
    slug: 'llave-de-jardin-1-2-he-bronce-stretto',
    name: 'Llave de jardín 1/2 pulgada HE bronce Stretto',
    price: 6990,
    image: '/producto/llave-de-jardin-1-2-he-bronce-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110269929',
  },
  {
    slug: 'valvula-bola-paso-estandar-1-2-genebre',
    name: 'Válvula de bola paso estándar 1/2 pulgada Genebre',
    price: 8990,
    image: '/producto/valvula-bola-paso-estandar-1-2-genebre.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110219742',
  },
  {
    slug: 'regulador-gas-alta-presion-45-kg-providus',
    name: 'Regulador de gas licuado dos etapas para cilindros de 45 kg Providus',
    price: 54990,
    image: '/producto/regulador-gas-alta-presion-45-kg-providus.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110289362',
  },
  {
    slug: 'llave-de-paso-1-2-so-bronce-humboldt',
    name: 'Llave de paso 1/2 pulgada SO bronce para soldar Humboldt',
    price: 3990,
    image: '/producto/llave-de-paso-1-2-so-bronce-humboldt.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110261487',
  },
  {
    slug: 'valvula-bola-1-hi-simple-union-pvc-nm-duke',
    name: 'Válvula de bola 1 pulgada HI simple unión PVC NM Duke',
    price: 7990,
    image: '/producto/valvula-bola-1-hi-simple-union-pvc-nm-duke.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110234649',
  },
  {
    slug: 'valvula-compuerta-1-2-hi-bronce-pn10-stretto',
    name: 'Válvula compuerta 1/2 pulgada HI bronce PN10 Stretto',
    price: 6990,
    image: '/producto/valvula-compuerta-1-2-hi-bronce-pn10-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110229651',
  },
  {
    slug: 'valvula-de-retencion-1-hi-laton-dura',
    name: 'Válvula de retención 1 pulgada HI latón resorte Dura',
    price: 17990,
    image: '/producto/valvula-de-retencion-1-hi-laton-dura.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110273431',
  },
  {
    slug: 'adaptador-universal-con-usb-dairu',
    name: 'Adaptador universal con USB Dairu',
    price: 11990,
    image: '/producto/adaptador-universal-con-usb-dairu.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '126865335',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-10-a-negro-gewiss',
    name: 'Enchufe macho volante 2p+t 10 A Negro Gewiss',
    price: 3990,
    image: '/producto/enchufe-macho-volante-2p-t-10-a-negro-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216339',
  },
  {
    slug: 'macho-volante-convertible-2p-t-gris-halux',
    name: 'Macho volante convertible 2P+T gris Halux',
    price: 3990,
    image: '/producto/macho-volante-convertible-2p-t-gris-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '122299145',
  },
  {
    slug: 'triple-salvaespacio-halux',
    name: 'Triple salvaespacio Halux',
    price: 5990,
    image: '/producto/triple-salvaespacio-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110272869',
  },
  {
    slug: 'enchufe-macho-volante-articulado-2p-t-16-a-gris-bt',
    name: 'Enchufe macho volante articulado 2p+t 16 A Gris Bticino',
    price: 9990,
    image: '/producto/enchufe-macho-volante-articulado-2p-t-16-a-gris-bt.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237627',
  },
  {
    slug: 'derivador-para-enchufe-3-hembras-16a-220v-lexo',
    name: 'Derivador Para Enchufe 3 Hembras 16A 220V Lexo',
    price: 10990,
    image: '/producto/derivador-para-enchufe-3-hembras-16a-220v-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142665332',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-16-a-negro-gewiss',
    name: 'Enchufe macho volante 2p+t 16 A Negro Gewiss',
    price: 4990,
    image: '/producto/enchufe-macho-volante-2p-t-16-a-negro-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237477',
  },
  {
    slug: 'adaptador-industrial-ip44-2x-2p-t-10-16a-250v-lexo',
    name: 'Adaptador industrial IP44 2X 2P+T 10/16A 250V Lexo',
    price: 22990,
    image: '/producto/adaptador-industrial-ip44-2x-2p-t-10-16a-250v-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642046',
  },
  {
    slug: 'macho-volante-convertible-2p-t-blanco-halux',
    name: 'Macho volante convertible 2P+T blanco Halux',
    price: 3990,
    image: '/producto/macho-volante-convertible-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '122299139',
  },
  {
    slug: 'alargador-4-tomas-sin-cable-halux',
    name: 'Alargador 4 tomas sin cable Halux',
    price: 11990,
    image: '/producto/alargador-4-tomas-sin-cable-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222831',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-16-a-gris-bticino',
    name: 'Enchufe hembra volante 2p+t 16 A Gris Bticino',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-2p-t-16-a-gris-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110253367',
  },
  {
    slug: 'enchufe-volante-2p-t-16a-legrand',
    name: 'Enchufe Volante 2P + T 16A Legrand',
    price: 17990,
    image: '/producto/enchufe-volante-2p-t-16a-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110265848',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-10-a-16-a-negro-gewiss',
    name: 'Enchufe hembra volante 2p+t 10 a 16 A Negro Gewiss',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-2p-t-10-a-16-a-negro-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110253218',
  },
  {
    slug: 'hembra-embutida-industrial-2p-t-16a-220v-ip44-legr',
    name: 'Hembra embutida industrial 2P+T 16A/220V IP44 Legrand',
    price: 20990,
    image: '/producto/hembra-embutida-industrial-2p-t-16a-220v-ip44-legr.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137113207',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-negro-halux',
    name: 'Enchufe hembra volante 2p+t Negro Halux',
    price: 2990,
    image: '/producto/enchufe-hembra-volante-2p-t-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110217467',
  },
  {
    slug: 'enchufe-industrial-macho-volante-16-a-2p-t-220v-le',
    name: 'Enchufe industrial macho volante 16 A 2p+t 220V Legrand',
    price: 17990,
    image: '/producto/enchufe-industrial-macho-volante-16-a-2p-t-220v-le.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110249466',
  },
  {
    slug: 'adaptador-industrial-ip44-3x-2p-t-10-16a-250v-lexo',
    name: 'Adaptador industrial IP44 3X 2P+T 10/16A 250V Lexo',
    price: 14990,
    image: '/producto/adaptador-industrial-ip44-3x-2p-t-10-16a-250v-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642094',
  },
  {
    slug: 'enchufe-industrial-macho-volante-ip44-32a-380v-3p',
    name: 'Enchufe industrial macho volante IP44, 32A, 380V, 3P+N+T Lexo',
    price: 7990,
    image: '/producto/enchufe-industrial-macho-volante-ip44-32a-380v-3p.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642042',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-10-a-negro-gewiss',
    name: 'Enchufe hembra volante 2p+t 10 A Negro Gewiss',
    price: 4990,
    image: '/producto/enchufe-hembra-volante-2p-t-10-a-negro-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263348',
  },
  {
    slug: 'enchufe-industrial-macho-volante-16-a-2p-t-220v-ip',
    name: 'Enchufe industrial macho volante 16 A 2P+T 220V IP44 Lexo',
    price: 4990,
    image: '/producto/enchufe-industrial-macho-volante-16-a-2p-t-220v-ip.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110244588',
  },
  {
    slug: 'enchufe-macho-volante-10a-blanco-convertible-salva',
    name: 'Enchufe macho volante 10A Blanco Convertible Salvaespacio Bticino',
    price: 6990,
    image: '/producto/enchufe-macho-volante-10a-blanco-convertible-salva.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137185518',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-10-a-negro-bticino',
    name: 'Enchufe macho volante 2p+t 10 A Negro Bticino',
    price: 6990,
    image: '/producto/enchufe-macho-volante-2p-t-10-a-negro-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110243573',
  },
  {
    slug: 'enchufe-macho-volante-schuko-16a-2p-t-blanco-halux',
    name: 'Enchufe macho volante schuko 16A 2P+T Blanco Halux Halux',
    price: 5990,
    image: '/producto/enchufe-macho-volante-schuko-16a-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135767716',
  },
  {
    slug: 'adaptador-triple-2p-t-10-a-blanco-bticino',
    name: 'Adaptador triple 2p+t 10 A blanco Bticino',
    price: 11990,
    image: '/producto/adaptador-triple-2p-t-10-a-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110254071',
  },
  {
    slug: 'enchufe-macho-volante-2p-negro-halux',
    name: 'Enchufe macho volante 2P negro Halux',
    price: 2990,
    image: '/producto/enchufe-macho-volante-2p-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110230497',
  },
  {
    slug: 'enchufe-macho-volante-schuko-16a-2p-t-negro-halux',
    name: 'Enchufe macho volante schuko 16A 2P+T Negro Halux Halux',
    price: 5990,
    image: '/producto/enchufe-macho-volante-schuko-16a-2p-t-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135792899',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-10-a-16-a-blanco-gewis',
    name: 'Enchufe hembra volante 2p+t 10 a 16 A Blanco Gewiss',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-2p-t-10-a-16-a-blanco-gewis.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263271',
  },
  {
    slug: 'enchufe-industrial-macho-volante-32-a-2p-t-220v-ip',
    name: 'Enchufe industrial macho volante 32 A 2P+T 220V IP44 Lexo',
    price: 8990,
    image: '/producto/enchufe-industrial-macho-volante-32-a-2p-t-220v-ip.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110221878',
  },
  {
    slug: 'macho-embutida-industrial-3p-t-32a-380v-ip44-legra',
    name: 'Macho embutida industrial 3P+T 32A/380V IP44 Legrand',
    price: 14990,
    image: '/producto/macho-embutida-industrial-3p-t-32a-380v-ip44-legra.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136992122',
  },
  {
    slug: 'macho-embutida-industrial-2p-t-32a-220v-ip44-legra',
    name: 'Macho embutida industrial 2P+T 32A/220V IP44 Legrand',
    price: 10990,
    image: '/producto/macho-embutida-industrial-2p-t-32a-220v-ip44-legra.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137113203',
  },
  {
    slug: 'hembra-embutida-industrial-3p-t-32a-380v-ip44-legr',
    name: 'Hembra embutida industrial 3P+T 32A/380V IP44 Legrand',
    price: 13990,
    image: '/producto/hembra-embutida-industrial-3p-t-32a-380v-ip44-legr.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137521384',
  },
  {
    slug: 'enchufe-macho-volante-profesional-2p-10a-gris-btic',
    name: 'Enchufe macho volante profesional 2P 10A Gris Bticino',
    price: 7990,
    image: '/producto/enchufe-macho-volante-profesional-2p-10a-gris-btic.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137185516',
  },
  {
    slug: 'enchufe-industrial-hembra-volante-ip67-16a-220v-2p',
    name: 'Enchufe industrial hembra volante IP67, 16A, 220V, 2P+T Lexo',
    price: 8990,
    image: '/producto/enchufe-industrial-hembra-volante-ip67-16a-220v-2p.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642098',
  },
  {
    slug: 'modulo-interruptor-9-24-10-a-blanco-karson',
    name: 'Módulo interruptor 9/24 10 A Blanco Karson',
    price: 1990,
    image: '/producto/modulo-interruptor-9-24-10-a-blanco-karson.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237515',
  },
  {
    slug: 'enchufe-hembra-volante-10a-blanco-bticino',
    name: 'Enchufe hembra volante 10A blanco Bticino',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-10a-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '137185520',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-10-a-gris-bticino',
    name: 'Enchufe macho volante 2p+t 10 A Gris Bticino',
    price: 8990,
    image: '/producto/enchufe-macho-volante-2p-t-10-a-gris-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110227960',
  },
  {
    slug: 'enchufe-hembra-volante-10-16a-2p-t-blanco-halux',
    name: 'Enchufe hembra volante 10/16A 2P+T Blanco Halux Halux',
    price: 3990,
    image: '/producto/enchufe-hembra-volante-10-16a-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135792853',
  },
  {
    slug: 'enchufe-macho-volante-schuko-2p-t-16-a-negro-btici',
    name: 'Enchufe macho volante schuko 2p+t 16 A Negro Bticino',
    price: 32990,
    image: '/producto/enchufe-macho-volante-schuko-2p-t-16-a-negro-btici.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110255941',
  },
  {
    slug: 'modulo-interruptor-9-12-10-a-blanco-karson',
    name: 'Módulo interruptor 9/12 10 A Blanco Karson',
    price: 1990,
    image: '/producto/modulo-interruptor-9-12-10-a-blanco-karson.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110245915',
  },
  {
    slug: 'enchufe-industrial-hembra-volante-ip44-32a-380v-3p',
    name: 'Enchufe industrial hembra volante IP44, 32A, 380V, 3P+N+T Lexo',
    price: 7990,
    image: '/producto/enchufe-industrial-hembra-volante-ip44-32a-380v-3p.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642044',
  },
  {
    slug: 'enchufe-tipo-wifi-smart-nexxt-solutions',
    name: 'Enchufe tipo wifi smart Nexxt Solutions',
    price: 12990,
    image: '/producto/enchufe-tipo-wifi-smart-nexxt-solutions.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110218105',
  },
  {
    slug: 'triple-estandar-halux',
    name: 'Triple estandar Halux',
    price: 3990,
    image: '/producto/triple-estandar-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110271792',
  },
  {
    slug: 'enchufe-industrial-macho-volante-32-a-3p-t-380v-ip',
    name: 'Enchufe industrial macho volante 32 A 3P+T 380V IP44 Lexo',
    price: 10990,
    image: '/producto/enchufe-industrial-macho-volante-32-a-3p-t-380v-ip.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110242928',
  },
  {
    slug: 'enchufe-macho-volante-2p-blanco-halux',
    name: 'Enchufe macho volante 2P blanco Halux',
    price: 1990,
    image: '/producto/enchufe-macho-volante-2p-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110245416',
  },
  {
    slug: 'enchufe-hembra-volante-32a-3p-t-lexo',
    name: 'Enchufe Hembra volante 32A 3P + T Lexo',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-32a-3p-t-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216965',
  },
  {
    slug: 'enchufe-hembra-volante-10-16a-2p-t-negro-halux',
    name: 'Enchufe hembra volante 10/16A 2P+T Negro Halux Halux',
    price: 3990,
    image: '/producto/enchufe-hembra-volante-10-16a-2p-t-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135833115',
  },
  {
    slug: 'tomacorriente-10-a-blanco-halux',
    name: 'Tomacorriente 10 A Blanco Halux',
    price: 23990,
    image: '/producto/tomacorriente-10-a-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216942',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-16-a-gewiss',
    name: 'Enchufe macho volante 2p+t 16 A Gewiss',
    price: 4990,
    image: '/producto/enchufe-macho-volante-2p-t-16-a-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263690',
  },
  {
    slug: 'enchufe-macho-volante-16a-lexo',
    name: 'Enchufe Macho volante 16A Lexo',
    price: 6990,
    image: '/producto/enchufe-macho-volante-16a-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110251770',
  },
  {
    slug: 'enchufe-macho-volante-16a-2p-t-blanco-halux',
    name: 'Enchufe macho volante 16A 2P+T Blanco Halux',
    price: 3990,
    image: '/producto/enchufe-macho-volante-16a-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135792839',
  },
  {
    slug: 'enchufe-industrial-macho-volante-ip67-16a-220v-2p',
    name: 'Enchufe industrial macho volante IP67, 16A, 220V, 2P+T Lexo',
    price: 7990,
    image: '/producto/enchufe-industrial-macho-volante-ip67-16a-220v-2p.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642096',
  },
  {
    slug: 'interruptor-pulsador-10-a-clio-blanco-halux',
    name: 'Interruptor pulsador 10 A Clio Blanco Halux',
    price: 3990,
    image: '/producto/interruptor-pulsador-10-a-clio-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110250640',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-negro-halux',
    name: 'Enchufe macho volante 2P+T negro Halux',
    price: 2990,
    image: '/producto/enchufe-macho-volante-2p-t-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110264141',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-blanco-halux',
    name: 'Enchufe macho volante 2P+T blanco Halux',
    price: 3990,
    image: '/producto/enchufe-macho-volante-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110230579',
  },
  {
    slug: 'adaptador-10-16-blanco-rema',
    name: 'Adaptador 10/16 blanco Rema',
    price: 12990,
    image: '/producto/adaptador-10-16-blanco-rema.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '116035908',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-10-a-blanco-gewiss',
    name: 'Enchufe hembra volante 2p+t 10 A Blanco Gewiss',
    price: 5990,
    image: '/producto/enchufe-hembra-volante-2p-t-10-a-blanco-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110241151',
  },
  {
    slug: 'macho-volante-convertible-2p-gris-halux',
    name: 'Macho volante convertible 2P gris Halux',
    price: 2990,
    image: '/producto/macho-volante-convertible-2p-gris-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '122850049',
  },
  {
    slug: 'enchufe-industrial-hembra-volante-ip44-16a-380v-3p',
    name: 'Enchufe industrial hembra volante IP44, 16A, 380V, 3P+T Lexo',
    price: 7990,
    image: '/producto/enchufe-industrial-hembra-volante-ip44-16a-380v-3p.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136642040',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-10-a-gris-bticino',
    name: 'Enchufe hembra volante 2p+t 10 A Gris Bticino',
    price: 7990,
    image: '/producto/enchufe-hembra-volante-2p-t-10-a-gris-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237559',
  },
  {
    slug: 'adaptador-10-16-negro-rema',
    name: 'Adaptador 10/16 negro Rema',
    price: 9990,
    image: '/producto/adaptador-10-16-negro-rema.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '116035731',
  },
  {
    slug: 'enchufe-macho-volante-16a-2p-t-negro-halux',
    name: 'Enchufe macho volante 16A 2P+T Negro Halux',
    price: 3990,
    image: '/producto/enchufe-macho-volante-16a-2p-t-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '135833129',
  },
  {
    slug: 'enchufe-macho-volante-2p-t-10-a-blanco-gewiss',
    name: 'Enchufe macho volante 2p+t 10 A Blanco Gewiss',
    price: 3990,
    image: '/producto/enchufe-macho-volante-2p-t-10-a-blanco-gewiss.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263513',
  },
  {
    slug: 'enchufe-industrial-hembra-volante-32-a-2p-t-220v-l',
    name: 'Enchufe industrial hembra volante 32 A 2P+T 220V Lexo',
    price: 6990,
    image: '/producto/enchufe-industrial-hembra-volante-32-a-2p-t-220v-l.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110245000',
  },
  {
    slug: 'macho-volante-convertible-2p-blanco-halux',
    name: 'Macho volante convertible 2P blanco Halux',
    price: 2990,
    image: '/producto/macho-volante-convertible-2p-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '122850046',
  },
  {
    slug: 'enchufe-hembra-volante-2p-t-blanco-halux',
    name: 'Enchufe hembra volante 2p+t Blanco Halux',
    price: 2990,
    image: '/producto/enchufe-hembra-volante-2p-t-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110270077',
  },
  {
    slug: 'adaptador-triple-10-16a-gewiss-blanco',
    name: 'Adaptador Triple 10/16A Gewiss Blanco Gewiss',
    price: 11990,
    image: '/producto/adaptador-triple-10-16a-gewiss-blanco.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '136916400',
  },
  {
    slug: 'enchufe-macho-volante-articulado-2p-t-10-a-blanco',
    name: 'Enchufe macho volante articulado 2p+t 10 A Blanco Bticino',
    price: 4990,
    image: '/producto/enchufe-macho-volante-articulado-2p-t-10-a-blanco.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223458',
  },
  {
    slug: 'enchufe-acople-macho-hembra-autostyle-gris-para-el',
    name: 'Enchufe Acople Macho Hembra Autostyle gris para Electricidad Autostyle',
    price: 23990,
    image: '/producto/enchufe-acople-macho-hembra-autostyle-gris-para-el.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110127719',
  },
  {
    slug: 'enchufe-macho-volante-articulado-2p-t-10-a-blanco-2854',
    name: 'Enchufe macho volante articulado 2p+t 10 A Blanco Bticino',
    price: 8990,
    image: '/producto/enchufe-macho-volante-articulado-2p-t-10-a-blanco-2854.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222854',
  },
  {
    slug: 'adaptador-triple-2p-t-10-a-gris-bticino',
    name: 'Adaptador triple 2p+t 10 A gris Bticino',
    price: 10990,
    image: '/producto/adaptador-triple-2p-t-10-a-gris-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110249731',
  },
  {
    slug: 'cable-concentrico-2x4-mm2-madeco',
    name: 'Cable Concéntrico 2x4 mm² Madeco por Metro',
    price: 2990,
    image: '/producto/cable-concentrico-2x4-mm2-madeco.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110265598',
  },
  {
    slug: 'cable-concentrico-2x6-mm2-madeco',
    name: 'Cable Concéntrico 2x6 mm² Madeco por Metro',
    price: 4990,
    image: '/producto/cable-concentrico-2x6-mm2-madeco.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110250081',
  },
  {
    slug: 'cordon-h05vv-f-3x1-5-mm2-negro-10m-elfle',
    name: 'Cordón H05VV-F 3x1,5 mm² Negro 10 m ELFLE',
    price: 23990,
    image: '/producto/cordon-h05vv-f-3x1-5-mm2-negro-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855852',
  },
  {
    slug: 'cordon-h05vv-f-2x0-75-mm2-negro-10m-elfle',
    name: 'Cordón H05VV-F 2x0,75 mm² Negro 10 m ELFLE',
    price: 9990,
    image: '/producto/cordon-h05vv-f-2x0-75-mm2-negro-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855862',
  },
  {
    slug: 'cordon-h05vv-f-2x0-75-mm2-blanco-10m-elfle',
    name: 'Cordón H05VV-F 2x0,75 mm² Blanco 10 m ELFLE',
    price: 9990,
    image: '/producto/cordon-h05vv-f-2x0-75-mm2-blanco-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855864',
  },
  {
    slug: 'cordon-h05vv-f-3x1-mm2-negro-10m-elfle',
    name: 'Cordón H05VV-F 3x1 mm² Negro 10 m ELFLE',
    price: 28990,
    image: '/producto/cordon-h05vv-f-3x1-mm2-negro-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855854',
  },
  {
    slug: 'cordon-h05vv-f-3x1-mm2-blanco-10m-elfle',
    name: 'Cordón H05VV-F 3x1 mm² Blanco 10 m ELFLE',
    price: 28990,
    image: '/producto/cordon-h05vv-f-3x1-mm2-blanco-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855850',
  },
  {
    slug: 'cordon-h05vv-f-3x2-5-mm2-negro-10m-elfle',
    name: 'Cordón Eléctrico H05VV-F 3x2,5 mm² Negro 10 m ELFLE',
    price: 49990,
    image: '/producto/cordon-h05vv-f-3x2-5-mm2-negro-10m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '147325133',
  },
  {
    slug: 'cordon-h05vv-f-3x1-5-mm2-negro-20m-elfle',
    name: 'Cordón H05VV-F 3x1,5 mm² Negro 20 m ELFLE',
    price: 59990,
    image: '/producto/cordon-h05vv-f-3x1-5-mm2-negro-20m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855909',
  },
  {
    slug: 'cordon-h05vv-f-2x0-75-mm2-negro-20m-elfle',
    name: 'Cordón H05VV-F 2x0,75 mm² Negro 20 m ELFLE',
    price: 24990,
    image: '/producto/cordon-h05vv-f-2x0-75-mm2-negro-20m-elfle.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '142855868',
  },
  {
    slug: 'kit-porton-electrico-new-1200-kg-veloti',
    name: 'Kit Portón Eléctrico Corredizo New 1.200 kg Veloti',
    price: 235990,
    image: '/producto/kit-porton-electrico-new-1200-kg-veloti.webp',
    category: 'Otros',
    status: 'available',
    sku: '152278051',
  },
  {
    slug: 'cerradura-acceso-rustica-negra-3-pitones-odis',
    name: 'Cerradura de acceso rústica colonial negra con 3 pitones Odis',
    price: 52990,
    image: '/producto/cerradura-acceso-rustica-negra-3-pitones-odis.webp',
    category: 'Otros',
    status: 'available',
    sku: '110290620',
  },
  {
    slug: 'cerradura-embutir-rustica-6180-negra-scanavini',
    name: 'Cerradura de embutir rústica colonial 6180 negra Scanavini',
    price: 82990,
    image: '/producto/cerradura-embutir-rustica-6180-negra-scanavini.webp',
    category: 'Otros',
    status: 'available',
    sku: '110290058',
  },
  {
    slug: 'kit-porton-electrico-new-speed-800-kg-veloti',
    name: 'Kit Portón Eléctrico Corredizo New Speed 800 kg Veloti',
    price: 157990,
    image: '/producto/kit-porton-electrico-new-speed-800-kg-veloti.webp',
    category: 'Otros',
    status: 'available',
    sku: '150336159',
  },
  {
    slug: 'cerradura-pomo-dormitorio-oficina-inox-karson',
    name: 'Cerradura de pomo para dormitorio u oficina inox Karson',
    price: 10990,
    image: '/producto/cerradura-pomo-dormitorio-oficina-inox-karson.webp',
    category: 'Otros',
    status: 'available',
    sku: '110284264',
  },
  {
    slug: 'cerradura-sobreponer-negra-doble-cerrojo-karson',
    name: 'Cerradura de sobreponer negra con doble cerrojo Karson',
    price: 14990,
    image: '/producto/cerradura-sobreponer-negra-doble-cerrojo-karson.webp',
    category: 'Otros',
    status: 'available',
    sku: '110328020',
  },
  {
    slug: 'cerradura-pomo-bano-inox-karson',
    name: 'Cerradura de pomo para baño inox con ranura de emergencia Karson',
    price: 8990,
    image: '/producto/cerradura-pomo-bano-inox-karson.webp',
    category: 'Otros',
    status: 'available',
    sku: '110316243',
  },
  {
    slug: 'kit-porton-electrico-new-speed-600-kg-veloti',
    name: 'Kit Portón Eléctrico Corredizo New Speed 600 kg Veloti',
    price: 125990,
    image: '/producto/kit-porton-electrico-new-speed-600-kg-veloti.webp',
    category: 'Otros',
    status: 'available',
    sku: '150336155',
  },
  {
    slug: 'cerradura-sobreponer-rim-323bl-caja-soldar-odis',
    name: 'Cerradura de sobreponer RIM 323BL con caja para soldar negra Odis',
    price: 26990,
    image: '/producto/cerradura-sobreponer-rim-323bl-caja-soldar-odis.webp',
    category: 'Otros',
    status: 'available',
    sku: '110317826',
  },
  {
    slug: 'cerradura-pomo-dormitorio-bronce-pulido-karson',
    name: 'Cerradura de pomo para dormitorio bronce pulido Karson',
    price: 8990,
    image: '/producto/cerradura-pomo-dormitorio-bronce-pulido-karson.webp',
    category: 'Otros',
    status: 'available',
    sku: '110299632',
  },
  {
    slug: 'monomando-lavamanos-cromado-karson',
    name: 'Monomando para lavamanos cromado con flexibles Karson',
    price: 17990,
    image: '/producto/monomando-lavamanos-cromado-karson.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '127111895',
  },
  {
    slug: 'monomando-lavamanos-bajo-vittorio-cromado-sensi-dacqua',
    name: 'Monomando para lavamanos bajo Vittorio cromado Sensi Dacqua',
    price: 61990,
    image: '/producto/monomando-lavamanos-bajo-vittorio-cromado-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110521437',
  },
  {
    slug: 'monomando-lavamanos-modena-eco-cromado-stretto',
    name: 'Monomando para lavamanos Modena Eco cromado Stretto',
    price: 29990,
    image: '/producto/monomando-lavamanos-modena-eco-cromado-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '127111909',
  },
  {
    slug: 'monomando-lavamanos-bajo-milan-cromado-sensi-dacqua',
    name: 'Monomando para lavamanos bajo Milán cromado Sensi Dacqua',
    price: 35990,
    image: '/producto/monomando-lavamanos-bajo-milan-cromado-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110153906',
  },
  {
    slug: 'monomando-lavamanos-new-barcelona-cepillado-fanaloza',
    name: 'Monomando para lavamanos New Barcelona acero cepillado Fanaloza',
    price: 37990,
    image: '/producto/monomando-lavamanos-new-barcelona-cepillado-fanaloza.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '126550922',
  },
  {
    slug: 'monomando-lavamanos-perugia-cromado-sensi-dacqua',
    name: 'Monomando para lavamanos Perugia cromado Sensi Dacqua',
    price: 25990,
    image: '/producto/monomando-lavamanos-perugia-cromado-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110173915',
  },
  {
    slug: 'monomando-lavamanos-atlanta-cromado-karson',
    name: 'Monomando para lavamanos Atlanta cromado Karson',
    price: 20990,
    image: '/producto/monomando-lavamanos-atlanta-cromado-karson.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '127111927',
  },
  {
    slug: 'monomando-lavamanos-galia-cromado-fas',
    name: 'Monomando para lavamanos Galia cromado FAS',
    price: 38990,
    image: '/producto/monomando-lavamanos-galia-cromado-fas.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110132936',
  },
  {
    slug: 'monomando-lavamanos-modena-eco-negro-stretto',
    name: 'Monomando para lavamanos Modena Eco negro mate Stretto',
    price: 29990,
    image: '/producto/monomando-lavamanos-modena-eco-negro-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '127111897',
  },
  {
    slug: 'monomando-lavamanos-alto-milan-cromado-sensi-dacqua',
    name: 'Monomando para lavamanos alto Milán cromado Sensi Dacqua',
    price: 47990,
    image: '/producto/monomando-lavamanos-alto-milan-cromado-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110178406',
  },
  {
    slug: 'flexible-agua-1-2-hi-hi-50-cm-humboldt',
    name: 'Flexible para agua 1/2 HI-HI 50 cm trenzado Humboldt',
    price: 5990,
    image: '/producto/flexible-agua-1-2-hi-hi-50-cm-humboldt.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110235999',
  },
  {
    slug: 'flexible-gas-1-2-hi-hi-100-cm-comisa',
    name: 'Flexible para gas 1/2 HI-HI 100 cm trenzado Comisa',
    price: 17990,
    image: '/producto/flexible-gas-1-2-hi-hi-100-cm-comisa.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110282342',
  },
  {
    slug: 'flexible-gas-1-2-x-3-8-hi-hi-100-cm-humboldt',
    name: 'Flexible para gas 1/2 x 3/8 HI-HI 100 cm Humboldt',
    price: 12990,
    image: '/producto/flexible-gas-1-2-x-3-8-hi-hi-100-cm-humboldt.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110289227',
  },
  {
    slug: 'flexible-agua-1-2-hi-hi-30-cm-humboldt',
    name: 'Flexible para agua 1/2 HI-HI 30 cm trenzado Humboldt',
    price: 4990,
    image: '/producto/flexible-agua-1-2-hi-hi-30-cm-humboldt.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110219941',
  },
  {
    slug: 'flexible-gas-pigtail-cilindro-45-kg-coflex',
    name: 'Flexible pigtail para gas cilindro 45 kg 60 cm Coflex',
    price: 17990,
    image: '/producto/flexible-gas-pigtail-cilindro-45-kg-coflex.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110526050',
  },
  {
    slug: 'flexible-ducha-extensible-1-75-m-stretto',
    name: 'Flexible de ducha extensible reforzado 1,75 m Stretto',
    price: 16990,
    image: '/producto/flexible-ducha-extensible-1-75-m-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110219767',
  },
  {
    slug: 'flexible-agua-metal-1-2-hi-hi-40-cm-stretto',
    name: 'Flexible para agua metálico 1/2 HI-HI 40 cm Stretto',
    price: 5990,
    image: '/producto/flexible-agua-metal-1-2-hi-hi-40-cm-stretto.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110221020',
  },
  {
    slug: 'flexible-ducha-metal-1-5-m-sensi-dacqua',
    name: 'Flexible de ducha metálico 1,5 m Sensi Dacqua',
    price: 10990,
    image: '/producto/flexible-ducha-metal-1-5-m-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '110221347',
  },
  {
    slug: 'flexible-ducha-pvc-negro-1-5-m-sensi-dacqua',
    name: 'Flexible de ducha PVC negro mate 1,5 m Sensi Dacqua',
    price: 9990,
    image: '/producto/flexible-ducha-pvc-negro-1-5-m-sensi-dacqua.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '138385858',
  },
  {
    slug: 'flexible-agua-calefont-1-2-hi-he-40-cm-coflex',
    name: 'Flexible para agua calefont 1/2 HI-HE 40 cm Coflex',
    price: 11990,
    image: '/producto/flexible-agua-calefont-1-2-hi-he-40-cm-coflex.webp',
    category: 'Gasfitería',
    status: 'available',
    sku: '113201925',
  },
  {
    slug: 'llave-stillson-8-pulgadas-heavy-duty-bauker',
    name: 'Llave para tubos Stillson 8 pulgadas Heavy Duty Bauker',
    price: 13990,
    image: '/producto/llave-stillson-8-pulgadas-heavy-duty-bauker.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '130586609',
  },
  {
    slug: 'llave-stillson-10-pulgadas-heavy-duty-bauker',
    name: 'Llave para tubos Stillson 10 pulgadas Heavy Duty Bauker',
    price: 18990,
    image: '/producto/llave-stillson-10-pulgadas-heavy-duty-bauker.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '130697628',
  },
  {
    slug: 'llave-stillson-14-pulgadas-heavy-duty-bauker',
    name: 'Llave para tubos Stillson 14 pulgadas Heavy Duty Bauker',
    price: 23990,
    image: '/producto/llave-stillson-14-pulgadas-heavy-duty-bauker.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '130586483',
  },
  {
    slug: 'llave-francesa-ajustable-10-pulgadas-multifuncion-ubermann',
    name: 'Llave francesa ajustable 10 pulgadas multifunción 2 en 1 Ubermann',
    price: 23990,
    image: '/producto/llave-francesa-ajustable-10-pulgadas-multifuncion-ubermann.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '145198328',
  },
  {
    slug: 'llave-francesa-ajustable-12-pulgadas-acero-bauker',
    name: 'Llave francesa ajustable 12 pulgadas 300 mm con mango engomado Bauker',
    price: 22990,
    image: '/producto/llave-francesa-ajustable-12-pulgadas-acero-bauker.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '130607540',
  },
  {
    slug: 'llave-francesa-ajustable-10-pulgadas-cromada-karson',
    name: 'Llave francesa ajustable 10 pulgadas 250 mm cromada Karson',
    price: 6990,
    image: '/producto/llave-francesa-ajustable-10-pulgadas-cromada-karson.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '143990858',
  },
  {
    slug: 'juego-llaves-hexagonales-9-piezas-sae-bauker',
    name: 'Juego de llaves hexagonales 9 piezas SAE tipo navaja Bauker',
    price: 14990,
    image: '/producto/juego-llaves-hexagonales-9-piezas-sae-bauker.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '130607355',
  },
  {
    slug: 'juego-llaves-hexagonales-9-piezas-sae-stanley',
    name: 'Juego de llaves hexagonales 9 piezas SAE tipo navaja Stanley',
    price: 17990,
    image: '/producto/juego-llaves-hexagonales-9-piezas-sae-stanley.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '110023853',
  },
  {
    slug: 'set-llaves-hexagonales-8-piezas-en-anilla-karson',
    name: 'Set de llaves hexagonales 8 piezas con anilla Karson',
    price: 2990,
    image: '/producto/set-llaves-hexagonales-8-piezas-en-anilla-karson.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '110035593',
  },
  {
    slug: 'set-llaves-punta-corona-9-piezas-ubermann',
    name: 'Set de llaves punta corona métricas 9 piezas 6 a 19 mm Ubermann',
    price: 49990,
    image: '/producto/set-llaves-punta-corona-9-piezas-ubermann.webp',
    category: 'Herramientas',
    status: 'available',
    sku: '110023940',
  },
  {
    slug: 'interruptor-diferencial-25-a-lexo',
    name: 'Interruptor diferencial 25 A 2 polos Lexo',
    price: 14990,
    image: '/producto/interruptor-diferencial-25-a-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222191',
  },
  {
    slug: 'interruptor-diferencial-25-a-legrand',
    name: 'Interruptor diferencial 25 A Legrand',
    price: 35990,
    image: '/producto/interruptor-diferencial-25-a-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110218255',
  },
  {
    slug: 'interruptor-simple-9-12-16-a-genesis-blanco-schneider',
    name: 'Interruptor simple 9/12 16 A Genesis Blanco Schneider',
    price: 2990,
    image: '/producto/interruptor-simple-9-12-16-a-genesis-blanco-schneider.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110239244',
  },
  {
    slug: 'interruptor-simple-9-12-10-a-luzica-blanco-bticino',
    name: 'Interruptor simple 9/12 10 A Luzica Blanco Bticino',
    price: 3990,
    image: '/producto/interruptor-simple-9-12-10-a-luzica-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237706',
  },
  {
    slug: 'interruptor-automatico-10-a-lexo',
    name: 'Interruptor automático 10 A Lexo',
    price: 3990,
    image: '/producto/interruptor-automatico-10-a-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216460',
  },
  {
    slug: 'interruptor-conmutador-9-24-16-a-luzica-blanco-bticino',
    name: 'Interruptor conmutador 9/24 16 A Luzica Blanco Bticino',
    price: 5990,
    image: '/producto/interruptor-conmutador-9-24-16-a-luzica-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110241293',
  },
  {
    slug: 'interruptor-doble-9-15-10-a-luzica-blanco-bticino',
    name: 'Interruptor doble 9/15 10 A Luzica Blanco Bticino',
    price: 4990,
    image: '/producto/interruptor-doble-9-15-10-a-luzica-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263623',
  },
  {
    slug: 'automatico-1p-n-25a-6ka-lexo',
    name: 'Automático 1P+N 25A 6KA Lexo',
    price: 8990,
    image: '/producto/automatico-1p-n-25a-6ka-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '116407740',
  },
  {
    slug: 'modulo-de-luz-piloto-lexo',
    name: 'Modulo De Luz Piloto Lexo',
    price: 4990,
    image: '/producto/modulo-de-luz-piloto-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '117082453',
  },
  {
    slug: 'interruptor-automatico-16-a-lexo',
    name: 'Interruptor automático 16 A Lexo',
    price: 3990,
    image: '/producto/interruptor-automatico-16-a-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216764',
  },
  {
    slug: 'interruptor-simple-9-12-10-a-clio-blanco-halux',
    name: 'Interruptor simple 9/12 10 A Clio Blanco Halux',
    price: 3990,
    image: '/producto/interruptor-simple-9-12-10-a-clio-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222129',
  },
  {
    slug: 'interruptor-doble-9-15-10-a-clio-blanco-halux',
    name: 'Interruptor doble 9/15 10 A Clio Blanco Halux',
    price: 4990,
    image: '/producto/interruptor-doble-9-15-10-a-clio-blanco-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110272745',
  },
  {
    slug: 'interruptor-triple-10-a-nobile-terra-bticino',
    name: 'Interruptor triple 10 A Nobile Terra Bticino',
    price: 12990,
    image: '/producto/interruptor-triple-10-a-nobile-terra-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110274167',
  },
  {
    slug: 'interruptor-automatico-16-a-curva-c-6ka-legrand',
    name: 'Interruptor automático 16 A curva C 6KA Legrand',
    price: 10990,
    image: '/producto/interruptor-automatico-16-a-curva-c-6ka-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110274394',
  },
  {
    slug: 'interruptor-simple-10-a-negro-halux',
    name: 'Interruptor simple 10 A Negro Halux',
    price: 5990,
    image: '/producto/interruptor-simple-10-a-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223652',
  },
  {
    slug: 'interruptor-simple-9-24-16-a-sobreponer-blanco-schneider',
    name: 'Interruptor simple 9/24 16 A Sobreponer blanco Schneider',
    price: 3990,
    image: '/producto/interruptor-simple-9-24-16-a-sobreponer-blanco-schneider.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216638',
  },
  {
    slug: 'interruptor-simple-2-a-negro-halux',
    name: 'Interruptor simple 2 A Negro Halux',
    price: 3990,
    image: '/producto/interruptor-simple-2-a-negro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110273712',
  },
  {
    slug: 'interruptor-automatico-16-a-easy9-schneider',
    name: 'Interruptor automático 16 A Easy9 Schneider',
    price: 4990,
    image: '/producto/interruptor-automatico-16-a-easy9-schneider.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110263816',
  },
  {
    slug: 'interruptor-automatico-20-a-saime',
    name: 'Interruptor automático 20 A Saime',
    price: 13990,
    image: '/producto/interruptor-automatico-20-a-saime.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110235364',
  },
  {
    slug: 'interruptor-automatico-10-a-curva-c-6ka-legrand',
    name: 'Interruptor automático 10 A curva C 6KA Legrand',
    price: 10990,
    image: '/producto/interruptor-automatico-10-a-curva-c-6ka-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223044',
  },
  {
    slug: 'interruptor-conmutador-9-24-16-a-genesis-blanco-schneider',
    name: 'Interruptor conmutador 9/24 16 A Genesis Blanco Schneider',
    price: 3990,
    image: '/producto/interruptor-conmutador-9-24-16-a-genesis-blanco-schneider.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110255276',
  },
  {
    slug: 'interruptor-simple-9-12-10-a-clio-gris-halux',
    name: 'Interruptor simple 9/12 10 A Clio Gris Halux',
    price: 4990,
    image: '/producto/interruptor-simple-9-12-10-a-clio-gris-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110223254',
  },
  {
    slug: 'interruptor-automatico-40-a-saime',
    name: 'Interruptor automático 40 A Saime',
    price: 13990,
    image: '/producto/interruptor-automatico-40-a-saime.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216317',
  },
  {
    slug: 'interruptor-simple-9-12-10-a-modus-plus-blanco-bticino',
    name: 'Interruptor simple 9/12 10 A Modus Plus Blanco Bticino',
    price: 4990,
    image: '/producto/interruptor-simple-9-12-10-a-modus-plus-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110265693',
  },
  {
    slug: 'interruptor-conmutador-9-24-10-a-nobile-terra-bticino',
    name: 'Interruptor conmutador 9/24 10 A Nobile Terra Bticino',
    price: 6990,
    image: '/producto/interruptor-conmutador-9-24-10-a-nobile-terra-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110217224',
  },
  {
    slug: 'interruptor-automatico-25-a-saime',
    name: 'Interruptor automático 25 A Saime',
    price: 13990,
    image: '/producto/interruptor-automatico-25-a-saime.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110252516',
  },
  {
    slug: 'automatico-1p-n-20a-6ka-lexo',
    name: 'Automático 1P+N 20A 6KA Lexo',
    price: 8990,
    image: '/producto/automatico-1p-n-20a-6ka-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '117081834',
  },
  {
    slug: 'interruptor-automatico-1x10a-saime',
    name: 'Interruptor Automatico 1x10A Saime',
    price: 13990,
    image: '/producto/interruptor-automatico-1x10a-saime.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110230879',
  },
  {
    slug: 'interruptor-simple-2-a-negro-bticino',
    name: 'Interruptor simple 2 A Negro Bticino',
    price: 7990,
    image: '/producto/interruptor-simple-2-a-negro-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110264187',
  },
  {
    slug: 'automatico-1p-n-16a-6ka-lexo',
    name: 'Automático 1P+N 16A 6KA Lexo',
    price: 8990,
    image: '/producto/automatico-1p-n-16a-6ka-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '116475023',
  },
  {
    slug: 'limitador-de-sobretension-20-a-gris-legrand',
    name: 'Limitador de sobretensión 20 A Gris Legrand',
    price: 59990,
    image: '/producto/limitador-de-sobretension-20-a-gris-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110216740',
  },
  {
    slug: 'interruptor-triple-10-a-nobile-perla-bticino',
    name: 'Interruptor triple 10 A Nobile Perla Bticino',
    price: 11990,
    image: '/producto/interruptor-triple-10-a-nobile-perla-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110243628',
  },
  {
    slug: 'interruptor-doble-1-placa-10-a-nobile-perla-bticino',
    name: 'Interruptor doble + 1 placa 10 A Nobile Perla Bticino',
    price: 8990,
    image: '/producto/interruptor-doble-1-placa-10-a-nobile-perla-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110272338',
  },
  {
    slug: 'interruptor-conmutador-9-24-10-a-luzica-blanco-bticino',
    name: 'Interruptor conmutador 9/24 10 A Luzica Blanco Bticino',
    price: 3990,
    image: '/producto/interruptor-conmutador-9-24-10-a-luzica-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110250127',
  },
  {
    slug: 'interruptor-automatico1x25-ac-6-ka-lexo-lexo',
    name: 'Interruptor Automático1x25 AC 6 Ka Lexo',
    price: 3990,
    image: '/producto/interruptor-automatico1x25-ac-6-ka-lexo-lexo.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '130442052',
  },
  {
    slug: 'automatico-2p-c25a-230-400v-6000a-bticino',
    name: 'Automatico 2P C25A 230/400V 6000A Bticino',
    price: 11990,
    image: '/producto/automatico-2p-c25a-230-400v-6000a-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '117082607',
  },
  {
    slug: 'interruptor-automatico-20-a-curva-c-6ka-legrand',
    name: 'Interruptor automático 20 A curva C 6KA Legrand',
    price: 10990,
    image: '/producto/interruptor-automatico-20-a-curva-c-6ka-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110235801',
  },
  {
    slug: 'interruptor-doble-9-15-10-a-clio-gris-halux',
    name: 'Interruptor doble 9/15 10 A Clio Gris Halux',
    price: 5990,
    image: '/producto/interruptor-doble-9-15-10-a-clio-gris-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110249772',
  },
  {
    slug: 'interruptor-9-12-s17-sinthesi-grafito-sinthesi',
    name: 'Interruptor 9/12 S17 Sinthesi Grafito',
    price: 4990,
    image: '/producto/interruptor-9-12-s17-sinthesi-grafito-sinthesi.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '140798035',
  },
  {
    slug: 'interruptor-conmutador-triple-9-24-10-a-luzica-blanco-bticino',
    name: 'Interruptor conmutador triple 9/24 10 A Luzica Blanco Bticino',
    price: 6990,
    image: '/producto/interruptor-conmutador-triple-9-24-10-a-luzica-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110238134',
  },
  {
    slug: 'interruptor-automatico-32-a-curva-c-6ka-legrand',
    name: 'Interruptor automático 32 A curva C 6KA Legrand',
    price: 10990,
    image: '/producto/interruptor-automatico-32-a-curva-c-6ka-legrand.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110224002',
  },
  {
    slug: 'interruptor-simple-9-12-s17-sinthesi-blanco-sinthesi',
    name: 'Interruptor simple 9/12 s17 Sinthesi Blanco',
    price: 3990,
    image: '/producto/interruptor-simple-9-12-s17-sinthesi-blanco-sinthesi.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '139923502',
  },
  {
    slug: 'enchufe-interruptor-10-a-nobile-perla-bticino',
    name: 'Enchufe + interruptor 10 A Nobile Perla Bticino',
    price: 9990,
    image: '/producto/enchufe-interruptor-10-a-nobile-perla-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110271939',
  },
  {
    slug: 'interruptor-conmutador-9-24-10-a-modus-plus-blanco-bticino',
    name: 'Interruptor conmutador 9/24 10 A Modus Plus Blanco Bticino',
    price: 5990,
    image: '/producto/interruptor-conmutador-9-24-10-a-modus-plus-blanco-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110253943',
  },
  {
    slug: 'interruptor-conmutador-9-24-s17-sinthesi-blanco-sinthesi',
    name: 'Interruptor conmutador 9/24 s17 Sinthesi Blanco',
    price: 4990,
    image: '/producto/interruptor-conmutador-9-24-s17-sinthesi-blanco-sinthesi.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '139923737',
  },
  {
    slug: 'interruptor-triple-9-32-10-a-clio-gris-claro-halux',
    name: 'Interruptor triple 9/32 10 A Clio Gris claro Halux',
    price: 6990,
    image: '/producto/interruptor-triple-9-32-10-a-clio-gris-claro-halux.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110237517',
  },
  {
    slug: 'interruptor-automatico-32-a-curva-c-6ka-bticino',
    name: 'Interruptor automático 32 A curva C 6KA Bticino',
    price: 6990,
    image: '/producto/interruptor-automatico-32-a-curva-c-6ka-bticino.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '110222814',
  },
  {
    slug: 'interruptor-automatico-bipolar-2x16ka-schneider',
    name: 'Interruptor Automatico Bipolar 2x16KA Schneider',
    price: 11990,
    image: '/producto/interruptor-automatico-bipolar-2x16ka-schneider.webp',
    category: 'Material Eléctrico',
    status: 'available',
    sku: '126117347',
  },
];

// ── Shipping settings ────────────────────────────────────────────────

async function getShippingSettings(env) {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN ('shipping_cost', 'free_shipping_min')`
  ).all();
  const out = { ...DEFAULT_SHIPPING };
  for (const r of rows.results || []) {
    const n = parseInt(r.value);
    if (!isNaN(n) && n >= 0) out[r.key] = n;
  }
  return out;
}

// free_shipping_min = 0 means free shipping is not offered
function shippingFor(subtotal, cfg) {
  if (cfg.free_shipping_min > 0 && subtotal >= cfg.free_shipping_min) return 0;
  return cfg.shipping_cost;
}

// GET /api/shipping (public): used by the checkout to show the right amounts
async function handleGetShipping(env) {
  return json(await getShippingSettings(env));
}

// ── Site config (AdSense on product pages) ──────────────────────────

async function getSiteConfig(env) {
  try {
    const rows = await env.DB.prepare(
      `SELECT key, value FROM settings WHERE key IN ('adsense_products', 'adsense_blog')`
    ).all();
    const v = Object.fromEntries((rows.results || []).map(r => [r.key, r.value]));
    // Products: off unless enabled. Blog: on unless disabled (it always had ads).
    return { adsense_products: v.adsense_products === '1', adsense_blog: v.adsense_blog !== '0' };
  } catch {
    return { adsense_products: false, adsense_blog: true }; // settings table not created yet
  }
}

// ── Blog pages: strip AdSense when disabled in /admin/ ──────────────
// Blog HTML is static with the ad code inline; with run_worker_first the
// Worker serves it from ASSETS and removes the loader script and ad units.

let blogAdsCache = { value: true, at: 0 };
async function blogAdsEnabled(env) {
  if (Date.now() - blogAdsCache.at < 30000) return blogAdsCache.value;
  const timeout = new Promise(resolve => setTimeout(resolve, 1500, null));
  const cfg = await Promise.race([getSiteConfig(env), timeout]);
  if (cfg) blogAdsCache = { value: cfg.adsense_blog, at: Date.now() };
  return cfg ? cfg.adsense_blog : blogAdsCache.value;
}

async function serveBlog(request, env) {
  const res = await env.ASSETS.fetch(request);
  const type = res.headers.get('Content-Type') || '';
  if (request.method !== 'GET' || !res.ok || !type.includes('text/html')) return res;
  const priced = await withDbPrices(res, request, env, null);
  if (await blogAdsEnabled(env)) return priced;
  const remove = { element(el) { el.remove(); } };
  const out = new HTMLRewriter()
    .on('script[src*="adsbygoogle"]', remove)
    .on('ins.adsbygoogle', remove)
    .transform(priced);
  return new Response(out.body, { status: out.status, statusText: out.statusText, headers: priced.headers });
}

// ── Prices from D1 on static pages ──────────────────────────────────
// Product pages, catalogs, the home page and the product boxes in blog
// articles are static HTML with the price written in (text, WhatsApp links,
// JSON-LD, data-price). When a price is changed in /admin/, the Worker
// rewrites those amounts on the way out, so the whole page shows the new one.

let dbPriceCache = { map: null, at: 0 };
async function dbPrices(env) {
  if (dbPriceCache.map && Date.now() - dbPriceCache.at < 10000) return dbPriceCache.map;
  const query = env.DB.prepare('SELECT slug, price FROM products').all()
    .then(r => new Map((r.results || []).map(p => [p.slug, Number(p.price)])))
    .catch(() => null);
  const map = await Promise.race([query, new Promise(resolve => setTimeout(resolve, 1500, null))]);
  if (map) dbPriceCache = { map, at: Date.now() };
  return map || dbPriceCache.map;
}

// Prices written in a product page: its color variants (data-slug + data-price)
// and, for the page's own product, the first JSON-LD price.
function pagePrices(html, slug) {
  const out = new Map();
  for (const m of html.matchAll(/class="variant-btn"[^>]*?data-slug="([a-z0-9-]+)"[^>]*?data-price="(\d+)"/g)) out.set(m[1], Number(m[2]));
  if (!out.has(slug)) {
    const m = html.match(/"price"\s*:\s*"?(\d+)/);
    if (m) out.set(slug, Number(m[1]));
  }
  return out;
}

// Static (deployed) price of products linked from other pages. Assets only
// change with a deploy, which starts new isolates, so this cache never goes stale.
const staticPriceCache = new Map();
async function staticPrice(env, origin, slug) {
  if (!staticPriceCache.has(slug)) {
    let prices = new Map();
    try {
      const r = await env.ASSETS.fetch(new Request(`${origin}/producto/${slug}`));
      if (r.ok && (r.headers.get('Content-Type') || '').includes('text/html')) prices = pagePrices(await r.text(), slug);
    } catch {}
    staticPriceCache.set(slug, prices);
  }
  return staticPriceCache.get(slug).get(slug);
}

const fmtCLP = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

async function applyDbPrices(html, env, origin, ownSlug) {
  const db = await dbPrices(env);
  if (!db || !db.size) return html;
  const refsOf = h => [...h.matchAll(/(?:href="\/producto\/|data-slug=")([a-z0-9-]+)/g)].map(m => [m.index, m[1]]);
  const own = ownSlug ? pagePrices(html, ownSlug) : new Map();
  const old = new Map(own);
  for (const s of new Set(refsOf(html).map(r => r[1]))) {
    if (old.has(s) || !db.has(s)) continue;
    const p = await staticPrice(env, origin, s);
    if (p) old.set(s, p);
  }
  const changed = new Set([...old].filter(([s, p]) => db.get(s) > 0 && db.get(s) !== p).map(([s]) => s));
  if (!changed.size) return html;

  // Which product an amount belongs to: the nearest link to a product whose
  // written price is that amount; far from any link, the page's own product.
  const WINDOW = 1500;
  const owner = (refs, pos, amount) => {
    let best = null, bestD = WINDOW + 1;
    for (const [i, s] of refs) {
      const d = Math.abs(i - pos);
      if (d < bestD && old.get(s) === amount) { best = s; bestD = d; }
    }
    if (!best) {
      const mine = [...own].filter(([, p]) => p === amount);
      if (mine.length === 1) best = mine[0][0];
    }
    return best && changed.has(best) ? db.get(best) : null;
  };

  let refs = refsOf(html);
  html = html.replace(/(\$\s?|%24)(\d{1,3}(?:\.\d{3})+)(?![\d]|\.\d)/g, (m, pre, num, pos) => {
    const n = owner(refs, pos, Number(num.replace(/\./g, '')));
    return n ? pre + fmtCLP(n) : m;
  });
  html = html.replace(/(data-slug="([a-z0-9-]+)"[^>]*?data-price=")(\d+)"/g, (m, pre, s, p) =>
    changed.has(s) && Number(p) === old.get(s) ? `${pre}${db.get(s)}"` : m);
  if (ownSlug) {
    refs = refsOf(html);
    html = html.replace(/("price"\s*:\s*"?|product:price:amount" content=")(\d+)/g, (m, pre, p, pos) => {
      const n = owner(refs, pos, Number(p));
      return n ? pre + n : m;
    });
  }
  return html;
}

async function withDbPrices(res, request, env, ownSlug) {
  const html = await res.text();
  let out = html;
  try { out = await applyDbPrices(html, env, new URL(request.url).origin, ownSlug); } catch (e) { console.error('prices', e); }
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.delete('ETag');
  headers.delete('Content-Length');
  return new Response(out, { status: res.status, statusText: res.statusText, headers });
}

// Home, /productos/, /productos-digitales/ and /producto/* (run_worker_first)
async function servePriced(request, env, rawPath) {
  const res = await env.ASSETS.fetch(request);
  const type = res.headers.get('Content-Type') || '';
  if (request.method !== 'GET' || !res.ok || !type.includes('text/html')) return res;
  const m = rawPath.match(/^\/producto\/([a-z0-9-]+?)(?:\.html)?\/?$/);
  return withDbPrices(res, request, env, m ? m[1] : null);
}

// GET /api/site-config (public): product pages and /productos/ read it to
// decide whether to show AdSense. Short cache so admin changes apply fast.
async function handleGetSiteConfig(env) {
  const res = json(await getSiteConfig(env));
  res.headers.set('Cache-Control', 'public, max-age=60');
  return res;
}

async function getAdminSettings(env) {
  return { ...(await getShippingSettings(env)), ...(await getSiteConfig(env)) };
}

// GET|PUT /api/admin/settings
async function handleAdminSettings(request, env) {
  if (!checkAdmin(request, env)) return err('No autorizado', 401);
  if (request.method === 'GET') return json(await getAdminSettings(env));

  let data;
  try { data = await request.json(); } catch { return err('JSON inválido'); }
  const updates = [];
  if (data.adsense_blog !== undefined) {
    updates.push(env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('adsense_blog', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(data.adsense_blog ? '1' : '0'));
    blogAdsCache = { value: !!data.adsense_blog, at: Date.now() };
  }
  if (data.adsense_products !== undefined) {
    updates.push(env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('adsense_products', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(data.adsense_products ? '1' : '0'));
  }
  for (const key of ['shipping_cost', 'free_shipping_min']) {
    if (data[key] === undefined) continue;
    const n = parseInt(data[key]);
    if (isNaN(n) || n < 0 || n > 10000000) return err('Monto inválido');
    updates.push(env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, String(n)));
  }
  if (!updates.length) return err('No hay campos para actualizar');
  await env.DB.batch(updates);
  return json(await getAdminSettings(env));
}

async function ensureSchema(env) {
  // Add sku column if missing. Separate from the batch because it fails
  // (harmlessly) once the column exists, and a failed batch rolls back.
  try { await env.DB.prepare('ALTER TABLE products ADD COLUMN sku TEXT').run(); } catch {}
  await ensureDownloadColumns(env);
  await ensureMpColumns(env);

  // Everything else is idempotent and goes in ONE round trip.
  const stmts = [
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ];
  for (const p of SEED_PRODUCTS) {
    stmts.push(env.DB.prepare(
      'INSERT OR IGNORE INTO products (slug, name, price, image, category, status, sku) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(p.slug, p.name, p.price, p.image, p.category, p.status, p.sku));
    stmts.push(env.DB.prepare(
      `UPDATE products SET sku = ? WHERE slug = ? AND (sku IS NULL OR sku = '')`
    ).bind(p.sku, p.slug));
  }
  await env.DB.batch(stmts);
}

// Set once a request in this isolate has completed the migration. Each request
// runs its own migration (never awaits another request's promise: Workers can
// hang when a request waits on I/O started by a different request).
let schemaDone = false;

async function ensureSchemaOnce(env) {
  if (schemaDone) return;
  const timeout = new Promise(resolve => setTimeout(resolve, 3000, 'timeout'));
  try {
    const r = await Promise.race([ensureSchema(env).then(() => 'ok'), timeout]);
    if (r === 'ok') schemaDone = true;
    else console.warn('Schema migration slow; continuing without waiting');
  } catch (e) {
    console.error('Schema error:', e);
  }
}

// ── Main router ──────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // Run migration/seed once per isolate (per-request, bounded by a timeout)
    // Only routes that depend on the migration wait for it; public product
    // lookups never block on it (they fall back to the page's own price).
    const reqPath = new URL(request.url).pathname;
    if (reqPath.startsWith('/api/admin') || reqPath.startsWith('/api/checkout')) {
      await ensureSchemaOnce(env);
    }

    const url = new URL(request.url);
    // Normalize: strip trailing slash (except root) so /api/flow/return/ matches /api/flow/return
    const rawPath = url.pathname;
    const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
    const method = request.method;

    try {
      // CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': env.SITE_URL,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // Blog articles (run_worker_first): AdSense on/off from /admin/
      if (rawPath === '/blog' || rawPath.startsWith('/blog/')) return serveBlog(request, env);
      // Static pages that show prices (run_worker_first): use the price from /admin/
      if (rawPath === '/' || rawPath === '/index.html' || rawPath.startsWith('/producto/') || rawPath.startsWith('/productos')) {
        return servePriced(request, env, rawPath);
      }

      // Public API routes
      if (path === '/api/shipping' && method === 'GET') return handleGetShipping(env);
      if (path === '/api/site-config' && method === 'GET') return handleGetSiteConfig(env);
      if (path === '/api/products' && method === 'GET') return handleGetProducts(request, env, url);
      if (path === '/api/checkout' && method === 'POST') return handleCheckout(request, env);
      if (path === '/api/flow/confirm' && method === 'POST') return handleFlowConfirm(request, env);
      if (path === '/api/flow/return' && (method === 'GET' || method === 'POST')) return handleFlowReturn(request, env, url);
      if (path === '/api/payment-methods' && method === 'GET') return json({ flow: true, mercadopago: !!env.MP_ACCESS_TOKEN });
      if (path === '/api/mp/return' && method === 'GET') return handleMpReturn(request, env, url);
      if (path === '/api/mp/webhook' && (method === 'POST' || method === 'GET')) return handleMpWebhook(request, env, url);
      if (path === '/api/order-status' && method === 'GET') return handleOrderStatus(request, env, url);
      if (path === '/api/download' && method === 'GET') return handleDownload(request, env, url);

      // Admin API routes
      if (path === '/api/admin/orders' && method === 'GET') return handleAdminOrders(request, env, url);
      if (path === '/api/admin/stats' && method === 'GET') return handleAdminStats(request, env);
      if (path === '/api/admin/settings' && (method === 'GET' || method === 'PUT')) return handleAdminSettings(request, env);
      if (path === '/api/admin/products' && method === 'GET') return handleAdminProducts(request, env);
      if (path === '/api/admin/products' && method === 'POST') return handleAdminCreateProduct(request, env);
      if (path === '/api/admin/digital' && method === 'GET') return handleAdminDigitalList(request, env);
      const digitalMatch = path.match(/^\/api\/admin\/digital\/([a-z0-9-]+)$/);
      if (digitalMatch && method === 'PUT') return handleAdminDigitalUpload(request, env, digitalMatch[1]);
      if (digitalMatch && method === 'GET') return handleAdminDigitalDownload(request, env, digitalMatch[1]);

      // Admin product update: PUT /api/admin/products/SLUG
      const productMatch = path.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/);
      if (productMatch && method === 'PUT') {
        return handleAdminUpdateProduct(request, env, productMatch[1]);
      }

      // Admin order delete: DELETE /api/admin/orders/ID
      const orderDeleteMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);
      if (orderDeleteMatch && method === 'DELETE') {
        return handleAdminDeleteOrder(request, env, orderDeleteMatch[1]);
      }

      // Not an API route — assets middleware already handled static files
      return new Response('Not Found', { status: 404 });
    } catch (e) {
      console.error('Worker error:', e);
      return err('Error interno del servidor', 500);
    }
  },
};
