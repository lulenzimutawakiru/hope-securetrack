-- Enterprise production hardening: sequences, indexes, performance

-- Document number helpers
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_company_id UUID,
  p_prefix TEXT
) RETURNS TEXT AS $$
DECLARE
  v_date TEXT := to_char(NOW() AT TIME ZONE 'Africa/Nairobi', 'YYYYMMDD');
  v_count INTEGER;
BEGIN
  -- Count today's docs by prefix pattern (best-effort unique enough for SME/enterprise ops)
  IF p_prefix = 'SO' THEN
    SELECT COUNT(*) INTO v_count FROM sales_orders
    WHERE company_id = p_company_id AND order_number LIKE 'SO-' || v_date || '%';
  ELSIF p_prefix = 'INV' THEN
    SELECT COUNT(*) INTO v_count FROM invoices
    WHERE company_id = p_company_id AND invoice_number LIKE 'INV-' || v_date || '%';
  ELSIF p_prefix = 'DSP' THEN
    SELECT COUNT(*) INTO v_count FROM dispatches
    WHERE company_id = p_company_id AND dispatch_number LIKE 'DSP-' || v_date || '%';
  ELSE
    v_count := floor(random() * 9000 + 1000)::int;
  END IF;
  RETURN p_prefix || '-' || v_date || '-' || lpad((v_count + 1)::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_qr_company_status ON qr_codes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_batch_type ON qr_codes(batch_id, code_type);
CREATE INDEX IF NOT EXISTS idx_reams_company_status ON reams(company_id, inventory_status);
CREATE INDEX IF NOT EXISTS idx_cartons_company_status ON cartons(company_id, inventory_status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_company_status ON print_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_verification_company_date ON verification_logs(company_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_company_status ON fraud_alerts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_company_date ON sales_orders(company_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatches_company_date ON dispatches(company_id, dispatch_date DESC);
CREATE INDEX IF NOT EXISTS idx_employees_company_status ON employees(company_id, status);

-- Touch last_login on profile when auth updates (app also updates explicitly)
CREATE OR REPLACE FUNCTION public.touch_user_login(p_user_id UUID, p_ip INET DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET last_login_at = NOW(),
      last_login_ip = COALESCE(p_ip, last_login_ip)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.touch_user_login(UUID, INET) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT) TO authenticated;

-- Ensure service role can insert verification logs freely (already have policies)
DO $$ BEGIN
  CREATE POLICY service_role_all_inventory ON inventory_movements FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY service_role_all_reams ON reams FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY service_role_all_cartons ON cartons FOR ALL
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
