import { Link, useRouterState } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Trophy,
  FileText,
  BarChart3,
  Settings,
  ClipboardList,
  CalendarCheck,
  Calendar,
  Building2,
  HandCoins,
  Dumbbell,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useCenter } from "@/lib/center";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;
  const { isAdmin, isCoach, isDirector, isSuperadmin } = useAuth();
  const { selectedCenterId, setSelectedCenterId, centers: centerList } = useCenter();

  const primary: NavItem[] = [
    { title: "Дашборд", url: "/", icon: LayoutDashboard },
    { title: "Спортсмены", url: "/athletes", icon: Users },
  ];

  const adminModules: NavItem[] = [
    { title: "Тренеры", url: "/coaches", icon: UserCog },
    { title: "Тренировки", url: "/trainings", icon: Dumbbell },
    { title: "Расписание", url: "/schedules", icon: Calendar },
    { title: "Соревнования", url: "/competitions", icon: Trophy },
    { title: "План мероприятий", url: "/plans", icon: CalendarCheck },
    { title: "Отчёты", url: "/reports", icon: FileText },
    { title: "Посещаемость", url: "/attendance", icon: ClipboardList },
    { title: "Комиссия", url: "/commission", icon: FileText },
    { title: "Программы", url: "/admin/programs", icon: HandCoins },
    { title: "Документы", url: "/documents", icon: FileText, disabled: true },
    { title: "Аналитика", url: "/analytics", icon: BarChart3 },
  ];

  const coachModules: NavItem[] = [
    { title: "Тренировки", url: "/trainings", icon: Dumbbell },
    { title: "Расписание", url: "/schedules", icon: Calendar },
    { title: "Соревнования", url: "/competitions", icon: Trophy },
    { title: "Мои группы", url: "/groups", icon: ClipboardList },
    { title: "План мероприятий", url: "/plans", icon: CalendarCheck },
    { title: "Отчёты", url: "/reports", icon: FileText },
    { title: "Посещаемость", url: "/attendance", icon: ClipboardList },
    { title: "Профиль", url: "/profile", icon: UserCog },
  ];

  const showAdminModules = isAdmin || isDirector || isSuperadmin;
  const secondary = showAdminModules ? adminModules : coachModules;

  const adminGroup: NavItem[] = isSuperadmin ? [
    { title: "Пользователи", url: "/admin/users", icon: Users },
    { title: "Оргструктура", url: "/admin/org", icon: Building2 },
    { title: "Программы", url: "/admin/programs", icon: HandCoins },
    { title: "Аудит-лог", url: "/admin/audit", icon: ClipboardList },
  ] : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent p-1.5">
            <img src="/logo.png" alt="СОКОЛ" className="h-full w-full brightness-0 invert" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-bold tracking-wide text-sidebar-foreground">
              СОКОЛ
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
              Sport Platform
            </span>
          </div>
        </Link>
        {isDirector && (
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <select
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
              className="h-7 w-full rounded-md border border-sidebar-border bg-sidebar-accent px-2 text-xs text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Все центры</option>
              {centerList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {showAdminModules ? (
        <>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Модули</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  {item.disabled ? (
                    <SidebarMenuButton tooltip={`${item.title} — скоро`} className="opacity-60">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-accent group-data-[collapsible=icon]:hidden">
                        soon
                      </span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminGroup.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Администрирование</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminGroup.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        </>
        ) : (
        <SidebarGroup>
          <SidebarGroupLabel>Моё</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...primary, ...coachModules].map((item) => (
                <SidebarMenuItem key={item.url}>
                  {item.disabled ? (
                    <SidebarMenuButton tooltip={`${item.title} — скоро`} className="opacity-60">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-accent group-data-[collapsible=icon]:hidden">
                        soon
                      </span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Настройки">
              <Settings className="h-4 w-4" />
              <span>Настройки</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
