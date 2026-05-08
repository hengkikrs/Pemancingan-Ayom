import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

// Demo users (fallback jika Supabase belum disetup)
const DEMO_USERS = {
  admin: {
    id: "demo-admin",
    username: "admin",
    full_name: "Administrator",
    role: "admin",
    is_active: true,
  },
  kasir: {
    id: "demo-kasir",
    username: "kasir",
    full_name: "Kasir",
    role: "kasir",
    is_active: true,
  },
};
const DEMO_PASSWORDS = { admin: "ayom2024", kasir: "kasir123" };

async function verifyLogin(username, password) {
  // 1. Coba Supabase dulu
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, full_name, role, is_active")
      .eq("username", username)
      .eq("is_active", true)
      .limit(1);

    if (!error && users?.length) {
      const user = users[0];
      // Verifikasi password via Supabase RPC (pgcrypto)
      try {
        const { data: valid, error: rpcErr } = await supabase
          .rpc("verify_password", {
            p_username: username,
            p_password: password,
          });
        if (!rpcErr && valid === true) return user;
        if (!rpcErr && valid === false) return null;
        // RPC error (fungsi belum dibuat?) → fallback demo
      } catch {
        // RPC tidak tersedia → fallback demo
      }
      // Fallback: cek demo password
      if (DEMO_PASSWORDS[username] === password) return user;
      return null;
    }
  } catch {
    // Supabase tidak bisa diakses, lanjut ke demo mode
  }

  // 2. Fallback demo mode (tanpa Supabase)
  const demoUser = DEMO_USERS[username];
  if (demoUser && DEMO_PASSWORDS[username] === password) {
    return demoUser;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("ayom_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const u = await verifyLogin(username, password);
    if (u) {
      setUser(u);
      localStorage.setItem("ayom_user", JSON.stringify(u));
      supabase.from("activity_logs").insert({
        action_type: "LOGIN",
        details: `Login berhasil sebagai ${u.username}`,
        created_by: u.id && u.id.length > 20 ? u.id : null,
      }).then(() => {});
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    if (user) {
      supabase.from("activity_logs").insert({
        action_type: "LOGOUT",
        details: `Logout ${user.username}`,
        created_by: user.id && user.id.length > 20 ? user.id : null,
      }).then(() => {});
    }
    setUser(null);
    localStorage.removeItem("ayom_user");
  }, [user]);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
