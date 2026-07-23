import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpFromLine, ArrowDownToLine, AlertOctagon, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Asset, Movement } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MovementDialog, type MovementDialogProps } from "@/components/MovementDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAssetCode, formatDateTime } from "@/lib/utils";

interface MovementsResp {
  items: Movement[];
  total: number;
}

export default function AssetDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<MovementDialogProps | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const assetQ = useQuery({
    queryKey: ["asset", id],
    queryFn: () => api.get<Asset>(`/api/v1/assets/${id}`),
    enabled: Boolean(id),
  });

  const movsQ = useQuery({
    queryKey: ["asset_movements", id],
    queryFn: () =>
      api.get<MovementsResp>(
        `/api/v1/movements?asset_id=${id}&size=20`,
      ),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/v1/assets/${id}`),
    onSuccess: () => {
      toast.success("Ativo removido.");
      qc.invalidateQueries({ queryKey: ["assets"] });
      navigate("/ativos", { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!id) return null;
  if (assetQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (assetQ.isError || !assetQ.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>
        <p className="text-sm text-destructive">Ativo não encontrado.</p>
      </div>
    );
  }

  const asset = assetQ.data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="-ml-2">
        <Link to="/ativos">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </Button>

      <PageHeader
        title={formatAssetCode(asset)}
        description={asset.asset_types?.name ?? ""}
        actions={
          <div className="flex flex-wrap gap-2">
            {asset.status === "available" && (
              <Button onClick={() => setDialog({ kind: "withdraw", open: true, onOpenChange: (v) => !v && setDialog(null), asset })}>
                <ArrowUpFromLine className="h-4 w-4" />
                {t("assets.detail.action.withdraw")}
              </Button>
            )}
            {asset.status === "in_use" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ kind: "return", open: true, onOpenChange: (v) => !v && setDialog(null), asset })}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  {t("assets.detail.action.return")}
                </Button>
                <Button
                  variant="warning"
                  onClick={() => setDialog({ kind: "return-with-problem", open: true, onOpenChange: (v) => !v && setDialog(null), asset })}
                >
                  <AlertOctagon className="h-4 w-4" />
                  {t("assets.detail.action.returnProblem")}
                </Button>
              </>
            )}
            {asset.status === "problem" && (
              <Button
                variant="outline"
                onClick={() => setDialog({ kind: "return-with-problem", open: true, onOpenChange: (v) => !v && setDialog(null), asset })}
              >
                <AlertOctagon className="h-4 w-4" />
                {t("assets.detail.action.returnProblem")}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={asset.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Responsável atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base">{asset.current_holder || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("assets.detail.created")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base">{formatDateTime(asset.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("assets.detail.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {movsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !movsQ.data?.items.length ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <ul className="divide-y">
              {movsQ.data.items.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {m.type === "withdraw" ? "Retirada" : "Devolução"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.holder} {m.collaborators?.badge_number && `· ${m.collaborators.badge_number}`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dialog && (
        <MovementDialog
          {...dialog}
          open={dialog.open}
          onOpenChange={(v) => {
            if (!v) setDialog(null);
          }}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assets.dialog.delete")}</DialogTitle>
            <DialogDescription>
              {t("assets.dialog.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
