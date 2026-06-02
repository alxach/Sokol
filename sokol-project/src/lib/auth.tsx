import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  centerId?: string;
  coachName?: string;
  coachDiscipline?: string;
  city?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USERS: Record<string, User> = {
  "admin@sokol.ru": {
    id: "1",
    email: "admin@sokol.ru",
    firstName: "Алексей",
    lastName: "И.",
    roles: ["admin"],
    centerId: "center-1",
  },
  "coach@sokol.ru": {
    id: "2",
    email: "coach@sokol.ru",
    firstName: "Мария",
    lastName: "П.",
    roles: ["coach"],
    coachName: "Петров А.В.",
    coachDiscipline: "Дзюдо",
    city: "Москва",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sokol_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    if (!email) throw new Error("Введите email");
    const mockUser = MOCK_USERS[email.toLowerCase()];
    if (!mockUser) throw new Error("Пользователь не найден");
    localStorage.setItem("sokol_token", "mock-token");
    localStorage.setItem("sokol_user", JSON.stringify(mockUser));
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sokol_token");
    localStorage.removeItem("sokol_user");
    setUser(null);
  }, []);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.includes("coach") ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isCoach }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAuthGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  return { user, loading };
}
