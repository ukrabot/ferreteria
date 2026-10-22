-- Ferretería Ukra - Orders Database Schema
-- Run: wrangler d1 execute ferreteria-orders --file=schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  customer_comuna TEXT DEFAULT '',
  products TEXT NOT NULL,          -- JSON array [{slug,name,price,quantity,image}]
  total INTEGER NOT NULL,          -- CLP integer
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | rejected | cancelled
  flow_token TEXT,
  flow_order TEXT,
  payment_method TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_flow_token ON orders(flow_token);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
