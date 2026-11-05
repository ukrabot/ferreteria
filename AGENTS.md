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
  certificaciones ni plazos. **Garantía: siempre 6 meses** (es la garantía de
  la tienda), aunque el fabricante, la ficha de Sodimac o el envase digan otra
  cosa; el generador pone la fila «Garantía: 6 meses» y rechaza otros plazos.
  Normas, presiones y temperaturas van solo si aparecen en la ficha de Sodimac,
  en el envase o en la etiqueta (y entonces di de dónde salen, p. ej. «según
  envase»).
- **Coincide con las fotos**: antes de terminar, mira las fotos y revisa que el
  texto calce: color, tipo de manilla (palanca, volante o mariposa), material
  y tipo de válvula. Si la foto muestra una etiqueta o envase con datos, úsalos.
  El `alt` describe lo que la foto muestra de verdad (no «extremo pelado» si es
  un rollo). Si la foto trae impresa otra sección, otra cantidad de conductores
  u otro modelo que el producto, avísale al dueño antes de publicar.
- **Cables y cordones**: no pongas amperes «según rotulación» si la cubierta no
  los trae impresos; usa la referencia IEC 60335-1 (0,75 mm² → 6 A; 1 mm² →
  10 A; 1,5 mm² → 16 A). Los cordones de PVC (H05VV-F, paralelos) no son para
  intemperie ni para instalación fija; no los recomiendes para soldadoras.
  La sección de una acometida la define la distribuidora.
- **Flexibles**: revisa en las fotos qué extremos trae (tuerca hembra o terminal macho) y que calce con HI-HI o HI-HE del nombre; si una foto muestra otro extremo, no la uses y avísale al dueño. No repitas dos fotos casi iguales. En flexibles de gas, las franjas amarillas solo lo identifican: no digas que son «normadas» ni que «certifican»; pide revisar el **sello de certificación SEC** y no escribas fechas de vencimiento ni normas que no veas. No prometas «antitorsión», «no se oxida» o «no acumula sarro» si el fabricante no lo dice.
- **Herramientas**: si la foto del envase trae datos (medidas, material), úsalos en el texto pero no publiques esa foto. Revisa que el largo en cm calce con las pulgadas (14" ≈ 35,6 cm) y que no haya dos aperturas distintas en la misma ficha. Un mango bimaterial o engomado no es aislante: no digas que «aísla». Enlaza productos y guías relacionados de verdad (no una cerradura en un set de llaves). Lee la ficha completa antes de terminar: no deben quedar palabras cortadas o sin sentido.
- **Material eléctrico (interruptores, automáticos, diferenciales)**: mira las fotos para saber qué es de verdad. Un «interruptor simple 2 A» puede ser de cordón y uno «10 A» redondo puede ser de pie: no son 9/12 de pared. Indica si es de sobreponer, si la placa trae enchufe o dos teclas, y usa el amperaje y la curva impresos en la etiqueta. Si la foto muestra otro amperaje u otra marca, no lo publiques y avísale al dueño. Los automáticos de formato americano (por ejemplo Saime) no van en riel DIN. En un limitador de sobretensión, «20 kA» es la corriente de descarga, no «20 A». No pongas una «A» sin número en el título. No uses el mismo texto para productos de tipos distintos ni escribas «materiales certificados», «cumple normas vigentes» o «autoextinguible» si el fabricante no lo dice. No publiques fotos con texto promocional encima. El `alt` de cada foto describe esa foto, no una plantilla («vista posterior con fijación para riel o caja»).
- **«Según ficha técnica»** solo si el dato aparece de verdad en la ficha o en
  una foto con datos del fabricante; si no, no lo pongas (velocidades, ciclos,
  módulos de cremallera, sistemas antiaplastamiento, backset, «acero
  inoxidable macizo»). Di siempre qué incluye el kit y qué se compra aparte
  (por ejemplo, la cremallera de un motor de portón). No llames «de
  sobreponer» a una cerradura que en la foto es de embutir (tiene frontal en
  el canto).
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
  rechaza ambas), fotos del envase o la caja, logos de otras tiendas, sellos
  de oferta ni texto encima.
- **Seguridad**: en productos eléctricos, de gas o de agua, incluye cómo
  usarlos de forma segura y cuándo llamar a un profesional (SEC cuando
  corresponda). En gas, la instalación de llaves y cañerías la hace un
  instalador de gas autorizado por la SEC: no escribas pasos para que el
  cliente la haga solo; explica qué revisar.
- Relaciona el producto con fichas y guías existentes cuando aporten.

- **Una ficha pensada para cada producto**: no uses una plantilla con el mismo
  texto para todos. Cada ficha explica para qué sirve ESE producto, cómo se usa
  y qué cuidar (un enchufe de remolque de 12 V no es un enchufe de casa; un
  triple o un enchufe wifi no se arman pelando cables). Las variantes de color
  pueden compartir texto, pero los datos (corriente, polos, potencia) deben ser
  los de cada una.
- **Especificaciones útiles**: no copies filas de otra tienda que no le sirven
  al cliente ni las que vienen cortadas con «...» («Cantidad de paquetes»,
  «Tipo de divisor», «Plazo de disponibilidad de repuestos», «Alimentación»).
  El generador las rechaza.
- **Sin límite por tanda**: puedes publicar **todos los productos que quieras
  en un mismo pull request**. Cada uno debe pasar `--verificar <slug>` con ✔
  antes de abrirlo, y en la descripción del pull request lista cada producto
  (nombre, SKU y precio) para que el dueño los pueda revisar.

## Flujo de publicación

```bash
git checkout main && git pull
git checkout -b producto/<slug>        # o productos/<tema> si es una tanda
# … crear la ficha, poner fotos, ejecutar el generador hasta que diga ✔ …
git add <solo los archivos que lista el generador>
git commit -m "Producto: <nombre del producto>"   # un commit por producto
# … repetir para cada producto de la tanda …
git push -u origin <rama>
gh pr create --title "Productos: <tema> (<cantidad>)" --body "Fichas generadas con scripts/productos/generar.py. Verificación: ✔
- <nombre> · <SKU> · <precio>
- …"
```

Luego avisa al dueño con el enlace del pull request, el precio y un resumen de
la ficha. Si el generador da un error que no puedes resolver con el JSON,
detente y explícale al dueño qué falta.
