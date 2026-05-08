import { useState, useCallback, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "./supabase";
import { useAuth, AuthProvider } from "./useAuth";

// ─── Supabase guard ────────────────────────────────────────
// Kalau credentials belum diisi, pakai local state saja
const SB_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SB_READY =
  SB_URL && !SB_URL.includes("placeholder") && SB_URL.startsWith("https://");

// ─── UUID helper ─────────────────────────────────────────────
// Pastikan created_by selalu UUID valid atau null
// (user demo pakai id string seperti 'demo-admin' yg tidak valid di PostgreSQL)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUserId(user) {
  if (!user?.id) return null;
  return UUID_RE.test(user.id) ? user.id : null;
}

async function sbInsert(table, data) {
  if (!SB_READY)
    return { data: [{ ...data, id: Date.now().toString() }], error: null };
  return await supabase.from(table).insert(data).select();
}
async function sbSelect(table, query) {
  if (!SB_READY) return { data: [], error: null };
  return await query(supabase.from(table));
}
async function sbUpdate(table, data, match) {
  if (!SB_READY) return { error: null };
  let q = supabase.from(table).update(data);
  Object.entries(match).forEach(([k, v]) => {
    q = q.eq(k, v);
  });
  return await q;
}

// ─────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────
const C = {
  navy: "#0B1D35",
  navyMid: "#112847",
  navyLight: "#1A3A5C",
  blue: "#1565C0",
  blueM: "#1976D2",
  blueL: "#2196F3",
  sky: "#42A5F5",
  pale: "#E3F2FD",
  paleDark: "#BBDEFB",
  teal: "#00ACC1",
  emerald: "#00897B",
  amber: "#FFB300",
  rose: "#E53935",
  violet: "#7B1FA2",
  white: "#FFFFFF",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
};

const TICKET_PRICE = 10000;
const MAX_ANGLERS = 24;
const LOW_STOCK = 5;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n ?? 0);
const fmtShort = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1)}jt`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(0)}rb`
      : String(Math.round(n ?? 0));
const today = () => new Date().toISOString().slice(0, 10);

function calcGal(p) {
  const total = p * TICKET_PRICE,
    profit = total * 0.5,
    pool = total * 0.5;
  if (p <= 10)
    return { total, profit, pool, j1: pool * 0.6, j2: pool * 0.4, j3: null };
  return {
    total,
    profit,
    pool,
    j1: pool * 0.5,
    j2: pool * 0.3,
    j3: pool * 0.2,
  };
}

function calcCig(inv, qty, unit) {
  const bpb = inv.batang_per_bungkus,
    hpp = inv.harga_beli_bungkus / bpb;
  const s = { ...inv };
  let cogs = 0,
    revenue = 0;
  if (unit === "bungkus") {
    if (s.stok_bungkus < qty) return null;
    s.stok_bungkus -= qty;
    cogs = qty * s.harga_beli_bungkus;
    revenue = qty * s.harga_jual_bungkus;
  } else {
    if (s.stok_batang >= qty) {
      s.stok_batang -= qty;
    } else {
      const need = qty - s.stok_batang,
        packs = Math.ceil(need / bpb);
      if (s.stok_bungkus < packs) return null;
      s.stok_bungkus -= packs;
      s.stok_batang += packs * bpb - qty;
    }
    cogs = qty * hpp;
    revenue = qty * s.harga_jual_batang;
  }
  return { inv: s, cogs, revenue, profit: revenue - cogs };
}

// ─── Breakpoint hook ─────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 640, isDesktop: w >= 1024, width: w };
}

// ─────────────────────────────────────────────────────────
// UI PRIMITIVES — semua di TOP LEVEL, TIDAK di dalam komponen lain
// ─────────────────────────────────────────────────────────
const Field = ({ label, children, error }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: C.gray500,
      }}
    >
      {label}
    </span>
    {children}
    {error && <span style={{ fontSize: 11, color: C.rose }}>{error}</span>}
  </div>
);

const iBase = {
  width: "100%",
  padding: "11px 13px",
  fontSize: 15,
  color: C.gray800,
  background: C.white,
  border: `1.5px solid ${C.gray200}`,
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  WebkitAppearance: "none",
  appearance: "none",
};

// KRITIS: Input, Sel, Textarea didefinisikan di luar semua komponen
// sehingga React tidak membuat instance baru setiap render
const Inp = ({ style, ...p }) => {
  const [f, setF] = useState(false);
  return (
    <input
      {...p}
      style={{ ...iBase, borderColor: f ? C.blueL : C.gray200, ...style }}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
    />
  );
};

const Sel = ({ children, style, ...p }) => {
  const [f, setF] = useState(false);
  return (
    <select
      {...p}
      style={{
        ...iBase,
        borderColor: f ? C.blueL : C.gray200,
        cursor: "pointer",
        ...style,
      }}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
    >
      {children}
    </select>
  );
};

const Textarea = ({ style, ...p }) => {
  const [f, setF] = useState(false);
  return (
    <textarea
      {...p}
      style={{
        ...iBase,
        borderColor: f ? C.blueL : C.gray200,
        resize: "vertical",
        minHeight: 72,
        ...style,
      }}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
    />
  );
};

const Btn = ({ variant = "primary", children, style, loading: ld, ...p }) => {
  const vars = {
    primary: {
      bg: C.blue,
      color: C.white,
      shadow: "0 2px 8px rgba(21,101,192,0.3)",
    },
    secondary: {
      bg: C.pale,
      color: C.blue,
      border: `1.5px solid ${C.paleDark}`,
    },
    success: { bg: "#E8F5E9", color: C.emerald, border: "1.5px solid #A5D6A7" },
    danger: { bg: "#FFEBEE", color: C.rose, border: "1.5px solid #FFCDD2" },
    ghost: {
      bg: "transparent",
      color: C.gray500,
      border: `1.5px solid ${C.gray200}`,
    },
    navy: {
      bg: C.navy,
      color: C.white,
      shadow: "0 2px 8px rgba(11,29,53,0.4)",
    },
  };
  const v = vars[variant];
  return (
    <button
      {...p}
      disabled={ld || p.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "11px 20px",
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 14,
        cursor: ld ? "not-allowed" : "pointer",
        border: v.border || "none",
        background: v.bg,
        color: v.color,
        boxShadow: v.shadow,
        opacity: ld ? 0.6 : 1,
        transition: "all .15s",
        fontFamily: "inherit",
        ...style,
      }}
    >
      {ld ? "⏳" : children}
    </button>
  );
};

const Card = ({ children, style, pad = 18 }) => (
  <div
    style={{
      background: C.white,
      borderRadius: 16,
      border: `1px solid ${C.gray200}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.04)",
      padding: pad,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

const CardHdr = ({ title, sub, action }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 16,
    }}
  >
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.gray800 }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
    {action}
  </div>
);

const KpiCard = ({ label, value, sub, color, icon }) => (
  <Card
    style={{ position: "relative", overflow: "hidden", padding: "14px 16px" }}
  >
    <div
      style={{
        position: "absolute",
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: `radial-gradient(circle,${color}22 0%,transparent 70%)`,
      }}
    />
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        background: `linear-gradient(135deg,${color}20,${color}38)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 19,
        marginBottom: 10,
        border: `1px solid ${color}25`,
      }}
    >
      {icon}
    </div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.gray400,
        marginBottom: 3,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 19,
        fontWeight: 800,
        color: C.gray800,
        fontFamily: "'DM Mono',monospace",
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ marginTop: 4, fontSize: 11, color, fontWeight: 600 }}>
        {sub}
      </div>
    )}
  </Card>
);

const Badge = ({ children, color = C.blue, bg }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 9px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      color,
      background: bg || color + "18",
    }}
  >
    {children}
  </span>
);

