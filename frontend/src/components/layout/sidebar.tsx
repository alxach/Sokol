"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  ClipboardList,
  FileText,
  Trophy,
  BarChart3,
  FolderOpen,
  Bot,
  Search,
  LogOut,
  Sparkles,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin, isCoach } = useAuth();

  const mainNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isAdmin ? [{ href: "/athletes", label: "Спортсмены", icon: Users }] : [{ href: "/athletes", label: "Спортсмены", icon: Users }]),
    ...(isAdmin ? [{ href: "/coaches", label: "Тренеры", icon: UserCircle }] : []),
    { href: "/attendance", label: "Посещаемость", icon: ClipboardList },
    { href: "/reports", label: "Отчёты", icon: FileText },
  ];

  const federationNav = [
    { href: "/events", label: "События", icon: Trophy },
    ...(isAdmin ? [{ href: "/analytics", label: "Аналитика", icon: BarChart3 }] : []),
    { href: "/documents", label: "Документы", icon: FolderOpen },
    { href: "/ai", label: "СОКОЛ AI", icon: Bot },
  ];

  return (
    <aside className="flex w-64 flex-col border-r border-brand-navy-light bg-brand-navy text-white">
      <div className="px-4 py-4">
        <img src="/logo.svg" alt="СОКОЛ" className="h-9 w-auto brightness-0 invert" />
        <div className="mt-1 text-[11px] text-neutral-500 tracking-wide">
          {isAdmin ? "Federation Platform" : "Тренерский кабинет"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="mb-1 mt-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          {isAdmin ? "Основное" : "Моё"}
        </div>
        <nav className="space-y-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          {isAdmin ? "Федерация" : "Активности"}
        </div>
        <nav className="space-y-0.5">
          {federationNav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isAdmin ? (
          <div className="mt-4 rounded-lg bg-brand-orange/10 border border-brand-orange/20 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-orange">
              <Sparkles className="h-3.5 w-3.5" />
              СОКОЛ AI
            </div>
            <p className="mt-0.5 text-[11px] text-brand-orange/70 leading-tight">
              Аномалия в посещаемости — Омск. Проверьте отчёты.
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-neutral-800 p-3 space-y-2">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-white transition-colors">
          <Search className="h-4 w-4" />
          <span>⌘K</span>
        </button>

        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium text-white">
            {user?.first_name?.charAt(0) ?? "?"}
            {user?.last_name?.charAt(0) ?? ""}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {isAdmin ? "Администратор" : isCoach ? "Тренер" : user?.roles?.join(", ")}
            </p>
          </div>
          <button
            onClick={logout}
            className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
