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
      // Coba verifikasi via backend
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          },
        );
        if (res.ok) {
          const json = await res.json();
          return json.valid ? user : null;
        }
      } catch {
        // Backend tidak jalan — cek demo password
        if (DEMO_PASSWORDS[username] === password) return user;
      }
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
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("ayom_user");
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
