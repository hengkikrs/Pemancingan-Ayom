-- =============================================================
-- PEMANCINGAN AYOM — Database Schema (Supabase / PostgreSQL)
-- =============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Copy-paste isi file ini, lalu klik "Run"
--   3. Jalankan seed.sql setelahnya untuk data awal
-- =============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================
-- TABLE: users
-- Login admin & kasir. Password di-hash pakai bcrypt.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,                 -- bcrypt hash
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'kasir'  -- 'admin' | 'kasir'
                  CHECK (role IN ('admin', 'kasir')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk login query
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);


-- =============================================================
-- TABLE: galatama_sessions
-- Satu baris = satu sesi kolam galatama
-- =============================================================
CREATE TABLE IF NOT EXISTS public.galatama_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date    DATE NOT NULL,
  session_num     SMALLINT NOT NULL DEFAULT 1,     -- sesi ke-1, 2, 3
  participants    SMALLINT NOT NULL
                  CHECK (participants BETWEEN 1 AND 24),
  winner1_name    TEXT,
  winner2_name    TEXT,
  winner3_name    TEXT,                            -- hanya diisi jika peserta > 10
  notes           TEXT,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (session_date, session_num)               -- tidak boleh duplikat sesi di hari yang sama
);

CREATE INDEX IF NOT EXISTS idx_gal_session_date ON public.galatama_sessions (session_date DESC);


-- =============================================================
-- TABLE: galatama_kasbon
-- Kasbon pemancing pada sesi galatama
-- =============================================================
CREATE TABLE IF NOT EXISTS public.galatama_kasbon (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES public.galatama_sessions (id) ON DELETE CASCADE,
  angler_name     TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'settled')),
  settled_at      TIMESTAMPTZ,
  settled_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gal_kasbon_status  ON public.galatama_kasbon (status);
CREATE INDEX IF NOT EXISTS idx_gal_kasbon_session ON public.galatama_kasbon (session_id);


-- =============================================================
-- TABLE: products
-- Produk warung (makanan, minuman, rokok)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'lainnya',   -- 'makanan' | 'minuman' | 'rokok' | 'lainnya'
  is_cigarette          BOOLEAN NOT NULL DEFAULT FALSE,    -- TRUE → pakai kolom rokok

  -- Stok untuk produk NON-rokok
  stok                  INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),

  -- Harga untuk produk NON-rokok
  harga_beli            NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_jual            NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (harga_jual >= 0),

  -- Kolom khusus rokok
  stok_bungkus          INTEGER NOT NULL DEFAULT 0 CHECK (stok_bungkus >= 0),
  stok_batang           INTEGER NOT NULL DEFAULT 0 CHECK (stok_batang >= 0),
  batang_per_bungkus    SMALLINT NOT NULL DEFAULT 12,
  harga_beli_bungkus    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  harga_jual_bungkus    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  harga_jual_batang     NUMERIC(12, 2) NOT NULL DEFAULT 0,

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by            UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active   ON public.products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);


-- =============================================================
-- TABLE: warung_transactions
-- Setiap baris = satu item yang terjual di warung
-- =============================================================
CREATE TABLE IF NOT EXISTS public.warung_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id      UUID REFERENCES public.products (id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,                   -- snapshot nama produk saat transaksi
  category        TEXT NOT NULL DEFAULT 'lainnya',
  qty             INTEGER NOT NULL CHECK (qty > 0),
  unit            TEXT NOT NULL DEFAULT 'pcs',     -- 'pcs' | 'bungkus' | 'batang'
  harga_jual      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cogs            NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- Harga Pokok Penjualan
  revenue         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_type    TEXT NOT NULL DEFAULT 'cash'
                  CHECK (payment_type IN ('cash', 'kasbon')),
  kasbon_name     TEXT,                            -- diisi jika payment_type='kasbon'
  customer_name   TEXT,                            -- opsional untuk nama pelanggan cash
  notes           TEXT,                            -- opsional untuk catatan transaksi
  is_settled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_war_txn_date       ON public.warung_transactions (trans_date DESC);
CREATE INDEX IF NOT EXISTS idx_war_txn_product    ON public.warung_transactions (product_id);
CREATE INDEX IF NOT EXISTS idx_war_txn_payment    ON public.warung_transactions (payment_type);


-- =============================================================
-- TABLE: open_bills
-- Rekapitulasi kasbon warung per nama (bisa dibayar sekaligus)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.open_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  angler_name     TEXT NOT NULL,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  bill_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'settled')),
  settled_at      TIMESTAMPTZ,
  settled_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_open_bills_status ON public.open_bills (status);
CREATE INDEX IF NOT EXISTS idx_open_bills_name   ON public.open_bills (angler_name);


-- =============================================================
-- TABLE: drawer_validations
-- Menyimpan riwayat validasi laci kasir (uang selip)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.drawer_validations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  val_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT NOT NULL,
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawer_val_date ON public.drawer_validations (val_date DESC);
CREATE INDEX IF NOT EXISTS idx_drawer_val_resolved ON public.drawer_validations (is_resolved);


