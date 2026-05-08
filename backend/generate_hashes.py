"""
Pemancingan Ayom — Generate Password Hashes
============================================
Script ini:
  1. Generate bcrypt hash untuk password admin & kasir
  2. Otomatis update file supabase/seed.sql dengan hash yang benar

Cara pakai:
  cd backend
  pip install bcrypt   (jika belum terinstall)
  python generate_hashes.py
"""

import os
import re
import bcrypt

# ── Konfigurasi password ──────────────────────────────────────
PASSWORDS = {
    "admin": "ayom2024",
    "kasir": "kasir123",
}

SEED_FILE = os.path.join(os.path.dirname(__file__), "..", "supabase", "seed.sql")

# ── Generate hash ─────────────────────────────────────────────
print("=" * 60)
print("PEMANCINGAN AYOM — Password Hash Generator")
print("=" * 60)

hashes = {}
for username, password in PASSWORDS.items():
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
    hashes[username] = hashed
    print(f"\n[{username}] password : {password}")
    print(f"           hash     : {hashed}")

# ── Update seed.sql ───────────────────────────────────────────
try:
    seed_path = os.path.abspath(SEED_FILE)
    with open(seed_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace placeholder hash untuk admin
    content = re.sub(
        r"(\s*-- bcrypt hash untuk: ayom2024\n\s*-- Jalankan generate_hashes\.py.*?\n\s*-- lalu replace baris ini\n\s*)'[^']*'",
        f"\\1'{hashes['admin']}'",
        content,
        flags=re.DOTALL
    )

    # Replace placeholder hash untuk kasir
    content = re.sub(
        r"(\s*-- bcrypt hash untuk: kasir123\n\s*)'[^']*'",
        f"\\1'{hashes['kasir']}'",
        content,
    )

    with open(seed_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"\n✅ seed.sql berhasil diperbarui: {seed_path}")

except FileNotFoundError:
    print(f"\n⚠️  File seed.sql tidak ditemukan di: {seed_path}")
    print("   Salin hash di atas secara manual ke supabase/seed.sql")

print("\n" + "=" * 60)
print("Langkah selanjutnya:")
print("  1. Buka Supabase Dashboard → SQL Editor")
print("  2. Run schema.sql terlebih dahulu")
print("  3. Lalu run seed.sql")
print("=" * 60)

