-- Run as database owner after 001. Set a strong runtime login password privately,
-- never in a migration, repository or chat. Use this role in DATABASE_URL.
BEGIN;
CREATE ROLE aloe_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA shop TO aloe_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA shop TO aloe_runtime;
GRANT INSERT,UPDATE ON shop.products,shop.variants,shop.orders,shop.events,shop.outbox,shop.contacts,shop.rate_limits TO aloe_runtime;
GRANT INSERT ON shop.movements,shop.audit TO aloe_runtime;
GRANT DELETE ON shop.rate_limits TO aloe_runtime;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='shop' LOOP
 EXECUTE format('CREATE POLICY server_only ON shop.%I TO aloe_runtime USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
