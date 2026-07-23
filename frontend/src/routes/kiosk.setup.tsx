import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode } from "lucide-react";

import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { AssetType } from "@/lib/types";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KioskConfig {
  typeId: string | null;
  label: string;
}

const STORAGE_KEY = "controle-patrimonio.kiosk.config";

function readConfig(): KioskConfig {
  if (typeof window === "undefined") return { typeId: null, label: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { typeId: null, label: "" };
    return JSON.parse(raw) as KioskConfig;
  } catch {
    return { typeId: null, label: "" };
  }
}

function writeConfig(c: KioskConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export default function KioskSetupRoute() {
  const typesQ = useQuery({
    queryKey: ["asset_types", { all: true }],
    queryFn: () => api.get<AssetType[]>("/api/v1/asset-types"),
    staleTime: 60_000,
  });

  const [typeId, setTypeId] = useState<string>("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    const c = readConfig();
    setTypeId(c.typeId ?? "");
    setLabel(c.label);
  }, []);

  const selected = typesQ.data?.find((t) => t.id === typeId);

  const save = () => {
    writeConfig({ typeId: typeId || null, label: label.trim() });
    toast.success(t("kioskSetup.saved"));
  };

  // Build a deep link that scanners can use to open this kiosk.
  const kioskUrl = `${window.location.origin}/kiosk`;

  return (
    <div>
      <PageHeader
        title={t("kioskSetup.title")}
        description={t("kioskSetup.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>{t("kioskSetup.chooseType")}</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
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
              {selected && (
                <p className="text-xs text-muted-foreground">
                  {selected.multi_use_per_day
                    ? "Permite múltiplas retiradas no mesmo dia"
                    : "Reuso no dia bloqueado"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">{t("kioskSetup.label")}</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Quiosque A"
              />
            </div>
            <Button onClick={save}>{t("kioskSetup.save")}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              {t("kioskSetup.qr.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("kioskSetup.qr.subtitle")}
            </p>
            <div className="rounded-md border bg-card p-4">
              <KioskQr url={kioskUrl} />
              <p className="mt-2 truncate text-center text-xs text-muted-foreground">
                {kioskUrl}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KioskQr({ url }: { url: string }) {
  // Renderiza um QR code simples via API pública (api.qrserver.com). Para
  // uso offline, troque por `qrcode.react`. Mantemos dependências mínimas.
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    url,
  )}`;
  return (
    <div className="flex justify-center">
      <img
        src={src}
        alt="QR do quiosque"
        className="h-44 w-44 rounded"
        loading="lazy"
      />
    </div>
  );
}
