import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtMonth } from "@/lib/engine/format";
import type { TokenColors } from "@/lib/ui/use-token-colors";

export interface Series {
  key: string;
  label: string;
  color: string;
  kind?: "bar" | "line" | "area";
  axis?: "left" | "right";
  format?: (v: number) => string;
  dashed?: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  series: Series[];
}): ReactNode {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1 font-semibold">{label ? fmtMonth(label, "long") : ""}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={p.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{s?.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{s?.format ? s.format(p.value) : fmtCompact(p.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Monthly trend with mixed bars / lines on one or two axes. */
export function MonthlyChart({
  data,
  series,
  colors,
  height = 260,
  rightFormat,
  leftFormat,
}: {
  data: Array<Record<string, number | string>>;
  series: Series[];
  colors: TokenColors;
  height?: number;
  leftFormat?: (v: number) => string;
  rightFormat?: (v: number) => string;
}) {
  const hasRight = series.some((s) => s.axis === "right");
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: hasRight ? 4 : 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => fmtMonth(m).split(" ")[0]}
            tick={{ fill: colors.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v: number) => (leftFormat ? leftFormat(v) : fmtCompact(v))}
            tick={{ fill: colors.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => (rightFormat ? rightFormat(v) : fmtCompact(v))}
              tick={{ fill: colors.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
          )}
          <Tooltip content={<ChartTooltip series={series} />} cursor={{ fill: colors.mutedBg, opacity: 0.5 }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => <span className="text-xs text-muted-foreground">{series.find((s) => s.key === v)?.label ?? v}</span>}
          />
          {series.map((s) =>
            s.kind === "line" ? (
              <Line
                key={s.key}
                yAxisId={s.axis ?? "left"}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                type="monotone"
              />
            ) : s.kind === "area" ? (
              <Area key={s.key} yAxisId={s.axis ?? "left"} dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} type="monotone" />
            ) : (
              <Bar key={s.key} yAxisId={s.axis ?? "left"} dataKey={s.key} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={28} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small sparkline for tiles. */
export function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.75} type="monotone" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
