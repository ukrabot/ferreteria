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
  if (!type.includes('text/html') || await blogAdsEnabled(env)) return res;
  const remove = { element(el) { el.remove(); } };
  const out = new HTMLRewriter()
    .on('script[src*="adsbygoogle"]', remove)
    .on('ins.adsbygoogle', remove)
    .transform(res);
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.delete('ETag');
  return new Response(out.body, { status: out.status, statusText: out.statusText, headers });
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
