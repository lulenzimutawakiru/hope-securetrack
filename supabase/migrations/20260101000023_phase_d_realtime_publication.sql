-- Phase D: enable Supabase Realtime on key operational tables
-- Idempotent: only add if not already in publication

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'notifications',
    'production_batches',
    'fraud_alerts',
    'verification_logs',
    'print_jobs',
    'stock_balances',
    'inventory_movements',
    'reams',
    'cartons'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL helps UPDATE/DELETE payloads include old row (optional but useful)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications', 'production_batches', 'fraud_alerts', 'stock_balances']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;
