-- Ferretería Ukra - Migration V2: Products table + Orders address fields
-- Run in D1 Console after the initial schema.sql

-- Products table for stock/price management
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,          -- CLP integer
  image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',  -- available | agotado | no_disponible
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Add address fields to orders
ALTER TABLE orders ADD COLUMN customer_address TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_region TEXT DEFAULT '';

-- Seed all 25 products
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('aceite-para-generador-1-litro', 'Aceite Ubermann 15W-40 para generadores diésel 1 litro', 24990, 'https://www.ferreteriaukra.cl/producto/aceite-para-generador-1-litro.webp', 'Lubricantes');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('adhesivo-para-papel-mural-1-kg', 'Adhesivo para papel mural Topex 1 kg, listo para usar', 9990, 'https://www.ferreteriaukra.cl/producto/adhesivo-para-papel-mural-1-kg.webp', 'Pinturas y adhesivos');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('alargador-multiple-led-6-tomas-5m-bticino', 'Alargador Múltiple con LED 6 Tomas 5 m Grafito BTICINO', 25990, 'https://media.falabella.com/sodimacCL/125628_01/w=1200,h=1200,fit=cover', 'Electricidad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('alargador-profesional-10-tomas-schuko-10-16a', 'Alargador Profesional Halux 10 Tomas Schuko 10/16A 2 m Blanco/Negro', 69990, 'https://www.ferreteriaukra.cl/producto/alargador-profesional-10-tomas-schuko-10-16a.webp', 'Electricidad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('bateria-de-automovil-60-ah', 'Batería de automóvil Hankook MF55D23L 60 Ah 550 CCA 12 V', 149990, 'https://www.ferreteriaukra.cl/producto/bateria-de-automovil-60-ah.webp', 'Automotriz');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('bomba-de-agua-sumergible', 'Bomba de agua sumergible 1 HP humboldt XKS-750S acero inoxidable', 129990, 'https://www.ferreteriaukra.cl/producto/bomba-de-agua-sumergible.webp', 'Bombas de agua');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('bomba-periferica-1-hp-50-l-min', 'Bomba periférica 1 HP 50 l/min humboldt XKm80-1', 149990, 'https://www.ferreteriaukra.cl/producto/bomba-periferica-1-hp-50-l-min.webp', 'Bombas de agua');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('bomba-presurizadora-123-w', 'Bomba presurizadora de agua 123 W 25 l/min automática 220V', 89990, 'https://www.ferreteriaukra.cl/producto/bomba-presurizadora-123-w.webp', 'Bombas de agua');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('cortador-de-tubos', 'Cortador de Tubos Profesional Ubermann 3–42 mm', 49990, 'https://www.ferreteriaukra.cl/producto/cortador-de-tubos.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('cortina-bano-blanca', 'Cortina de baño blanca 178x180 cm de PVC con magnetos', 4990, 'https://www.ferreteriaukra.cl/producto/cortina-bano-blanca.webp', 'Baño');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('electrobomba-centrifuga-2-hp-183-l-min', 'Electrobomba centrífuga de superficie 2 HP 183 l/min 220V', 329990, 'https://www.ferreteriaukra.cl/producto/electrobomba-centrifuga-2-hp-183-l-min.webp', 'Bombas de agua');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('engrapadora-ubermann', 'Engrapadora manual Ubermann de trabajo pesado', 49990, 'https://www.ferreteriaukra.cl/producto/engrapadora-ubermann.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('equipo-purificador-de-agua', 'Equipo Purificador de Agua Osmosis Inversa Humboldt 5 Etapas', 199990, 'https://www.ferreteriaukra.cl/producto/equipo-purificador-de-agua.webp', 'Gasfitería');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('generador-electrico-a-gasolina', 'Generador eléctrico a gasolina Karson GG950 720 W portátil', 199990, 'https://www.ferreteriaukra.cl/producto/generador-electrico-a-gasolina.webp', 'Energía');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('interruptor-automatico-20-a', 'Interruptor automático 20 A LEXO C45N, curva C, 1 polo', 4990, 'https://www.ferreteriaukra.cl/producto/interruptor-automatico-20-a.webp', 'Electricidad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('interruptor-diferencial-25a-easy9', 'Interruptor diferencial 25 A Easy9 Schneider Electric 2P 30mA', 37300, 'https://www.ferreteriaukra.cl/producto/interruptor-diferencial-25a-easy9.webp', 'Electricidad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('interruptor-diferencial-40-a', 'Interruptor Diferencial Legrand DX3-ID 40A 30mA Bipolar', 99990, 'https://www.ferreteriaukra.cl/producto/interruptor-diferencial-40-a.webp', 'Electricidad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('lampara-emergencia-portatil', 'Lámpara de emergencia portátil LED recargable con radio', 49990, 'https://www.ferreteriaukra.cl/producto/lampara-emergencia-portatil.webp', 'Emergencia');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('llave-de-paso-3-4-so-so-metal', 'Llave de Paso 3/4" SO SO Metal Bronce Cromado', 29990, 'https://www.ferreteriaukra.cl/producto/llave-de-paso-3-4-so-so-metal.webp', 'Gasfitería');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('martillo-carpintero-ubermann', 'Martillo carpintero Ubermann 20 oz con mango de fibra de vidrio', 34990, 'https://www.ferreteriaukra.cl/producto/martillo-carpintero-ubermann.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('mascara-de-soldar-ubermann', 'Máscara de soldar fotosensible Ubermann YC-09 con luz LED', 109990, 'https://www.ferreteriaukra.cl/producto/mascara-de-soldar-ubermann.webp', 'Seguridad');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('pistola-para-pintar-400-w', 'Pistola para pintar eléctrica 400 W BAUKER JS-910FB', 59990, 'https://www.ferreteriaukra.cl/producto/pistola-para-pintar-400-w.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('sierra-circular-makita', 'Sierra Circular Makita 7-1/4" 1600W HS7010K', 199990, 'https://www.ferreteriaukra.cl/producto/sierra-circular-makita.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('taladro-inalambrico-ubermann', 'Taladro percutor inalámbrico Ubermann 20V 13 mm brushless', 199990, 'https://www.ferreteriaukra.cl/producto/taladro-inalambrico-ubermann-03.webp', 'Herramientas');
INSERT OR IGNORE INTO products (slug, name, price, image, category) VALUES ('valvula-de-descarga-para-wc', 'Válvula Doble Descarga 2 Pulgadas Para WC Humboldt', 11990, 'https://www.ferreteriaukra.cl/producto/valvula-de-descarga-para-wc.webp', 'Gasfitería');
