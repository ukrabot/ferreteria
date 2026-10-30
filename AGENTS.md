# Instrucciones para agentes (Hermes u otros)

Este repositorio es la tienda **Ferretería Ukra** (ferreteriaukra.cl). Cada push
a `main` se publica solo en Cloudflare. Tu trabajo aquí es **publicar o
actualizar fichas de productos físicos con el generador**. Nada más.

## Lo que puedes hacer

1. Crear `scripts/productos/fichas/<slug>.json` siguiendo
   `scripts/productos/README.md` y `scripts/productos/ejemplo.json`.
2. Fotos: enlaces directos a las imágenes en `fotos[].url` (se descargan
   solas) o archivos en `scripts/productos/fotos/<slug>/`. Las originales no
   se suben a git; las webp finales sí.
3. Ejecutar el generador:
   ```bash
   python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json --prueba
   python3 scripts/productos/generar.py scripts/productos/fichas/<slug>.json
   python3 scripts/productos/generar.py --verificar <slug>
   ```
4. Subir el cambio en una rama y abrir un pull request (ver abajo).

## Lo que NO puedes hacer

- Editar a mano `src/`, `assets/`, `admin/`, `checkout/`, `orden/`, `blog/`,
  `productos/index.html`, `sitemap.xml`, `wrangler.jsonc` ni otras fichas.
  El generador escribe lo necesario.
- Editar `scripts/productos/generar.py` o `plantilla.html`. Si el generador
  rechaza la ficha, corrige el JSON según el mensaje.
- Hacer push a `main` o hacer merge. Solo el dueño publica.
- Leer, copiar o mostrar contraseñas o llaves (por ejemplo, las de
  `wrangler.jsonc`).
- Cambiar precios de productos ya publicados: eso se hace en `/admin/`.

## Reglas de contenido

- **Datos reales**: especificaciones solo del fabricante, del empaque o del
  dueño. Si un dato no está confirmado, no lo pongas. No inventes
  certificaciones, garantías ni plazos.
- **Precio**: lo entrega el dueño, o te da un **margen**. Con margen, pon en la
  ficha `precio_referencia` (precio normal, no el de oferta ni el de tarjeta)
  y `margen`, y **no pongas `precio`**: el generador lo calcula y lo redondea a
  terminación 990. Si no tienes precio ni margen, pregunta.
- **Textos originales**: escribe en español de Chile, tuteando, con frases
  claras. No copies descripciones de otras tiendas (Sodimac, Easy, etc.) ni las
  menciones; puedes usar sus datos técnicos como referencia y redactar con tus
  palabras.
- **Fotos**: el dueño autoriza usar las fotos de la ficha del mismo producto en
  Sodimac. Pon el enlace directo de cada imagen en `fotos[].url` (no el de la
  página) y el generador las descarga y convierte. También sirven fotos propias
  con `fotos[].archivo`. Usa solo fotos del producto exacto (mismo modelo y
  color), máximo 6, la primera de frente y con fondo blanco. **No uses fotos
  con código QR ni fotos de «escala» con silueta gris y manos** (el generador
  rechaza ambas), logos de otras tiendas, sellos de oferta ni texto encima.
- **Seguridad**: en productos eléctricos, de gas o de agua, incluye cómo
  usarlos de forma segura y cuándo llamar a un profesional (SEC cuando
  corresponda).
- Relaciona el producto con fichas y guías existentes cuando aporten.

## Flujo de publicación

```bash
git checkout main && git pull
git checkout -b producto/<slug>
# … crear la ficha, poner fotos, ejecutar el generador hasta que diga ✔ …
git add <solo los archivos que lista el generador>
git commit -m "Producto: <nombre del producto>"
git push -u origin producto/<slug>
gh pr create --title "Producto: <nombre>" --body "Ficha generada con scripts/productos/generar.py. Verificación: ✔"
```

Luego avisa al dueño con el enlace del pull request, el precio y un resumen de
la ficha. Si el generador da un error que no puedes resolver con el JSON,
detente y explícale al dueño qué falta.