const PBar = ({ value, max, color = C.blueL }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        height: 5,
        background: C.gray100,
        borderRadius: 9999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg,${color}aa,${color})`,
          borderRadius: 9999,
          transition: "width .4s",
        }}
      />
    </div>
  );
};

const Divider = () => (
  <div style={{ height: 1, background: C.gray100, margin: "14px 0" }} />
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        fontSize: 12,
      }}
    >
      {label && (
        <div style={{ color: C.gray500, fontWeight: 600, marginBottom: 4 }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: C.gray700,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: p.color,
            }}
          />
          <span>{p.name}: </span>
          <span style={{ fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const Modal = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(11,29,53,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 20,
          padding: 24,
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gray800 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: C.gray100,
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Toast = ({ msg, type = "success", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  if (!msg) return null;
  const cm = { success: C.emerald, error: C.rose, info: C.blueL };
  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        right: 16,
        zIndex: 600,
        background: C.white,
        border: `1.5px solid ${cm[type]}`,
        borderRadius: 12,
        padding: "12px 18px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
      }}
    >
      <span style={{ fontSize: 18 }}>
        {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.gray800 }}>
        {msg}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// DATA HOOKS
// ─────────────────────────────────────────────────────────

// Local state fallback ketika Supabase belum disetup
const DEMO_SESSIONS = [
  {
    id: "1",
    session_date: "2025-01-15",
    session_num: 1,
    participants: 18,
    winner1_name: "Budi",
    winner2_name: "Sari",
    winner3_name: "Roni",
    users: { full_name: "Admin" },
  },
  {
    id: "2",
    session_date: "2025-01-15",
    session_num: 2,
    participants: 24,
    winner1_name: "Agus",
    winner2_name: "Dewi",
    winner3_name: "Heru",
    users: { full_name: "Admin" },
  },
  {
    id: "3",
    session_date: "2025-01-16",
    session_num: 1,
    participants: 8,
    winner1_name: "Fajar",
    winner2_name: "Gita",
    winner3_name: null,
    users: { full_name: "Admin" },
  },
];
const DEMO_PRODUCTS = [
  {
    id: "p1",
    name: "Rokok Surya 12",
    category: "rokok",
    is_cigarette: true,
    stok_bungkus: 20,
    stok_batang: 6,
    batang_per_bungkus: 12,
    harga_beli_bungkus: 24000,
    harga_jual_bungkus: 28000,
    harga_jual_batang: 2500,
    is_active: true,
  },
  {
    id: "p2",
    name: "Rokok Djarum",
    category: "rokok",
    is_cigarette: true,
    stok_bungkus: 15,
    stok_batang: 0,
    batang_per_bungkus: 12,
    harga_beli_bungkus: 22000,
    harga_jual_bungkus: 26000,
    harga_jual_batang: 2300,
    is_active: true,
  },
  {
    id: "p3",
    name: "Air Mineral 600ml",
    category: "minuman",
    is_cigarette: false,
    stok: 48,
    harga_beli: 2500,
    harga_jual: 5000,
    is_active: true,
  },
  {
    id: "p4",
    name: "Kopi Sachet",
    category: "minuman",
    is_cigarette: false,
    stok: 30,
    harga_beli: 1500,
    harga_jual: 3000,
    is_active: true,
  },
  {
    id: "p5",
    name: "Mie Instan",
    category: "makanan",
    is_cigarette: false,
    stok: 40,
    harga_beli: 3500,
    harga_jual: 7000,
    is_active: true,
  },
  {
    id: "p6",
    name: "Kerupuk Udang",
    category: "makanan",
    is_cigarette: false,
    stok: 3,
    harga_beli: 8000,
    harga_jual: 15000,
    is_active: true,
  },
];

function useSessions() {
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const load = useCallback(async () => {
    if (!SB_READY) return;
    const { data } = await supabase
      .from("galatama_sessions")
      .select("*,users(full_name)")
      .order("session_date", { ascending: false })
      .order("session_num")
      .limit(50);
    if (data) setSessions(data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!SB_READY) return;
    const ch = supabase
      .channel("sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "galatama_sessions" },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);
  return { sessions, reload: load, setSessions };
}

function useProducts() {
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const load = useCallback(async () => {
    if (!SB_READY) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setProducts(data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!SB_READY) return;
    const ch = supabase
      .channel("products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);
  return { products, setProducts, reload: load };
}

function useTransactions(dateFilter) {
  const [txns, setTxns] = useState([]);
  const load = useCallback(async () => {
    if (!SB_READY) return;
    let q = supabase
      .from("warung_transactions")
      .select("*,users(full_name)")
      .order("created_at", { ascending: false });
    if (dateFilter) q = q.eq("trans_date", dateFilter);
    const { data } = await q.limit(200);
    if (data) setTxns(data);
  }, [dateFilter]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!SB_READY) return;
    const ch = supabase
      .channel("txns")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warung_transactions" },
        load,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);
  return { txns, setTxns, reload: load };
}

function useOpenBills() {
  const [bills, setBills] = useState([]);
  const load = useCallback(async () => {
    if (!SB_READY) return;
    const { data } = await supabase
      .from("open_bills")
      .select("*")
      .eq("status", "open")
      .order("created_at");
    if (data) setBills(data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { bills, setBills, reload: load };
}

function useGalKasbon() {
  const [kasbon, setKasbon] = useState([]);
  const load = useCallback(async () => {
    if (!SB_READY) return;
    const { data } = await supabase
      .from("galatama_kasbon")
      .select("*,galatama_sessions(session_date,session_num)")
      .eq("status", "open")
      .order("created_at");
    if (data) setKasbon(data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { kasbon, setKasbon, reload: load };
}

// ─────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (!ok) setErr("Username atau password salah");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 50%,${C.navyLight} 100%)`,
        padding: 20,
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              fontSize: 34,
              background: "linear-gradient(135deg,#42A5F5,#1565C0)",
              boxShadow: "0 8px 24px rgba(21,101,192,0.4)",
              marginBottom: 16,
            }}
          >
            🎣
          </div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 22 }}>
            Pemancingan Ayom
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Sistem Manajemen Bisnis
          </div>
        </div>
        <Card pad={28}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.gray800,
              marginBottom: 4,
            }}
          >
            Masuk
          </div>
          <div style={{ fontSize: 13, color: C.gray400, marginBottom: 22 }}>
            Masukkan kredensial akun Anda
          </div>
          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field label="Username">
              <Inp
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <Inp
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {err && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#FFEBEE",
                  border: "1px solid #FFCDD2",
                  borderRadius: 9,
                  fontSize: 13,
                  color: C.rose,
                  fontWeight: 600,
                }}
              >
                ⚠️ {err}
              </div>
            )}
            <Btn
              type="submit"
              loading={loading}
              style={{ width: "100%", marginTop: 4 }}
            >
              🔑 Masuk
            </Btn>
          </form>
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: C.gray50,
              borderRadius: 9,
              fontSize: 12,
              color: C.gray500,
            }}
          >
            <strong>Demo:</strong> admin / ayom2024
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "galatama", label: "Galatama", icon: "🎣" },
  { key: "warung", label: "Warung", icon: "🛒" },
  { key: "laporan", label: "Laporan", icon: "📋" },
];

