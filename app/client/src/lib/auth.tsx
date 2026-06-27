import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api, clearToken, getToken, setToken, User } from "./api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: {
    displayName?: string;
    bio?: string;
    avatar?: string;
  }) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.login(email, password);
    setToken(r.token);
    setUser(r.user);
  }
  async function register(email: string, username: string, password: string) {
    const r = await api.register(email, username, password);
    setToken(r.token);
    setUser(r.user);
  }
  async function logout() {
    try {
      await api.logout();
    } catch {
      /* token déjà invalide */
    }
    clearToken();
    setUser(null);
  }
  async function updateProfile(patch: {
    displayName?: string;
    bio?: string;
    avatar?: string;
  }) {
    const r = await api.updateMe(patch);
    setUser(r.user);
  }

  return (
    <Ctx.Provider
      value={{ user, loading, login, register, logout, updateProfile }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth hors AuthProvider");
  return ctx;
}
