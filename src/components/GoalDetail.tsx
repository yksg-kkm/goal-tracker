// 目標詳細画面: 進捗・グラフ・ログ入力・マイルストーン一覧・ログ履歴
import type { Goal, LogEntry, Milestone } from "../types";
import { goalProgress, todayStr } from "../util";
import { TYPE_LABEL } from "./GoalCard";
import LogForm from "./LogForm";
import ProgressBar from "./ProgressBar";
import ProgressChart from "./ProgressChart";

interface Props {
  goal: Goal;
  onBack: () => void;
  onUpdate: (updater: (g: Goal) => Goal) => void;
  onDelete: () => void;
}

export default function GoalDetail({ goal, onBack, onUpdate, onDelete }: Props) {
  const doneCount = goal.milestones.filter((m) => m.done).length;

  function toggleMilestone(id: string) {
    onUpdate((g) => ({
      ...g,
      milestones: g.milestones.map((m) =>
        m.id === id
          ? { ...m, done: !m.done, doneDate: m.done ? undefined : todayStr() }
          : m,
      ),
    }));
  }

  function addLog(log: LogEntry) {
    onUpdate((g) => ({ ...g, logs: [...g.logs, log] }));
  }

  function deleteLog(id: string) {
    if (!window.confirm("この記録を削除しますか?")) return;
    onUpdate((g) => ({ ...g, logs: g.logs.filter((l) => l.id !== id) }));
  }

  // 区間ごとにマイルストーンをグループ化(music以外は単一グループ)
  const groups: [string, Milestone[]][] = [];
  for (const m of [...goal.milestones].sort((a, b) => a.order - b.order)) {
    const key = m.section ?? "";
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(m);
    else groups.push([key, [m]]);
  }

  const logsDesc = [...goal.logs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <header>
        <button
          onClick={onBack}
          className="mb-3 text-sm text-slate-400 active:text-slate-200"
        >
          ← 目標一覧へ戻る
        </button>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
            {TYPE_LABEL[goal.type]}
          </span>
          {goal.targetDate && (
            <span className="text-xs text-slate-400">
              目標日 {goal.targetDate}
            </span>
          )}
        </div>
        <h1 className="mb-3 text-lg font-bold leading-snug">{goal.title}</h1>
        <ProgressBar percent={goalProgress(goal)} />
        <p className="mt-1 text-xs text-slate-400">
          マイルストーン {doneCount} / {goal.milestones.length} 達成
        </p>
      </header>

      <ProgressChart goal={goal} />

      <LogForm goal={goal} onAdd={addLog} />

      <section className="rounded-xl bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">
          マイルストーン
        </h3>
        <div className="space-y-3">
          {groups.map(([section, milestones]) => (
            <div key={section || "_default"}>
              {section && (
                <h4 className="mb-1 text-xs font-semibold text-slate-400">
                  {section}
                </h4>
              )}
              <ul className="space-y-1">
                {milestones.map((m) => (
                  <li key={m.id}>
                    <label className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm active:bg-slate-700">
                      <input
                        type="checkbox"
                        checked={m.done}
                        onChange={() => toggleMilestone(m.id)}
                        className="h-5 w-5 shrink-0 accent-[#3987e5]"
                      />
                      <span
                        className={
                          m.done ? "text-slate-500 line-through" : "text-slate-200"
                        }
                      >
                        {m.title}
                      </span>
                      {m.done && m.doneDate && (
                        <span className="ml-auto shrink-0 text-xs text-slate-500">
                          {m.doneDate}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">
          記録の履歴({goal.logs.length}件)
        </h3>
        {logsDesc.length === 0 ? (
          <p className="text-sm text-slate-400">まだ記録がありません</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {logsDesc.map((log) => (
              <li key={log.id} className="flex items-start gap-2 py-2 text-sm">
                <span className="shrink-0 text-slate-400">{log.date}</span>
                <span className="min-w-0 flex-1">
                  {log.section && (
                    <span className="mr-1 rounded bg-slate-700 px-1 text-xs text-slate-300">
                      {log.section}
                    </span>
                  )}
                  {log.tempo !== undefined && (
                    <span className="mr-1 text-slate-200">♩={log.tempo}</span>
                  )}
                  <span className="text-slate-300">{log.note}</span>
                </span>
                <button
                  onClick={() => deleteLog(log.id)}
                  aria-label="この記録を削除"
                  className="shrink-0 px-1 text-slate-500 active:text-red-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => {
          if (window.confirm("この目標を削除しますか?(記録もすべて消えます)"))
            onDelete();
        }}
        className="w-full rounded-lg border border-red-900 py-2 text-sm text-red-400 active:bg-red-950"
      >
        この目標を削除
      </button>
    </div>
  );
}
