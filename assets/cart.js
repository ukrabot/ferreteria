/**
 * Ferretería Ukra — Carrito de Compras
 * Persiste en localStorage. Se inyecta en páginas de producto y catálogo.
 */
(function () {
  'use strict';

  const CART_KEY = 'ukra_cart';
  // Digital products: no shipping, delivered by a download link after payment.
  const DIGITAL = new Set(['pack-cuadro-de-cargas-unilineal-checklist-te1', 'pack-codigo-de-colores-etiquetas-tablero-ric', 'pack-calculadora-techo-de-zinc-excel', 'pack-calculadora-consumo-soldadora-excel', 'pack-soldadura-con-estano-guia-visual-pdf', 'pack-calculadora-de-pastelones-excel', 'pack-regularizacion-ley-del-mono-checklist-dom', 'pack-calculadora-cemento-y-ladrillos-muro-excel', 'pack-dilucion-acido-muriatico-ladrillo-visto-excel', 'pack-comparador-ladrillo-fiscal-princesa-hormigon-celular-excel', 'pack-selector-remaches-pop-excel', 'pack-planilla-fosa-septica-test-percolacion-excel', 'pack-calculadora-radier-armado-malla-excel', 'pack-presupuesto-construccion-casa-excel', 'pack-diagnostico-bomba-agua-no-corta-excel', 'pack-enchufe-seguro-carga-circuito-excel', 'pack-galpon-metalico-dimensiones-cotizaciones-excel', 'pack-revision-enchufes-fase-neutro-tierra-excel', 'pack-calculadora-tabique-metalcon-excel', 'pack-ducha-electrica-circuito-seguro-excel', 'pack-hongos-humedad-diagnostico-repintado-excel', 'pack-muro-contencion-drenaje-supervision-excel', 'pack-impermeabilizacion-radier-capilaridad-excel', 'pack-goteras-techo-zinc-reparacion-mantencion-excel', 'pack-tablero-transferencia-ats-generador-excel', 'pack-tornillos-para-madera-calculadora-excel', 'pack-calefont-no-enciende-diagnostico-mantencion-excel', 'pack-malla-raschel-calculadora-estructura-excel']);
  const isDigital = slug => DIGITAL.has(slug);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Cart data ─────────────────────────────────────────────────────

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }

  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  function addToCart(product) {
    const cart = getCart();
    const idx = cart.findIndex(i => i.slug === product.slug);
    if (idx >= 0) {
      cart[idx].quantity += 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    saveCart(cart);
    updateBadge();
    showToast(`${product.name} agregado al carrito`);
  }

  function removeFromCart(slug) {
    const cart = getCart().filter(i => i.slug !== slug);
    saveCart(cart);
    updateBadge();
  }

  function updateQuantity(slug, qty) {
    const cart = getCart();
    const item = cart.find(i => i.slug === slug);
    if (item) {
      item.quantity = Math.max(1, qty);
      saveCart(cart);
    }
    updateBadge();
  }

  function clearCart() {
    try { localStorage.removeItem(CART_KEY); } catch {}
    updateBadge();
  }

  // Shipping settings: defaults, replaced by /api/shipping (set in /admin/).
  // The server recalculates shipping at checkout, so these only drive the display.
  const shippingCfg = { shipping_cost: 3990, free_shipping_min: 19990 };
  function shippingFor(subtotal) {
    if (shippingCfg.free_shipping_min > 0 && subtotal >= shippingCfg.free_shipping_min) return 0;
    return shippingCfg.shipping_cost;
  }

  function cartTotal() {
    return getCart().reduce((s, i) => s + i.price * i.quantity, 0);
  }

  // Shipping only applies to physical products
  function physicalTotal() {
    return getCart().filter(i => !isDigital(i.slug)).reduce((s, i) => s + i.price * i.quantity, 0);
  }

  function cartCount() {
    return getCart().reduce((s, i) => s + i.quantity, 0);
  }

  // ── Format helpers ────────────────────────────────────────────────

  function fmt(n) {
    return '$' + n.toLocaleString('es-CL');
  }

  // ── Toast notification ────────────────────────────────────────────

  function showToast(msg) {
    let t = document.getElementById('ukra-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ukra-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      Object.assign(t.style, {
        position: 'fixed', bottom: '100px', right: '24px', zIndex: '10001',
        background: '#1e1b15', color: '#fff', padding: '14px 22px',
        borderRadius: '12px', fontFamily: 'Inter,system-ui,sans-serif',
        fontSize: '.9rem', fontWeight: '600', boxShadow: '0 8px 28px rgba(0,0,0,.25)',
        transform: 'translateY(20px)', opacity: '0', transition: 'all .3s ease',
        maxWidth: '320px', pointerEvents: 'none',
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(20px)';
    }, 2500);
  }

  // ── Floating cart badge ───────────────────────────────────────────

  function createBadge() {
    if (document.getElementById('ukra-cart-btn')) return;
    const btn = document.createElement('a');
    btn.id = 'ukra-cart-btn';
    btn.href = '/checkout/';
    btn.setAttribute('aria-label', 'Ver carrito');
    btn.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg><span id="ukra-cart-count" style="position:absolute;top:-4px;right:-4px;background:#D9381E;color:#fff;font-size:.7rem;font-weight:800;min-width:20px;height:20px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif">0</span>`;
    Object.assign(btn.style, {
      position: 'fixed', bottom: '96px', right: '24px', zIndex: '10000',
      width: '56px', height: '56px', borderRadius: '50%',
      background: '#D9381E', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 16px rgba(0,0,0,.2)', textDecoration: 'none',
      transition: 'transform .2s',
    });
    btn.onmouseenter = () => btn.style.transform = 'scale(1.08)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    document.body.appendChild(btn);
    updateBadge();
  }

  function updateBadge() {
    const el = document.getElementById('ukra-cart-count');
    if (el) {
      const c = cartCount();
      el.textContent = c;
      el.style.display = c > 0 ? 'flex' : 'none';
    }
  }

  // ── Product page: parse JSON-LD and add button ────────────────────

  // fetch with a timeout so a slow API never blocks the page
  function fetchJSON(url, ms = 6000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .finally(() => clearTimeout(t));
  }

  function initProductPage() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let product = null;
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent);
        if (d['@type'] === 'Product') { product = d; break; }
      } catch {}
    }
    if (!product) return;

    const slug = window.location.pathname.split('/').filter(Boolean).pop();
    const info = {
      slug,
      name: product.name,
      price: parseInt(product.offers?.price || 0),
      image: Array.isArray(product.image) ? product.image[0] : product.image,
    };
    if (!info.price) return;

    function showPrice(price) {
      // Update displayed price on the page
      const priceStrong = document.querySelector('.price-panel strong');
      if (priceStrong) priceStrong.innerHTML = fmt(price) + ' <small>CLP</small>';
      // Update buy-box price if present
      document.querySelectorAll('.buy-box p strong').forEach(el => {
        if (/\$[\d.,]+/.test(el.textContent)) el.textContent = fmt(price) + ' CLP';
      });
    }

    function createCartBtn(fullWidth, status) {
      const isAvailable = status === 'available';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-cart';
      if (isAvailable) {
        btn.innerHTML = '🛒 Agregar al carrito';
        Object.assign(btn.style, {
          background: '#1e1b15', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', padding: '13px 22px', borderRadius: '999px',
          fontWeight: '700', fontSize: '.88rem', transition: '.2s',
        });
        if (fullWidth) btn.style.width = '100%', btn.style.marginTop = '10px';
        btn.onmouseenter = () => { btn.style.background = '#333'; btn.style.transform = 'translateY(-1px)'; };
        btn.onmouseleave = () => { btn.style.background = '#1e1b15'; btn.style.transform = 'none'; };
        btn.onclick = (e) => { e.preventDefault(); addToCart({ ...info }); };
      } else {
        const label = status === 'agotado' ? '🔴 Producto Agotado' : '⚫ No Disponible';
        btn.innerHTML = label;
        btn.disabled = true;
        Object.assign(btn.style, {
          background: '#94a3b8', color: '#fff', border: 'none', cursor: 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', padding: '13px 22px', borderRadius: '999px',
          fontWeight: '700', fontSize: '.88rem', opacity: '.7',
        });
        if (fullWidth) btn.style.width = '100%', btn.style.marginTop = '10px';
      }
      return btn;
    }

    function setStatus(status) {
      document.querySelectorAll('.btn-cart').forEach(old => {
        old.replaceWith(createCartBtn(old.style.width === '100%', status));
      });
    }

    // 1) Show the cart buttons right away (assume available); the API only refines them.
    document.querySelectorAll('.action-row, .buy-box').forEach(container => {
      if (container.querySelector('.btn-cart')) return;
      container.appendChild(createCartBtn(false, 'available'));
    });
    document.querySelectorAll('.card .btn-wa').forEach(waBtn => {
      const card = waBtn.closest('.card');
      if (!card || card.querySelector('.btn-cart')) return;
      card.appendChild(createCartBtn(true, 'available'));
    });

    // 2) Refresh price/status of the currently selected product from the DB.
    let reqId = 0;
    function refreshFromDB() {
      const id = ++reqId;
      const forSlug = info.slug;
      fetchJSON(`/api/products?slug=${encodeURIComponent(forSlug)}`).then(d => {
        if (!d || id !== reqId || info.slug !== forSlug) return; // stale or failed: keep defaults
        if (d.price) { info.price = d.price; showPrice(d.price); }
        setStatus(d.status || 'available');
      });
    }

    // 3) Color/variant picker. Markup: <button class="variant-btn" data-slug data-name
    // data-image data-price data-param data-alt>. Each variant is its own DB product
    // (own SKU, price, status) but shares this page, so there is no duplicate URL.
    const vbtns = document.querySelectorAll('.variant-btn');
    function selectVariant(b, updateUrl) {
      vbtns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      info.slug = b.dataset.slug;
      info.name = b.dataset.name;
      info.image = b.dataset.image;
      info.price = parseInt(b.dataset.price) || info.price;
      showPrice(info.price);
      setStatus('available');
      const main = document.getElementById('mainShot');
      if (main && b.dataset.image) {
        main.src = b.dataset.image;
        if (b.dataset.alt) main.alt = b.dataset.alt;
        document.querySelectorAll('.thumbs button').forEach(t =>
          t.setAttribute('aria-current', t.dataset.src === b.dataset.image ? 'true' : 'false'));
      }
      const label = document.getElementById('variant-label');
      if (label) label.textContent = b.textContent.trim();
      if (updateUrl) {
        const url = b.dataset.param ? `?color=${b.dataset.param}` : location.pathname;
        history.replaceState(null, '', url);
      }
      refreshFromDB();
    }
    vbtns.forEach(b => b.addEventListener('click', () => selectVariant(b, true)));
    const wanted = new URLSearchParams(location.search).get('color');
    const pre = [...vbtns].find(b => b.dataset.param && b.dataset.param === wanted);
    if (pre) selectVariant(pre, false);
    else refreshFromDB();
  }

  // ── Catalog page: add mini-cart buttons to product cards ───────────

  async function initCatalogPage() {
    // Fetch all products status from DB
    let dbProducts = {};
    const data = await fetchJSON('/api/products');
    if (data) (data.products || []).forEach(p => { dbProducts[p.slug] = p; });

    document.querySelectorAll('.card-prod').forEach(card => {
      const link = card.querySelector('.card-prod-title a');
      const priceEl = card.querySelector('.card-prod-price');
      const imgEl = card.querySelector('.card-prod-media img');
      if (!link || !priceEl) return;

      const name = link.textContent.trim();
      const slug = link.getAttribute('href').split('/').filter(Boolean).pop();
      const dbProd = dbProducts[slug];
      const price = dbProd ? dbProd.price : parseInt(priceEl.textContent.replace(/[^\d]/g, ''));
      const image = imgEl ? imgEl.getAttribute('src') : '';
      const status = dbProd ? dbProd.status : 'available';
      if (!price) return;

      // Update displayed price if different from DB
      if (dbProd && dbProd.price) {
        priceEl.textContent = fmt(dbProd.price);
      }

      const media = card.querySelector('.card-prod-media');
      if (!media) return;
      media.style.position = 'relative';

      if (status === 'available') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card-prod-cart-btn';
        btn.innerHTML = '🛒';
        btn.title = 'Agregar al carrito';
        Object.assign(btn.style, {
          position: 'absolute', top: '8px', right: '8px', zIndex: '5',
          width: '36px', height: '36px', borderRadius: '50%',
          background: '#D9381E', color: '#fff', border: 'none',
          fontSize: '1rem', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,.15)', transition: '.2s',
        });
        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          addToCart({ slug, name, price, image });
        };
        media.appendChild(btn);
      } else {
        // Show "Agotado" badge
        const badge = document.createElement('span');
        badge.textContent = status === 'agotado' ? 'Agotado' : 'No disponible';
        Object.assign(badge.style, {
          position: 'absolute', top: '8px', right: '8px', zIndex: '5',
          background: status === 'agotado' ? '#ef4444' : '#64748b',
          color: '#fff', padding: '4px 12px', borderRadius: '999px',
          fontSize: '.72rem', fontWeight: '700', textTransform: 'uppercase',
        });
        media.appendChild(badge);
      }
    });
  }

  // ── Checkout page: render cart and form ────────────────────────────

  function initCheckoutPage() {
    const container = document.getElementById('checkout-cart');
    const form = document.getElementById('checkout-form');
    const totalEl = document.getElementById('checkout-total');
    const emptyEl = document.getElementById('checkout-empty');
    const contentEl = document.getElementById('checkout-content');
    if (!container) return;

    fetch('/api/shipping').then(r => r.ok ? r.json() : null).then(cfg => {
      if (!cfg) return;
      for (const k of ['shipping_cost', 'free_shipping_min']) {
        const n = parseInt(cfg[k]);
        if (!isNaN(n) && n >= 0) shippingCfg[k] = n;
      }
      render();
    }).catch(() => {});

    function render() {
      const cart = getCart();
      if (!cart.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';

      container.innerHTML = cart.map(item => `
        <div class="cart-item" data-slug="${esc(item.slug)}">
          <img src="${esc(item.image)}" alt="${esc(item.name)}" width="80" height="80" style="object-fit:contain;background:#fff;border-radius:8px;border:1px solid #e2e8f0">
          <div class="cart-item-info">
            <strong>${esc(item.name)}</strong>${isDigital(item.slug) ? ' <small style="color:#16a34a;font-weight:700">· Descarga digital</small>' : ''}
            <span class="cart-item-price">${fmt(item.price)} × ${item.quantity} = ${fmt(item.price * item.quantity)}</span>
            <div class="cart-item-controls">
              <button type="button" class="qty-btn" data-action="minus">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button type="button" class="qty-btn" data-action="plus">+</button>
              <button type="button" class="qty-btn remove" data-action="remove">✕ Quitar</button>
            </div>
          </div>
        </div>
      `).join('');

      const subtotal = cartTotal();
      const physical = cart.filter(i => !isDigital(i.slug));
      const digitalOnly = physical.length === 0;
      const physSub = physicalTotal();
      const shipping = digitalOnly ? 0 : shippingFor(physSub);
      // Digital-only orders don't need a delivery address
      ['customer_address', 'customer_comuna', 'customer_region'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const group = el.closest('.form-group');
        if (group) group.style.display = digitalOnly ? 'none' : '';
        el.required = !digitalOnly;
      });
      if (totalEl) totalEl.textContent = fmt(subtotal + shipping);
      const subEl = document.getElementById('checkout-subtotal');
      const shipEl = document.getElementById('checkout-shipping');
      const hintEl = document.getElementById('ship-hint');
      if (subEl) subEl.textContent = fmt(subtotal);
      if (shipEl) shipEl.innerHTML = digitalOnly ? '<span class="free">No aplica</span>' : shipping ? fmt(shipping) : '<span class="free">Gratis</span>';
      const noteEl = document.getElementById('ship-note');
      if (noteEl && digitalOnly) {
        noteEl.textContent = 'Producto digital: recibes el enlace de descarga apenas se confirme el pago.';
      } else if (noteEl) {
        const { shipping_cost: c, free_shipping_min: m } = shippingCfg;
        noteEl.textContent = !c ? 'Envío gratis en todas las compras.'
          : m > 0 ? `Envío gratis en compras desde ${fmt(m)}. Bajo ese monto, el envío cuesta ${fmt(c)}.`
          : `Envío a todo Chile: ${fmt(c)}.`;
      }
      if (hintEl && digitalOnly) {
        hintEl.className = 'ship-hint';
        hintEl.textContent = '⬇️ Descarga inmediata después del pago';
      } else if (hintEl) {
        const offersFree = shippingCfg.free_shipping_min > 0;
        hintEl.style.display = (shipping && !offersFree) ? 'none' : '';
        if (shipping && offersFree) {
          const missing = shippingCfg.free_shipping_min - physSub;
          const pct = Math.min(100, Math.round(physSub / shippingCfg.free_shipping_min * 100));
          hintEl.className = 'ship-hint pending';
          hintEl.innerHTML = `Te faltan <strong>${fmt(missing)}</strong> para tener envío gratis<div class="ship-bar"><span style="width:${pct}%"></span></div>`;
        } else {
          hintEl.className = 'ship-hint';
          hintEl.textContent = '🚚 ¡Tu compra tiene envío gratis!';
        }
      }

      // Bind controls
      container.querySelectorAll('.qty-btn').forEach(btn => {
        btn.onclick = () => {
          const slug = btn.closest('.cart-item').dataset.slug;
          const action = btn.dataset.action;
          const cart2 = getCart();
          const item = cart2.find(i => i.slug === slug);
          if (!item) return;
          if (action === 'minus' && item.quantity > 1) updateQuantity(slug, item.quantity - 1);
          else if (action === 'plus') updateQuantity(slug, item.quantity + 1);
          else if (action === 'remove') removeFromCart(slug);
          render();
        };
      });
    }

    render();

    // Payment methods: Mercado Pago shows up only when it's configured.
    let gateway = 'flow';
    const payBox = document.getElementById('pay-methods');
    const payBtn = form ? form.querySelector('button[type="submit"]') : null;
    const payNote = document.getElementById('secure-note-text');
    const setGateway = g => {
      gateway = g;
      if (payBtn && !payBtn.disabled) payBtn.textContent = g === 'mercadopago' ? 'Pagar con Mercado Pago' : 'Pagar con Flow';
      if (payNote) payNote.textContent = g === 'mercadopago'
        ? 'Pago seguro procesado por Mercado Pago — Tarjetas de crédito, débito, saldo en Mercado Pago y cuotas'
        : 'Pago seguro procesado por Flow.cl — Aceptamos tarjetas de crédito, débito y transferencia';
    };
    if (payBox && form) {
      fetch('/api/payment-methods').then(r => r.ok ? r.json() : null).then(m => {
        if (!m || !m.mercadopago) return;
        payBox.classList.add('on');
        const checked = form.querySelector('input[name="payment_method"]:checked');
        setGateway(checked ? checked.value : 'mercadopago');
        form.querySelectorAll('input[name="payment_method"]').forEach(r => { r.onchange = () => setGateway(r.value); });
      }).catch(() => {});
    }

    // Form submit
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const cart = getCart();
        if (!cart.length) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';

        const payload = {
          customer_name: form.customer_name.value.trim(),
          customer_email: form.customer_email.value.trim(),
          customer_phone: form.customer_phone.value.trim(),
          customer_address: form.customer_address ? form.customer_address.value.trim() : '',
          customer_comuna: form.customer_comuna.value.trim(),
          customer_region: form.customer_region ? form.customer_region.value.trim() : '',
          items: cart,
          payment_method: gateway,
        };

        try {
          const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Error al procesar la compra');
          }

          // Clear cart and redirect to the payment page (Flow or Mercado Pago)
          clearCart();
          window.location.href = data.paymentUrl;
        } catch (err) {
          alert(err.message || 'Error al conectar con el servidor. Intenta de nuevo.');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      };
    }
  }

  // ── Order confirmation page ───────────────────────────────────────

  function initOrderPage() {
    const container = document.getElementById('order-detail');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const orderNum = params.get('order');
    const status = params.get('status');
    const error = params.get('error');
    const dl = params.get('dl');

    if (error) {
      container.innerHTML = `<div class="order-status error"><h2>Error en el pago</h2><p>No pudimos procesar tu pago. Por favor intenta de nuevo o contáctanos por WhatsApp.</p><a href="/checkout/" class="btn-back">Volver al carrito</a></div>`;
      return;
    }

    if (!orderNum) {
      container.innerHTML = `<p>No se encontró información de la orden.</p>`;
      return;
    }

    // Fetch order details
    fetch(`/api/order-status?order=${encodeURIComponent(orderNum)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          container.innerHTML = `<p>${data.error}</p>`;
          return;
        }

        const statusLabels = {
          paid: { text: 'Pago confirmado', cls: 'success', icon: '✓' },
          pending: { text: 'Pago pendiente', cls: 'warning', icon: '⏳' },
          rejected: { text: 'Pago rechazado', cls: 'error', icon: '✕' },
          cancelled: { text: 'Pago cancelado', cls: 'error', icon: '✕' },
        };
        const s = statusLabels[data.status] || statusLabels.pending;

        container.innerHTML = `
          <div class="order-status ${s.cls}">
            <span class="order-icon">${s.icon}</span>
            <h2>${s.text}</h2>
            <p class="order-num">Orden: <strong>${esc(data.order_number)}</strong></p>
          </div>
          ${data.has_digital ? downloadBox(data, dl) : ''}
          <div class="order-products">
            <h3>Productos</h3>
            ${data.products.map(p => `
              <div class="order-product-row">
                <span>${p.slug === 'envio' ? esc(p.name) : `${esc(p.name)} × ${p.quantity}`}</span>
                <strong>${p.slug === 'envio' && !p.price ? 'Gratis' : fmt(p.price * p.quantity)}</strong>
              </div>
            `).join('')}
            <div class="order-total-row">
              <span>Total</span>
              <strong>${fmt(data.total)}</strong>
            </div>
          </div>
          <p class="order-info">Cliente: ${esc(data.customer_name)}<br>Fecha: ${new Date(data.created_at).toLocaleDateString('es-CL', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
          ${data.status === 'paid' && data.has_physical !== false ? '<p class="order-info success-msg">Te contactaremos por email para coordinar el envío.</p>' : ''}
          <a href="/productos/" class="btn-back">Seguir comprando</a>
        `;
      })
      .catch(() => {
        container.innerHTML = `<p>No se pudo cargar la orden. Intenta recargar la página.</p>`;
      });
  }

  function downloadBox(data, dl) {
    const box = 'margin:18px 0;padding:18px;border-radius:14px;border:2px solid #16a34a;background:#f0fdf4;text-align:center';
    if (!dl) {
      return `<div style="${box}"><strong>Descarga digital</strong><p style="margin:8px 0 0">Si no ves tu enlace de descarga, escríbenos por <a href="https://wa.me/56993514970">WhatsApp</a> con tu número de orden y te lo enviamos.</p></div>`;
    }
    const href = `/api/download?order=${encodeURIComponent(data.order_number)}&token=${encodeURIComponent(dl)}`;
    if (data.status === 'paid') {
      const names = data.products.filter(p => isDigital(p.slug)).map(p => esc(p.name)).join(' · ');
      return `<div style="${box}"><strong style="font-size:1.05rem">Tu descarga está lista</strong>
        <p style="margin:8px 0 14px">${names}</p>
        <a href="${href}" style="display:inline-block;background:#16a34a;color:#fff;padding:13px 24px;border-radius:999px;font-weight:800;text-decoration:none">⬇️ Descargar (.zip)</a>
        <p style="margin:12px 0 0;font-size:.85rem;color:#475569">Guarda esta página en favoritos: el enlace es personal y puedes volver a usarlo.</p></div>`;
    }
    if (data.status === 'pending') {
      return `<div style="${box};border-color:#f59e0b;background:#fffbeb"><strong>Descarga en espera</strong>
        <p style="margin:8px 0 14px">Tu descarga se habilita apenas se confirme el pago. Guarda esta página y vuelve a intentarlo en unos minutos.</p>
        <a href="${href}" style="display:inline-block;background:#1e1b15;color:#fff;padding:11px 20px;border-radius:999px;font-weight:700;text-decoration:none">Intentar descarga</a></div>`;
    }
    return '';
  }

  // ── "Agregar al carrito" buttons on any page (blog boxes, landings) ──
  // Markup: <button data-add-cart data-slug data-name data-price data-image>
  function initAddCartButtons() {
    document.querySelectorAll('[data-add-cart]').forEach(btn => {
      if (btn._ukraBound) return;
      btn._ukraBound = true;
      btn.addEventListener('click', e => {
        e.preventDefault();
        if (btn.dataset.items) {
          // Bundle button: data-items='[{"slug","name","price","image"}, ...]'
          let items = [];
          try { items = JSON.parse(btn.dataset.items); } catch {}
          items.filter(i => i.slug && parseInt(i.price)).forEach(i => addToCart({ slug: i.slug, name: i.name, price: parseInt(i.price), image: i.image || '' }));
          if (items.length) showToast(`${items.length} productos agregados al carrito`);
        } else {
          const price = parseInt(btn.dataset.price);
          if (!btn.dataset.slug || !price) return;
          addToCart({ slug: btn.dataset.slug, name: btn.dataset.name, price, image: btn.dataset.image || '' });
        }
        if (btn.dataset.goCheckout !== undefined) setTimeout(() => { location.href = '/checkout/'; }, 400);
      });
    });
  }

  // ── AdSense on product pages / catalog (toggled from /admin/) ─────

  const ADS_CLIENT = 'ca-pub-7032484018692343';
  const ADS_SLOT = '7434550690';

  function makeAdSlot() {
    const wrap = document.createElement('div');
    wrap.className = 'ukra-ad';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Publicidad');
    wrap.style.cssText = 'margin:28px 0;min-height:280px;text-align:center;clear:both';
    wrap.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="${ADS_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    return wrap;
  }

  async function initAds() {
    const cfg = await fetchJSON('/api/site-config', 4000);
    if (!cfg || !cfg.adsense_products) return;
    if (document.querySelector('.ukra-ad')) return;

    // Where to place up to 3 ad units
    const spots = [];
    const prose = document.querySelector('article.prose');
    if (prose) {
      // Product page: after the table of contents, before the first buy box, before the FAQ
      const toc = prose.querySelector('.toc');
      if (toc) spots.push(['after', toc]);
      const buy = prose.querySelector('.buy-box');
      if (buy) spots.push(['before', buy]);
      const faq = prose.querySelector('#preguntas') || prose.querySelector('.sources') || prose.querySelector('.disclosure');
      if (faq) spots.push(['before', faq]);
    } else {
      // Catalog: before the grid, between the two grids, after the last grid
      const g1 = document.getElementById('prodGrid');
      const g2 = document.getElementById('prodGrid2');
      if (g1) spots.push(['before', g1]);
      if (g2) spots.push(['before', g2]);
      const last = g2 || g1;
      if (last) spots.push(['after', last]);
    }
    if (!spots.length) return;

    spots.slice(0, 3).forEach(([where, el]) => {
      const ad = makeAdSlot();
      if (where === 'after') el.insertAdjacentElement('afterend', ad);
      else el.insertAdjacentElement('beforebegin', ad);
    });

    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const sc = document.createElement('script');
      sc.async = true;
      sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
      sc.crossOrigin = 'anonymous';
      document.head.appendChild(sc);
    }
    document.querySelectorAll('.ukra-ad ins.adsbygoogle').forEach(() => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    });
  }

  // ── Init ──────────────────────────────────────────────────────────

  function init() {
    createBadge();
    initAddCartButtons();
    const path = window.location.pathname;
    if (path.startsWith('/producto/')) initProductPage();
    if (path.startsWith('/productos')) initCatalogPage();
    if (path.startsWith('/producto/') || path.startsWith('/productos')) initAds();
    if (path.startsWith('/checkout')) initCheckoutPage();
    if (path.startsWith('/orden')) initOrderPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.UkraCart = { getCart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount };
})();
