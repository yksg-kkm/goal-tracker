// ===== 目標タイプ別のテンプレート =====
import type { Goal, GoalType, LogEntry, Milestone } from "./types";
import { todayStr, uid } from "./util";

/** music: 区間ごとの練習段階(譜読み → 段階テンポ → 目標テンポ) */
export function musicStages(targetTempo: number): string[] {
  return [
    "譜読み完了",
    "♩=60で通し",
    "♩=100で通し",
    `目標テンポ♩=${targetTempo}で通し`,
  ];
}

/** music: 区間 × 練習段階のマイルストーン一覧を生成する */
export function buildMusicMilestones(
  sections: string[],
  targetTempo: number,
): Milestone[] {
  const list: Milestone[] = [];
  for (const section of sections) {
    for (const stage of musicStages(targetTempo)) {
      list.push({
        id: uid(),
        title: stage,
        section,
        done: false,
        order: list.length,
      });
    }
  }
  return list;
}

/** exam: 試験型の定番ステップ */
export const EXAM_TEMPLATE: string[] = [
  "出題範囲の把握・教材の準備",
  "教材を1周する",
  "過去問1回目(現状把握)",
  "弱点分野の集中復習",
  "過去問2回目(合格ライン到達)",
  "総仕上げ・本番想定演習",
];

/** habit: 継続型の積み上げステップ */
export const HABIT_TEMPLATE: string[] = [
  "3日連続で実施",
  "1週間継続",
  "2週間継続",
  "1か月継続",
  "3か月継続(習慣化)",
];

function buildSimpleMilestones(titles: string[]): Milestone[] {
  return titles.map((title, i) => ({
    id: uid(),
    title,
    done: false,
    order: i,
  }));
}

/** 目標追加フォームからの入力 */
export interface NewGoalInput {
  type: GoalType;
  title: string;
  /** music: 区間一覧 */
  sections?: string[];
  /** music: 目標テンポ */
  targetTempo?: number;
  /** exam: 試験日など */
  targetDate?: string;
}

/** type に応じたテンプレートを適用して新しい目標を作る */
export function createGoal(input: NewGoalInput): Goal {
  const base = {
    id: uid(),
    title: input.title,
    createdAt: todayStr(),
    logs: [] as LogEntry[],
  };
  if (input.type === "music") {
    const sections =
      input.sections && input.sections.length > 0 ? input.sections : ["A", "B"];
    const tempo = input.targetTempo ?? 120;
    return {
      ...base,
      type: "music",
      sections,
      targetTempo: tempo,
      milestones: buildMusicMilestones(sections, tempo),
    };
  }
  if (input.type === "exam") {
    return {
      ...base,
      type: "exam",
      targetDate: input.targetDate || undefined,
      milestones: buildSimpleMilestones(EXAM_TEMPLATE),
    };
  }
  return {
    ...base,
    type: "habit",
    milestones: buildSimpleMilestones(HABIT_TEMPLATE),
  };
}
