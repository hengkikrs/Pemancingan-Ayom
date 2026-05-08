-- =============================================================
-- Fungsi RPC: verify_password
-- =============================================================
-- Verifikasi bcrypt password langsung di PostgreSQL
-- menggunakan pgcrypto (sudah di-enable di schema.sql).
--
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Copy-paste isi file ini, lalu klik "Run"
-- =============================================================

CREATE OR REPLACE FUNCTION public.verify_password(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER          -- berjalan dengan hak pemilik, bukan caller
SET search_path = public  -- keamanan: hindari search_path injection
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.users
  WHERE username = p_username AND is_active = TRUE;

  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- pgcrypto crypt() bisa memverifikasi hash $2a$/$2b$ (bcrypt)
  RETURN stored_hash = crypt(p_password, stored_hash);
END;
$$;

-- Izinkan anon & authenticated memanggil fungsi ini
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO authenticated;
