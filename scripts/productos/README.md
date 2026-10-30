# Generador de fichas de producto

Publica un producto físico con el mismo formato que el resto de la tienda
(ficha, fotos, carrito, catálogo, servidor y sitemap) a partir de un JSON.

```
scripts/productos/
├── generar.py        el generador (no editar sin revisión)
├── plantilla.html    diseño de la ficha (no editar sin revisión)
├── ejemplo.json      ficha de ejemplo completa
├── fichas/<slug>.json   una ficha por producto (se guarda en git)
└── fotos/<slug>/        fotos originales (NO se suben a git)
```

## Uso

```bash
pip install pillow                     # una vez
cp scripts/productos/ejemplo.json scripts/productos/fichas/<slug>.json
# editar la ficha y poner las fotos en scripts/productos/fotos/<slug>/
python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json --prueba
python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json
python3 scripts/productos/generar.py --verificar <slug>
```

- `--prueba` valida y muestra qué archivos cambiaría, sin escribir nada.
- Sin opciones publica el producto. Si la verificación final falla, deshace todo.
- `--actualizar` regenera la ficha, las fotos y la tarjeta de un producto
  existente. **No cambia el precio vigente**: los precios se cambian en
  `/admin/` y el sitio los aplica en todas las páginas.
- `--verificar <slug>` revisa que el producto esté completo.

## Campos de la ficha

| Campo | Qué es | Reglas |
|---|---|---|
| `slug` | URL del producto | minúsculas, números y guiones; igual al nombre del archivo |
| `nombre` | nombre completo (Google, carrito, admin) | 10–120 |
| `titulo_h1` | título grande de la ficha | 10–90 |
| `titulo_corto` | para migas, redes y WhatsApp | 8–70 |
| `marca` | marca | 2–40 |
| `sku` | código del producto | único en la tienda |
| `precio` | precio en pesos, entero | ej. `5890` (sin puntos) |
| `categoria` | filtro del catálogo | `herramientas`, `electricidad`, `bombas`, `gasfiteria`, `otros` |
| `subcategoria` | texto bajo la categoría | ej. «Adaptadores de enchufe» |
| `color` | opcional | |
| `disponible` | opcional, `true` por defecto | `false` = sin stock en Google |
| `seo_titulo` | título de la pestaña; se le agrega «\| $precio» | 15–60 |
| `meta_descripcion` | descripción en Google; `{precio}` se reemplaza | 110–175 |
| `og_descripcion` | descripción al compartir | 40–160 |
| `descripcion` | descripción técnica para Google | 80–600 |
| `lede` | párrafo de entrada | 120–600, admite formato |
| `fotos` | lista de `{url o archivo, alt, miniatura}` | 1–6 fotos de al menos 500 px; la primera es la principal |
| `stock` | opcional `{titulo, detalle}` | por defecto «En stock / Despacho en 24-48 h hábiles» |
| `especificaciones` | filas `[nombre, valor]` | al menos 4 e incluir «Marca» |
| `confianza` | 4 `{titulo, detalle}` bajo la foto | exactamente 4 |
| `secciones` | `{id, titulo, indice, bloques}` | al menos 2 |
| `faq` | `{pregunta, respuesta}` | 3–8; preguntas entre ¿ y ? |
| `aviso_final` | opcional, letra chica al final | |
| `lateral` | `{etiqueta, titulo, texto}` de la caja lateral | |
| `relacionados` | slugs existentes o `{slug, texto}` | máx. 10 |
| `guias` | `{url, texto}` de guías del blog existentes | opcional |
| `tarjeta` | `{titulo, extracto, alt, etiqueta}` para /productos/ | |
| `whatsapp` | opcional, texto del mensaje | por defecto «Hola, quiero comprar … a $…» |
| `microcopy` | opcional, línea bajo los botones | |

### Fotos desde un enlace

Cada foto lleva **una** de estas dos claves:

- `"url": "https://…"`: enlace directo a la imagen. El generador la descarga
  a `scripts/productos/fotos/<slug>/`, revisa que sea una imagen y la
  convierte a webp de 1200 × 1200 con fondo blanco.
- `"archivo": "1.jpg"`: foto que ya está en `scripts/productos/fotos/<slug>/`.

Para sacar el enlace de una foto de Sodimac: abre la ficha del producto, haz
clic en la foto para verla grande, clic derecho sobre ella y **Copiar
dirección de la imagen**. Debe terminar en la imagen (por ejemplo
`…/is/image/SodimacCL/113360933?…`), no en la página del producto. Si el
enlace trae un tamaño como `wid=` o `hei=`, súbelo a 1200 o más para que la
foto no salga borrosa. Si la descarga falla, guarda la foto a mano en la
carpeta y usa `archivo`.

Los textos (`alt`, descripciones, etc.) no pueden nombrar a otras tiendas: el
generador los rechaza.

```json
"fotos": [
  {"url": "https://…/foto-frente.jpg", "alt": "Adaptador Schuko a enchufe chileno visto de frente", "miniatura": "Ver de frente"},
  {"url": "https://…/foto-lado.jpg", "alt": "Enchufe chileno de 3 patas del adaptador", "miniatura": "Ver el enchufe"}
]
```

### Bloques de una sección

Cada bloque es un objeto con una sola clave:

- `{"p": "texto"}` párrafo
- `{"subtitulo": "texto"}` subtítulo
- `{"lista": ["…", "…"]}` lista con viñetas
- `{"pasos": ["…", "…"]}` lista numerada
- `{"tabla": {"cabecera": ["A", "B"], "filas": [["1", "2"]]}}`
- `{"aviso": "texto"}` recuadro destacado
- `{"advertencia": "texto"}` recuadro de advertencia (rojo)

### Formato permitido en los textos

- `**negrita**`
- `[texto](/producto/slug)` o `[texto](/blog/slug/)`: solo enlaces internos a
  páginas que existen.
- No se acepta HTML, ni nombres de otras tiendas, ni textos pendientes (TODO).
