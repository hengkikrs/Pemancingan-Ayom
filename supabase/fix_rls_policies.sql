-- =============================================================
-- FIX: Tambah RLS DELETE & UPDATE policies yang kurang
-- Jalankan di Supabase Dashboard → SQL Editor
-- =============================================================

-- ── galatama_sessions: tambah DELETE policy ──────────────────
DROP POLICY IF EXISTS "galatama_sessions_delete" ON public.galatama_sessions;
CREATE POLICY "galatama_sessions_delete"
  ON public.galatama_sessions FOR DELETE USING (TRUE);

-- ── galatama_kasbon: tambah DELETE policy ─────────────────────
DROP POLICY IF EXISTS "galatama_kasbon_delete" ON public.galatama_kasbon;
CREATE POLICY "galatama_kasbon_delete"
  ON public.galatama_kasbon FOR DELETE USING (TRUE);

-- ── products: tambah DELETE policy ───────────────────────────
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete"
  ON public.products FOR DELETE USING (TRUE);

-- ── warung_transactions: tambah UPDATE & DELETE policies ─────
DROP POLICY IF EXISTS "warung_transactions_update" ON public.warung_transactions;
CREATE POLICY "warung_transactions_update"
  ON public.warung_transactions FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "warung_transactions_delete" ON public.warung_transactions;
CREATE POLICY "warung_transactions_delete"
  ON public.warung_transactions FOR DELETE USING (TRUE);

-- ── open_bills: tambah DELETE policy ─────────────────────────
DROP POLICY IF EXISTS "open_bills_delete" ON public.open_bills;
CREATE POLICY "open_bills_delete"
  ON public.open_bills FOR DELETE USING (TRUE);

-- ── stock_adjustments: tambah DELETE policy ──────────────────
DROP POLICY IF EXISTS "stock_adjustments_delete" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_delete"
  ON public.stock_adjustments FOR DELETE USING (TRUE);

-- ── drawer_validations: ENABLE RLS + semua policies ──────────
ALTER TABLE public.drawer_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drawer_validations_select" ON public.drawer_validations;
CREATE POLICY "drawer_validations_select"
  ON public.drawer_validations FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "drawer_validations_insert" ON public.drawer_validations;
CREATE POLICY "drawer_validations_insert"
  ON public.drawer_validations FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "drawer_validations_update" ON public.drawer_validations;
CREATE POLICY "drawer_validations_update"
  ON public.drawer_validations FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "drawer_validations_delete" ON public.drawer_validations;
CREATE POLICY "drawer_validations_delete"
  ON public.drawer_validations FOR DELETE USING (TRUE);

-- ── activity_logs: ENABLE RLS + policies ─────────────────────
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select"
  ON public.activity_logs FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert"
  ON public.activity_logs FOR INSERT WITH CHECK (TRUE);

-- =============================================================
-- Selesai! Sekarang edit & hapus harusnya jalan dari frontend.
-- =============================================================
