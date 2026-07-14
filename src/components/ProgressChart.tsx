// 進捗グラフ(Recharts)
// music: 日ごとの最高達成テンポの推移 / exam・habit: 記録の累積数の推移
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Goal } from "../types";
import { formatDateShort } from "../util";

// dataviz 検証済みカラー(ダーク面でコントラスト・CVD分離 PASS)
const SERIES = "#3987e5"; // 系列色(青)
const GRID = "#334155"; // 控えめなグリッド線
const TICK = "#94a3b8"; // 軸ラベル

interface Point {
  date: string;
  value: number;
}

/** music: 日付ごとの最高達成テンポ */
function tempoSeries(goal: Goal): Point[] {
  const byDate = new Map<string, number>();
  for (const log of goal.logs) {
    if (log.tempo === undefined) continue;
    const cur = byDate.get(log.date);
    if (cur === undefined || log.tempo > cur) byDate.set(log.date, log.tempo);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

/** exam・habit: 記録の累積数 */
function cumulativeSeries(goal: Goal): Point[] {
  const byDate = new Map<string, number>();
  for (const log of goal.logs) {
    byDate.set(log.date, (byDate.get(log.date) ?? 0) + 1);
  }
  let sum = 0;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, n]) => {
      sum += n;
      return { date, value: sum };
    });
}

interface Props {
  goal: Goal;
}

export default function ProgressChart({ goal }: Props) {
  const isMusic = goal.type === "music";
  const data = isMusic ? tempoSeries(goal) : cumulativeSeries(goal);
  // 単一系列のため凡例は置かず、タイトルが系列名を兼ねる
  const title = isMusic ? "達成テンポの推移(♩)" : "記録の累積数";

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800 p-4">
        <h3 className="mb-1 text-sm font-medium text-slate-300">{title}</h3>
        <p className="text-sm text-slate-400">
          記録が増えるとここにグラフが表示されます
        </p>
      </div>
    );
  }

  const yMax = isMusic
    ? Math.max(goal.targetTempo ?? 0, ...data.map((d) => d.value)) + 10
    : undefined;

  return (
    <div className="rounded-xl bg-slate-800 p-3">
      <h3 className="mb-2 px-1 text-sm font-medium text-slate-300">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fill: TICK, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            domain={yMax !== undefined ? [0, yMax] : [0, "auto"]}
            tick={{ fill: TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value) => [String(value), isMusic ? "♩" : "件"]}
          />
          {isMusic && goal.targetTempo !== undefined && (
            <ReferenceLine
              y={goal.targetTempo}
              stroke={TICK}
              strokeDasharray="4 4"
              label={{
                value: `目標 ♩=${goal.targetTempo}`,
                fill: TICK,
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
