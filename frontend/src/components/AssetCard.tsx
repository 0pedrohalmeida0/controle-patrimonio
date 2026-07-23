import { Link } from "react-router-dom";
import { Package, ScanLine, Tag } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { cn, formatDateTime } from "@/lib/utils";
import { formatAssetCode, type Asset } from "@/lib/types";

interface AssetCardProps {
  asset: Asset;
  selected?: boolean;
  onSelect?: (asset: Asset) => void;
  showStatus?: boolean;
}

export function AssetCard({
  asset,
  selected,
  onSelect,
  showStatus = true,
}: AssetCardProps) {
  const isClickable = Boolean(onSelect);
  const inner = (
    <Card
      className={cn(
        "group h-full cursor-pointer transition-all",
        selected && "ring-2 ring-primary",
        isClickable && "hover:border-primary/50",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-mono text-base">
            {formatAssetCode(asset)}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {asset.asset_types?.name ?? "—"}
          </span>
        </div>
        <Package className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {showStatus && <StatusBadge status={asset.status} />}
        {asset.current_holder && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Tag className="h-3 w-3" /> {asset.current_holder}
          </p>
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ScanLine className="h-3 w-3" /> {formatDateTime(asset.created_at)}
        </p>
      </CardContent>
    </Card>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(asset)}
        className="block w-full text-left"
      >
        {inner}
      </button>
    );
  }
  return (
    <Link to={`/ativos/${asset.id}`} className="block">
      {inner}
    </Link>
  );
}
