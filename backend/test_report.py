"""
Test script - jalankan: python test_report.py
Ini akan menampilkan error yang sebenarnya
"""
import os, sys
from datetime import date
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

print(f"SUPABASE_URL: {SUPABASE_URL[:40]}...")
print(f"SUPABASE_KEY: {SUPABASE_KEY[:20]}...")

# Test Supabase connection
print("\n[1] Test Supabase connection...")
try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    res = sb.table("galatama_sessions").select("*").limit(3).execute()
    print(f"  galatama_sessions: {len(res.data)} rows")
    
    res2 = sb.table("warung_transactions").select("*").limit(3).execute()
    print(f"  warung_transactions: {len(res2.data)} rows")
    
    res3 = sb.table("galatama_kasbon").select("*").limit(3).execute()
    print(f"  galatama_kasbon: {len(res3.data)} rows")
    print("  ✅ Supabase OK")
except Exception as e:
    print(f"  ❌ Supabase error: {e}")
    sys.exit(1)

# Test Excel
print("\n[2] Test Excel generation...")
try:
    import openpyxl
    # import fungsi dari main
    sys.path.insert(0, os.path.dirname(__file__))
    from main import generate_excel, fetch_galatama, fetch_warung, fetch_galatama_kasbon

    start = end = date.today()
    galatama = fetch_galatama(sb, start, end)
    warung   = fetch_warung(sb, start, end)
    kasbon   = fetch_galatama_kasbon(sb, start, end)
    print(f"  Data: {len(galatama)} sesi, {len(warung)} transaksi, {len(kasbon)} kasbon")
    
    data = generate_excel(start, end, galatama, warung, kasbon)
    print(f"  ✅ Excel OK ({len(data)} bytes)")
except Exception as e:
    import traceback
    print(f"  ❌ Excel error:")
    traceback.print_exc()

# Test PDF
print("\n[3] Test PDF generation...")
try:
    from main import generate_pdf
    data = generate_pdf(start, end, galatama, warung, kasbon)
    print(f"  ✅ PDF OK ({len(data)} bytes)")
except Exception as e:
    import traceback
    print(f"  ❌ PDF error:")
    traceback.print_exc()

print("\nDone!")