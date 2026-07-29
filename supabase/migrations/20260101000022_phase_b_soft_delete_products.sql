-- Phase B: soft-delete support for products (+ recycle bin eligibility)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_deleted
  ON products(company_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
