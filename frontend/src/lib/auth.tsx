import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { apiFetch } from "./api/client";

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
  isDirector: boolean;
  isSuperadmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    middle_name?: string | null;
    roles: string[];
    center_id: string | null;
  };
}

interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  roles: string[];
}

function buildFullName(u: { last_name: string; first_name: string; middle_name?: string | null }): string {
  return [u.last_name, u.first_name, u.middle_name ?? ""].filter(Boolean).join(" ");
}

function mapUser(u: LoginResponse["user"] | MeResponse): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    roles: u.roles,
    centerId: "center_id" in u ? (u as LoginResponse["user"]).center_id ?? undefined : undefined,
    coachName: buildFullName(u),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sokol_token");
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<MeResponse>("/auth/me")
      .then((data) => setUser(mapUser(data)))
      .catch(() => {
        localStorage.removeItem("sokol_token");
        localStorage.removeItem("sokol_refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email) throw new Error("Введите email");
    const data = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("sokol_token", data.access_token);
    localStorage.setItem("sokol_refresh_token", data.refresh_token);
    setUser(mapUser(data.user));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sokol_token");
    localStorage.removeItem("sokol_refresh_token");
    setUser(null);
  }, []);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.includes("coach") ?? false;
  const isDirector = user?.roles.includes("director") ?? false;
  const isSuperadmin = user?.roles.includes("superadmin") ?? false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isCoach, isDirector, isSuperadmin }}>
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
