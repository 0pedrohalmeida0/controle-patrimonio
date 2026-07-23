import { CheckCircle2, Clock, AlertOctagon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import type { AssetStatus, ProblemStatus } from "@/lib/types";

const ASSET_STATUS: Record<
  AssetStatus,
  { label: string; variant: "success" | "warning" | "destructive"; icon: typeof CheckCircle2 }
> = {
  available: { label: "status.available", variant: "success", icon: CheckCircle2 },
  in_use: { label: "status.in_use", variant: "warning", icon: Clock },
  problem: { label: "status.problem", variant: "destructive", icon: AlertOctagon },
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  const s = ASSET_STATUS[status];
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {t(s.label)}
    </Badge>
  );
}

export function ProblemStatusBadge({ status }: { status: ProblemStatus }) {
  if (status === "open") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertOctagon className="h-3 w-3" />
        {t("problems.status.open")}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="h-3 w-3" />
      {t("problems.status.resolved")}
    </Badge>
  );
}
