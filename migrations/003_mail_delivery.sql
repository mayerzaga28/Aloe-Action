BEGIN;
ALTER TABLE shop.outbox ADD COLUMN delivery_status text;
ALTER TABLE shop.outbox ADD COLUMN delivery_checked_at timestamptz;
COMMIT;
