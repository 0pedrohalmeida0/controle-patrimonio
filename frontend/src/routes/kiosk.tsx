import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  LogOut,
  Maximize2,
  Package,
  ScanLine,
  XCircle,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { cn, formatAssetCode } from "@/lib/utils";
import type { Asset, AssetType, Collaborator } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { AssetCard } from "@/components/AssetCard";

type State =
  | { kind: "idle" }
  | { kind: "choosing-type" }
  | { kind: "choosing-asset"; type: AssetType; selected: string[] }
  | { kind: "badge"; type: AssetType; selected: string[] }
  | { kind: "confirming"; type: AssetType; selected: Asset[]; holder: string }
  | { kind: "returning"; asset: Asset }
  | {
      kind: "success";
      message: string;
      action: "withdraw" | "return";
    }
  | { kind: "error"; message: string };

interface KioskConfig {
  typeId: string | null;
  label: string;
}

function readConfig(): KioskConfig {
  try {
    const raw = window.localStorage.getItem("controle-patrimonio.kiosk.config");
    if (!raw) return { typeId: null, label: "" };
    return JSON.parse(raw) as KioskConfig;
  } catch {
    return { typeId: null, label: "" };
  }
}

export default function KioskRoute() {
  const { signOut, fullName, isKiosk } = useAuth();
  const [state, setState] = useState<State>({ kind: "idle" });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fullscreen attempt on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    if (document.fullscreenElement) return;
    const tryFs = async () => {
      try {
        await el.requestFullscreen();
      } catch {
        // ignore: browser may block without user gesture
      }
    };
    void tryFs();
  }, []);

  // Kiosk auto start: se tem config, vai direto pra escolha de ativo.
  useEffect(() => {
    if (state.kind !== "idle") return;
    const cfg = readConfig();
    if (cfg.typeId) {
      // se tem tipo configurado, deixa na idle mas com botão "Iniciar"
    }
  }, [state.kind]);

  const typesQ = useQuery({
    queryKey: ["asset_types", { kiosk: true }],
    queryFn: () => api.get<AssetType[]>("/api/v1/asset-types"),
    staleTime: 60_000,
  });

  const goIdle = useCallback(() => setState({ kind: "idle" }), []);

  const onTypeChosen = useCallback(
    async (type: AssetType) => {
      setState({ kind: "choosing-asset", type, selected: [] });
    },
    [],
  );

  const onAssetClicked = useCallback(
    (asset: Asset, multi: boolean) => {
      setState((prev) => {
        if (prev.kind !== "choosing-asset") return prev;
        const exists = prev.selected.includes(asset.id);
        if (!multi) {
          return { ...prev, selected: [asset.id] };
        }
        return {
          ...prev,
          selected: exists
            ? prev.selected.filter((s) => s !== asset.id)
            : [...prev.selected, asset.id],
        };
      });
    },
    [],
  );

  const fetchAsset = useCallback(async (id: string) => {
    return api.get<Asset>(`/api/v1/assets/${id}`);
  }, []);

  const onBadgeSubmit = useCallback(
    async (type: AssetType, selectedIds: string[], holder: string) => {
      try {
        const assets = await Promise.all(selectedIds.map(fetchAsset));
        for (const a of assets) {
          if (a.status === "in_use") {
            throw new Error("kiosk.error.assetInUse");
          }
          if (a.status === "problem") {
            throw new Error("kiosk.error.assetProblem");
          }
        }
        setState({
          kind: "confirming",
          type,
          selected: assets,
          holder,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "kiosk.error.generic";
        setState({ kind: "error", message: t(msg) });
      }
    },
    [fetchAsset],
  );

  const commit = useCallback(async () => {
    if (state.kind !== "confirming") return;
    try {
      for (const a of state.selected) {
        await api.post("/api/v1/movements", {
          asset_id: a.id,
          type: "withdraw",
          holder: state.holder,
        });
      }
      setState({
        kind: "success",
        message: t("kiosk.success.subtitle"),
        action: "withdraw",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "kiosk.error.generic";
      setState({ kind: "error", message: msg });
    }
  }, [state]);

  const commitReturn = useCallback(async (asset: Asset) => {
    try {
      await api.post("/api/v1/movements", {
        asset_id: asset.id,
        type: "return",
        holder: asset.current_holder ?? "sistema",
      });
      setState({
        kind: "success",
        message: t("kiosk.return.success"),
        action: "return",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "kiosk.error.generic";
      setState({ kind: "error", message: msg });
    }
  }, []);

  const handleLogout = async () => {
    await signOut();
    window.location.assign("/auth");
  };

  const requestFs = async () => {
    if (!containerRef.current) return;
    try {
      await containerRef.current.requestFullscreen();
    } catch {
      toast.error("Não foi possível entrar em tela cheia.");
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background text-foreground"
    >
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {readConfig().label || t("kiosk.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {fullName ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={requestFs}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          {!isKiosk && (
            <Button size="sm" variant="ghost" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              {t("auth.signOut")}
            </Button>
          )}
        </div>
      </header>

      <main className="px-6 py-8">
        {state.kind === "idle" && (
          <IdleView types={typesQ.data ?? []} onType={onTypeChosen} />
        )}

        {state.kind === "choosing-type" && (
          <ChooseTypeView
            types={typesQ.data ?? []}
            onType={onTypeChosen}
            onBack={goIdle}
          />
        )}

        {state.kind === "choosing-asset" && (
          <ChooseAssetView
            type={state.type}
            selected={state.selected}
            onToggle={(a) => onAssetClicked(a, state.type.multi_use_per_day)}
            onConfirm={() => setState({ ...state, kind: "badge" })}
            onBack={goIdle}
          />
        )}

        {state.kind === "badge" && (
          <BadgeView
            type={state.type}
            count={state.selected.length}
            onSubmit={(holder) => onBadgeSubmit(state.type, state.selected, holder)}
            onBack={() =>
              setState({ kind: "choosing-asset", type: state.type, selected: state.selected })
            }
          />
        )}

        {state.kind === "confirming" && (
          <ConfirmView
            assets={state.selected}
            holder={state.holder}
            onConfirm={commit}
            onBack={() =>
              setState({
                kind: "choosing-asset",
                type: state.type,
                selected: state.selected.map((a) => a.id),
              })
            }
          />
        )}

        {state.kind === "returning" && (
          <ReturnView
            asset={state.asset}
            onConfirm={() => commitReturn(state.asset)}
            onBack={goIdle}
          />
        )}

        {(state.kind === "success" || state.kind === "error") && (
          <ResultView
            kind={state.kind}
            message={state.message}
            onDone={goIdle}
          />
        )}
      </main>
    </div>
  );
}

function IdleView({
  types,
  onType,
}: {
  types: AssetType[];
  onType: (t: AssetType) => void;
}) {
  const cfg = readConfig();
  const initial = types.find((t) => t.id === cfg.typeId);

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-semibold">{t("kiosk.idle.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("kiosk.idle.subtitle")}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {initial && (
          <Button
            size="xl"
            className="h-32 flex-col gap-1 text-base"
            onClick={() => onType(initial)}
          >
            <Package className="h-6 w-6" />
            {initial.name}
          </Button>
        )}
        <Button
          size="xl"
          variant={initial ? "outline" : "default"}
          className="h-32 flex-col gap-1 text-base"
          onClick={() => onType(types[0] ?? ({} as AssetType))}
          disabled={!types.length}
        >
          <ArrowUpFromLine className="h-6 w-6" />
          Retirada
        </Button>
        <Button
          size="xl"
          variant="outline"
          className="h-32 flex-col gap-1 text-base"
          onClick={() => onType(types[0] ?? ({} as AssetType))}
          disabled={!types.length}
        >
          <ArrowDownToLine className="h-6 w-6" />
          Devolução
        </Button>
        <Button
          size="xl"
          variant="ghost"
          className="h-32 flex-col gap-1 text-base"
          onClick={() => {
            // navega para tela de escolha de tipo via state interno
            onType(types[0] ?? ({} as AssetType));
          }}
          disabled={!types.length}
        >
          <ScanLine className="h-6 w-6" />
          {t("kiosk.idle.chooseType")}
        </Button>
      </div>
    </div>
  );
}

function ChooseTypeView({
  types,
  onType,
  onBack,
}: {
  types: AssetType[];
  onType: (t: AssetType) => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton onBack={onBack} />
      <h2 className="mb-4 text-xl font-semibold">
        {t("kiosk.idle.chooseType")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((tp) => (
          <button
            key={tp.id}
            onClick={() => onType(tp)}
            className="rounded-lg border bg-card p-6 text-left transition-colors hover:border-primary"
          >
            <p className="text-lg font-semibold">{tp.name}</p>
            <p className="text-xs text-muted-foreground">{tp.code}</p>
            {tp.multi_use_per_day && (
              <p className="mt-2 text-xs text-success">Reuso no dia: sim</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChooseAssetView({
  type,
  selected,
  onToggle,
  onConfirm,
  onBack,
}: {
  type: AssetType;
  selected: string[];
  onToggle: (a: Asset) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const assetsQ = useQuery({
    queryKey: ["assets", { kioskType: type.id, status: "available" }],
    queryFn: () =>
      api.get<{ items: Asset[]; total: number }>(
        `/api/v1/assets?type_id=${type.id}&status=available&size=200`,
      ),
    staleTime: 15_000,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <BackButton onBack={onBack} />
      <h2 className="mb-1 text-xl font-semibold">
        {t("kiosk.chooseAsset.title")} — {type.name}
      </h2>
      {type.multi_use_per_day && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("kiosk.chooseAsset.multi")}
        </p>
      )}

      {assetsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !assetsQ.data?.items.length ? (
        <p className="text-sm text-muted-foreground">
          {t("kiosk.chooseAsset.empty")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assetsQ.data.items.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              selected={selected.includes(a.id)}
              onSelect={onToggle}
              showStatus={false}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <p className="text-sm text-muted-foreground">
          {selected.length}{" "}
          {selected.length === 1 ? "selecionado" : "selecionados"}
        </p>
        <Button
          size="lg"
          onClick={onConfirm}
          disabled={selected.length === 0}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}

function BadgeView({
  type,
  count,
  onSubmit,
  onBack,
}: {
  type: AssetType;
  count: number;
  onSubmit: (holder: string) => void;
  onBack: () => void;
}) {
  const [badge, setBadge] = useState("");
  const [holder, setHolder] = useState("");
  const [mode, setMode] = useState<"badge" | "manual">("badge");

  const lookup = useQuery({
    queryKey: ["collaborator_by_badge", badge],
    queryFn: async () => {
      if (!badge.trim()) return null;
      const data = await api.get<{ items: Collaborator[] }>(
        `/api/v1/collaborators?q=${encodeURIComponent(badge.trim())}&size=1`,
      );
      return data.items[0] ?? null;
    },
    enabled: false,
  });

  return (
    <div className="mx-auto max-w-md">
      <BackButton onBack={onBack} />
      <h2 className="mb-1 text-xl font-semibold">{t("kiosk.badge.title")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("kiosk.badge.subtitle")}
      </p>

      {mode === "badge" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!badge.trim()) return;
            await lookup.refetch();
            const coll = lookup.data;
            if (!coll) {
              toast.error(t("kiosk.error.badgeNotFound"));
              return;
            }
            onSubmit(coll.full_name);
          }}
          className="space-y-3"
        >
          <Input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder={t("kiosk.badge.placeholder")}
            autoFocus
            className="h-14 text-lg"
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!badge.trim() || lookup.isFetching}
          >
            <ScanLine className="h-4 w-4" />
            {t("kiosk.badge.lookup")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode("manual")}
          >
            {t("kiosk.badge.manual")}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!holder.trim()) {
              toast.error(t("kiosk.error.needHolder"));
              return;
            }
            onSubmit(holder.trim());
          }}
          className="space-y-3"
        >
          <Input
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder={t("kiosk.badge.manualName")}
            autoFocus
            className="h-14 text-lg"
          />
          <Button type="submit" size="lg" className="w-full">
            {t("common.next")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode("badge")}
          >
            {t("common.back")}
          </Button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {count} {count === 1 ? "equipamento" : "equipamentos"} · {type.name}
      </p>
    </div>
  );
}

function ConfirmView({
  assets,
  holder,
  onConfirm,
  onBack,
}: {
  assets: Asset[];
  holder: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <BackButton onBack={onBack} />
      <h2 className="mb-1 text-xl font-semibold">{t("kiosk.confirm.title")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("kiosk.confirm.holder")}: <span className="font-medium">{holder}</span>
      </p>

      <ul className="mb-6 space-y-2">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-md border bg-card p-3"
          >
            <span className="font-mono">{formatAssetCode(a)}</span>
            <StatusBadge status={a.status} />
          </li>
        ))}
      </ul>

      <Button size="lg" className="w-full" onClick={onConfirm}>
        <CheckCircle2 className="h-4 w-4" />
        {t("kiosk.confirm.confirm")}
      </Button>
    </div>
  );
}

function ReturnView({
  asset,
  onConfirm,
  onBack,
}: {
  asset: Asset;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <BackButton onBack={onBack} />
      <h2 className="mb-1 text-xl font-semibold">{t("kiosk.return.title")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("kiosk.return.subtitle")}
      </p>

      <div className="rounded-md border bg-card p-4">
        <p className="font-mono text-lg">{formatAssetCode(asset)}</p>
        {asset.current_holder && (
          <p className="text-sm text-muted-foreground">
            {asset.current_holder}
          </p>
        )}
      </div>

      <Button size="lg" className="mt-6 w-full" onClick={onConfirm}>
        <ArrowDownToLine className="h-4 w-4" />
        {t("kiosk.confirm.confirm")}
      </Button>
    </div>
  );
}

function ResultView({
  kind,
  message,
  onDone,
}: {
  kind: "success" | "error";
  message: string;
  onDone: () => void;
}) {
  return (
    <div className="mx-auto max-w-md text-center">
      {kind === "success" ? (
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
      ) : (
        <XCircle className="mx-auto h-16 w-16 text-destructive" />
      )}
      <h2
        className={cn(
          "mt-4 text-2xl font-semibold",
          kind === "success" ? "text-success" : "text-destructive",
        )}
      >
        {kind === "success" ? t("kiosk.success.title") : t("common.back")}
      </h2>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <Button className="mt-6" size="lg" onClick={onDone}>
        {t("kiosk.success.reset")}
      </Button>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2">
      <ChevronLeft className="h-4 w-4" />
      {t("common.back")}
    </Button>
  );
}
