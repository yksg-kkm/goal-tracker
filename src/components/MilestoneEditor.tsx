// マイルストーン編集リスト: 追加・編集・削除・上下並べ替え(M1)
// 目標詳細画面(作成後)と目標追加フォーム(作成中)の両方から使う共通部品。
// GoalForm の <form> 内に置いても入れ子にならないよう、<form> 要素は使わない
import { useState, type KeyboardEvent } from "react";
import type { Milestone } from "../types";
import { uid } from "../util";

interface Props {
  milestones: Milestone[];
  onChange: (ms: Milestone[]) => void;
}

/** 達成条件の表示テキスト(未設定なら null) */
export function targetText(m: Milestone): string | null {
  if (m.targetValue !== undefined)
    return `${m.targetLabel ? `${m.targetLabel} ` : ""}${m.targetValue}`;
  return m.targetLabel ?? null;
}

/** order を 0..n-1 に振り直す(削除・並べ替え・追加後の整合用) */
function renumber(ms: Milestone[]): Milestone[] {
  return ms.map((m, i) => ({ ...m, order: i }));
}

/** 入力フォームの値(文字列のまま保持し、保存時に変換する) */
interface DraftValues {
  title: string;
  section: string;
  note: string;
  targetLabel: string;
  targetValue: string;
}

export default function MilestoneEditor({ milestones, onChange }: Props) {
  const sorted = [...milestones].sort((a, b) => a.order - b.order);
  const [editingId, setEditingId] = useState<string | null>(null);
  // リストが空のときは最初から追加フォームを開いておく
  const [adding, setAdding] = useState(milestones.length === 0);

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(renumber(next));
  }

  function remove(m: Milestone) {
    if (!window.confirm(`マイルストーン「${m.title}」を削除しますか?`)) return;
    onChange(renumber(sorted.filter((x) => x.id !== m.id)));
    if (editingId === m.id) setEditingId(null);
  }

  /** フォームの値を既存(m)へ反映、または新規追加(m = null) */
  function apply(m: Milestone | null, v: DraftValues) {
    const num = Number(v.targetValue);
    const fields = {
      title: v.title.trim(),
      section: v.section.trim() || undefined,
      note: v.note.trim() || undefined,
      targetLabel: v.targetLabel.trim() || undefined,
      targetValue:
        v.targetValue.trim() !== "" && Number.isFinite(num) ? num : undefined,
    };
    if (m) {
      onChange(sorted.map((x) => (x.id === m.id ? { ...x, ...fields } : x)));
      setEditingId(null);
    } else {
      onChange(
        renumber([
          ...sorted,
          { id: uid(), done: false, order: sorted.length, ...fields },
        ]),
      );
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      {sorted.length === 0 && !adding && (
        <p className="text-sm text-slate-400">マイルストーンがありません</p>
      )}
      <ul className="space-y-1.5">
        {sorted.map((m, i) =>
          editingId === m.id ? (
            <li key={m.id}>
              <MilestoneForm
                initial={m}
                onSave={(v) => apply(m, v)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={m.id}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2"
            >
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 text-sm leading-snug">
                  {m.section && (
                    <span className="mr-1 rounded bg-slate-700 px-1 text-xs text-slate-300">
                      {m.section}
                    </span>
                  )}
                  <span
                    className={
                      m.done ? "text-slate-500 line-through" : "text-slate-200"
                    }
                  >
                    {m.title}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="上へ移動"
                  className="h-8 w-8 shrink-0 rounded border border-slate-700 text-slate-300 active:bg-slate-700 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === sorted.length - 1}
                  aria-label="下へ移動"
                  className="h-8 w-8 shrink-0 rounded border border-slate-700 text-slate-300 active:bg-slate-700 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(m.id);
                    setAdding(false);
                  }}
                  aria-label="編集"
                  className="h-8 w-8 shrink-0 rounded border border-slate-700 text-slate-300 active:bg-slate-700"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  aria-label="削除"
                  className="h-8 w-8 shrink-0 rounded border border-red-900 text-red-400 active:bg-red-950"
                >
                  ✕
                </button>
              </div>
              {(m.note !== undefined || targetText(m) !== null) && (
                <p className="mt-1 text-xs text-slate-400">
                  {targetText(m) !== null && (
                    <span className="mr-1.5 rounded bg-slate-800 px-1 text-slate-300">
                      🎯 {targetText(m)}
                    </span>
                  )}
                  {m.note}
                </p>
              )}
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <MilestoneForm onSave={(v) => apply(null, v)} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="w-full rounded-lg border border-dashed border-slate-600 py-2 text-sm text-slate-300 active:bg-slate-800"
        >
          + マイルストーンを追加
        </button>
      )}
    </div>
  );
}

// ---- 追加・編集フォーム ----
const INPUT =
  "mt-0.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500";

interface FormProps {
  initial?: Milestone;
  onSave: (v: DraftValues) => void;
  onCancel: () => void;
}

function MilestoneForm({ initial, onSave, onCancel }: FormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [targetLabel, setTargetLabel] = useState(initial?.targetLabel ?? "");
  const [targetValue, setTargetValue] = useState(
    initial?.targetValue !== undefined ? String(initial.targetValue) : "",
  );

  function save() {
    if (!title.trim()) return;
    onSave({ title, section, note, targetLabel, targetValue });
  }

  /** Enter で親フォーム(目標追加)が送信されるのを防ぎ、代わりにこの下書きを保存する */
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="space-y-2 rounded-lg border border-[#3987e5] bg-slate-900 p-2.5"
    >
      <label className="block text-xs text-slate-400">
        タイトル(必須)
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: ♩=100で通し"
          className={INPUT}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-400">
          区間・カテゴリ(任意)
          <input
            type="text"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="例: A, コーダ"
            className={INPUT}
          />
        </label>
        <label className="block text-xs text-slate-400">
          補足メモ(任意)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: ペダルに注意"
            className={INPUT}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-400">
          達成条件の項目(任意)
          <input
            type="text"
            value={targetLabel}
            onChange={(e) => setTargetLabel(e.target.value)}
            placeholder="例: テンポ, 正答率%"
            className={INPUT}
          />
        </label>
        <label className="block text-xs text-slate-400">
          達成条件の数値(任意)
          <input
            type="number"
            inputMode="decimal"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="例: 132, 80"
            className={INPUT}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-600 py-1.5 text-sm text-slate-300 active:bg-slate-700"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={save}
          disabled={title.trim() === ""}
          className="flex-1 rounded-lg py-1.5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#3987e5" }}
        >
          {initial ? "保存" : "追加"}
        </button>
      </div>
    </div>
  );
}
