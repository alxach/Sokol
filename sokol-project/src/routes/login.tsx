import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Вход — СОКОЛ" },
      { name: "description", content: "Вход в спортивную платформу СОКОЛ." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16 bg-background">
        <div>
          <div className="mb-8">
            <img src="/logo.png" alt="СОКОЛ" className="h-[65px] w-auto" />
          </div>

          <h1 className="text-3xl font-bold text-secondary font-display leading-tight">
            Цифровая система центра<br />спортивных единоборств «СОКОЛ»
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">
            единая платформа управления спортсменами, тренерами и соревнованиями
          </p>

          <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> JWT</span>
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> RBAC</span>
            <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> SSO</span>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground mb-1">Вход в систему</h2>
          <p className="text-sm text-muted-foreground mb-6">Используйте корпоративные учётные данные.</p>
          <div className="mb-6 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            Демо: <strong className="text-foreground">admin@sokol.ru</strong> (админ) или <strong className="text-foreground">coach@sokol.ru</strong> (тренер)
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
            {error ? (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@sokol.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="rounded border-border" />
                Запомнить меня
              </label>
              <a href="#" className="text-sm text-primary hover:text-primary/80">
                Забыли пароль?
              </a>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Вход…" : "Войти"}
            </Button>
          </form>
        </div>

        <p className="mt-auto pt-12 text-xs text-muted-foreground">
          © СОКОЛ Sport Platform
        </p>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-secondary to-primary items-center justify-center p-12">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <img src="/logo.png" alt="СОКОЛ" className="h-[90px] w-auto brightness-0 invert" />
          </div>
          <h2 className="text-2xl font-bold text-primary-foreground font-display">ЦСЕ «Сокол»</h2>
          <p className="text-sm text-primary-foreground/70 leading-relaxed">
            Централизованная система управления спортивными единоборствами
          </p>
          <div className="flex justify-center gap-3 pt-4">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-primary-foreground/80">Самбо</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-primary-foreground/80">Дзюдо</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-primary-foreground/80">Каратэ</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-primary-foreground/80">Бокс</span>
          </div>
        </div>
      </div>
    </div>
  );
}
