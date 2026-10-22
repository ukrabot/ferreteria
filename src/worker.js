/**
 * Ferretería Ukra — Worker API
 * Handles checkout (Flow payments), order management, product management, and admin panel API.
 * Static assets are served automatically by Cloudflare Workers Static Assets.
 */

const FLOW_API = 'https://www.flow.cl/api';

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
  if (!customer_name || !customer_email || !items?.length) {
    return err('Faltan campos obligatorios: nombre, email y productos');
  }
  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    return err('Email inválido');
  }
  // Validate items
  for (const item of items) {
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
    return json({ paymentUrl, orderNumber: order_number });
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

    // Find order number
    const row = await env.DB.prepare(
      `SELECT order_number FROM orders WHERE flow_token = ?`
    ).bind(token).first();

    const orderNum = row?.order_number || '';
    return Response.redirect(`${env.SITE_URL}/orden/?order=${orderNum}&status=${status}`, 302);
  } catch (e) {
    console.error('Flow return error:', e);
    return Response.redirect(`${env.SITE_URL}/orden/?error=payment_error`, 302);
  }
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

  return json({
    order_number: row.order_number,
    customer_name: row.customer_name,
    products: JSON.parse(row.products),
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    paid_at: row.paid_at,
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

  const rows = await env.DB.prepare(
    `SELECT id, order_number, customer_name, customer_email, customer_phone, customer_comuna,
            customer_address, customer_region, products, total, status, flow_order, payment_method, created_at, paid_at
     FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  return json({
    orders: rows.results.map(r => ({ ...r, products: JSON.parse(r.products) })),
    total: countRow.c,
    page,
    pages: Math.ceil(countRow.c / limit),
  });
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
    `SELECT id, slug, name, price, image, category, status, updated_at FROM products ORDER BY name`
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

  if (!updates.length) return err('No hay campos para actualizar');

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  values.push(slug);

  await env.DB.prepare(
    `UPDATE products SET ${updates.join(', ')} WHERE slug = ?`
  ).bind(...values).run();

  // Return updated product
  const updated = await env.DB.prepare(
    `SELECT id, slug, name, price, image, category, status, updated_at FROM products WHERE slug = ?`
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

  const { slug, name, price, image, category, status } = data;
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
    `INSERT INTO products (slug, name, price, image, category, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    slug.trim(),
    name.trim(),
    parsedPrice,
    (image || '').trim(),
    (category || '').trim(),
    status || 'available'
  ).run();

  const created = await env.DB.prepare(
    `SELECT id, slug, name, price, image, category, status, updated_at FROM products WHERE slug = ?`
  ).bind(slug.trim()).first();

  return json(created, 201);
}

// ── Main router ──────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
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

      // Public API routes
      if (path === '/api/products' && method === 'GET') return handleGetProducts(request, env, url);
      if (path === '/api/checkout' && method === 'POST') return handleCheckout(request, env);
      if (path === '/api/flow/confirm' && method === 'POST') return handleFlowConfirm(request, env);
      if (path === '/api/flow/return' && (method === 'GET' || method === 'POST')) return handleFlowReturn(request, env, url);
      if (path === '/api/order-status' && method === 'GET') return handleOrderStatus(request, env, url);

      // Admin API routes
      if (path === '/api/admin/orders' && method === 'GET') return handleAdminOrders(request, env, url);
      if (path === '/api/admin/stats' && method === 'GET') return handleAdminStats(request, env);
      if (path === '/api/admin/products' && method === 'GET') return handleAdminProducts(request, env);
      if (path === '/api/admin/products' && method === 'POST') return handleAdminCreateProduct(request, env);

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
