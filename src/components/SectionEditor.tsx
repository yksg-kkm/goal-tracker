// 練習区間の編集リスト: 追加・編集・削除・上下並べ替え(P1)
// MilestoneEditor と同じ操作体系。GoalForm の <form> 内でも使えるよう <form> 要素は使わない
import { useState, type KeyboardEvent } from "react";
import type { Section } from "../types";
import { uid } from "../util";

interface Props {
  sections: Section[];
  onChange: (ss: Section[]) => void;
}

/** order を 0..n-1 に振り直す */
function renumber(ss: Section[]): Section[] {
  return ss.map((s, i) => ({ ...s, order: i }));
}

interface DraftValues {
  name: string;
  bars: string;
  note: string;
}

export default function SectionEditor({ sections, onChange }: Props) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(sections.length === 0);

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(renumber(next));
  }

  function remove(s: Section) {
    if (
      !window.confirm(
        `区間「${s.name}」を削除しますか?\n(この区間のマイルストーンと記録は残ります)`,
      )
    )
      return;
    onChange(renumber(sorted.filter((x) => x.id !== s.id)));
    if (editingId === s.id) setEditingId(null);
  }

  /** フォームの値を既存(s)へ反映、または新規追加(s = null) */
  function apply(s: Section | null, v: DraftValues) {
    const name = v.name.trim();
    if (!name) return;
    // 名前で参照するため重複は不可(リネーム波及が誤動作しないように)
    if (sorted.some((x) => x.name === name && x.id !== s?.id)) {
      window.alert("同じ名前の区間がすでにあります。別の名前にしてください。");
      return;
    }
    const fields = {
      name,
      bars: v.bars.trim() || undefined,
      note: v.note.trim() || undefined,
    };
    if (s) {
      onChange(sorted.map((x) => (x.id === s.id ? { ...x, ...fields } : x)));
      setEditingId(null);
    } else {
      onChange(
        renumber([...sorted, { id: uid(), order: sorted.length, ...fields }]),
      );
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      {sorted.length === 0 && !adding && (
        <p className="text-sm text-slate-400">区間がありません</p>
      )}
      <ul className="space-y-1.5">
        {sorted.map((s, i) =>
          editingId === s.id ? (
            <li key={s.id}>
              <SectionForm
                initial={s}
                onSave={(v) => apply(s, v)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={s.id}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2"
            >
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 text-sm leading-snug text-slate-200">
                  {s.name}
                  {s.bars && (
                    <span className="ml-1.5 text-xs text-slate-400">
                      ({s.bars}小節)
                    </span>
                  )}
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
                    setEditingId(s.id);
                    setAdding(false);
                  }}
                  aria-label="編集"
                  className="h-8 w-8 shrink-0 rounded border border-slate-700 text-slate-300 active:bg-slate-700"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label="削除"
                  className="h-8 w-8 shrink-0 rounded border border-red-900 text-red-400 active:bg-red-950"
                >
                  ✕
                </button>
              </div>
              {s.note && <p className="mt-1 text-xs text-slate-400">{s.note}</p>}
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <SectionForm onSave={(v) => apply(null, v)} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="w-full rounded-lg border border-dashed border-slate-600 py-2 text-sm text-slate-300 active:bg-slate-800"
        >
          + 区間を追加
        </button>
      )}
    </div>
  );
}

// ---- 追加・編集フォーム ----
const INPUT =
  "mt-0.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500";

interface FormProps {
  initial?: Section;
  onSave: (v: DraftValues) => void;
  onCancel: () => void;
}

function SectionForm({ initial, onSave, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [bars, setBars] = useState(initial?.bars ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function save() {
    if (!name.trim()) return;
    onSave({ name, bars, note });
  }

  /** Enter で親フォーム(目標追加)が送信されるのを防ぐ */
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
        区間名(必須)
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: A, 1〜2小節, 16小節目の装飾音"
          className={INPUT}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-400">
          小節範囲(任意)
          <input
            type="text"
            value={bars}
            onChange={(e) => setBars(e.target.value)}
            placeholder="例: 1〜8"
            className={INPUT}
          />
        </label>
        <label className="block text-xs text-slate-400">
          メモ(任意)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 装飾音に注意"
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
          disabled={name.trim() === ""}
          className="flex-1 rounded-lg py-1.5 text-sm font-semibold text-white active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#3987e5" }}
        >
          {initial ? "保存" : "追加"}
        </button>
      </div>
    </div>
  );
}
