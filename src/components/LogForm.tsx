// ログ入力フォーム(music: 日付・練習区間・達成テンポ・メモ / その他: 日付・メモ)
import { useState, type FormEvent } from "react";
import type { Goal, LogEntry } from "../types";
import { todayStr, uid } from "../util";

interface Props {
  goal: Goal;
  onAdd: (log: LogEntry) => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

export default function LogForm({ goal, onAdd }: Props) {
  const isMusic = goal.type === "music";
  const [date, setDate] = useState(todayStr());
  // P4: 区間は操作者が定義した一覧から複数選択(未選択 = 全体練習)
  const [selSections, setSelSections] = useState<string[]>([]);
  const [tempo, setTempo] = useState("");
  const [note, setNote] = useState("");

  const sectionNames = [...(goal.sections ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.name);

  function toggleSection(name: string) {
    setSelSections((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name],
    );
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date) return;
    // 表示順に整えて保存する
    const ordered = sectionNames.filter((n) => selSections.includes(n));
    const log: LogEntry = {
      id: uid(),
      date,
      note: note.trim(),
      ...(isMusic
        ? {
            sections: ordered.length > 0 ? ordered : undefined,
            tempo: tempo !== "" ? Number(tempo) : undefined,
          }
        : {}),
    };
    onAdd(log);
    // 日付と区間は連続入力しやすいよう保持し、テンポとメモだけリセット
    setTempo("");
    setNote("");
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-300">今日の記録</h3>
      <label className="block text-xs text-slate-400">
        日付
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${INPUT_CLASS} mt-1`}
          required
        />
      </label>
      {isMusic && sectionNames.length > 0 && (
        <div className="text-xs text-slate-400">
          練習区間(タップで複数選択・未選択 = 全体)
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sectionNames.map((name) => {
              const selected = selSections.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleSection(name)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                    selected
                      ? "border-[#3987e5] bg-[#3987e5]/15 text-white"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {isMusic && (
        <label className="block text-xs text-slate-400">
          達成テンポ(♩)
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={300}
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            placeholder="例: 92"
            className={`${INPUT_CLASS} mt-1`}
          />
        </label>
      )}
      <label className="block text-xs text-slate-400">
        メモ
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isMusic ? "例: 左手のアルペジオを重点練習" : "例: 30分実施"}
          className={`${INPUT_CLASS} mt-1`}
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-lg py-2 text-sm font-semibold text-white active:opacity-80"
        style={{ backgroundColor: "#3987e5" }}
      >
        記録する
      </button>
    </form>
  );
}
