-- =============================================================
-- PEMANCINGAN AYOM — Seed Data
-- =============================================================
-- Jalankan SETELAH schema.sql berhasil di-run.
-- Berisi: user admin/kasir + produk awal warung
-- =============================================================
-- Password di-hash menggunakan Python bcrypt (generate_hashes.py).
-- Atau generate manual via backend:
--   cd backend && python generate_hashes.py
--
-- Kredensial default:
--   admin  → "ayom2024"
--   kasir  → "kasir123"
--
-- CARA RESET PASSWORD:
--   UPDATE public.users
--   SET password_hash = '<hash_baru>'
--   WHERE username = 'admin';
-- =============================================================

-- ─── Hapus data lama jika ada (untuk re-seed bersih) ─────────
DELETE FROM public.users WHERE username IN ('admin', 'kasir');

-- ─── Users ───────────────────────────────────────────────────
-- Hash dibawah adalah bcrypt(cost=12) dari password default.
-- GANTI hash ini jika sudah run generate_hashes.py
INSERT INTO public.users (username, password_hash, full_name, role, is_active)
VALUES
  (
    'admin',
    -- bcrypt hash untuk: ayom2024
    -- Jalankan generate_hashes.py untuk mendapatkan hash yang benar
    -- lalu replace baris ini
    '$2b$12$U5kD1i70q28E7oYkupKWMufg.VhQztq0VUyCe8jllx30CEE18lFiS',
    'Administrator',
    'admin',
    TRUE
  ),
  (
    'kasir',
    -- bcrypt hash untuk: kasir123
    '$2b$12$V8v8pRm/9WCxrK4z7b8xI.pIHjfIvHOr6Fs.9nVt9tGu1kYHTi20S',
    'Kasir',
    'kasir',
    TRUE
  )
ON CONFLICT (username) DO NOTHING;


-- ─── Produk Awal Warung ───────────────────────────────────────
-- Rokok (is_cigarette = TRUE)
INSERT INTO public.products (
  name, category, is_cigarette,
  stok, harga_beli, harga_jual,
  stok_bungkus, stok_batang, batang_per_bungkus,
  harga_beli_bungkus, harga_jual_bungkus, harga_jual_batang,
  is_active
) VALUES
  -- Rokok
  (
    'Rokok Surya 12', 'rokok', TRUE,
    0, 0, 0,
    20, 6, 12,
    24000, 28000, 2500,
    TRUE
  ),
  (
    'Rokok Djarum Super', 'rokok', TRUE,
    0, 0, 0,
    15, 0, 12,
    22000, 26000, 2300,
    TRUE
  ),
  (
    'Rokok Sampoerna Mild', 'rokok', TRUE,
    0, 0, 0,
    10, 4, 16,
    28000, 33000, 2200,
    TRUE
  ),

  -- Minuman
  (
    'Air Mineral 600ml', 'minuman', FALSE,
    48, 2500, 5000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Kopi Sachet', 'minuman', FALSE,
    30, 1500, 3000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Teh Botol 350ml', 'minuman', FALSE,
    24, 3000, 5000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Es Teh Manis', 'minuman', FALSE,
    50, 1000, 3000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),

  -- Makanan
  (
    'Mie Instan', 'makanan', FALSE,
    40, 3500, 7000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Kerupuk Udang', 'makanan', FALSE,
    20, 8000, 15000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Gorengan (porsi)', 'makanan', FALSE,
    0, 1000, 2000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Nasi Bungkus', 'makanan', FALSE,
    0, 8000, 13000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),

  -- Lainnya (perlengkapan mancing)
  (
    'Umpan Cacing (bks)', 'lainnya', FALSE,
    10, 5000, 10000,
    0, 0, 12, 0, 0, 0,
    TRUE
  ),
  (
    'Kail / Mata Kail', 'lainnya', FALSE,
    50, 500, 2000,
    0, 0, 12, 0, 0, 0,
    TRUE
  )
ON CONFLICT DO NOTHING;


-- =============================================================
-- Verifikasi data
-- =============================================================
SELECT 'users'               AS tabel, COUNT(*) AS jumlah FROM public.users
UNION ALL
SELECT 'products',                      COUNT(*)          FROM public.products;
