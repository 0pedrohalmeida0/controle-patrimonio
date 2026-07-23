import { useCallback, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Boxes,
  Tags,
  ArrowLeftRight,
  AlertTriangle,
  BarChart3,
  Users,
  UserCheck,
  LogOut,
  Monitor,
  Menu,
  ScanLine,
  Settings,
  Download,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { useRealtimeChannel } from "@/lib/realtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePwaInstall } from "@/hooks/use-pwa-install";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/RoleBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  show: (ctx: { isKiosk: boolean; isAdmin: boolean; canEdit: boolean }) => boolean;
}

const NAV: NavItem[] = [
  {
    to: "/",
    label: "nav.dashboard",
    icon: LayoutDashboard,
    end: true,
    show: ({ isKiosk }) => !isKiosk,
  },
  {
    to: "/ativos",
    label: "nav.assets",
    icon: Boxes,
    show: ({ isKiosk }) => !isKiosk,
  },
  {
    to: "/tipos",
    label: "nav.types",
    icon: Tags,
    show: ({ isKiosk, canEdit }) => !isKiosk && canEdit,
  },
  {
    to: "/colaboradores",
    label: "nav.collaborators",
    icon: UserCheck,
    show: ({ isKiosk, canEdit }) => !isKiosk && canEdit,
  },
  {
    to: "/movimentacoes",
    label: "nav.movements",
    icon: ArrowLeftRight,
    show: ({ isKiosk }) => !isKiosk,
  },
  {
    to: "/problemas",
    label: "nav.problems",
    icon: AlertTriangle,
    show: ({ isKiosk }) => !isKiosk,
  },
  {
    to: "/indicadores",
    label: "nav.indicators",
    icon: BarChart3,
    show: ({ isKiosk }) => !isKiosk,
  },
  {
    to: "/kiosk",
    label: "nav.kiosk",
    icon: Monitor,
    show: () => true,
  },
  {
    to: "/kiosk/setup",
    label: "nav.kioskSetup",
    icon: Settings,
    show: ({ isKiosk, isAdmin }) => !isKiosk && isAdmin,
  },
  {
    to: "/usuarios",
    label: "nav.users",
    icon: Users,
    show: ({ isKiosk, isAdmin }) => !isKiosk && isAdmin,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { role, fullName, user, isAdmin, isKiosk, canEdit, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { canInstall, install } = usePwaInstall();

  // Realtime: invalidar queries em mudanças de dados operacionais.
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["problems"] });
    qc.invalidateQueries({ queryKey: ["indicators"] });
    qc.invalidateQueries({ queryKey: ["asset_types"] });
    qc.invalidateQueries({ queryKey: ["collaborators"] });
  }, [qc]);

  useRealtimeChannel("assets", invalidate);
  useRealtimeChannel("movements", invalidate);
  useRealtimeChannel("problems", invalidate);
  useRealtimeChannel("asset_types", invalidate);
  useRealtimeChannel("collaborators", invalidate);

  const visible = NAV.filter((n) => n.show({ isKiosk, isAdmin, canEdit }));
  const displayName = fullName || user?.email || "—";

  const handleSignOut = async () => {
    await signOut();
    qc.clear();
    navigate("/auth", { replace: true });
  };

  const navList = (
    <nav className="flex flex-col gap-1 p-3">
      {visible.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
          {isMobile && !isKiosk && (
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border p-4">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                      <ScanLine className="h-4 w-4" />
                    </span>
                    {t("app.name")}
                  </SheetTitle>
                </SheetHeader>
                {navList}
              </SheetContent>
            </Sheet>
          )}

          <div className="flex items-center gap-2">
            <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background sm:flex">
              <ScanLine className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold">{t("app.name")}</span>
          </div>

          <div className="flex flex-1 justify-end items-center gap-2">
            {canInstall && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void install()}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
            )}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1">
                  <RoleBadge role={role} />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {!isMobile && !isKiosk && (
          <aside className="hidden w-56 shrink-0 md:block">
            <div className="sticky top-20 rounded-lg border bg-card">
              {navList}
            </div>
          </aside>
        )}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
