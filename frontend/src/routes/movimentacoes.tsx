import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Movement, Asset } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAssetCode, formatDateTime } from "@/lib/utils";

interface MovementsResponse {
  items: Movement[];
  total: number;
  page: number;
  size: number;
}

export default function MovimentacoesRoute() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assetId, setAssetId] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  if (assetId) params.set("asset_id", assetId);
  params.set("page", String(page));
  params.set("size", "30");

  const listQ = useQuery({
    queryKey: ["movements", { page, from, to, assetId }],
    queryFn: () =>
      api.get<MovementsResponse>(`/api/v1/movements?${params.toString()}`),
    staleTime: 30_000,
  });

  const totalPages = listQ.data
    ? Math.max(1, Math.ceil(listQ.data.total / listQ.data.size))
    : 1;

  return (
    <div>
      <PageHeader
        title={t("mov.title")}
        description={t("mov.subtitle")}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="from">{t("mov.filter.from")}</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">{t("mov.filter.to")}</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setFrom("");
              setTo("");
              setAssetId("");
              setPage(1);
            }}
          >
            <Filter className="h-4 w-4" />
            {t("mov.filter.clear")}
          </Button>
        </div>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.items.length ? (
        <EmptyState title={t("mov.empty")} />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("mov.col.when")}</TableHead>
                  <TableHead>{t("mov.col.asset")}</TableHead>
                  <TableHead>{t("mov.col.type")}</TableHead>
                  <TableHead>{t("mov.col.holder")}</TableHead>
                  <TableHead>{t("mov.col.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQ.data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">
                      {formatDateTime(m.created_at)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {m.assets
                        ? formatAssetCode(m.assets as Asset)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.type === "withdraw" ? "warning" : "success"}
                      >
                        {m.type === "withdraw"
                          ? t("mov.type.withdraw")
                          : t("mov.type.return")}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.holder}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {listQ.data.total}{" "}
              {listQ.data.total === 1 ? "movimentação" : "movimentações"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.back")}
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
