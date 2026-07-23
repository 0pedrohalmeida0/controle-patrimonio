import { ShieldCheck, Wrench, Eye, Monitor } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { AppRole } from "@/lib/types";

const ROLES: Record<
  AppRole,
  { label: string; variant: "default" | "secondary" | "success" | "warning"; icon: typeof ShieldCheck }
> = {
  administrador: { label: "users.role.administrador", variant: "default", icon: ShieldCheck },
  editor: { label: "users.role.editor", variant: "success", icon: Wrench },
  leitor: { label: "users.role.leitor", variant: "secondary", icon: Eye },
  kiosk: { label: "users.role.kiosk", variant: "warning", icon: Monitor },
};

export function RoleBadge({
  role,
  className,
}: {
  role: AppRole | null;
  className?: string;
}) {
  if (!role) {
    return (
      <Badge variant="muted" className={className}>
        —
      </Badge>
    );
  }
  const r = ROLES[role];
  const Icon = r.icon;
  return (
    <Badge variant={r.variant} className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {t(r.label)}
    </Badge>
  );
}
