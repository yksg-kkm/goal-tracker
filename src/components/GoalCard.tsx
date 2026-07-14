// ホーム画面: 目標カード(進捗バー + 次のマイルストーン)
import type { Goal, GoalType } from "../types";
import { goalProgress } from "../util";
import ProgressBar from "./ProgressBar";

export const TYPE_LABEL: Record<GoalType, string> = {
  music: "🎵 楽曲",
  exam: "📝 試験",
  habit: "🔁 継続",
};

interface Props {
  goal: Goal;
  onOpen: () => void;
}

export default function GoalCard({ goal, onOpen }: Props) {
  const next = goal.milestones
    .filter((m) => !m.done)
    .sort((a, b) => a.order - b.order)[0];

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-xl bg-slate-800 p-4 text-left shadow active:bg-slate-700"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
          {TYPE_LABEL[goal.type]}
        </span>
        {goal.targetDate && (
          <span className="text-xs text-slate-400">目標日 {goal.targetDate}</span>
        )}
      </div>
      <h2 className="mb-2 font-semibold leading-snug">{goal.title}</h2>
      <ProgressBar percent={goalProgress(goal)} />
      <p className="mt-2 truncate text-sm text-slate-400">
        {next
          ? `次: ${next.section ? `${next.section} — ` : ""}${next.title}`
          : "🎉 全マイルストーン達成!"}
      </p>
    </button>
  );
}
