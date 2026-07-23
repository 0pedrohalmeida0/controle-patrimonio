import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Filter } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { t } from "@/lib/i18n";
import type { Asset, AssetStatus, AssetType } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatAssetCode } from "@/lib/utils";

interface AssetsResponse {
  items: Asset[];
  total: number;
  page: number;
  size: number;
}

const STATUS_VALUES: AssetStatus[] = ["available", "in_use", "problem"];
const ALL = "__all__";

export default function AtivosRoute() {
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(searchInput, 300);
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (typeFilter && typeFilter !== ALL) params.set("type_id", typeFilter);
  if (statusFilter && statusFilter !== ALL) params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("size", "20");

  const listQ = useQuery({
    queryKey: ["assets", { list: params.toString() }],
    queryFn: () =>
      api.get<AssetsResponse>(
        `/api/v1/assets?${params.toString()}`,
      ),
    staleTime: 30_000,
  });

  const typesQ = useQuery({
    queryKey: ["asset_types", { all: true }],
    queryFn: async () => {
      const items = await api.get<AssetType[]>("/api/v1/asset-types");
      return items;
    },
    staleTime: 60_000,
  });

  const totalPages = listQ.data
    ? Math.max(1, Math.ceil(listQ.data.total / listQ.data.size))
    : 1;

  return (
    <div>
      <PageHeader
        title={t("assets.title")}
        description={t("assets.subtitle")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("assets.new")}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("assets.search")}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <Filter className="mr-1 h-4 w-4" />
            <SelectValue placeholder={t("assets.filter.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("assets.filter.all")}</SelectItem>
            {typesQ.data?.map((tp) => (
              <SelectItem key={tp.id} value={tp.id}>
                {tp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t("assets.filter.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("assets.filter.all")}</SelectItem>
            {STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !listQ.data?.items.length ? (
        <EmptyState title={t("assets.empty")} />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assets.col.code")}</TableHead>
                  <TableHead>{t("assets.col.type")}</TableHead>
                  <TableHead>{t("assets.col.status")}</TableHead>
                  <TableHead>{t("assets.col.holder")}</TableHead>
                  <TableHead className="text-right">
                    {t("assets.col.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQ.data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">
                      {formatAssetCode(a)}
                    </TableCell>
                    <TableCell>{a.asset_types?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.current_holder ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/ativos/${a.id}`}>
                          {t("common.open")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {listQ.data.total} {listQ.data.total === 1 ? "ativo" : "ativos"}
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

      <CreateAssetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["assets"] });
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateAssetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const typesQ = useQuery({
    queryKey: ["asset_types", { all: true }],
    queryFn: () => api.get<AssetType[]>("/api/v1/asset-types"),
    enabled: open,
    staleTime: 60_000,
  });
  const [typeId, setTypeId] = useState("");
  const [number, setNumber] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post<Asset>("/api/v1/assets", {
        type_id: typeId,
        number: number.trim(),
      }),
    onSuccess: () => {
      toast.success("Ativo cadastrado.");
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("assets.dialog.create")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="type">{t("assets.form.type")}</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {typesQ.data?.map((tp) => (
                  <SelectItem key={tp.id} value={tp.id}>
                    {tp.name} ({tp.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">{t("assets.form.number")}</Label>
            <Input
              id="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="01"
              required
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
              disabled={create.isPending || !typeId || !number.trim()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
