import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { AssetType } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export default function TiposRoute() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AssetType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AssetType | null>(null);

  const listQ = useQuery({
    queryKey: ["asset_types"],
    queryFn: () => api.get<AssetType[]>("/api/v1/asset-types"),
    staleTime: 60_000,
  });

  return (
    <div>
      <PageHeader
        title={t("types.title")}
        description={t("types.subtitle")}
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("types.new")}
            </Button>
          )
        }
      />

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.length ? (
        <EmptyState title={t("types.empty")} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("types.col.code")}</TableHead>
                <TableHead>{t("types.col.name")}</TableHead>
                <TableHead>{t("types.col.multi")}</TableHead>
                {canEdit && (
                  <TableHead className="text-right">
                    {t("types.col.actions")}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.data.map((tp) => (
                <TableRow key={tp.id}>
                  <TableCell className="font-mono">{tp.code}</TableCell>
                  <TableCell>{tp.name}</TableCell>
                  <TableCell>
                    {tp.multi_use_per_day ? (
                      <Badge variant="success">Sim</Badge>
                    ) : (
                      <Badge variant="muted">Não</Badge>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(tp)}
                          aria-label={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(tp)}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(createOpen || editing) && (
        <TypeDialog
          open={createOpen || Boolean(editing)}
          type={editing}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["asset_types"] });
            setCreateOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDelete
        type={confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          api
            .delete(`/api/v1/asset-types/${confirmDelete.id}`)
            .then(() => {
              toast.success("Tipo removido.");
              qc.invalidateQueries({ queryKey: ["asset_types"] });
              setConfirmDelete(null);
            })
            .catch((err: Error) => toast.error(err.message));
        }}
      />
    </div>
  );
}

function TypeDialog({
  open,
  type,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  type: AssetType | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(type?.code ?? "");
  const [name, setName] = useState(type?.name ?? "");
  const [multi, setMulti] = useState(type?.multi_use_per_day ?? false);

  useEffect(() => {
    setCode(type?.code ?? "");
    setName(type?.name ?? "");
    setMulti(type?.multi_use_per_day ?? false);
  }, [type, open]);

  const mut = useMutation({
    mutationFn: () => {
      if (type) {
        return api.patch(`/api/v1/asset-types/${type.id}`, {
          code: code.trim(),
          name: name.trim(),
          multi_use_per_day: multi,
        });
      }
      return api.post("/api/v1/asset-types", {
        code: code.trim(),
        name: name.trim(),
        multi_use_per_day: multi,
      });
    },
    onSuccess: () => {
      toast.success("Tipo salvo.");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type ? t("types.dialog.edit") : t("types.dialog.create")}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="code">{t("types.form.code")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("types.form.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={multi}
              onChange={(e) => setMulti(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {t("types.form.multi")}
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDelete({
  type,
  onOpenChange,
  onConfirm,
}: {
  type: AssetType | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(type)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("types.dialog.delete")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("types.dialog.deleteConfirm")}
          </p>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
