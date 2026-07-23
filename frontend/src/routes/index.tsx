import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Boxes,
  Clock,
  AlertOctagon,
  CalendarCheck2,
  ArrowRight,
} from "lucide-react";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Asset, Movement, Problem } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { formatAssetCode, formatDateTime } from "@/lib/utils";

interface AssetsResponse {
  items: Asset[];
  total: number;
  page: number;
  size: number;
}

interface MovementsResponse {
  items: Movement[];
  total: number;
}

interface ProblemsResponse {
  items: Problem[];
  total: number;
}

export default function DashboardRoute() {
  const assetsQ = useQuery({
    queryKey: ["assets", { dashboard: true }],
    queryFn: () => api.get<AssetsResponse>("/api/v1/assets?size=1"),
    staleTime: 30_000,
  });

  const inUseQ = useQuery({
    queryKey: ["assets", { dashboard: "in_use" }],
    queryFn: () =>
      api.get<AssetsResponse>("/api/v1/assets?status=in_use&size=1"),
    staleTime: 30_000,
  });

  const problemQ = useQuery({
    queryKey: ["problems", { dashboard: "open" }],
    queryFn: () =>
      api.get<ProblemsResponse>("/api/v1/problems?status=open&size=1"),
    staleTime: 30_000,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const movementsTodayQ = useQuery({
    queryKey: ["movements", { dashboard: "today" }],
    queryFn: () =>
      api.get<MovementsResponse>(
        `/api/v1/movements?from=${encodeURIComponent(todayIso)}&size=10`,
      ),
    staleTime: 30_000,
  });

  const cards = [
    {
      title: "Ativos totais",
      value: assetsQ.data?.total ?? 0,
      icon: Boxes,
      href: "/ativos",
    },
    {
      title: "Em uso",
      value: inUseQ.data?.total ?? 0,
      icon: Clock,
      href: "/ativos?status=in_use",
    },
    {
      title: "Com problema",
      value: problemQ.data?.total ?? 0,
      icon: AlertOctagon,
      href: "/problemas?status=open",
    },
    {
      title: "Movimentações hoje",
      value: movementsTodayQ.data?.total ?? 0,
      icon: CalendarCheck2,
      href: "/movimentacoes",
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav.dashboard")}
        description="Visão geral do sistema"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.title} to={c.href} className="group">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{c.value}</p>
                  <p className="mt-1 flex items-center text-xs text-muted-foreground">
                    Ver detalhes <ArrowRight className="ml-1 h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Movimentações de hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {movementsTodayQ.isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !movementsTodayQ.data?.items.length ? (
              <p className="text-sm text-muted-foreground">
                Sem movimentações hoje.
              </p>
            ) : (
              <ul className="divide-y">
                {movementsTodayQ.data.items.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono">
                        {m.assets
                          ? formatAssetCode(m.assets as Asset)
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {m.holder}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {m.type === "withdraw" ? "Retirada" : "Devolução"}
                      <span>•</span>
                      <span>{formatDateTime(m.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
