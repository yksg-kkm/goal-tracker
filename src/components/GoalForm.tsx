// 目標追加画面: type を選ぶとテンプレートが適用される
import { useState, type FormEvent } from "react";
import type { GoalType } from "../types";
import {
  EXAM_TEMPLATE,
  HABIT_TEMPLATE,
  musicStages,
  type NewGoalInput,
} from "../templates";

interface Props {
  onCreate: (input: NewGoalInput) => void;
  onBack: () => void;
}

const TYPE_OPTIONS: { value: GoalType; label: string; desc: string }[] = [
  {
    value: "music",
    label: "🎵 楽曲習得型",
    desc: "曲を区間に分け、テンポを段階的に上げて仕上げる",
  },
  {
    value: "exam",
    label: "📝 試験型",
    desc: "教材1周 → 過去問 → 弱点復習の定番ステップ",
  },
  {
    value: "habit",
    label: "🔁 継続型",
    desc: "3日 → 1週間 → 1か月…と継続を積み上げる",
  },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

export default function GoalForm({ onCreate, onBack }: Props) {
  const [type, setType] = useState<GoalType>("music");
  const [title, setTitle] = useState("");
  const [sectionsText, setSectionsText] = useState("A,A',B,A'',コーダ");
  const [targetTempo, setTargetTempo] = useState("120");
  const [targetDate, setTargetDate] = useState("");

  // 選択中の type で適用されるテンプレートのプレビュー
  const preview: string[] =
    type === "music"
      ? musicStages(Number(targetTempo) || 120)
      : type === "exam"
        ? EXAM_TEMPLATE
        : HABIT_TEMPLATE;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      type,
      title: title.trim(),
      sections: sectionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      targetTempo: Number(targetTempo) || 120,
      targetDate: targetDate || undefined,
    });
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 text-sm text-slate-400 active:text-slate-200"
      >
        ← 目標一覧へ戻る
      </button>
      <h1 className="mb-4 text-lg font-bold">目標を追加</h1>

      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-xs text-slate-400">目標のタイプ</legend>
          <div className="space-y-2">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`block cursor-pointer rounded-xl border p-3 ${
                  type === opt.value
                    ? "border-[#3987e5] bg-slate-800"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="goal-type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-slate-400">{opt.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-xs text-slate-400">
          目標のタイトル
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: ○○を達成する"
            className={`${INPUT_CLASS} mt-1`}
            required
          />
        </label>

        {type === "music" && (
          <>
            <label className="block text-xs text-slate-400">
              練習区間(カンマ区切り)
              <input
                type="text"
                value={sectionsText}
                onChange={(e) => setSectionsText(e.target.value)}
                placeholder="例: A,A',B,A'',コーダ"
                className={`${INPUT_CLASS} mt-1`}
              />
            </label>
            <label className="block text-xs text-slate-400">
              目標テンポ(♩)
              <input
                type="number"
                inputMode="numeric"
                min={20}
                max={300}
                value={targetTempo}
                onChange={(e) => setTargetTempo(e.target.value)}
                className={`${INPUT_CLASS} mt-1`}
              />
            </label>
          </>
        )}

        {type === "exam" && (
          <label className="block text-xs text-slate-400">
            試験日(任意)
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
        )}

        <div className="rounded-xl bg-slate-900 p-3">
          <h3 className="mb-1 text-xs font-semibold text-slate-400">
            適用されるテンプレート
            {type === "music" && "(各区間に以下の4段階)"}
          </h3>
          <ol className="list-inside list-decimal space-y-0.5 text-xs text-slate-300">
            {preview.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white active:opacity-80"
          style={{ backgroundColor: "#3987e5" }}
        >
          この内容で作成
        </button>
      </form>
    </div>
  );
}