function Sidebar({ tab, setTab, user, logout }) {
  return (
    <aside
      style={{
        width: 230,
        minHeight: "100vh",
        background: C.navy,
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
      }}
    >
      <div style={{ padding: "22px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              fontSize: 20,
              background: "linear-gradient(135deg,#42A5F5,#1565C0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(66,165,245,0.4)",
            }}
          >
            🎣
          </div>
          <div>
            <div
              style={{
                color: C.white,
                fontWeight: 800,
                fontSize: 13,
                lineHeight: 1.2,
              }}
            >
              Pemancingan
            </div>
            <div style={{ color: "#90CAF9", fontSize: 12, fontWeight: 600 }}>
              Ayom
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          margin: "0 14px 16px",
          padding: "10px 12px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            color: "#90CAF9",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          Login sebagai
        </div>
        <div
          style={{
            color: C.white,
            fontSize: 13,
            fontWeight: 700,
            marginTop: 3,
          }}
        >
          {user?.full_name || user?.username}
        </div>
        <div style={{ color: "#64B5F6", fontSize: 11, marginTop: 1 }}>
          {new Date().toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </div>
      </div>
      <div style={{ padding: "0 10px", flex: 1 }}>
        {NAV.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "11px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                marginBottom: 3,
                fontFamily: "inherit",
                background: active ? "rgba(33,150,243,0.2)" : "transparent",
                color: active ? C.white : "#90CAF9",
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                borderLeft: active
                  ? `3px solid ${C.blueL}`
                  : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
      {!SB_READY && (
        <div
          style={{
            margin: "0 14px",
            padding: "8px 12px",
            background: "rgba(255,179,0,0.15)",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ color: C.amber, fontSize: 10, fontWeight: 700 }}>
            ⚠️ MODE DEMO
          </div>
          <div
            style={{ color: "rgba(255,179,0,0.7)", fontSize: 10, marginTop: 2 }}
          >
            Isi .env untuk live data
          </div>
        </div>
      )}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#90CAF9",
            fontSize: 13,
            fontFamily: "inherit",
          }}
        >
          🚪 Keluar
        </button>
      </div>
    </aside>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: C.white,
        borderTop: `1px solid ${C.gray200}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
        boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {NAV.map((item) => {
        const active = tab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 0 8px",
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: active ? C.blue : C.gray400,
              fontFamily: "inherit",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 21 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                marginTop: 3,
              }}
            >
              {item.label}
            </span>
            {active && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: 28,
                  height: 3,
                  background: C.blue,
                  borderRadius: "3px 3px 0 0",
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────
// DASHBOARD — Premium Redesign
// ─────────────────────────────────────────────────────────
function StatRing({ pct, color, size = 64, stroke = 7, label, value }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color+"22"} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize: 11, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>{pct}%</div>
      </div>
      <div style={{ fontSize: 10, color: C.gray500, fontWeight: 600, textAlign: "center" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.gray800, fontFamily: "'DM Mono',monospace" }}>{value}</div>
    </div>
  );
}

function RankRow({ rank, name, value, color, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
      borderBottom: `1px solid ${C.gray100}` }}>
      <span style={{ fontSize: rank <= 3 ? 16 : 12, minWidth: 24, textAlign: "center",
        fontWeight: 700, color: C.gray500 }}>{medal}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray800, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "—"}</div>
        <div style={{ height: 4, background: C.gray100, borderRadius: 9999, marginTop: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 9999,
            background: `linear-gradient(90deg,${color}88,${color})`, transition: "width .5s" }} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "'DM Mono',monospace",
        whiteSpace: "nowrap" }}>{fmtShort(value)}</div>
    </div>
  );
}

function DashboardTab({ bp }) {
  const { sessions } = useSessions();
  const { txns } = useTransactions();
  const { isMobile } = bp;

  // ── Computed data ────────────────────────────────────────
  const galRevTotal = sessions.reduce((a,s) => a + s.participants * TICKET_PRICE, 0);
  const galProfTotal = galRevTotal * 0.5;
  const galPrizeTotal = galRevTotal * 0.5;
  const warRevTotal = txns.reduce((a,t) => a + parseFloat(t.revenue||0), 0);
  const warProfTotal = txns.reduce((a,t) => a + parseFloat(t.profit||0), 0);
  const totalOmzet = galRevTotal + warRevTotal;
  const totalProfit = galProfTotal + warProfTotal;

  // Trend chart data
  const dateMap = {};
  sessions.forEach(s => {
    dateMap[s.session_date] = dateMap[s.session_date] || { date: s.session_date.slice(5), gal: 0, war: 0 };
    dateMap[s.session_date].gal += calcGal(s.participants).profit;
  });
  txns.forEach(t => {
    dateMap[t.trans_date] = dateMap[t.trans_date] || { date: t.trans_date.slice(5), gal: 0, war: 0 };
    dateMap[t.trans_date].war += parseFloat(t.profit||0);
  });
  const trend = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date)).slice(-10);

  // Category distribution
  const catMap = {};
  txns.forEach(t => {
    catMap[t.category] = catMap[t.category] || { name: t.category, value: 0, profit: 0 };
    catMap[t.category].value += parseFloat(t.revenue||0);
    catMap[t.category].profit += parseFloat(t.profit||0);
  });
  const catData = Object.values(catMap).sort((a,b) => b.value - a.value);
  const PIE_COLORS = [C.blueL, C.teal, C.amber, C.violet, C.emerald];

  // Winners leaderboard from sessions
  const winnerMap = {};
  sessions.forEach(s => {
    const g = calcGal(s.participants);
    if (s.winner1_name) { winnerMap[s.winner1_name] = (winnerMap[s.winner1_name]||0) + g.j1; }
    if (s.winner2_name) { winnerMap[s.winner2_name] = (winnerMap[s.winner2_name]||0) + g.j2; }
    if (s.winner3_name && g.j3) { winnerMap[s.winner3_name] = (winnerMap[s.winner3_name]||0) + g.j3; }
  });
  const topWinners = Object.entries(winnerMap).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxWin = topWinners[0]?.[1] || 1;

  // Occupancy data (last 8 sessions)
  const recentSessions = [...sessions].slice(0,8);
  const avgPax = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((a,s) => a+s.participants,0) / recentSessions.length) : 0;
  const occPct = Math.round((avgPax / MAX_ANGLERS) * 100);
  const warMargin = warRevTotal > 0 ? Math.round((warProfTotal/warRevTotal)*100) : 0;
  const galEffPct = Math.min(100, Math.round((sessions.length > 0 ? avgPax/MAX_ANGLERS : 0) * 100));

  const todayStr = today();
  const todayTxns = txns.filter(t => t.trans_date === todayStr);
  const todayRev = todayTxns.reduce((a,t) => a+parseFloat(t.revenue||0), 0);
  const todaySessions = sessions.filter(s => s.session_date === todayStr);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* ── HERO BANNER ─────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 55%,${C.navyLight} 100%)`,
        borderRadius: 20, padding: isMobile ? "18px 16px" : "22px 28px",
        color: C.white, position:"relative", overflow:"hidden",
        boxShadow:"0 8px 32px rgba(11,29,53,0.35)"
      }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%",
          background:"rgba(255,255,255,0.04)" }} />
        <div style={{ position:"absolute", bottom:-30, right:60, width:100, height:100, borderRadius:"50%",
          background:"rgba(66,165,245,0.08)" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:11, opacity:.55, fontWeight:700, letterSpacing:"0.1em",
              textTransform:"uppercase", marginBottom:6 }}>Total Laba Gabungan</div>
            <div style={{ fontSize: isMobile?28:38, fontWeight:900, fontFamily:"'DM Mono',monospace",
              letterSpacing:"-2px", lineHeight:1 }}>{fmt(totalProfit)}</div>
            <div style={{ fontSize:12, opacity:.6, marginTop:8, display:"flex", gap:16, flexWrap:"wrap" }}>
              <span>🎣 {sessions.length} sesi</span>
              <span>🛒 {txns.length} transaksi</span>
              <span>📅 Hari ini: {todaySessions.length} sesi, {todayTxns.length} transaksi</span>
            </div>
          </div>
          {!isMobile && (
            <div style={{ display:"flex", gap:24, alignItems:"center" }}>
              <StatRing pct={occPct} color={C.sky} label="Rata Okupansi" value={`${avgPax}/${MAX_ANGLERS}`} size={72} stroke={7} />
              <StatRing pct={warMargin} color={C.teal} label="Margin Warung" value={`${warMargin}%`} size={72} stroke={7} />
              <StatRing pct={Math.min(100,Math.round(totalOmzet/5000000*100))} color={C.amber} label="Target 5jt" value={fmtShort(totalOmzet)} size={72} stroke={7} />
            </div>
          )}
        </div>
        {/* Today highlight bar */}
        {(todaySessions.length > 0 || todayTxns.length > 0) && (
          <div style={{ marginTop:14, padding:"8px 14px", background:"rgba(255,255,255,0.08)",
            borderRadius:10, display:"flex", gap:20, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.8)", fontWeight:600 }}>
              ⚡ Hari ini — Galatama: <b style={{color:C.sky}}>{fmt(todaySessions.reduce((a,s)=>a+s.participants*TICKET_PRICE*0.5,0))}</b>
              &nbsp;· Warung: <b style={{color:C.teal}}>{fmt(todayRev)}</b>
            </span>
          </div>
        )}
      </div>

      {/* ── 6 KPI CARDS ─────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12 }}>
        {[
          { label:"Omzet Galatama", value:fmtShort(galRevTotal), sub:`${sessions.length} sesi`, color:C.blueL, icon:"🎣",
            detail: `Tiket ${fmt(TICKET_PRICE)}/orang` },
          { label:"Profit Kolam", value:fmtShort(galProfTotal), sub:"50% dari omzet", color:C.teal, icon:"💰",
            detail: `Prize pool: ${fmtShort(galPrizeTotal)}` },
          { label:"Omzet Warung", value:fmtShort(warRevTotal), sub:`${txns.length} transaksi`, color:C.amber, icon:"🛒",
            detail: `${catData.length} kategori produk` },
          { label:"Profit Warung", value:fmtShort(warProfTotal), sub:`Margin ${warMargin}%`, color:C.emerald, icon:"💹",
            detail: `HPP: ${fmtShort(warRevTotal-warProfTotal)}` },
          { label:"Total Omzet", value:fmtShort(totalOmzet), sub:"Gabungan", color:C.violet, icon:"📊",
            detail: `Gal ${Math.round(galRevTotal/Math.max(totalOmzet,1)*100)}% · War ${Math.round(warRevTotal/Math.max(totalOmzet,1)*100)}%` },
          { label:"Total Profit", value:fmtShort(totalProfit), sub:"Bersih gabungan", color:C.rose, icon:"🏆",
            detail: `Margin ${totalOmzet>0?Math.round(totalProfit/totalOmzet*100):0}%` },
        ].map((k,i) => (
          <div key={i} style={{ background:C.white, borderRadius:16, padding:"14px 16px",
            border:`1px solid ${C.gray100}`, boxShadow:"0 2px 12px rgba(0,0,0,0.05)",
            position:"relative", overflow:"hidden", transition:"transform .15s",
            cursor:"default" }}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
            <div style={{ position:"absolute", top:-16, right:-16, width:64, height:64, borderRadius:"50%",
              background:`radial-gradient(circle,${k.color}18,transparent 70%)` }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${k.color}18`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                border:`1px solid ${k.color}22` }}>{k.icon}</div>
              <span style={{ fontSize:9, fontWeight:700, color:k.color, background:`${k.color}15`,
                padding:"2px 7px", borderRadius:20, letterSpacing:"0.06em",
                textTransform:"uppercase" }}>LIVE</span>
            </div>
            <div style={{ marginTop:10, fontSize:9, fontWeight:700, letterSpacing:"0.08em",
              textTransform:"uppercase", color:C.gray400 }}>{k.label}</div>
            <div style={{ fontSize:isMobile?17:20, fontWeight:900, color:C.gray800,
              fontFamily:"'DM Mono',monospace", marginTop:2 }}>{k.value}</div>
            <div style={{ fontSize:10, color:k.color, fontWeight:600, marginTop:2 }}>{k.sub}</div>
            <div style={{ fontSize:9, color:C.gray400, marginTop:4 }}>{k.detail}</div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ──────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"2fr 1fr", gap:16 }}>

        {/* Trend Chart */}
        <Card>
          <CardHdr title="📈 Tren Profit Harian" sub="Galatama vs Warung (10 hari terakhir)" />
          {trend.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:C.gray300, fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📊</div>Belum ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <defs>
                  <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.blueL} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.blueL} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="dW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.amber} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                <XAxis dataKey="date" tick={{ fill:C.gray400, fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtShort} tick={{ fill:C.gray400, fontSize:9 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip />}/>
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11 }}/>
                <Area type="monotone" dataKey="gal" name="Galatama" stroke={C.blueL} fill="url(#dG)" strokeWidth={2.5} dot={{ fill:C.blueL, r:3 }}/>
                <Area type="monotone" dataKey="war" name="Warung" stroke={C.amber} fill="url(#dW)" strokeWidth={2.5} dot={{ fill:C.amber, r:3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Warung Category Donut */}
        <Card>
          <CardHdr title="🛒 Warung per Kategori" sub="Distribusi omzet" />
          {catData.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:C.gray300 }}>
              <div style={{ fontSize:32 }}>🛒</div><div style={{ fontSize:12, marginTop:8 }}>Belum ada transaksi</div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    paddingAngle={3} dataKey="value">
                    {catData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip />}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:4 }}>
                {catData.map((d,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                      background:PIE_COLORS[i%PIE_COLORS.length] }}/>
                    <div style={{ flex:1, fontSize:11, color:C.gray600, overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                    <div style={{ fontSize:11, fontWeight:800, color:C.gray800,
                      fontFamily:"'DM Mono',monospace" }}>{fmtShort(d.value)}</div>
                    <div style={{ fontSize:10, color:C.emerald, fontWeight:600,
                      minWidth:32, textAlign:"right" }}>
                      {warRevTotal>0?Math.round(d.value/warRevTotal*100):0}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── BOTTOM ROW ──────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:16 }}>

        {/* Winner Leaderboard */}
        <Card>
          <CardHdr title="🏆 Juara Terbanyak Menang" sub={`${topWinners.length} pemancing teratas`} />
          {topWinners.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 0", color:C.gray300 }}>
              <div style={{ fontSize:32 }}>🏆</div>
              <div style={{ fontSize:12, marginTop:8 }}>Belum ada data juara</div>
            </div>
          ) : (
            <div>
              {topWinners.map(([name, val], i) => (
                <RankRow key={name} rank={i+1} name={name} value={val} color={
                  i===0?C.amber:i===1?C.gray400:i===2?C.rose:C.blueL} max={maxWin} />
              ))}
            </div>
          )}
        </Card>

        {/* Recent Sessions + Occupancy */}
        <Card>
          <CardHdr title="🎣 Sesi Terakhir" sub={`Okupansi rata-rata ${occPct}%`} />
          {recentSessions.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 0", color:C.gray300 }}>
              <div style={{ fontSize:32 }}>🎣</div>
              <div style={{ fontSize:12, marginTop:8 }}>Belum ada sesi</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {recentSessions.map(s => {
                const pct = Math.round(s.participants/MAX_ANGLERS*100);
                const col = s.participants>=20?C.emerald:s.participants>=14?C.blueL:C.amber;
                return (
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <div style={{ minWidth:60, fontSize:10, fontWeight:700, color:C.gray500 }}>
                      {s.session_date.slice(5)} S{s.session_num}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:C.gray600 }}>{s.participants}/{MAX_ANGLERS} pax</span>
                        <span style={{ fontSize:10, fontWeight:700, color:col }}>{pct}%</span>
                      </div>
                      <div style={{ height:5, background:C.gray100, borderRadius:9999, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, borderRadius:9999,
                          background:`linear-gradient(90deg,${col}88,${col})`, transition:"width .4s" }}/>
                      </div>
                    </div>
                    <div style={{ minWidth:52, textAlign:"right", fontSize:10, fontWeight:800,
                      color:C.gray700, fontFamily:"'DM Mono',monospace" }}>
                      {fmtShort(s.participants*TICKET_PRICE*0.5)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── GALATAMA DAILY BAR CHART ─────────────────── */}
      <Card>
        <CardHdr title="📊 Galatama — Peserta & Omzet per Hari" sub="7 hari terakhir" />
        {galProfTotal === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:C.gray300 }}>
            <div style={{ fontSize:32 }}>📊</div>
            <div style={{ fontSize:12, marginTop:8 }}>Belum ada data galatama</div>
          </div>
        ) : (() => {
          const galDailyMap = {};
          sessions.forEach(s => {
            galDailyMap[s.session_date] = galDailyMap[s.session_date] || { date:s.session_date.slice(5), peserta:0, omzet:0, profit:0 };
            galDailyMap[s.session_date].peserta += s.participants;
            galDailyMap[s.session_date].omzet += s.participants*TICKET_PRICE;
            galDailyMap[s.session_date].profit += s.participants*TICKET_PRICE*0.5;
          });
          const gd = Object.values(galDailyMap).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);
          return (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gd} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false}/>
                <XAxis dataKey="date" tick={{ fill:C.gray400, fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="l" tickFormatter={fmtShort} tick={{ fill:C.gray400, fontSize:9 }} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="r" orientation="right" tick={{ fill:C.gray400, fontSize:9 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip />}/>
                <Legend iconSize={7} wrapperStyle={{ fontSize:11 }}/>
                <Bar yAxisId="l" dataKey="omzet" name="Omzet" fill={C.blueL} radius={[5,5,0,0]}/>
                <Bar yAxisId="l" dataKey="profit" name="Profit" fill={C.teal} radius={[5,5,0,0]}/>
                <Bar yAxisId="r" dataKey="peserta" name="Peserta" fill={C.amber+"88"} radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </Card>

    </div>
  );
}


// ─────────────────────────────────────────────────────────
// GALATAMA SESSION FORM — top-level component (bukan nested!)
// ─────────────────────────────────────────────────────────
function GalForm({ form, update, preview, saving, onSave }) {
  return (
    <Card>
      <CardHdr title="Tambah Sesi" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Tanggal">
          <Inp
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <Field label="Sesi ke-">
            <Sel
              value={form.sessionNum}
              onChange={(e) => update("sessionNum", e.target.value)}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  Sesi {n}
                </option>
              ))}
            </Sel>
          </Field>
          <Field label="Peserta (1–24)">
            <Inp
              type="number"
              min={1}
              max={24}
              placeholder="0"
              value={form.participants}
              onChange={(e) => update("participants", e.target.value)}
            />
          </Field>
        </div>
        {preview && (
          <div
            style={{
              padding: 12,
              background: C.pale,
              borderRadius: 12,
              border: `1px solid ${C.paleDark}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.blue,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Kalkulasi Otomatis
            </div>
            {[
              ["Omzet", fmt(preview.total), C.blue],
              ["Profit Kolam", fmt(preview.profit), C.emerald],
              ["Pool Hadiah", fmt(preview.pool), C.amber],
              ["🥇 Juara 1", fmt(preview.j1), C.amber],
              ["🥈 Juara 2", fmt(preview.j2), C.gray500],
              ...(preview.j3
                ? [["🥉 Juara 3", fmt(preview.j3), C.gray400]]
                : []),
            ].map(([l, v, c]) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: C.gray500 }}>{l}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: c,
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
            <div
              style={{
                marginTop: 8,
                padding: "5px 9px",
                background: C.white,
                borderRadius: 7,
                fontSize: 11,
                color: C.blue,
                fontWeight: 600,
              }}
            >
              {parseInt(form.participants) <= 10
                ? "≤10 peserta → J1 & J2 saja"
                : ">10 peserta → J1, J2 & J3"}
            </div>
          </div>
        )}
        <Divider />
        <Field label="Juara 1">
          <Inp
            type="text"
            placeholder="Nama..."
            value={form.winner1}
            onChange={(e) => update("winner1", e.target.value)}
          />
        </Field>
        <Field label="Juara 2">
          <Inp
            type="text"
            placeholder="Nama..."
            value={form.winner2}
            onChange={(e) => update("winner2", e.target.value)}
          />
        </Field>
        <Field
          label={`Juara 3${preview && !preview.j3 ? " (dilewati, ≤10 pax)" : ""}`}
        >
          <Inp
            type="text"
            placeholder="Nama..."
            value={form.winner3}
            onChange={(e) => update("winner3", e.target.value)}
            style={{ opacity: preview && !preview.j3 ? 0.4 : 1 }}
            disabled={!!(preview && !preview.j3)}
          />
        </Field>
        <Field label="Catatan">
          <Textarea
            placeholder="Opsional..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
        <Btn
          onClick={onSave}
          loading={saving}
          style={{ width: "100%", marginTop: 4 }}
        >
          💾 Simpan Sesi
        </Btn>
      </div>
    </Card>
  );
}

function GalSessionList({ sessions, setKasbonModal }) {
  return (
    <Card>
      <CardHdr title="Riwayat Sesi" sub={`${sessions.length} sesi`} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: 560,
          overflowY: "auto",
        }}
      >
        {[...sessions].map((s) => {
          const g = calcGal(s.participants);
          const occ = Math.round((s.participants / MAX_ANGLERS) * 100);
          const col =
            s.participants >= 20
              ? C.emerald
              : s.participants >= 14
                ? C.blueL
                : C.amber;
          return (
            <div
              key={s.id}
              style={{
                padding: 14,
                background: C.gray50,
                border: `1px solid ${C.gray200}`,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 700, fontSize: 13, color: C.gray800 }}
                  >
                    {s.session_date} · Sesi {s.session_num}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>
                    {s.participants}/{MAX_ANGLERS} · {s.users?.full_name || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color={col}>{occ}%</Badge>
                  <button
                    onClick={() => setKasbonModal(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "#FFF9F0",
                      border: "1px solid #FED7AA",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.amber,
                      fontFamily: "inherit",
                    }}
                  >
                    📝 Kasbon
                  </button>
                </div>
              </div>
              <PBar value={s.participants} max={MAX_ANGLERS} color={col} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {[
                  ["Omzet", fmt(g.total), C.gray600],
                  ["Profit", fmt(g.profit), C.emerald],
                  ["Hadiah", fmt(g.pool), C.amber],
                ].map(([l, v, c]) => (
                  <div
                    key={l}
                    style={{
                      padding: "6px 9px",
                      background: C.white,
                      borderRadius: 8,
                      border: `1px solid ${C.gray200}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.gray400,
                        textTransform: "uppercase",
                        marginBottom: 2,
                      }}
                    >
                      {l}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: c,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {[
                  ["🥇", s.winner1_name, fmt(g.j1)],
                  ["🥈", s.winner2_name, fmt(g.j2)],
                  ...(s.winner3_name
                    ? [["🥉", s.winner3_name, fmt(g.j3)]]
                    : []),
                ].map(([ic, nm, pr]) => (
                  <div
                    key={ic}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "4px 8px",
                      background: C.white,
                      borderRadius: 7,
                      fontSize: 12,
                    }}
                  >
                    <span>{ic}</span>
                    <span style={{ flex: 1, color: C.gray700 }}>{nm}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontWeight: 700,
                        color: C.amber,
                        fontSize: 11,
                      }}
                    >
                      {pr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// GALATAMA TAB
// ─────────────────────────────────────────────────────────
function GalatamaTab({ bp }) {
  const { user } = useAuth();
  const { sessions, setSessions } = useSessions();
  const { kasbon, setKasbon } = useGalKasbon();
  const { isMobile } = bp;
  const [subTab, setSubTab] = useState("sessions");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const empty = {
    date: today(),
    sessionNum: "1",
    participants: "",
    winner1: "",
    winner2: "",
    winner3: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [preview, setPreview] = useState(null);
  const [kasbonModal, setKasbonModal] = useState(null);
  const [kasbonForm, setKasbonForm] = useState({
    name: "",
    amount: "",
    notes: "",
  });

  const update = useCallback((k, v) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      const p = parseInt(next.participants);
      setPreview(p > 0 && p <= MAX_ANGLERS ? calcGal(p) : null);
      return next;
    });
  }, []);

  const saveSession = async () => {
    const p = parseInt(form.participants);
    if (!p || p < 1 || p > MAX_ANGLERS) return;
    setSaving(true);
    if (SB_READY) {
      const { error } = await supabase.from("galatama_sessions").insert({
        session_date: form.date,
        session_num: parseInt(form.sessionNum),
        participants: p,
        winner1_name: form.winner1,
        winner2_name: form.winner2,
        winner3_name: form.winner3,
        notes: form.notes,
        created_by: safeUserId(user),
      });
      setSaving(false);
      if (error) {
        setToast({ msg: "Gagal: " + error.message, type: "error" });
        return;
      }
    } else {
      // Demo mode: simpan ke local state
      setSessions((prev) => [
        {
          id: Date.now().toString(),
          session_date: form.date,
          session_num: parseInt(form.sessionNum),
          participants: p,
          winner1_name: form.winner1,
          winner2_name: form.winner2,
          winner3_name: form.winner3 || null,
          notes: form.notes,
          users: { full_name: user?.full_name || "Admin" },
        },
        ...prev,
      ]);
      setSaving(false);
    }
    setToast({ msg: "Sesi berhasil disimpan!", type: "success" });
    setForm(empty);
    setPreview(null);
    if (isMobile) setShowForm(false);
  };

  const saveKasbon = async () => {
    if (!kasbonForm.name || !kasbonForm.amount) return;
    if (SB_READY) {
      const { error } = await supabase.from("galatama_kasbon").insert({
        session_id: kasbonModal?.id,
        angler_name: kasbonForm.name,
        amount: parseFloat(kasbonForm.amount),
        notes: kasbonForm.notes,
        created_by: safeUserId(user),
      });
      if (error) {
        setToast({ msg: error.message, type: "error" });
        return;
      }
    } else {
      setKasbon((prev) => [
        {
          id: Date.now().toString(),
          angler_name: kasbonForm.name,
          amount: parseFloat(kasbonForm.amount),
          notes: kasbonForm.notes,
          status: "open",
          galatama_sessions: {
            session_date: kasbonModal?.session_date,
            session_num: kasbonModal?.session_num,
          },
        },
        ...prev,
      ]);
    }
    setToast({ msg: "Kasbon berhasil dicatat!", type: "success" });
    setKasbonModal(null);
    setKasbonForm({ name: "", amount: "", notes: "" });
  };

  const settleKasbon = async (id) => {
    if (SB_READY) {
      await supabase
        .from("galatama_kasbon")
        .update({
          status: "settled",
          settled_at: new Date().toISOString(),
          settled_by: safeUserId(user),
        })
        .eq("id", id);
    } else {
      setKasbon((prev) => prev.filter((k) => k.id !== id));
    }
    setToast({ msg: "Kasbon dilunasi!", type: "success" });
  };

  const totOmzet = sessions.reduce(
    (a, s) => a + s.participants * TICKET_PRICE,
    0,
  );
  const totProfit = totOmzet * 0.5,
    totPrize = totOmzet * 0.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
      >
        <KpiCard
          label="Omzet"
          value={fmtShort(totOmzet)}
          sub={`${sessions.length} sesi`}
          color={C.blueL}
          icon="🎣"
        />
        <KpiCard
          label="Profit"
          value={fmtShort(totProfit)}
          sub="50% omzet"
          color={C.emerald}
          icon="💵"
        />
        <KpiCard
          label="Hadiah"
          value={fmtShort(totPrize)}
          sub="50% omzet"
          color={C.amber}
          icon="🏆"
        />
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {[
          ["sessions", "📋 Sesi"],
          ["kasbon", "📝 Kasbon"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSubTab(k)}
            style={{
              flexShrink: 0,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              background: subTab === k ? C.blue : C.gray100,
              color: subTab === k ? C.white : C.gray500,
              fontWeight: subTab === k ? 700 : 500,
              fontSize: 13,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {subTab === "sessions" && (
        <>
          {isMobile && (
            <Btn
              onClick={() => setShowForm((v) => !v)}
              variant={showForm ? "ghost" : "primary"}
              style={{ width: "100%" }}
            >
              {showForm ? "✕ Tutup Form" : "➕ Tambah Sesi Baru"}
            </Btn>
          )}
          {isMobile && showForm && (
            <GalForm
              form={form}
              update={update}
              preview={preview}
              saving={saving}
              onSave={saveSession}
            />
          )}
          {!isMobile ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "340px 1fr",
                gap: 16,
              }}
            >
              <GalForm
                form={form}
                update={update}
                preview={preview}
                saving={saving}
                onSave={saveSession}
              />
              <GalSessionList
                sessions={sessions}
                setKasbonModal={setKasbonModal}
              />
            </div>
          ) : (
            <GalSessionList
              sessions={sessions}
              setKasbonModal={setKasbonModal}
            />
          )}
        </>
      )}

      {subTab === "kasbon" && (
        <Card>
          <CardHdr
            title="Kasbon Galatama"
            sub={`${kasbon.length} kasbon aktif`}
          />
          {kasbon.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: C.gray300,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13 }}>Tidak ada kasbon aktif</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {kasbon.map((k) => (
                <div
                  key={k.id}
                  style={{
                    padding: "12px 14px",
                    background: "#FFF9F0",
                    border: "1px solid #FED7AA",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: C.gray800,
                      }}
                    >
                      🎣 {k.angler_name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: C.gray400, marginTop: 2 }}
                    >
                      Sesi {k.galatama_sessions?.session_num} ·{" "}
                      {k.galatama_sessions?.session_date}
                    </div>
                    {k.notes && (
                      <div
                        style={{ fontSize: 11, color: C.gray500, marginTop: 2 }}
                      >
                        📝 {k.notes}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: C.amber,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {fmt(k.amount)}
                    </div>
                    <Btn
                      variant="success"
                      onClick={() => settleKasbon(k.id)}
                      style={{ padding: "6px 12px", fontSize: 12 }}
                    >
                      ✅ Lunasi
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={!!kasbonModal}
        onClose={() => setKasbonModal(null)}
        title="Tambah Kasbon Galatama"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: "10px 14px",
              background: C.pale,
              borderRadius: 10,
              fontSize: 13,
              color: C.blue,
            }}
          >
            Sesi {kasbonModal?.session_num} · {kasbonModal?.session_date}
          </div>
          <Field label="Nama Pemancing">
            <Inp
              type="text"
              placeholder="Nama..."
              value={kasbonForm.name}
              onChange={(e) =>
                setKasbonForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <Field label="Jumlah (Rp)">
            <Inp
              type="number"
              min={0}
              placeholder="0"
              value={kasbonForm.amount}
              onChange={(e) =>
                setKasbonForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </Field>
          <Field label="Catatan">
            <Textarea
              placeholder="Opsional..."
              value={kasbonForm.notes}
              onChange={(e) =>
                setKasbonForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>
          <Btn onClick={saveKasbon} style={{ width: "100%" }}>
            💾 Simpan Kasbon
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WARUNG TAB
// ─────────────────────────────────────────────────────────
function WarungTab({ bp }) {
  const { user } = useAuth();
  const { products, setProducts } = useProducts();
  const { txns, setTxns } = useTransactions(today());
  const { bills, setBills } = useOpenBills();
  const { isMobile } = bp;
  const [subTab, setSubTab] = useState("pos");
  const [posForm, setPosForm] = useState({
    productId: "",
    qty: "",
    unit: "pcs",
    billName: "",
  });
  const [billMode, setBillMode] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [adjModal, setAdjModal] = useState(null);
  const [adjForm, setAdjForm] = useState({
    type: "hilang",
    unit: "pcs",
    qty: "",
    notes: "",
  });
  const [newProdModal, setNewProdModal] = useState(false);
  const [newProd, setNewProd] = useState({
    name: "",
    category: "makanan",
    stok: "",
    hargaBeli: "",
    hargaJual: "",
  });

  const selected = products.find((p) => p.id === posForm.productId);
  const isCig = selected?.is_cigarette;
  const previewTotal =
    selected && posForm.qty
      ? parseInt(posForm.qty || 0) *
        (isCig
          ? posForm.unit === "bungkus"
            ? selected.harga_jual_bungkus
            : selected.harga_jual_batang
          : selected.harga_jual)
      : 0;

  const handleSell = async () => {
    if (!selected || !posForm.qty) return;
    const qty = parseInt(posForm.qty);
    let revenue = 0,
      cogs = 0,
      newStk = null;
    if (isCig) {
      const r = calcCig(selected, qty, posForm.unit);
      if (!r) {
        setToast({ msg: "Stok tidak cukup!", type: "error" });
        return;
      }
      revenue = r.revenue;
      cogs = r.cogs;
      newStk = r.inv;
    } else {
      if (selected.stok < qty) {
        setToast({ msg: "Stok tidak cukup!", type: "error" });
        return;
      }
      cogs = qty * selected.harga_beli;
      revenue = qty * selected.harga_jual;
    }
    setSaving(true);
    const tx = {
      id: Date.now().toString(),
      trans_date: today(),
      product_id: selected.id,
      product_name: selected.name,
      category: selected.category,
      qty,
      unit: posForm.unit,
      harga_jual: isCig
        ? posForm.unit === "bungkus"
          ? selected.harga_jual_bungkus
          : selected.harga_jual_batang
        : selected.harga_jual,
      cogs,
      revenue,
      profit: revenue - cogs,
      payment_type: billMode,
      kasbon_name: posForm.billName || null,
      is_settled: billMode === "cash",
      users: { full_name: user?.full_name || "Admin" },
    };

    if (SB_READY) {
      const { users, ...txData } = tx;
      await supabase
        .from("warung_transactions")
        .insert({ ...txData, created_by: safeUserId(user) });
      if (isCig && newStk)
        await supabase
          .from("products")
          .update({
            stok_bungkus: newStk.stok_bungkus,
            stok_batang: newStk.stok_batang,
          })
          .eq("id", selected.id);
      else
        await supabase
          .from("products")
          .update({ stok: selected.stok - qty })
          .eq("id", selected.id);
    } else {
      setTxns((prev) => [tx, ...prev]);
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== selected.id) return p;
          if (isCig && newStk) return { ...p, ...newStk };
          return { ...p, stok: p.stok - qty };
        }),
      );
    }
    if (billMode === "kasbon" && posForm.billName) {
      const billItem = {
        id: Date.now().toString(),
        angler_name: posForm.billName,
        total_amount: revenue,
        status: "open",
        bill_date: today(),
      };
      if (!SB_READY)
        setBills((prev) => {
          const ex = prev.find((b) => b.angler_name === posForm.billName);
          if (ex)
            return prev.map((b) =>
              b.angler_name === posForm.billName
                ? { ...b, total_amount: b.total_amount + revenue }
                : b,
            );
          return [...prev, billItem];
        });
    }
    setSaving(false);
    setToast({ msg: "Transaksi berhasil!", type: "success" });
    setPosForm({ productId: "", qty: "", unit: "pcs", billName: "" });
  };

  const settleBill = async (bill) => {
    if (SB_READY) {
      await supabase
        .from("open_bills")
        .update({
          status: "settled",
          settled_at: new Date().toISOString(),
          settled_by: safeUserId(user),
        })
        .eq("id", bill.id);
    } else {
      setBills((prev) => prev.filter((b) => b.id !== bill.id));
    }
    setToast({ msg: `Kasbon ${bill.angler_name} dilunasi!`, type: "success" });
  };

  const saveAdj = async () => {
    if (!adjForm.qty || !adjForm.notes) return;
    const qty = parseInt(adjForm.qty),
      p = adjModal;
    let before = 0,
      after = 0,
      change = 0;
    if (adjForm.unit === "bungkus") {
      before = p.stok_bungkus;
      change = -qty;
      after = before + change;
    } else if (adjForm.unit === "batang") {
      before = p.stok_batang;
      change = -qty;
      after = before + change;
    } else {
      before = p.stok;
      change = adjForm.type === "restock" ? qty : -qty;
      after = before + change;
    }
    if (after < 0) {
      setToast({ msg: "Stok tidak boleh negatif!", type: "error" });
      return;
    }
    if (SB_READY) {
      await supabase.from("stock_adjustments").insert({
        product_id: p.id,
        adj_type: adjForm.type,
        unit: adjForm.unit,
        qty_before: before,
        qty_change: change,
        qty_after: after,
        notes: adjForm.notes,
        created_by: safeUserId(user),
      });
      const upd =
        adjForm.unit === "bungkus"
          ? { stok_bungkus: after }
          : adjForm.unit === "batang"
            ? { stok_batang: after }
            : { stok: after };
      await supabase.from("products").update(upd).eq("id", p.id);
    } else {
      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id !== p.id) return prod;
          if (adjForm.unit === "bungkus")
            return { ...prod, stok_bungkus: after };
          if (adjForm.unit === "batang") return { ...prod, stok_batang: after };
          return { ...prod, stok: after };
        }),
      );
    }
    setToast({ msg: "Stok disesuaikan!", type: "success" });
    setAdjModal(null);
    setAdjForm({ type: "hilang", unit: "pcs", qty: "", notes: "" });
  };

  const saveNewProd = async () => {
    if (!newProd.name || !newProd.hargaBeli || !newProd.hargaJual) return;
    const prod = {
      name: newProd.name,
      category: newProd.category,
      is_cigarette: false,
      stok: parseInt(newProd.stok) || 0,
      harga_beli: parseFloat(newProd.hargaBeli) || 0,
      harga_jual: parseFloat(newProd.hargaJual) || 0,
      is_active: true,
    };
    if (SB_READY) {
      const { error } = await supabase
        .from("products")
        .insert({ ...prod, created_by: safeUserId(user) });
      if (error) {
        setToast({ msg: error.message, type: "error" });
        return;
      }
    } else {
      setProducts((prev) => [...prev, { ...prod, id: Date.now().toString() }]);
    }
    setToast({ msg: "Produk ditambahkan!", type: "success" });
    setNewProdModal(false);
    setNewProd({
      name: "",
      category: "makanan",
      stok: "",
      hargaBeli: "",
      hargaJual: "",
    });
  };

  const deleteProd = async (id) => {
    if (!confirm("Hapus produk ini?")) return;
    if (SB_READY)
      await supabase.from("products").update({ is_active: false }).eq("id", id);
    else setProducts((prev) => prev.filter((p) => p.id !== id));
    setToast({ msg: "Produk dihapus", type: "success" });
  };

  const totalRev = txns.reduce((a, t) => a + parseFloat(t.revenue || 0), 0);
  const totalProf = txns.reduce((a, t) => a + parseFloat(t.profit || 0), 0);
  const lowStock = products.filter(
    (p) => (p.is_cigarette ? p.stok_bungkus : p.stok) <= LOW_STOCK,
  );
  const SUB = [
    ["pos", "💳 POS"],
    ["inventory", "📦 Stok"],
    ["bills", "📝 Kasbon"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <KpiCard
          label="Omzet Hari Ini"
          value={fmtShort(totalRev)}
          sub={`${txns.length} transaksi`}
          color={C.blueL}
          icon="🛒"
        />
        <KpiCard
          label="Laba Hari Ini"
          value={fmtShort(totalProf)}
          sub={`${totalRev > 0 ? Math.round((totalProf / totalRev) * 100) : 0}% margin`}
          color={C.emerald}
          icon="💹"
        />
        <KpiCard
          label="Open Bills"
          value={bills.length}
          sub={bills.length > 0 ? "Kasbon aktif" : "Lunas semua"}
          color={bills.length > 0 ? C.rose : C.emerald}
          icon="📝"
        />
        <KpiCard
          label="Produk Aktif"
          value={products.length}
          sub={`${lowStock.length} perlu restock`}
          color={lowStock.length > 0 ? C.amber : C.blueL}
          icon="📦"
        />
      </div>

      {lowStock.length > 0 && (
        <div
          style={{
            padding: "12px 14px",
            background: "#FFEBEE",
            border: `1px solid #FFCDD2`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: C.rose,
              marginBottom: 6,
            }}
          >
            ⚠️ Stok Menipis!
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {lowStock.map((p) => (
              <span
                key={p.id}
                style={{
                  padding: "3px 9px",
                  background: C.white,
                  border: "1px solid #FFCDD2",
                  borderRadius: 20,
                  fontSize: 11,
                  color: C.rose,
                  fontWeight: 600,
                }}
              >
                {p.name}:{" "}
                {p.is_cigarette ? `${p.stok_bungkus} bks` : `${p.stok} pcs`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {SUB.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSubTab(k)}
            style={{
              flexShrink: 0,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              background: subTab === k ? C.blue : C.gray100,
              color: subTab === k ? C.white : C.gray500,
              fontWeight: subTab === k ? 700 : 500,
              fontSize: 13,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {subTab === "pos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <CardHdr title="Kasir" sub="Transaksi baru" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Pilih Produk">
                <Sel
                  value={posForm.productId}
                  onChange={(e) =>
                    setPosForm((p) => ({
                      ...p,
                      productId: e.target.value,
                      unit: "pcs",
                    }))
                  }
                >
                  <option value="">— Pilih produk —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{" "}
                      {p.is_cigarette
                        ? `(${p.stok_bungkus}bks/${p.stok_batang}btg)`
                        : `(${p.stok}pcs)`}
                    </option>
                  ))}
                </Sel>
              </Field>
              {selected && (
                <div
                  style={{
                    padding: 11,
                    background: C.pale,
                    border: `1px solid ${C.paleDark}`,
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: C.blue,
                      fontWeight: 600,
                      marginBottom: 3,
                    }}
                  >
                    Harga Jual
                  </div>
                  {isCig ? (
                    <div style={{ fontSize: 13 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: C.blue,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {fmt(selected.harga_jual_bungkus)}
                      </span>
                      <span style={{ color: C.gray400 }}>/bks · </span>
                      <span
                        style={{
                          fontWeight: 800,
                          color: C.blue,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {fmt(selected.harga_jual_batang)}
                      </span>
                      <span style={{ color: C.gray400 }}>/btg</span>
                    </div>
                  ) : (
                    <span
                      style={{
                        fontWeight: 800,
                        color: C.blue,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 15,
                      }}
                    >
                      {fmt(selected.harga_jual)}
                    </span>
                  )}
                </div>
              )}
              {isCig && (
                <Field label="Satuan">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {["bungkus", "batang"].map((u) => (
                      <button
                        key={u}
                        onClick={() => setPosForm((p) => ({ ...p, unit: u }))}
                        style={{
                          padding: "10px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          border: `2px solid ${posForm.unit === u ? C.blueL : C.gray200}`,
                          background: posForm.unit === u ? C.pale : C.white,
                          color: posForm.unit === u ? C.blue : C.gray500,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {u.charAt(0).toUpperCase() + u.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Jumlah">
                <Inp
                  type="number"
                  min="1"
                  value={posForm.qty}
                  onChange={(e) =>
                    setPosForm((p) => ({ ...p, qty: e.target.value }))
                  }
                  placeholder="0"
                />
              </Field>
              <Field label="Pembayaran">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {[
                    ["cash", "💵 Cash"],
                    ["kasbon", "📝 Kasbon"],
                  ].map(([m, l]) => (
                    <button
                      key={m}
                      onClick={() => setBillMode(m)}
                      style={{
                        padding: "10px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: `2px solid ${billMode === m ? C.blueL : C.gray200}`,
                        background: billMode === m ? C.pale : C.white,
                        color: billMode === m ? C.blue : C.gray500,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              {billMode === "kasbon" && (
                <Field label="Nama Pemancing">
                  <Inp
                    type="text"
                    value={posForm.billName}
                    onChange={(e) =>
                      setPosForm((p) => ({ ...p, billName: e.target.value }))
                    }
                    placeholder="Nama..."
                  />
                </Field>
              )}
              {previewTotal > 0 && (
                <div
                  style={{
                    padding: 13,
                    background: C.gray50,
                    border: `1px solid ${C.gray200}`,
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: C.gray500, fontWeight: 600 }}
                  >
                    Total Bayar
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: C.blue,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {fmt(previewTotal)}
                  </span>
                </div>
              )}
              <Btn
                onClick={handleSell}
                loading={saving}
                style={{ width: "100%" }}
              >
                {billMode === "cash"
                  ? "💵 Proses Pembayaran"
                  : "📝 Tambah ke Kasbon"}
              </Btn>
            </div>
          </Card>
          <Card>
            <CardHdr
              title="Transaksi Hari Ini"
              sub={`${txns.length} tercatat`}
            />
            {txns.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: C.gray300,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                <div style={{ fontSize: 13 }}>Belum ada transaksi</div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {txns.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: C.gray50,
                      border: `1px solid ${C.gray200}`,
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: C.gray800,
                        }}
                      >
                        {t.product_name}
                      </div>
                      <div
                        style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}
                      >
                        {t.qty} {t.unit} ·{" "}
                        {t.payment_type === "kasbon"
                          ? `📝 ${t.kasbon_name}`
                          : "💵"}{" "}
                        · {t.users?.full_name || "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: C.gray800,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {fmt(t.revenue)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.emerald,
                          fontWeight: 600,
                        }}
                      >
                        +{fmt(t.profit)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {subTab === "inventory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={() => setNewProdModal(true)} variant="secondary">
              ➕ Tambah Produk
            </Btn>
          </div>
          <Card>
            <CardHdr
              title="Stok Inventori"
              sub={`${products.length} produk aktif`}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {products.map((p) => {
                const stock = p.is_cigarette ? p.stok_bungkus : p.stok;
                const isLow = stock <= LOW_STOCK;
                const catC = {
                  rokok: C.violet,
                  minuman: C.blueL,
                  makanan: C.emerald,
                  lainnya: C.gray500,
                };
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: isLow ? "#FFEBEE" : C.gray50,
                      border: `1px solid ${isLow ? "#FFCDD2" : C.gray200}`,
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: (catC[p.category] || C.gray400) + "18",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {p.category === "rokok"
                        ? "🚬"
                        : p.category === "minuman"
                          ? "🥤"
                          : "🍜"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: C.gray800,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          marginTop: 3,
                        }}
                      >
                        <Badge color={catC[p.category]}>{p.category}</Badge>
                        {isLow && (
                          <Badge color={C.rose} bg="#FFEBEE">
                            Restock!
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {p.is_cigarette ? (
                        <>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: isLow ? C.rose : C.gray800,
                            }}
                          >
                            {p.stok_bungkus} bks
                          </div>
                          <div style={{ fontSize: 11, color: C.gray400 }}>
                            {p.stok_batang} btg
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: isLow ? C.rose : C.gray800,
                          }}
                        >
                          {p.stok} pcs
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.gray400 }}>
                        {fmt(
                          p.is_cigarette ? p.harga_jual_bungkus : p.harga_jual,
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginLeft: 4,
                      }}
                    >
                      <button
                        onClick={() => {
                          setAdjModal(p);
                          setAdjForm({
                            type: "hilang",
                            unit: p.is_cigarette ? "bungkus" : "pcs",
                            qty: "",
                            notes: "",
                          });
                        }}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 7,
                          background: C.pale,
                          border: `1px solid ${C.paleDark}`,
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.blue,
                          fontFamily: "inherit",
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => deleteProd(p.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 7,
                          background: "#FFEBEE",
                          border: "1px solid #FFCDD2",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.rose,
                          fontFamily: "inherit",
                        }}
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {subTab === "bills" && (
        <Card>
          <CardHdr
            title="Open Bills / Kasbon Warung"
            sub={bills.length > 0 ? `${bills.length} aktif` : "Lunas semua"}
          />
          {bills.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: C.gray300,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13 }}>Tidak ada kasbon aktif</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    padding: 16,
                    background: "#FFF9F0",
                    border: `1px solid #FED7AA`,
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 18 }}>🎣</span>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: C.gray800,
                          }}
                        >
                          {bill.angler_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.gray400 }}>
                          {bill.bill_date}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color: C.amber,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {fmt(bill.total_amount)}
                    </div>
                  </div>
                  <Btn
                    variant="success"
                    onClick={() => settleBill(bill)}
                    style={{ width: "100%" }}
                  >
                    ✅ Lunaskan {fmt(bill.total_amount)}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Stock Adj Modal */}
      <Modal
        open={!!adjModal}
        onClose={() => setAdjModal(null)}
        title={`Edit Stok — ${adjModal?.name}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: "10px 14px",
              background: C.pale,
              borderRadius: 10,
              fontSize: 13,
              color: C.blue,
            }}
          >
            Stok saat ini:{" "}
            {adjModal?.is_cigarette
              ? `${adjModal?.stok_bungkus} bks / ${adjModal?.stok_batang} btg`
              : `${adjModal?.stok} pcs`}
          </div>
          <Field label="Tipe Penyesuaian">
            <Sel
              value={adjForm.type}
              onChange={(e) =>
                setAdjForm((f) => ({ ...f, type: e.target.value }))
              }
            >
              <option value="hilang">📦 Hilang</option>
              <option value="rusak">💔 Rusak/Kadaluarsa</option>
              <option value="restock">🔄 Restock/Tambah</option>
              <option value="koreksi">✏️ Koreksi Manual</option>
            </Sel>
          </Field>
          {adjModal?.is_cigarette && (
            <Field label="Satuan">
              <Sel
                value={adjForm.unit}
                onChange={(e) =>
                  setAdjForm((f) => ({ ...f, unit: e.target.value }))
                }
              >
                <option value="bungkus">Bungkus</option>
                <option value="batang">Batang</option>
              </Sel>
            </Field>
          )}
          <Field label="Jumlah">
            <Inp
              type="number"
              min={1}
              placeholder="0"
              value={adjForm.qty}
              onChange={(e) =>
                setAdjForm((f) => ({ ...f, qty: e.target.value }))
              }
            />
          </Field>
          <Field label="Catatan (wajib)">
            <Textarea
              placeholder="Jelaskan alasan..."
              value={adjForm.notes}
              onChange={(e) =>
                setAdjForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </Field>
          <Btn onClick={saveAdj} style={{ width: "100%" }}>
            💾 Simpan Penyesuaian
          </Btn>
        </div>
      </Modal>

      {/* New Product Modal */}
      <Modal
        open={newProdModal}
        onClose={() => setNewProdModal(false)}
        title="Tambah Produk Baru"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nama Produk">
            <Inp
              type="text"
              placeholder="Nama..."
              value={newProd.name}
              onChange={(e) =>
                setNewProd((p) => ({ ...p, name: e.target.value }))
              }
            />
          </Field>
          <Field label="Kategori">
            <Sel
              value={newProd.category}
              onChange={(e) =>
                setNewProd((p) => ({ ...p, category: e.target.value }))
              }
            >
              <option value="makanan">🍜 Makanan</option>
              <option value="minuman">🥤 Minuman</option>
              <option value="rokok">🚬 Rokok</option>
              <option value="lainnya">📦 Lainnya</option>
            </Sel>
          </Field>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <Field label="Stok Awal">
              <Inp
                type="number"
                min={0}
                placeholder="0"
                value={newProd.stok}
                onChange={(e) =>
                  setNewProd((p) => ({ ...p, stok: e.target.value }))
                }
              />
            </Field>
            <Field label="Harga Beli">
              <Inp
                type="number"
                min={0}
                placeholder="Rp"
                value={newProd.hargaBeli}
                onChange={(e) =>
                  setNewProd((p) => ({ ...p, hargaBeli: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Harga Jual">
            <Inp
              type="number"
              min={0}
              placeholder="Rp"
              value={newProd.hargaJual}
              onChange={(e) =>
                setNewProd((p) => ({ ...p, hargaJual: e.target.value }))
              }
            />
          </Field>
          {newProd.hargaBeli && newProd.hargaJual && (
            <div
              style={{
                padding: 10,
                background: C.pale,
                borderRadius: 9,
                fontSize: 13,
              }}
            >
              Estimasi margin:{" "}
              <strong
                style={{ color: C.emerald, fontFamily: "'DM Mono',monospace" }}
              >
                {Math.round(
                  ((parseFloat(newProd.hargaJual) -
                    parseFloat(newProd.hargaBeli)) /
                    parseFloat(newProd.hargaJual)) *
                    100,
                )}
                %
              </strong>
            </div>
          )}
          <Btn onClick={saveNewProd} style={{ width: "100%" }}>
            ➕ Simpan Produk
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// LAPORAN
// ─────────────────────────────────────────────────────────
function LaporanTab({ bp }) {
  const { sessions } = useSessions();
  const { txns } = useTransactions();
  const [startDate, setStartDate] = useState(today());
  const [period, setPeriod] = useState("daily");
  const [loading, setLoading] = useState({ excel: false, pdf: false });
  const [toast, setToast] = useState(null);
  const [cashMatch, setCashMatch] = useState(true);
  const [cashNotes, setCashNotes] = useState("");

  const endDate =
    period === "weekly"
      ? new Date(new Date(startDate).getTime() + 6 * 86400000)
          .toISOString()
          .slice(0, 10)
      : startDate;

  const download = async (type) => {
    if (!cashMatch && !cashNotes.trim()) {
      setToast({ msg: "Wajib mengisi catatan jika terdapat selisih uang fisik!", type: "error" });
      return;
    }
    
    setLoading((l) => ({ ...l, [type]: true }));
    try {
      const url = `${API_URL}/api/report/${type}?start=${startDate}&period=${period}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(
          `Gagal memuat laporan (HTTP ${res.status}) — Pastikan API berjalan`,
        );
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `laporan_ayom_${startDate}.${type === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      setToast({
        msg: `Laporan ${type.toUpperCase()} berhasil diunduh!`,
        type: "success",
      });
    } catch (e) {
      setToast({ msg: "Gagal: " + e.message, type: "error" });
    }
    setLoading((l) => ({ ...l, [type]: false }));
  };

  const filtS = sessions.filter(
    (s) => s.session_date >= startDate && s.session_date <= endDate,
  );
  const filtT = txns.filter(
    (t) => t.trans_date >= startDate && t.trans_date <= endDate,
  );
  const galRev = filtS.reduce((a, s) => a + s.participants * TICKET_PRICE, 0);
  const warRev = filtT.reduce((a, t) => a + parseFloat(t.revenue || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <Card>
        <CardHdr
          title="📋 Generate Laporan"
          sub="Excel & PDF dengan data lengkap"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Field label="Tanggal Mulai">
            <Inp
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Periode">
            <Sel value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Harian (1 hari)</option>
              <option value="weekly">Mingguan (7 hari)</option>
            </Sel>
          </Field>
        </div>
        <div
          style={{
            padding: "10px 14px",
            background: C.pale,
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          <span style={{ color: C.gray500 }}>Rentang: </span>
          <strong style={{ color: C.blue }}>
            {new Date(startDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {period === "weekly" &&
              ` — ${new Date(endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
          </strong>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              background: C.gray50,
              borderRadius: 12,
              border: `1px solid ${C.gray200}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.gray400,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Galatama
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: C.blueL,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {fmt(galRev)}
            </div>
            <div style={{ fontSize: 11, color: C.emerald }}>
              Profit: {fmt(galRev * 0.5)}
            </div>
            <div style={{ fontSize: 11, color: C.gray400 }}>
              {filtS.length} sesi
            </div>
          </div>
          <div
            style={{
              padding: "12px 14px",
              background: C.gray50,
              borderRadius: 12,
              border: `1px solid ${C.gray200}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.gray400,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Warung
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: C.amber,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {fmt(warRev)}
            </div>
            <div style={{ fontSize: 11, color: C.gray400 }}>
              {filtT.length} transaksi
            </div>
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Btn
            onClick={() => download("excel")}
            loading={loading.excel}
            variant="success"
            style={{ width: "100%" }}
          >
            📊 Download Excel
          </Btn>
          <Btn
            onClick={() => download("pdf")}
            loading={loading.pdf}
            variant="navy"
            style={{ width: "100%" }}
          >
            📄 Download PDF
          </Btn>
        </div>
        <div
          style={{
            marginTop: 14,
            padding: "14px",
            background: C.gray50,
            border: `1px solid ${C.gray200}`,
            borderRadius: 10,
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.gray700 }}>
            <input 
              type="checkbox" 
              checked={cashMatch}
              onChange={(e) => setCashMatch(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.blue }}
            />
            ✅ Uang fisik di laci sesuai dengan total pencatatan sistem
          </label>
          
          {!cashMatch && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: C.rose, fontWeight: 700, marginBottom: 4 }}>
                ⚠️ Terdapat Selisih! (Wajib diisi)
              </div>
              <textarea
                value={cashNotes}
                onChange={(e) => setCashNotes(e.target.value)}
                placeholder="Jelaskan alasan selisih uang (contoh: untuk kembalian kurang 50rb, kasbon belum dibayar, dll)..."
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${C.rose}`,
                  background: "#FFF",
                  fontFamily: "inherit",
                  fontSize: 13,
                  resize: "vertical",
                  minHeight: 60
                }}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────
function AppInner() {
  const { user, logout, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const bp = useBreakpoint();
  const { isDesktop, isMobile } = bp;

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.navy,
        }}
      >
        <div style={{ color: C.white, fontSize: 16 }}>⏳ Memuat...</div>
      </div>
    );
  if (!user) return <LoginPage />;

  const PAGE_TITLES = {
    dashboard: "Dashboard",
    galatama: "Galatama",
    warung: "Warung",
    laporan: "Laporan",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.gray50 }}>
      {isDesktop && (
        <Sidebar tab={tab} setTab={setTab} user={user} logout={logout} />
      )}
      <div
        style={{
          flex: 1,
          marginLeft: isDesktop ? 230 : 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            background: C.white,
            borderBottom: `1px solid ${C.gray200}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 14px" : "0 28px",
            height: isMobile ? 56 : 64,
            position: "sticky",
            top: 0,
            zIndex: 50,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  fontSize: 17,
                  background: "linear-gradient(135deg,#42A5F5,#1565C0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                🎣
              </div>
            )}
            <div>
              <h1
                style={{
                  fontSize: isMobile ? 15 : 17,
                  fontWeight: 800,
                  color: C.gray800,
                }}
              >
                {PAGE_TITLES[tab]}
              </h1>
              {!isMobile && (
                <p style={{ fontSize: 12, color: C.gray400, marginTop: 1 }}>
                  Pemancingan Ayom
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isMobile && (
              <div style={{ fontSize: 11, color: C.gray400, fontWeight: 600 }}>
                👤 {user.full_name || user.username}
              </div>
            )}
            {!isMobile && (
              <button
                onClick={logout}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: C.gray100,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.gray500,
                  fontFamily: "inherit",
                }}
              >
                Keluar
              </button>
            )}
            <div style={{ fontSize: 11, color: C.gray400 }}>
              {new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </div>
          </div>
        </header>
        <main
          style={{
            flex: 1,
            padding: isMobile ? "14px" : "24px 28px",
            paddingBottom: !isDesktop ? "80px" : "24px",
            maxWidth: isDesktop ? 1360 : "100%",
            width: "100%",
          }}
        >
          {tab === "dashboard" && <DashboardTab bp={bp} />}
          {tab === "galatama" && <GalatamaTab bp={bp} />}
          {tab === "warung" && <WarungTab bp={bp} />}
          {tab === "laporan" && <LaporanTab bp={bp} />}
        </main>
      </div>
      {!isDesktop && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
