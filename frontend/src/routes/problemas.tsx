import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Asset, AssetStatus, Problem } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { ProblemStatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { formatAssetCode, formatDateTime } from "@/lib/utils";

interface ProblemsResponse {
  items: Problem[];
  total: number;
}

const ALL = "__all__";

export default function ProblemasRoute() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter !== ALL) params.set("status", statusFilter);
  params.set("size", "50");

  const listQ = useQuery({
    queryKey: ["problems", { status: statusFilter }],
    queryFn: () =>
      api.get<ProblemsResponse>(`/api/v1/problems?${params.toString()}`),
    staleTime: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) =>
      api.patch<Problem>(`/api/v1/problems/${id}`, { status: "resolved" }),
    onSuccess: () => {
      toast.success("Problema marcado como resolvido.");
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader
        title={t("problems.title")}
        description={t("problems.subtitle")}
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("problems.new")}
            </Button>
          )
        }
      />

      <div className="mb-3 max-w-xs">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("assets.filter.all")}</SelectItem>
            <SelectItem value="open">{t("problems.status.open")}</SelectItem>
            <SelectItem value="resolved">
              {t("problems.status.resolved")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.items.length ? (
        <EmptyState title={t("problems.empty")} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("problems.col.when")}</TableHead>
                <TableHead>{t("problems.col.asset")}</TableHead>
                <TableHead>{t("problems.col.description")}</TableHead>
                <TableHead>{t("problems.col.status")}</TableHead>
                <TableHead>{t("problems.col.reportedBy")}</TableHead>
                {canEdit && (
                  <TableHead className="text-right">
                    {t("problems.col.actions") || ""}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    {formatDateTime(p.created_at)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {p.assets ? formatAssetCode(p.assets as Asset) : "—"}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-pre-wrap text-sm">
                    {p.description}
                  </TableCell>
                  <TableCell>
                    <ProblemStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.reported_by || "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      {p.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveMut.mutate(p.id)}
                          disabled={resolveMut.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t("problems.markResolved")}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProblemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["problems"] });
          qc.invalidateQueries({ queryKey: ["assets"] });
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateProblemDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const assetsQ = useQuery({
    queryKey: ["assets", { allForProblems: true }],
    queryFn: () =>
      api.get<{ items: Asset[]; total: number }>(
        "/api/v1/assets?size=200",
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const [assetId, setAssetId] = useState("");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post<Problem>("/api/v1/problems", {
        asset_id: assetId,
        description: description.trim(),
        reported_by: reportedBy.trim() || "sistema",
      }),
    onSuccess: () => {
      toast.success("Problema registrado.");
      onCreated();
      setAssetId("");
      setDescription("");
      setReportedBy("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const availableAssets = (assetsQ.data?.items ?? []).filter(
    (a) => a.status !== ("problem" as AssetStatus),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("problems.dialog.create")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("problems.dialog.createSub")}
          </p>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="asset">{t("problems.form.asset")}</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="asset">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {availableAssets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {formatAssetCode(a)} — {a.asset_types?.name ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">{t("problems.form.description")}</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reporter">{t("problems.form.reportedBy")}</Label>
            <input
              id="reporter"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Seu nome"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !assetId || !description.trim()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
