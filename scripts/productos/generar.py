#!/usr/bin/env python3
"""Generador de fichas de producto físico para Ferretería Ukra.

Lee una ficha en JSON (ver scripts/productos/README.md) y deja el producto
publicado con el mismo formato y carrito que el resto de la tienda:

  * producto/<slug>.html        página de la ficha (desde plantilla.html)
  * producto/<slug>[-0N].webp   fotos convertidas a 1200 × 1200
  * productos/index.html        tarjeta en el catálogo + ItemList
  * src/worker.js               registro en SEED_PRODUCTS (carrito y pago)
  * sitemap.xml                 URL nueva

Uso:
  python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json --prueba
  python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json
  python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json --actualizar
  python3 scripts/productos/generar.py --verificar <slug>

--prueba     valida todo y muestra qué cambiaría, sin escribir nada.
--actualizar vuelve a generar la página, las fotos y la tarjeta de un
             producto existente (no toca el precio en el servidor: el precio
             vigente se cambia en /admin/).
--verificar  revisa que un producto publicado esté completo y consistente.

El script se niega a continuar ante cualquier error: no deja cambios a medias.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SITE = "https://www.ferreteriaukra.cl"
WA = "56993514970"

CATEGORIAS = {
    # clave: (etiqueta visible, categoría en el servidor)
    "herramientas": ("Herramientas", "Herramientas"),
    "electricidad": ("Material eléctrico", "Material Eléctrico"),
    "bombas": ("Bombas de agua", "Bombas de Agua"),
    "gasfiteria": ("Gasfitería", "Gasfitería"),
    "otros": ("Otros", "Otros"),
}
PROHIBIDAS = ["sodimac", "easy.cl", "falabella", "mercadolibre", "mercado libre", "paris.cl", "lider.cl",
              "lorem", "ipsum", "xxx", "{{", "}}", "chatgpt", "como modelo de lenguaje"]
MARCA = "<!-- generado: scripts/productos/generar.py -->"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ID_RE = re.compile(r"^[a-z][a-z0-9-]{1,40}$")

WA_SVG = ('<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6 0-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>')


class FichaError(Exception):
    pass


# ── utilidades ─────────────────────────────────────────────────────────
def fmt_clp(n: int) -> str:
    return "$" + f"{n:,}".replace(",", ".")


def esc(t: str) -> str:
    return html.escape(str(t), quote=True)


def leer(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def existe_producto(slug: str) -> bool:
    return (ROOT / "producto" / f"{slug}.html").exists()


def existe_guia(url: str) -> bool:
    m = re.fullmatch(r"/blog/([a-z0-9-]+)/?", url)
    return bool(m) and (ROOT / "blog" / f"{m.group(1)}.html").exists()


def validar_url(url: str, donde: str) -> str:
    """Solo enlaces internos a fichas o guías que existen."""
    if url in ("/", "/productos/", "/productos-digitales/"):
        return url
    m = re.fullmatch(r"/producto/([a-z0-9-]+)/?", url)
    if m:
        if not existe_producto(m.group(1)):
            raise FichaError(f"{donde}: el enlace {url} apunta a un producto que no existe")
        return f"/producto/{m.group(1)}"
    if url.startswith("/blog/"):
        if not existe_guia(url):
            raise FichaError(f"{donde}: el enlace {url} apunta a una guía que no existe")
        return url
    raise FichaError(f"{donde}: solo se permiten enlaces internos (/producto/… o /blog/…), no {url}")


def texto(t, donde: str, minimo: int = 1, maximo: int = 2000) -> str:
    if not isinstance(t, str):
        raise FichaError(f"{donde}: debe ser texto")
    t = " ".join(t.split())
    if not (minimo <= len(t) <= maximo):
        raise FichaError(f"{donde}: largo {len(t)} fuera de rango ({minimo}–{maximo} caracteres)")
    if "<" in t or ">" in t:
        raise FichaError(f"{donde}: no uses HTML; para negrita usa **así** y para enlaces [texto](/producto/slug)")
    if "TODO" in t:
        raise FichaError(f"{donde}: contiene «TODO» (texto pendiente)")
    low = t.lower()
    for p in PROHIBIDAS:
        if re.search(r"(?<![a-z])" + re.escape(p) + r"(?![a-z])", low):
            raise FichaError(f"{donde}: contiene «{p}», que no se permite en una ficha")
    return t


def md(t: str, donde: str) -> str:
    """Texto plano con **negrita** y [enlace](/ruta) → HTML seguro."""
    t = texto(t, donde)
    out, pos = [], 0
    for m in re.finditer(r"\[([^\]]+)\]\(([^)\s]+)\)", t):
        out.append(_negrita(esc(t[pos:m.start()])))
        out.append(f'<a href="{esc(validar_url(m.group(2), donde))}">{_negrita(esc(m.group(1)))}</a>')
        pos = m.end()
    out.append(_negrita(esc(t[pos:])))
    res = "".join(out)
    if "**" in res:
        raise FichaError(f"{donde}: hay ** sin cerrar")
    return res


def _negrita(s: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)


def plano(t: str) -> str:
    """Quita el formato (para JSON-LD y atributos)."""
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    return t.replace("**", "")


# ── validación de la ficha ─────────────────────────────────────────────
def cargar_ficha(path: Path, actualizar: bool) -> dict:
    try:
        f = json.loads(leer(path))
    except json.JSONDecodeError as e:
        raise FichaError(f"El JSON no es válido: {e}")
    req = ["slug", "nombre", "titulo_h1", "titulo_corto", "marca", "sku", "precio", "categoria", "subcategoria",
           "seo_titulo", "meta_descripcion", "og_descripcion", "descripcion", "lede", "fotos", "especificaciones",
           "confianza", "secciones", "faq", "lateral", "tarjeta"]
    falta = [k for k in req if k not in f]
    if falta:
        raise FichaError("Faltan campos obligatorios: " + ", ".join(falta))
    slug = f["slug"]
    if not isinstance(slug, str) or not SLUG_RE.match(slug) or len(slug) > 80:
        raise FichaError("slug: solo minúsculas, números y guiones (máx. 80), ej. taladro-percutor-750w-marca")
    if path.stem != slug:
        raise FichaError(f"El archivo debe llamarse {slug}.json")
    if existe_producto(slug) and not actualizar:
        raise FichaError(f"Ya existe producto/{slug}.html. Para regenerarlo usa --actualizar")
    if actualizar and not existe_producto(slug):
        raise FichaError(f"--actualizar: no existe producto/{slug}.html")
    if actualizar and MARCA not in leer(ROOT / "producto" / f"{slug}.html"):
        raise FichaError(f"producto/{slug}.html no fue creado con el generador: no se puede sobrescribir")
    if not isinstance(f["precio"], int) or not (100 <= f["precio"] <= 10_000_000):
        raise FichaError("precio: número entero en pesos, sin puntos (ej. 5890)")
    if f["categoria"] not in CATEGORIAS:
        raise FichaError("categoria: usa una de " + ", ".join(CATEGORIAS))
    f["sku"] = texto(str(f["sku"]), "sku", 3, 40)
    for k, lo, hi in [("nombre", 10, 120), ("titulo_h1", 10, 90), ("titulo_corto", 8, 70), ("marca", 2, 40),
                      ("subcategoria", 3, 50), ("seo_titulo", 15, 60), ("meta_descripcion", 110, 175),
                      ("og_descripcion", 40, 160), ("descripcion", 80, 600)]:
        f[k] = texto(f[k], k, lo, hi)
    texto(f["lede"], "lede", 120, 600)
    if f.get("color"):
        f["color"] = texto(f["color"], "color", 3, 30)
    # fotos
    fotos = f["fotos"]
    if not isinstance(fotos, list) or not (1 <= len(fotos) <= 6):
        raise FichaError("fotos: entre 1 y 6")
    carpeta = HERE / "fotos" / slug
    for i, ft in enumerate(fotos, 1):
        if not isinstance(ft, dict) or "archivo" not in ft or "alt" not in ft:
            raise FichaError(f"fotos[{i}]: necesita «archivo» y «alt»")
        p = carpeta / ft["archivo"]
        if not p.is_file():
            raise FichaError(f"fotos[{i}]: no encuentro {p.relative_to(ROOT)}")
        ft["_ruta"] = p
        ft["alt"] = texto(ft["alt"], f"fotos[{i}].alt", 15, 160)
        ft["miniatura"] = texto(ft.get("miniatura", f"Ver foto {i}"), f"fotos[{i}].miniatura", 5, 80)
    # especificaciones
    esp = f["especificaciones"]
    if not isinstance(esp, list) or len(esp) < 4:
        raise FichaError("especificaciones: al menos 4 filas [nombre, valor]")
    f["especificaciones"] = [[texto(a, f"especificaciones[{i}][0]", 2, 40), texto(b, f"especificaciones[{i}][1]", 1, 160)]
                             for i, (a, b) in enumerate(esp, 1)]
    if not any(a.lower() == "marca" for a, _ in f["especificaciones"]):
        raise FichaError("especificaciones: incluye una fila «Marca»")
    # confianza
    if not isinstance(f["confianza"], list) or len(f["confianza"]) != 4:
        raise FichaError("confianza: exactamente 4 elementos {titulo, detalle}")
    for i, c in enumerate(f["confianza"], 1):
        texto(c.get("titulo", ""), f"confianza[{i}].titulo", 4, 40); texto(c.get("detalle", ""), f"confianza[{i}].detalle", 4, 70)
    # secciones
    if not isinstance(f["secciones"], list) or len(f["secciones"]) < 2:
        raise FichaError("secciones: al menos 2")
    ids = {"ficha-tecnica", "preguntas"}
    for i, sec in enumerate(f["secciones"], 1):
        if not ID_RE.match(str(sec.get("id", ""))) or sec["id"] in ids:
            raise FichaError(f"secciones[{i}].id: minúsculas y guiones, único (no uses ficha-tecnica ni preguntas)")
        ids.add(sec["id"])
        texto(sec.get("titulo", ""), f"secciones[{i}].titulo", 8, 90)
        texto(sec.get("indice", sec.get("titulo", "")), f"secciones[{i}].indice", 4, 60)
        if not isinstance(sec.get("bloques"), list) or not sec["bloques"]:
            raise FichaError(f"secciones[{i}].bloques: al menos un bloque")
    # faq
    if not isinstance(f["faq"], list) or not (3 <= len(f["faq"]) <= 8):
        raise FichaError("faq: entre 3 y 8 preguntas")
    for i, q in enumerate(f["faq"], 1):
        p = texto(q.get("pregunta", ""), f"faq[{i}].pregunta", 10, 140)
        if not p.startswith("¿") or not p.endswith("?"):
            raise FichaError(f"faq[{i}].pregunta: escríbela entre ¿ y ?")
        texto(q.get("respuesta", ""), f"faq[{i}].respuesta", 30, 600)
    lat = f["lateral"]
    for k, lo, hi in [("etiqueta", 3, 30), ("titulo", 6, 60), ("texto", 30, 220)]:
        texto(lat.get(k, ""), f"lateral.{k}", lo, hi)
    tj = f["tarjeta"]
    for k, lo, hi in [("titulo", 8, 70), ("extracto", 60, 200), ("alt", 15, 160)]:
        texto(tj.get(k, ""), f"tarjeta.{k}", lo, hi)
    if tj.get("etiqueta"):
        texto(tj["etiqueta"], "tarjeta.etiqueta", 3, 40)
    # relacionados y guías
    rel = []
    for i, r in enumerate(f.get("relacionados", []), 1):
        s, t = (r, None) if isinstance(r, str) else (r.get("slug"), r.get("texto"))
        if not s or not existe_producto(s) or s == slug:
            raise FichaError(f"relacionados[{i}]: «{s}» no es un producto existente")
        rel.append((s, texto(t, f"relacionados[{i}].texto", 4, 70) if t else titulo_de(s)))
    if len(rel) > 10:
        raise FichaError("relacionados: máximo 10")
    f["_relacionados"] = rel
    guias = []
    for i, g in enumerate(f.get("guias", []), 1):
        if not existe_guia(g.get("url", "")):
            raise FichaError(f"guias[{i}]: «{g.get('url')}» no es una guía existente")
        guias.append((g["url"], texto(g.get("texto", ""), f"guias[{i}].texto", 4, 60)))
    f["_guias"] = guias
    if f.get("whatsapp"):
        texto(f["whatsapp"], "whatsapp", 10, 200)
    for k in ("microcopy", "aviso_final"):
        if f.get(k):
            texto(f[k], k, 10, 300)
    st = f.get("stock") or {}
    texto(st.get("titulo", "En stock"), "stock.titulo", 3, 30); texto(st.get("detalle", "Despacho en 24-48 h hábiles"), "stock.detalle", 5, 60)
    # SKU único en el servidor
    w = leer(ROOT / "src" / "worker.js")
    seed = w[w.index("const SEED_PRODUCTS = ["):]
    seed = seed[:seed.index("\n];")]
    for m in re.finditer(r"slug: '([^']+)',(?:\n.*){5}\n\s*sku: '([^']*)'", seed):
        if m.group(2) == f["sku"] and m.group(1) != slug:
            raise FichaError(f"sku {f['sku']} ya lo usa {m.group(1)}")
    return f


def titulo_de(slug: str) -> str:
    h = leer(ROOT / "producto" / f"{slug}.html")
    m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else slug


# ── render ─────────────────────────────────────────────────────────────
def render_bloque(b: dict, donde: str) -> str:
    if not isinstance(b, dict) or len(b) != 1:
        raise FichaError(f"{donde}: cada bloque es un objeto con una sola clave (p, subtitulo, lista, pasos, tabla, aviso, advertencia)")
    tipo, v = next(iter(b.items()))
    if tipo == "p":
        return f"<p>{md(v, donde)}</p>"
    if tipo == "subtitulo":
        return f"<h3>{esc(texto(v, donde, 4, 90))}</h3>"
    if tipo == "aviso":
        return f'<div class="notice"><p>{md(v, donde)}</p></div>'
    if tipo == "advertencia":
        return f'<div class="warning"><p>{md(v, donde)}</p></div>'
    if tipo in ("lista", "pasos"):
        if not isinstance(v, list) or not v:
            raise FichaError(f"{donde}: «{tipo}» debe ser una lista de textos")
        tag = "ul" if tipo == "lista" else "ol"
        items = "\n".join(f"  <li>{md(x, f'{donde}[{i}]')}</li>" for i, x in enumerate(v, 1))
        return f"<{tag}>\n{items}\n</{tag}>"
    if tipo == "tabla":
        cab, filas = v.get("cabecera"), v.get("filas")
        if not cab or not filas or any(len(r) != len(cab) for r in filas):
            raise FichaError(f"{donde}: la tabla necesita «cabecera» y «filas» del mismo largo")
        th = "".join(f"<th>{esc(texto(c, donde, 1, 60))}</th>" for c in cab)
        trs = "\n".join("<tr>" + "".join(f"<td>{md(c, donde)}</td>" for c in r) + "</tr>" for r in filas)
        return f'<div class="table-wrap">\n<table>\n<thead><tr>{th}</tr></thead>\n<tbody>\n{trs}\n</tbody>\n</table>\n</div>'
    raise FichaError(f"{donde}: tipo de bloque desconocido «{tipo}»")


def render(f: dict, cart_v: str) -> str:
    slug, precio = f["slug"], f["precio"]
    url = f"{SITE}/producto/{slug}"
    cat_label, _ = CATEGORIAS[f["categoria"]]
    n_fotos = len(f["fotos"])
    img_rel = [f"/producto/{slug}{'' if i == 0 else f'-{i + 1:02d}'}.webp" for i in range(n_fotos)]
    wa_txt = f.get("whatsapp") or f"Hola, quiero comprar {f['titulo_corto']} a {fmt_clp(precio)}"
    from urllib.parse import quote
    wa = f"https://wa.me/{WA}?text={quote(wa_txt, safe='')}"
    meta = f["meta_descripcion"].replace("{precio}", fmt_clp(precio))
    props = [{"@type": "PropertyValue", "name": a, "value": b} for a, b in f["especificaciones"] if a.lower() not in ("marca", "color")]
    ld_prod = {"@context": "https://schema.org", "@type": "Product", "name": f["nombre"], "description": f["descripcion"],
               "image": [SITE + p for p in img_rel], "brand": {"@type": "Brand", "name": f["marca"]}}
    if f.get("color"):
        ld_prod["color"] = f["color"]
    ld_prod.update({"category": f"{cat_label} - {f['subcategoria']}", "sku": f["sku"],
                    "offers": {"@type": "Offer", "url": url, "priceCurrency": "CLP", "price": str(precio),
                               "availability": "https://schema.org/InStock" if f.get("disponible", True) else "https://schema.org/OutOfStock",
                               "itemCondition": "https://schema.org/NewCondition",
                               "areaServed": {"@type": "Country", "name": "Chile"},
                               "seller": {"@type": "Organization", "name": "Ferretería Ukra"}},
                    "additionalProperty": props})
    ld_faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q["pregunta"], "acceptedAnswer": {"@type": "Answer", "text": plano(" ".join(q["respuesta"].split()))}} for q in f["faq"]]}
    ld_bread = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Productos", "item": SITE + "/productos/"},
        {"@type": "ListItem", "position": 3, "name": f["titulo_corto"], "item": url}]}
    ld = lambda d: '<script type="application/ld+json">\n' + json.dumps(d, ensure_ascii=False, indent=1).replace("</", "<\\/") + "\n</script>"

    thumbs = ""
    if n_fotos > 1:
        bts = []
        for i, (p, ft) in enumerate(zip(img_rel, f["fotos"])):
            bts.append(f'      <button type="button"{" aria-current=\"true\"" if i == 0 else ""} data-src="{p}" data-alt="{esc(ft["alt"])}"><img src="{p}" alt="{esc(ft["miniatura"])}" width="84" height="84"{"" if i == 0 else " loading=\"lazy\""}></button>')
        thumbs = '\n    <div class="thumbs" role="group" aria-label="Fotos del producto">\n' + "\n".join(bts) + "\n    </div>"
    st = f.get("stock") or {}
    toc = [("ficha-tecnica", "Ficha técnica")] + [(s["id"], s.get("indice", s["titulo"])) for s in f["secciones"]] + [("preguntas", "Preguntas frecuentes")]
    secciones = []
    for i, s in enumerate(f["secciones"], 1):
        bl = "\n\n".join(render_bloque(b, f"secciones[{i}].bloques[{j}]") for j, b in enumerate(s["bloques"], 1))
        secciones.append(f'<h2 id="{s["id"]}">{esc(s["titulo"])}</h2>\n\n{bl}')
    faqs = "\n\n".join(f"<details>\n  <summary>{esc(q['pregunta'])}</summary>\n  <p>{md(q['respuesta'], f'faq[{i}].respuesta')}</p>\n</details>" for i, q in enumerate(f["faq"], 1))
    ficha_t = f.get("titulo_ficha") or f"Ficha técnica: {f['titulo_corto']}"
    filas = "\n".join(f"<tr><td>{esc(a)}</td><td>{md(b, 'especificaciones')}</td></tr>" for a, b in f["especificaciones"])
    body = f'''<section class="hero" aria-labelledby="titulo-producto">
  <div>
    <div class="eyebrow">{esc(cat_label)} · {esc(f["subcategoria"])}</div>
    <h1 id="titulo-producto">{esc(f["titulo_h1"])}</h1>
    <p class="lede">{md(f["lede"], "lede")}</p>
    <div class="price-panel" role="group" aria-label="Precio y cobertura de envío">
      <span class="price-label">Precio</span><strong>{fmt_clp(precio)} <small>CLP</small></strong><span class="shipping">Envíos a todo Chile</span>
    </div>
    <div class="action-row">
      <a href="{esc(wa)}" class="btn btn-wa" aria-label="Comprar por WhatsApp">
        {WA_SVG}
        Comprar por WhatsApp
      </a>
    </div>
    <p class="microcopy">{esc(f.get("microcopy") or "Pago por transferencia, tarjeta o Flow · IVA incluido")}</p>
  </div>
  <div class="hero-media">
    <div class="main-shot">
      <img id="mainShot" src="{img_rel[0]}" alt="{esc(f["fotos"][0]["alt"])}" width="800" height="800" loading="eager">
      <div class="stock-note">
        <strong>{esc(st.get("titulo", "En stock"))}</strong>
        <span>{esc(st.get("detalle", "Despacho en 24-48 h hábiles"))}</span>
      </div>
    </div>{thumbs}
  </div>
</section>
</main>

<section class="trust" aria-label="Garantías y servicio">
<div class="trust-inner">
''' + "\n".join(f'  <div class="trust-item"><strong>{esc(c["titulo"])}</strong><span>{esc(c["detalle"])}</span></div>' for c in f["confianza"]) + f'''
</div>
</section>

<div class="wrap">
<article class="prose">
<nav class="toc" aria-label="Índice del contenido">
  <h2>Contenido</h2>
  <ol>
''' + "\n".join(f'    <li><a href="#{i}">{esc(t)}</a></li>' for i, t in toc) + f'''
  </ol>
</nav>

<h2 id="ficha-tecnica">{esc(ficha_t)}</h2>

<div class="table-wrap">
<table>
<thead><tr><th>Característica</th><th>Especificación</th></tr></thead>
<tbody>
{filas}
</tbody>
</table>
</div>

''' + "\n\n".join(secciones) + f'''

<h2 id="preguntas">Preguntas frecuentes</h2>

{faqs}

<p class="disclosure">{esc(f.get("aviso_final") or "Los precios incluyen IVA. Revisa siempre la ficha y el manual del fabricante antes de usar el producto.")}</p>

</article>

'''
    lat = f["lateral"]
    aside = f'''  <div class="card">
    <span class="pill">{esc(lat["etiqueta"])}</span>
    <h2>{esc(lat["titulo"])}</h2>
    <p>{esc(lat["texto"])}</p>
    <a href="{esc(wa)}" class="btn btn-wa">Comprar por WhatsApp</a>
  </div>'''
    related = "\n".join(f'      <li><a href="/producto/{s}">{esc(t)}</a></li>' for s, t in f["_relacionados"]) or '      <li><a href="/productos/">Ver todos los productos</a></li>'
    guias = "\n".join(f'      <p><a href="{esc(u)}">→ {esc(t)}</a></p>' for u, t in f["_guias"])
    guias = (guias + "\n" if guias else "") + '      <p><a href="/">→ Todas las guías</a></p>'
    tpl = leer(HERE / "plantilla.html")
    rep = {"TITLE": esc(f"{f['seo_titulo']} | {fmt_clp(precio)}"), "META": esc(meta), "URL": url,
           "OG_TITLE": esc(f"{f['titulo_corto']} a {fmt_clp(precio)}"), "OG_DESC": esc(f["og_descripcion"]),
           "IMG1_ABS": SITE + img_rel[0], "LD_PRODUCT": ld(ld_prod), "LD_FAQ": ld(ld_faq), "LD_BREAD": ld(ld_bread),
           "BODY": body, "ASIDE_BUY": aside, "RELATED": related, "GUIAS": guias, "CART_V": cart_v}
    out = re.sub(r"\{\{([A-Z0-9_]+)\}\}", lambda m: rep[m.group(1)], tpl)
    return out.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + MARCA + "\n", 1)


def fotos_webp(f: dict, prueba: bool) -> list[Path]:
    try:
        from PIL import Image
    except ImportError:
        raise FichaError("Falta Pillow: pip install pillow")
    salidas = []
    for i, ft in enumerate(f["fotos"]):
        dest = ROOT / "producto" / f"{f['slug']}{'' if i == 0 else f'-{i + 1:02d}'}.webp"
        im = Image.open(ft["_ruta"])
        im.load()
        if min(im.size) < 500:
            raise FichaError(f"{ft['archivo']}: muy pequeña ({im.size[0]}×{im.size[1]}); mínimo 500 px por lado")
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA"); fondo = Image.new("RGBA", im.size, (255, 255, 255, 255)); fondo.alpha_composite(im); im = fondo
        im = im.convert("RGB")
        im.thumbnail((1200, 1200), Image.LANCZOS)
        lienzo = Image.new("RGB", (1200, 1200), (255, 255, 255))
        lienzo.paste(im, ((1200 - im.width) // 2, (1200 - im.height) // 2))
        if not prueba:
            lienzo.save(dest, "WEBP", quality=82, method=6)
        salidas.append(dest)
    return salidas


# ── catálogo, servidor y sitemap ───────────────────────────────────────
def js_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def tarjeta_html(f: dict, n: int) -> str:
    slug, tj = f["slug"], f["tarjeta"]
    etiqueta = tj.get("etiqueta") or CATEGORIAS[f["categoria"]][1]
    return f'''
    <!-- {n}. {esc(tj["titulo"])} -->
    <article class="card-prod" data-cat="{f["categoria"]}">
      <a class="card-prod-media" href="/producto/{slug}" aria-label="Ver {esc(tj["titulo"])}">
        <img src="/producto/{slug}.webp" alt="{esc(tj["alt"])}" width="1200" height="1200" loading="lazy" decoding="async">
      </a>
      <div class="card-prod-body">
        <div class="card-prod-brand">{esc(f["marca"])}</div>
        <div class="card-prod-tag">{esc(etiqueta)}</div>
        <h2 class="card-prod-title"><a href="/producto/{slug}">{esc(tj["titulo"])}</a></h2>
        <p class="card-prod-excerpt">{esc(tj["extracto"])}</p>
        <div class="card-prod-foot">
          <span class="card-prod-price">{fmt_clp(f["precio"])} <small>CLP</small></span>
          <a class="card-prod-cta" href="/producto/{slug}">Ver ficha</a>
        </div>
      </div>
    </article>
'''


def catalogo(f: dict, actualizar: bool) -> str:
    p = ROOT / "productos" / "index.html"
    d = leer(p)
    slug = f["slug"]
    href = f'<a class="card-prod-media" href="/producto/{slug}"'
    i = d.index('"@type": "ItemList"'); b = d.index("</script>", i)
    block = d[i:b]
    nombre = json.dumps(f["nombre"], ensure_ascii=False)
    if href in d:
        if not actualizar:
            raise FichaError(f"El catálogo ya tiene una tarjeta de {slug}")
        a = d.rindex("<!--", 0, d.index(href)); z = d.index("</article>", a) + len("</article>\n")
        n = int(re.search(r"<!-- (\d+)\.", d[a:z]).group(1))
        d = d[:a] + tarjeta_html(f, n).lstrip("\n").replace("    <!--", "<!--", 1) + d[z:]
        block2 = re.sub(r'(\{"@type": "ListItem", "position": \d+, "url": "' + re.escape(f"{SITE}/producto/{slug}") + r'", "name": )"[^"]*"\}', r"\1" + nombre.replace("\\", "\\\\") + "}", block)
        d = d.replace(block, block2)
        return d
    items = list(re.finditer(r'\{"@type": "ListItem", "position": (\d+), [^\n]*\}\n', block))
    pos = int(items[-1].group(1)) + 1
    nuevo = block[:items[-1].end() - 1] + ",\n" + f'    {{"@type": "ListItem", "position": {pos}, "url": "{SITE}/producto/{slug}", "name": {nombre}}}\n' + block[items[-1].end():]
    nuevo = re.sub(r'"numberOfItems": \d+', f'"numberOfItems": {pos}', nuevo)
    d = d[:i] + nuevo + d[b:]
    ult = d.rindex('<article class="card-prod"')
    z = d.index("</article>\n", ult) + len("</article>\n")
    n = len(re.findall(r'<article class="card-prod"', d)) + 1
    return d[:z] + tarjeta_html(f, n) + d[z:]


def servidor(f: dict, actualizar: bool) -> str:
    p = ROOT / "src" / "worker.js"
    w = leer(p)
    a = w.index("const SEED_PRODUCTS = [")
    z = w.index("\n];", a)
    if f"slug: '{f['slug']}'," in w[a:z]:
        if actualizar:
            return w
        raise FichaError(f"{f['slug']} ya está registrado en el servidor")
    entrada = ("\n  {\n"
               f"    slug: {js_str(f['slug'])},\n"
               f"    name: {js_str(f['nombre'])},\n"
               f"    price: {f['precio']},\n"
               f"    image: {js_str('/producto/' + f['slug'] + '.webp')},\n"
               f"    category: {js_str(CATEGORIAS[f['categoria']][1])},\n"
               f"    status: 'available',\n"
               f"    sku: {js_str(f['sku'])},\n"
               "  },")
    return w[:z] + entrada + w[z:]


def sitemap(f: dict) -> str:
    p = ROOT / "sitemap.xml"
    s = leer(p)
    loc = f"{SITE}/producto/{f['slug']}/"
    hoy = _dt.date.today().isoformat()
    if loc in s:
        return re.sub(r"(<loc>" + re.escape(loc) + r"</loc>\s*<lastmod>)[^<]+", r"\g<1>" + hoy, s)
    url = f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{hoy}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n"
    return s.replace("</urlset>", url + "</urlset>")


def cart_version() -> str:
    m = re.search(r"/assets/cart\.js\?v=([0-9a-z]+)", leer(ROOT / "productos" / "index.html"))
    if not m:
        raise FichaError("No encuentro la versión de cart.js en productos/index.html")
    return m.group(1)


# ── verificación ──────────────────────────────────────────────────────
def verificar(slug: str) -> list[str]:
    errores = []
    page = ROOT / "producto" / f"{slug}.html"
    if not page.exists():
        return [f"No existe {page.relative_to(ROOT)}"]
    h = leer(page)
    if re.search(r"\{\{[A-Z0-9_]+\}\}", h):
        errores.append("La página tiene marcadores sin reemplazar")
    prod = None
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
        try:
            d = json.loads(m.group(1))
            if d.get("@type") == "Product":
                prod = d
        except json.JSONDecodeError as e:
            errores.append(f"JSON-LD inválido: {e}")
    if not prod:
        errores.append("Falta el JSON-LD Product (el carrito lo necesita)")
    else:
        if not str(prod.get("offers", {}).get("price", "")).isdigit():
            errores.append("El precio del JSON-LD no es un número")
        for u in prod.get("image", []):
            if not (ROOT / u.replace(SITE + "/", "")).exists():
                errores.append(f"Falta la imagen {u}")
    for tag in ("details", "table", "section", "article", "aside", "ul", "ol", "div", "p"):
        a, c = len(re.findall(fr"<{tag}[\s>]", h)), h.count(f"</{tag}>")
        if a != c:
            errores.append(f"Etiquetas <{tag}> desbalanceadas ({a} abren, {c} cierran)")
    for need in ('class="price-panel"', 'class="action-row"', "/assets/cart.js?v="):
        if need not in h:
            errores.append(f"Falta {need} (necesario para el carrito)")
    cv = cart_version()
    if f"/assets/cart.js?v={cv}" not in h:
        errores.append(f"La versión de cart.js no es la vigente ({cv})")
    for href in set(re.findall(r'href="(/(?:producto|blog)/[^"#]+)"', h)):
        try:
            validar_url(href, "enlace")
        except FichaError as e:
            errores.append(str(e))
    if f'href="/producto/{slug}"' not in leer(ROOT / "productos" / "index.html"):
        errores.append("No está en el catálogo /productos/")
    w = leer(ROOT / "src" / "worker.js")
    if f"slug: '{slug}'," not in w:
        errores.append("No está registrado en SEED_PRODUCTS (src/worker.js): el pago fallaría")
    if f"/producto/{slug}/</loc>" not in leer(ROOT / "sitemap.xml"):
        errores.append("No está en sitemap.xml")
    if shutil.which("node"):
        r = subprocess.run(["node", "--check", str(ROOT / "src" / "worker.js")], capture_output=True, text=True)
        if r.returncode:
            errores.append("src/worker.js tiene un error de sintaxis: " + r.stderr.strip()[:300])
    return errores


# ── main ──────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ficha", nargs="?", help="ruta del JSON de la ficha")
    ap.add_argument("--prueba", action="store_true", help="validar sin escribir nada")
    ap.add_argument("--actualizar", action="store_true", help="regenerar un producto existente")
    ap.add_argument("--verificar", metavar="SLUG", help="revisar un producto publicado")
    a = ap.parse_args()
    try:
        if a.verificar:
            errs = verificar(a.verificar)
            if errs:
                print("✘ Problemas en", a.verificar)
                for e in errs:
                    print("  -", e)
                return 1
            print(f"✔ {a.verificar}: página, fotos, carrito, catálogo, servidor y sitemap en orden")
            return 0
        if not a.ficha:
            ap.error("indica la ficha JSON o usa --verificar SLUG")
        f = cargar_ficha(Path(a.ficha).resolve(), a.actualizar)
        page = render(f, cart_version())
        cat = catalogo(f, a.actualizar)
        wjs = servidor(f, a.actualizar)
        smap = sitemap(f)
        fotos = fotos_webp(f, prueba=True)  # valida las fotos antes de escribir
        rel = lambda p: p.relative_to(ROOT).as_posix()
        archivos = [f"producto/{f['slug']}.html"] + [rel(p) for p in fotos] + ["productos/index.html", "sitemap.xml"]
        if not a.actualizar:
            archivos.append("src/worker.js")
        if a.prueba:
            print("✔ Ficha válida. Se escribirían:")
            for x in archivos:
                print("  -", x)
            return 0
        # Respaldo de todo lo que se va a tocar: si algo falla, se restaura.
        tocar = [ROOT / x for x in archivos]
        respaldo = {p: (p.read_bytes() if p.exists() else None) for p in tocar}
        try:
            fotos_webp(f, prueba=False)
            (ROOT / "producto" / f"{f['slug']}.html").write_text(page, encoding="utf-8")
            (ROOT / "productos" / "index.html").write_text(cat, encoding="utf-8")
            (ROOT / "src" / "worker.js").write_text(wjs, encoding="utf-8")
            (ROOT / "sitemap.xml").write_text(smap, encoding="utf-8")
            errs = verificar(f["slug"])
        except Exception as e:  # noqa: BLE001
            errs = [f"Error inesperado: {e}"]
        if errs:
            for p, b in respaldo.items():
                if b is None:
                    p.unlink(missing_ok=True)
                else:
                    p.write_bytes(b)
            print("✘ La verificación falló; se deshicieron todos los cambios:")
            for e in errs:
                print("  -", e)
            return 1
        print(f"✔ {'Actualizado' if a.actualizar else 'Publicado'} {f['slug']}. Archivos para el commit:")
        for x in archivos + [rel(Path(a.ficha).resolve())]:
            print("  -", x)
        return 0
    except FichaError as e:
        print("✘", e)
        return 2


if __name__ == "__main__":
    sys.exit(main())
