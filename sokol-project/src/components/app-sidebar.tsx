import { Link, useRouterState } from "@tanstack/react-router";
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

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url;
  const { isAdmin, isCoach } = useAuth();

  const primary = [
    { title: "Дашборд", url: "/", icon: LayoutDashboard },
    { title: "Спортсмены", url: "/athletes", icon: Users },
  ];

  const adminModules = [
    { title: "Тренеры", url: "/coaches", icon: UserCog },
    { title: "Расписание", url: "/schedules", icon: Calendar },
    { title: "Соревнования", url: "/competitions", icon: Trophy },
    { title: "План мероприятий", url: "/plans", icon: CalendarCheck },
    { title: "Отчёты", url: "/reports", icon: FileText },
    { title: "Посещаемость", url: "/attendance", icon: ClipboardList },
    { title: "Документы", url: "/documents", icon: FileText, disabled: true },
    { title: "Аналитика", url: "/analytics", icon: BarChart3, disabled: true },
  ];

  const coachModules = [
    { title: "Расписание", url: "/schedules", icon: Calendar },
    { title: "Соревнования", url: "/competitions", icon: Trophy },
    { title: "Мои группы", url: "/groups", icon: ClipboardList },
    { title: "План мероприятий", url: "/plans", icon: CalendarCheck },
    { title: "Отчёты", url: "/reports", icon: FileText },
    { title: "Посещаемость", url: "/attendance", icon: ClipboardList },
  ];

  const secondary = isAdmin ? adminModules : coachModules;

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
      </SidebarHeader>

      <SidebarContent>
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
          <SidebarGroupLabel>{isAdmin ? "Модули" : "Моё"}</SidebarGroupLabel>
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
