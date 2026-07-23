import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Movement, Problem } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MovementsResp {
  items: Movement[];
  total: number;
}
interface ProblemsResp {
  items: Problem[];
  total: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(217 33% 35%)",
  "hsl(280 60% 50%)",
];

export default function IndicadoresRoute() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  const since = useMemo(() => {
    const d = subDays(new Date(), rangeDays - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [rangeDays]);

  const movsQ = useQuery({
    queryKey: ["indicators", "movements", { since, rangeDays }],
    queryFn: () =>
      api.get<MovementsResp>(
        `/api/v1/movements?from=${encodeURIComponent(since)}&size=500`,
      ),
    staleTime: 60_000,
  });

  const problemsQ = useQuery({
    queryKey: ["indicators", "problems"],
    queryFn: () =>
      api.get<ProblemsResp>("/api/v1/problems?size=500"),
    staleTime: 60_000,
  });

  // Daily movement counts
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; withdraw: number; return: number }>();
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map.set(key, {
        date: format(d, rangeDays <= 7 ? "EEE dd" : "dd/MM", { locale: ptBR }),
        withdraw: 0,
        return: 0,
      });
    }
    movsQ.data?.items.forEach((m) => {
      const key = format(new Date(m.created_at), "yyyy-MM-dd");
      const row = map.get(key);
      if (row) {
        if (m.type === "withdraw") row.withdraw += 1;
        else row.return += 1;
      }
    });
    return Array.from(map.values());
  }, [movsQ.data, rangeDays]);

  const problemsStatus = useMemo(() => {
    const open =
      problemsQ.data?.items.filter((p) => p.status === "open").length ?? 0;
    const resolved =
      problemsQ.data?.items.filter((p) => p.status === "resolved").length ?? 0;
    return [
      { name: t("problems.status.open"), value: open, key: "open" },
      { name: t("problems.status.resolved"), value: resolved, key: "resolved" },
    ];
  }, [problemsQ.data]);

  const topAssets = useMemo(() => {
    const counts = new Map<string, { code: string; count: number }>();
    movsQ.data?.items.forEach((m) => {
      if (m.type !== "withdraw") return;
      const a = m.assets;
      if (!a) return;
      const key = a.code || a.id;
      const cur = counts.get(key) ?? {
        code: a.code || a.id.slice(0, 6),
        count: 0,
      };
      cur.count += 1;
      counts.set(key, cur);
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [movsQ.data]);

  return (
    <div>
      <PageHeader
        title={t("indicators.title")}
        description={t("indicators.subtitle")}
        actions={
          <div className="flex gap-1">
            <Button
              variant={rangeDays === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setRangeDays(7)}
            >
              {t("indicators.range.7d")}
            </Button>
            <Button
              variant={rangeDays === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setRangeDays(30)}
            >
              {t("indicators.range.30d")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {rangeDays === 7
                ? t("indicators.movLast7")
                : t("indicators.movLast30")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="withdraw"
                  name="Retiradas"
                  fill="hsl(var(--warning))"
                />
                <Bar
                  dataKey="return"
                  name="Devoluções"
                  fill="hsl(var(--success))"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("indicators.problemsOpen")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={problemsStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label
                >
                  {problemsStatus.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        entry.key === "open"
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--success))"
                      }
                    />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("indicators.topAssets")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topAssets} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="code" type="category" width={140} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="count" name="Retiradas" fill="hsl(var(--primary))">
                  {topAssets.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
