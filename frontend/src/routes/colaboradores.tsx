import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Collaborator } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/lib/auth";

interface CollabResponse {
  items: Collaborator[];
  total: number;
}

export default function ColaboradoresRoute() {
  const { canEdit, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Collaborator | null>(null);

  const listQ = useQuery({
    queryKey: ["collaborators", { q: search }],
    queryFn: () =>
      api.get<CollabResponse>(
        `/api/v1/collaborators?q=${encodeURIComponent(search)}&size=50`,
      ),
    staleTime: 30_000,
  });

  return (
    <div>
      <PageHeader
        title={t("collab.title")}
        description={t("collab.subtitle")}
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("collab.new")}
            </Button>
          )
        }
      />

      <div className="mb-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("common.search")}
          className="max-w-sm"
        />
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.items.length ? (
        <EmptyState title={t("collab.empty")} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("collab.col.name")}</TableHead>
                <TableHead>{t("collab.col.badge")}</TableHead>
                <TableHead>{t("collab.col.active")}</TableHead>
                {(canEdit || isAdmin) && (
                  <TableHead className="text-right">
                    {t("collab.col.actions")}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.full_name}</TableCell>
                  <TableCell className="font-mono">{c.badge_number}</TableCell>
                  <TableCell>
                    {c.active ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  {(canEdit || isAdmin) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(c)}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(c)}
                            aria-label={t("common.delete")}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
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
        <CollabDialog
          open={createOpen || Boolean(editing)}
          collaborator={editing}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["collaborators"] });
            setCreateOpen(false);
            setEditing(null);
          }}
        />
      )}

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collab.dialog.delete")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("collab.dialog.deleteConfirm")}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDelete) return;
                api
                  .delete(`/api/v1/collaborators/${confirmDelete.id}`)
                  .then(() => {
                    toast.success("Colaborador removido.");
                    qc.invalidateQueries({ queryKey: ["collaborators"] });
                    setConfirmDelete(null);
                  })
                  .catch((err: Error) => toast.error(err.message));
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollabDialog({
  open,
  collaborator,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  collaborator: Collaborator | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(collaborator?.full_name ?? "");
  const [badge, setBadge] = useState(collaborator?.badge_number ?? "");
  const [active, setActive] = useState(collaborator?.active ?? true);

  useEffect(() => {
    setName(collaborator?.full_name ?? "");
    setBadge(collaborator?.badge_number ?? "");
    setActive(collaborator?.active ?? true);
  }, [collaborator, open]);

  const mut = useMutation({
    mutationFn: () => {
      if (collaborator) {
        return api.patch(`/api/v1/collaborators/${collaborator.id}`, {
          full_name: name.trim(),
          badge_number: badge.trim(),
          active,
        });
      }
      return api.post("/api/v1/collaborators", {
        full_name: name.trim(),
        badge_number: badge.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Colaborador salvo.");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {collaborator
              ? t("collab.dialog.edit")
              : t("collab.dialog.create")}
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
            <Label htmlFor="cname">{t("collab.form.name")}</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cbadge">{t("collab.form.badge")}</Label>
            <Input
              id="cbadge"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              required
            />
          </div>
          {collaborator && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Ativo
            </label>
          )}
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
