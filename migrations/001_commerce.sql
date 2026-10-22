BEGIN;
CREATE SCHEMA shop;
REVOKE ALL ON SCHEMA shop FROM PUBLIC;
CREATE TABLE shop.settings(id boolean PRIMARY KEY DEFAULT true CHECK(id), mode text NOT NULL CHECK(mode IN ('test','live')), policies_approved boolean NOT NULL DEFAULT false);
INSERT INTO shop.settings(mode) VALUES('test');
CREATE TABLE shop.products(id uuid PRIMARY KEY, name text NOT NULL, description text NOT NULL, active boolean NOT NULL DEFAULT false);
CREATE TABLE shop.variants(id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES shop.products, sku text NOT NULL UNIQUE, ml int NOT NULL CHECK(ml>0), image text NOT NULL, price int NOT NULL CHECK(price>0), physical int NOT NULL DEFAULT 0 CHECK(physical>=0), reserved int NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=physical), active boolean NOT NULL DEFAULT false, low_stock int NOT NULL DEFAULT 5 CHECK(low_stock>=0), weight_g int CHECK(weight_g>0), length_mm int CHECK(length_mm>0), width_mm int CHECK(width_mm>0), height_mm int CHECK(height_mm>0));
CREATE TABLE shop.shipping(id uuid PRIMARY KEY, name text NOT NULL, postcodes text[] NOT NULL, price int NOT NULL CHECK(price>=0), estimate text NOT NULL, active boolean NOT NULL DEFAULT false);
CREATE TABLE shop.admins(user_id uuid PRIMARY KEY, email text NOT NULL UNIQUE, role text NOT NULL CHECK(role IN ('owner','operations')), active boolean NOT NULL DEFAULT true);
CREATE TABLE shop.orders(id uuid PRIMARY KEY, request_key uuid NOT NULL UNIQUE, fingerprint text NOT NULL, mode text NOT NULL CHECK(mode IN ('test','live')), customer jsonb NOT NULL, items jsonb NOT NULL, subtotal int NOT NULL CHECK(subtotal>0), shipping int NOT NULL CHECK(shipping>=0), total int NOT NULL CHECK(total=subtotal+shipping), shipping_rule uuid NOT NULL REFERENCES shop.shipping, shipping_estimate text NOT NULL, payment text NOT NULL DEFAULT 'pending' CHECK(payment IN ('pending','paid','failed','cancelled','expired','partially_refunded','refunded','review')), fulfillment text NOT NULL DEFAULT 'unprepared' CHECK(fulfillment IN ('unprepared','preparing','shipped','delivered','cancelled')), stock_state text NOT NULL DEFAULT 'reserved' CHECK(stock_state IN ('reserved','sold','released')), session_id text UNIQUE, session_params jsonb, payment_intent text, expires_at timestamptz NOT NULL, carrier text, tracking text, notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shop.movements(id uuid PRIMARY KEY, variant_id uuid NOT NULL REFERENCES shop.variants, order_id uuid REFERENCES shop.orders, physical_delta int NOT NULL, reserved_delta int NOT NULL, reason text NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shop.events(id text PRIMARY KEY, order_id uuid REFERENCES shop.orders, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shop.outbox(id uuid PRIMARY KEY, dedupe text NOT NULL UNIQUE, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','review')), provider_id text, attempts int NOT NULL DEFAULT 0, first_attempt timestamptz, lease_until timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shop.contacts(id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE shop.rate_limits(key text PRIMARY KEY, count int NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE shop.audit(id uuid PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX orders_reconcile ON shop.orders(payment,expires_at);
CREATE INDEX movements_variant ON shop.movements(variant_id,created_at);
CREATE INDEX outbox_pending ON shop.outbox(state,lease_until);
-- Server-only schema: never add shop to Supabase's exposed schemas.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='shop' LOOP
 EXECUTE format('ALTER TABLE shop.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON shop.%I FROM PUBLIC',t);
 END LOOP;
END $$;
-- Catalog drafts only. Zero stock is intentional; prices require owner confirmation.
INSERT INTO shop.products VALUES('10000000-0000-4000-8000-000000000001','Aloe Action','Crema corporal aromática para gente activa.',false);
INSERT INTO shop.variants(id,product_id,sku,ml,image,price) VALUES
('80000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000001','AA-080',80,'/aloe-action-80.png',30000),
('80000000-0000-4000-8000-000000000250','10000000-0000-4000-8000-000000000001','AA-250',250,'/aloe-action-250-cutout.png',85000);
COMMIT;
