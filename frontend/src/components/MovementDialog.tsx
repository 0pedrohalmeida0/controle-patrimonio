import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpFromLine, ArrowDownToLine, X } from "lucide-react";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Asset, Movement, MovementType } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
}

interface WithdrawProps extends BaseProps {
  kind: "withdraw";
  defaultHolder?: string;
}

interface ReturnProps extends BaseProps {
  kind: "return";
}

interface ReturnWithProblemProps extends BaseProps {
  kind: "return-with-problem";
}

export type MovementDialogProps =
  | WithdrawProps
  | ReturnProps
  | ReturnWithProblemProps;

export function MovementDialog(props: MovementDialogProps) {
  const { open, onOpenChange, asset, kind } = props;
  const [holder, setHolder] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setHolder(
      "defaultHolder" in props && props.defaultHolder
        ? props.defaultHolder
        : asset.current_holder ?? "",
    );
    setDescription("");
    setNote("");
  }, [open, asset, props]);

  const isWithdraw = kind === "withdraw";
  const isReturnWithProblem = kind === "return-with-problem";

  const mutation = useMutation({
    mutationFn: async () => {
      if (kind === "withdraw") {
        return api.post<Movement>("/api/v1/movements", {
          asset_id: asset.id,
          type: "withdraw" as MovementType,
          holder: holder.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      if (kind === "return") {
        return api.post<Movement>("/api/v1/movements", {
          asset_id: asset.id,
          type: "return" as MovementType,
          holder: asset.current_holder ?? holder.trim(),
        });
      }
      return api.post<Movement>("/api/v1/movements/return-with-problem", {
        asset_id: asset.id,
        holder: asset.current_holder ?? holder.trim(),
        description: description.trim(),
        reported_by: holder.trim() || asset.current_holder || "sistema",
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["indicators"] });
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      toast.success("Movimentação registrada.");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao registrar movimentação.");
    },
  });

  const title =
    kind === "withdraw"
      ? "assets.detail.action.withdraw"
      : kind === "return"
        ? "assets.detail.action.return"
        : "assets.detail.action.returnProblem";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === "withdraw" ? (
              <ArrowUpFromLine className="h-4 w-4" />
            ) : kind === "return" ? (
              <ArrowDownToLine className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {t(title)}
          </DialogTitle>
          <DialogDescription>{asset.code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!isWithdraw && !isReturnWithProblem && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Responsável: </span>
                <span className="font-medium">
                  {asset.current_holder || "—"}
                </span>
              </p>
            </div>
          )}

          {(isWithdraw || isReturnWithProblem) && (
            <div className="space-y-2">
              <Label htmlFor="holder">Responsável</Label>
              <Input
                id="holder"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="Nome completo"
                autoComplete="off"
              />
            </div>
          )}

          {isReturnWithProblem && (
            <div className="space-y-2">
              <Label htmlFor="description">Descrição do problema</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Descreva o que aconteceu"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              ((isWithdraw || isReturnWithProblem) && !holder.trim()) ||
              (isReturnWithProblem && !description.trim())
            }
          >
            {mutation.isPending ? t("common.loading") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