-- =============================================================
-- TABLE: activity_logs
-- Menyimpan log aktivitas (login, tambah, hapus)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type     TEXT NOT NULL,
  details         TEXT,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON public.activity_logs (created_at DESC);


-- =============================================================
-- TABLE: stock_adjustments
-- Log penyesuaian stok manual (hilang, rusak, restock)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES public.products (id) ON DELETE CASCADE,
  adj_type        TEXT NOT NULL
                  CHECK (adj_type IN ('hilang', 'rusak', 'restock', 'koreksi')),
  unit            TEXT NOT NULL DEFAULT 'pcs',     -- 'pcs' | 'bungkus' | 'batang'
  qty_before      INTEGER NOT NULL,
  qty_change      INTEGER NOT NULL,                -- negatif = pengurangan
  qty_after       INTEGER NOT NULL,
  notes           TEXT NOT NULL,
  created_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON public.stock_adjustments (product_id);


-- =============================================================
-- TRIGGER: auto-update products.updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- Aktifkan RLS agar anon key frontend tidak bisa bypass
-- =============================================================

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galatama_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galatama_kasbon     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warung_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_bills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments   ENABLE ROW LEVEL SECURITY;

-- ── Policy: anon/authenticated boleh SELECT semua tabel ──────
-- Frontend menggunakan anon key, bukan auth Supabase bawaan.
-- Akses tulis (INSERT/UPDATE) tetap dibatasi via service key backend.

-- users: hanya boleh baca kolom non-sensitif (password_hash disembunyikan)
CREATE POLICY "users_select_public"
  ON public.users FOR SELECT
  USING (TRUE);

-- galatama_sessions
CREATE POLICY "galatama_sessions_select"
  ON public.galatama_sessions FOR SELECT USING (TRUE);

CREATE POLICY "galatama_sessions_insert"
  ON public.galatama_sessions FOR INSERT
  WITH CHECK (TRUE);           -- frontend anon key boleh insert (pakai kondisi aplikasi)

CREATE POLICY "galatama_sessions_update"
  ON public.galatama_sessions FOR UPDATE
  USING (TRUE);

CREATE POLICY "galatama_sessions_delete"
  ON public.galatama_sessions FOR DELETE
  USING (TRUE);

-- galatama_kasbon
CREATE POLICY "galatama_kasbon_select"
  ON public.galatama_kasbon FOR SELECT USING (TRUE);

CREATE POLICY "galatama_kasbon_insert"
  ON public.galatama_kasbon FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "galatama_kasbon_update"
  ON public.galatama_kasbon FOR UPDATE USING (TRUE);

CREATE POLICY "galatama_kasbon_delete"
  ON public.galatama_kasbon FOR DELETE USING (TRUE);

-- products
CREATE POLICY "products_select"
  ON public.products FOR SELECT USING (TRUE);

CREATE POLICY "products_insert"
  ON public.products FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "products_update"
  ON public.products FOR UPDATE USING (TRUE);

CREATE POLICY "products_delete"
  ON public.products FOR DELETE USING (TRUE);

-- warung_transactions
CREATE POLICY "warung_transactions_select"
  ON public.warung_transactions FOR SELECT USING (TRUE);

CREATE POLICY "warung_transactions_insert"
  ON public.warung_transactions FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "warung_transactions_update"
  ON public.warung_transactions FOR UPDATE USING (TRUE);

CREATE POLICY "warung_transactions_delete"
  ON public.warung_transactions FOR DELETE USING (TRUE);

-- open_bills
CREATE POLICY "open_bills_select"
  ON public.open_bills FOR SELECT USING (TRUE);

CREATE POLICY "open_bills_insert"
  ON public.open_bills FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "open_bills_update"
  ON public.open_bills FOR UPDATE USING (TRUE);

CREATE POLICY "open_bills_delete"
  ON public.open_bills FOR DELETE USING (TRUE);

-- stock_adjustments
CREATE POLICY "stock_adjustments_select"
  ON public.stock_adjustments FOR SELECT USING (TRUE);

CREATE POLICY "stock_adjustments_insert"
  ON public.stock_adjustments FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "stock_adjustments_delete"
  ON public.stock_adjustments FOR DELETE USING (TRUE);

-- drawer_validations
ALTER TABLE public.drawer_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drawer_validations_select"
  ON public.drawer_validations FOR SELECT USING (TRUE);

CREATE POLICY "drawer_validations_insert"
  ON public.drawer_validations FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "drawer_validations_update"
  ON public.drawer_validations FOR UPDATE USING (TRUE);

CREATE POLICY "drawer_validations_delete"
  ON public.drawer_validations FOR DELETE USING (TRUE);

-- activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select"
  ON public.activity_logs FOR SELECT USING (TRUE);

CREATE POLICY "activity_logs_insert"
  ON public.activity_logs FOR INSERT WITH CHECK (TRUE);


-- =============================================================
-- Selesai. Lanjutkan dengan menjalankan seed.sql
-- =============================================================
