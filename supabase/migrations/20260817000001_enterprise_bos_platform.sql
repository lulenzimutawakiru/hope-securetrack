-- ============================================================
-- Enterprise BOS — Business Object metadata catalog (P0)
--
-- Extends entity_metadata into the full Business Object catalog that backs
-- the metadata-driven registry served by /api/v2/metadata/entities.
-- Definitions remain authoritative in the TS registry; this table is the
-- DB-persisted, admin-readable projection (synced by the API).
-- ============================================================

ALTER TABLE public.entity_metadata
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS staff_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tenant_scoped BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archive_column TEXT,
  ADD COLUMN IF NOT EXISTS archive_timestamp_column TEXT,
  ADD COLUMN IF NOT EXISTS has_created_at BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_updated_at BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_by BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS searchable JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sortable JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Catalog query indexes
CREATE INDEX IF NOT EXISTS idx_entity_metadata_module
  ON public.entity_metadata (module);
CREATE INDEX IF NOT EXISTS idx_entity_metadata_capabilities
  ON public.entity_metadata USING GIN (capabilities);

-- Control-plane catalog: only platform staff may read/write it.
ALTER TABLE public.entity_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_metadata_read ON public.entity_metadata;
CREATE POLICY entity_metadata_read ON public.entity_metadata FOR SELECT
  USING (public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS entity_metadata_admin ON public.entity_metadata;
CREATE POLICY entity_metadata_admin ON public.entity_metadata FOR ALL
  USING (public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin());

-- ============================================================
-- Domain event tracing indexes (correlation + source module)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_domain_events_correlation
  ON public.domain_events (correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domain_events_source_module
  ON public.domain_events (source_module)
  WHERE source_module IS NOT NULL;
