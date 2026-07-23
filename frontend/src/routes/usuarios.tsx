import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, ShieldCheck, UserMinus, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { AppRole, ManagedUser } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
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
import { RoleBadge } from "@/components/RoleBadge";
import { formatDate } from "@/lib/utils";

const ROLES: AppRole[] = ["administrador", "editor", "leitor", "kiosk"];

export default function UsuariosRoute() {
  const qc = useQueryClient();
  const [changeRole, setChangeRole] = useState<{
    user: ManagedUser;
    role: AppRole;
  } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] =
    useState<ManagedUser | null>(null);

  const listQ = useQuery({
    queryKey: ["users", { adminList: true }],
    queryFn: () => api.get<ManagedUser[]>("/api/v1/users"),
    staleTime: 30_000,
  });

  const roleMut = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/users/${changeRole!.user.id}/role`, {
        role: changeRole!.role,
      }),
    onSuccess: () => {
      toast.success("Papel atualizado.");
      qc.invalidateQueries({ queryKey: ["users"] });
      setChangeRole(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMut = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/users/${confirmDeactivate!.id}/deactivate`),
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      qc.invalidateQueries({ queryKey: ["users"] });
      setConfirmDeactivate(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <PageHeader
        title={t("users.title")}
        description={t("users.subtitle")}
      />

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.length ? (
        <EmptyState title={t("users.empty")} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.col.name")}</TableHead>
                <TableHead>{t("users.col.email")}</TableHead>
                <TableHead>{t("users.col.role")}</TableHead>
                <TableHead>{t("users.col.active")}</TableHead>
                <TableHead>{t("users.col.created")}</TableHead>
                <TableHead className="text-right">
                  {t("users.col.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setChangeRole({
                            user: u,
                            role: u.role ?? "leitor",
                          })
                        }
                        aria-label={t("users.changeRole")}
                      >
                        {u.role ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <ShieldOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeactivate(u)}
                        aria-label={
                          u.active ? t("users.deactivate") : t("users.activate")
                        }
                      >
                        {u.active ? (
                          <UserMinus className="h-4 w-4 text-destructive" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-success" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(changeRole)}
        onOpenChange={(v) => !v && setChangeRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.changeRole")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {changeRole?.user.email}
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Select
              value={changeRole?.role}
              onValueChange={(v) =>
                setChangeRole((prev) =>
                  prev ? { ...prev, role: v as AppRole } : null,
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`users.role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRole(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => roleMut.mutate()} disabled={roleMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmDeactivate)}
        onOpenChange={(v) => !v && setConfirmDeactivate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDeactivate?.active
                ? t("users.deactivate")
                : t("users.activate")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {confirmDeactivate?.email}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivate(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={confirmDeactivate?.active ? "destructive" : "default"}
              onClick={() => deactivateMut.mutate()}
              disabled={deactivateMut.isPending}
            >
              {confirmDeactivate?.active
                ? t("users.deactivate")
                : t("users.activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
