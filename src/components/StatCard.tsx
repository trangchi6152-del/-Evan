import { Card } from "./Card";
import { formatCurrency, formatPercent, cn } from "../lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  delta?: number; // P/L amount
  deltaPercent?: number; // P/L percent
  isTarget?: boolean;
}

export function StatCard({ title, value, isCurrency = true, delta, deltaPercent, isTarget }: StatCardProps) {
  const isPositive = delta ? delta > 0 : false;
  const isNegative = delta ? delta < 0 : false;

  return (
    <Card className="flex flex-col justify-between gap-4">
      <h3 className="text-[var(--color-text-secondary)] font-medium text-sm">{title}</h3>
      <div>
        <div className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          {isCurrency ? formatCurrency(value) : value}
        </div>
        
        {(delta !== undefined || deltaPercent !== undefined) ? (
          <div className="flex items-center gap-2 mt-2 h-6">
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border",
                isPositive && "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20",
                isNegative && "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20",
                !isPositive && !isNegative && "bg-[var(--color-border-color)] text-[var(--color-text-secondary)] border-transparent"
              )}
            >
              {isPositive && <TrendingUp className="w-3 h-3" />}
              {isNegative && <TrendingDown className="w-3 h-3" />}
              {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
              {deltaPercent !== undefined ? formatPercent(deltaPercent) : ""}
            </div>
            {delta !== undefined && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {delta > 0 ? "+" : ""}{formatCurrency(delta)}
              </span>
            )}
          </div>
        ) : (
          <div className="h-6 mt-2"></div>
        )}
      </div>
    </Card>
  );
}
