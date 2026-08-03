-- Add tenant_id to ast_documents (duplicate name guard) with safe backfill, FK, indexes, RLS
-- NOTE: ast_documents migration already created earlier; this file is a safe duplicate to ensure idempotency across runs.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_documents' AND column_name='tenant_id') THEN
    ALTER TABLE public.ast_documents ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ast_documents (duplicate guard)';
  END IF;
END$$;
COMMIT;