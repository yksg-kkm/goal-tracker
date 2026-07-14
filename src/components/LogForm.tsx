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
  const [section, setSection] = useState(goal.sections?.[0] ?? "");
  const [tempo, setTempo] = useState("");
  const [note, setNote] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date) return;
    const log: LogEntry = {
      id: uid(),
      date,
      note: note.trim(),
      ...(isMusic
        ? {
            section: section || undefined,
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
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-400">
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${INPUT_CLASS} mt-1`}
            required
          />
        </label>
        {isMusic && (
          <label className="flex-1 text-xs text-slate-400">
            練習区間
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className={`${INPUT_CLASS} mt-1`}
            >
              {(goal.sections ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="全体">全体</option>
            </select>
          </label>
        )}
      </div>
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
