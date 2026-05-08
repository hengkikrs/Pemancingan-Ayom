# 🗄️ Panduan Setup Database Supabase — Pemancingan Ayom

## Urutan Setup (Wajib Diikuti)

```
1. Jalankan generate_hashes.py  → generate password hash
2. Jalankan schema.sql di Supabase SQL Editor
3. Jalankan seed.sql di Supabase SQL Editor
4. Jalankan backend + frontend
```

---

## Langkah 1 — Generate Password Hash

Buka terminal di folder `backend/`:

```powershell
cd backend
pip install bcrypt   # jika belum
python generate_hashes.py
```

Script ini otomatis mengupdate `supabase/seed.sql` dengan hash yang benar.

---

## Langkah 2 — Jalankan Schema di Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project `ttqwowuoixwtgzayiscr`
3. Klik **SQL Editor** di sidebar kiri
4. Klik **+ New query**
5. Copy-paste isi `supabase/schema.sql`
6. Klik **Run** (Ctrl+Enter)

✅ Tabel yang akan dibuat:
| Tabel | Fungsi |
|---|---|
| `users` | Login admin & kasir |
| `galatama_sessions` | Data sesi kolam galatama |
| `galatama_kasbon` | Kasbon pemancing galatama |
| `products` | Produk warung |
| `warung_transactions` | Transaksi penjualan warung |
| `open_bills` | Rekapitulasi kasbon warung |
| `stock_adjustments` | Log penyesuaian stok |

---

## Langkah 3 — Jalankan Seed Data

1. Masih di SQL Editor Supabase
2. Buka query baru
3. Copy-paste isi `supabase/seed.sql`
4. Klik **Run**

✅ Data yang akan dimasukkan:
- User `admin` (password: `ayom2024`)
- User `kasir` (password: `kasir123`)
- 13 produk warung awal (rokok, minuman, makanan, perlengkapan mancing)

---

## Langkah 4 — Jalankan Aplikasi

### Backend (FastAPI):
```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Vite + React):
```powershell
cd frontend
npm install
npm run dev
```

Buka browser: `http://localhost:5173`

---

## Verifikasi Koneksi

Setelah backend berjalan, buka: `http://localhost:8000/health`

Response yang diharapkan:
```json
{
  "status": "ok",
  "excel": true,
  "pdf": true,
  "supabase": true
}
```

Jika `"supabase": false` → periksa file `backend/.env`

---

## Troubleshooting

### ❌ `SUPABASE_URL` atau `SUPABASE_KEY` tidak terbaca
**Penyebab:** File `.env` menggunakan `:` bukan `=`  
**Solusi:** Pastikan format di `.env` adalah `KEY=VALUE` (sudah diperbaiki)

### ❌ Login gagal meskipun password benar
**Penyebab:** Hash di `seed.sql` masih placeholder  
**Solusi:** Jalankan `python generate_hashes.py` lalu re-run `seed.sql`

### ❌ RLS Error: `new row violates row-level security policy`
**Penyebab:** Policy belum dibuat  
**Solusi:** Pastikan `schema.sql` dijalankan sampai selesai (termasuk bagian RLS di bawah)

### ❌ Frontend tidak mau terhubung ke Supabase (mode DEMO)
**Penyebab:** `VITE_SUPABASE_URL` tidak dibaca  
**Solusi:** Periksa `frontend/.env` — harus menggunakan `=` bukan `:`

---

## Struktur File Database

```
supabase/
├── schema.sql          ← DDL: buat semua tabel, index, RLS, trigger
└── seed.sql            ← DML: data awal (user + produk)

backend/
├── generate_hashes.py  ← Helper: generate bcrypt hash & update seed.sql
├── .env                ← Credentials backend (service_role key)
└── main.py             ← FastAPI app

frontend/
├── .env                ← Credentials frontend (anon key)
└── src/supabase.js     ← Supabase client
```
