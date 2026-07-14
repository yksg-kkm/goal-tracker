// 目標追加画面: type 選択でテンプレートを「初期案」として提案する(M2)
// マイルストーンは「このまま使う / 編集して使う / 白紙から作る」から選べる
import { useState, type FormEvent } from "react";
import type { GoalType, Milestone } from "../types";
import {
  buildMusicMilestones,
  buildSimpleMilestones,
  EXAM_TEMPLATE,
  HABIT_TEMPLATE,
  musicStages,
  type NewGoalInput,
} from "../templates";
import MilestoneEditor from "./MilestoneEditor";

interface Props {
  onCreate: (input: NewGoalInput) => void;
  onBack: () => void;
}

/** マイルストーンの初期化方法 */
type MsChoice = "template" | "edit" | "blank";

const MS_CHOICES: { value: MsChoice; label: string; desc: string }[] = [
  {
    value: "template",
    label: "このまま使う",
    desc: "テンプレートを適用(作成後も自由に編集できます)",
  },
  {
    value: "edit",
    label: "編集して使う",
    desc: "テンプレートを下書きにして、今ここで編集する",
  },
  {
    value: "blank",
    label: "白紙から作る",
    desc: "マイルストーンなしで作成し、自由に追加する",
  },
];

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
  const [msChoice, setMsChoice] = useState<MsChoice>("template");
  // 「編集して使う / 白紙から作る」の下書きマイルストーン
  const [drafts, setDrafts] = useState<Milestone[]>([]);

  function parseSections(): string[] {
    return sectionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** 現在の入力値からテンプレートのマイルストーンを生成する */
  function buildFromTemplate(t: GoalType): Milestone[] {
    if (t === "music") {
      const sections = parseSections();
      return buildMusicMilestones(
        sections.length > 0 ? sections : ["A", "B"],
        Number(targetTempo) || 120,
      );
    }
    return buildSimpleMilestones(t === "exam" ? EXAM_TEMPLATE : HABIT_TEMPLATE);
  }

  function changeType(t: GoalType) {
    setType(t);
    // 「編集して使う」の下書きはタイプのテンプレートに合わせて作り直す
    if (msChoice === "edit") setDrafts(buildFromTemplate(t));
  }

  function changeMsChoice(c: MsChoice) {
    setMsChoice(c);
    if (c === "edit") setDrafts(buildFromTemplate(type));
    if (c === "blank") setDrafts([]);
  }

  // 「このまま使う」で適用されるテンプレートのプレビュー(初期案)
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
      sections: parseSections(),
      targetTempo: Number(targetTempo) || 120,
      targetDate: targetDate || undefined,
      // M2: 「このまま使う」以外は下書き(空配列含む)をそのまま採用する
      milestones: msChoice === "template" ? undefined : drafts,
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
                  onChange={() => changeType(opt.value)}
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

        {/* M2: テンプレートは初期案。使い方を3択から選ぶ */}
        <fieldset>
          <legend className="mb-2 text-xs text-slate-400">
            マイルストーンの作り方
          </legend>
          <div className="space-y-1.5">
            {MS_CHOICES.map((c) => (
              <label
                key={c.value}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
                  msChoice === c.value
                    ? "border-[#3987e5] bg-slate-800"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="ms-choice"
                  checked={msChoice === c.value}
                  onChange={() => changeMsChoice(c.value)}
                  className="mt-0.5 accent-[#3987e5]"
                />
                <span>
                  <span className="font-semibold text-slate-200">{c.label}</span>
                  <span className="block text-xs text-slate-400">{c.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {msChoice === "template" && (
          <div className="rounded-xl bg-slate-900 p-3">
            <h3 className="mb-1 text-xs font-semibold text-slate-400">
              テンプレート(初期案)
              {type === "music" && "(各区間に以下の4段階)"}
            </h3>
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-slate-300">
              {preview.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </div>
        )}

        {msChoice !== "template" && (
          <div className="rounded-xl bg-slate-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400">
                マイルストーン({drafts.length}件)
              </h3>
              {msChoice === "edit" && (
                <button
                  type="button"
                  onClick={() => setDrafts(buildFromTemplate(type))}
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 active:bg-slate-700"
                >
                  テンプレートから作り直す
                </button>
              )}
            </div>
            {/* key で選択切替時に編集状態をリセットする */}
            <MilestoneEditor
              key={msChoice}
              milestones={drafts}
              onChange={setDrafts}
            />
          </div>
        )}

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
