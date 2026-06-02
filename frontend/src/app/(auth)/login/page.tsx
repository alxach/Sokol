"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { Shield, Lock, KeyRound } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 bg-white">
        <div>
          <div className="mb-8">
            <img src="/logo.svg" alt="СОКОЛ" className="h-[65px] w-auto" />
          </div>

          <h1 className="text-3xl font-bold text-brand-navy leading-tight">
            Цифровая система центра<br />спортивных единоборств «СОКОЛ»
          </h1>
          <p className="mt-3 text-neutral-500 leading-relaxed max-w-md">
            централизованная платформа
            в едином пространстве.
          </p>

          <div className="mt-6 flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> JWT</span>
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> RBAC</span>
            <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> SSO</span>
          </div>
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">Вход в систему</h2>
          <p className="text-sm text-neutral-500 mb-6">Используйте корпоративные учётные данные.</p>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            ) : null}

            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="ivan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Пароль"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" className="rounded border-neutral-300" />
                Запомнить меня
              </label>
              <a href="#" className="text-sm text-brand-blue hover:text-brand-blue-hover">
                Забыли пароль?
              </a>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Войти
            </Button>
          </form>
        </div>

        <p className="mt-auto pt-12 text-xs text-neutral-400">
          © СОКОЛ Federation Platform
        </p>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-navy via-brand-navy-light to-brand-blue items-center justify-center p-12">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <img src="/logo.svg" alt="СОКОЛ" className="h-[90px] w-auto brightness-0 invert" />
          </div>
          <h2 className="text-2xl font-bold text-white">ЦСЕ «Сокол»</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Централизованная система управления спортивными единоборствами
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Самбо</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Дзюдо</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Каратэ</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Бокс</span>
          </div>
        </div>
      </div>
    </div>
  );
}
