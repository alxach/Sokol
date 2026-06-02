"use client";

import { useAuth } from "@/contexts/auth-context";
import { Bell } from "lucide-react";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-blue uppercase tracking-wider">ЦСЕ «Сокол»</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-700">
            {user?.first_name?.charAt(0) ?? "?"}
            {user?.last_name?.charAt(0) ?? ""}
          </div>
          <div>
            <p className="font-medium text-neutral-900">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-neutral-500">{user?.roles?.join(", ")}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
