// ===== 目標タイプ別のテンプレート(初期案。適用後は自由に編集できる) =====
import type { Goal, GoalType, LogEntry, Milestone, Section } from "./types";
import { todayStr, uid } from "./util";

/** music: 練習区間テンプレートの初期案(P2) */
export const SECTION_TEMPLATE: string[] = ["A", "A'", "B", "A''", "コーダ"];

/** 区間名の一覧から Section エンティティを生成する */
export function buildSections(names: string[]): Section[] {
  return names.map((name, i) => ({ id: uid(), name, order: i }));
}

/** music: 区間ごとの練習段階(譜読み → 段階テンポ → 目標テンポ) */
export function musicStages(targetTempo: number): string[] {
  return [
    "譜読み完了",
    "♩=60で通し",
    "♩=100で通し",
    `目標テンポ♩=${targetTempo}で通し`,
  ];
}

/** music: 区間 × テンポ段階のマイルストーン一覧を生成する */
export function buildMusicMilestones(
  sectionNames: string[],
  stages: string[],
): Milestone[] {
  const list: Milestone[] = [];
  for (const section of sectionNames) {
    for (const stage of stages) {
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

export function buildSimpleMilestones(titles: string[]): Milestone[] {
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
  /** music: 区間一覧(P2: 空配列 = 白紙。未指定ならテンプレートを適用) */
  sections?: Section[];
  /** music: 目標テンポ */
  targetTempo?: number;
  /** exam: 試験日など */
  targetDate?: string;
  /**
   * M2: 指定時はテンプレートの代わりにこのマイルストーンを使う
   * (「編集して使う」「白紙から作る」用。空配列も有効)
   */
  milestones?: Milestone[];
}

/** 新しい目標を作る。milestones 未指定なら type のテンプレートを初期案として適用する */
export function createGoal(input: NewGoalInput): Goal {
  const base = {
    id: uid(),
    title: input.title,
    createdAt: todayStr(),
    logs: [] as LogEntry[],
  };
  if (input.type === "music") {
    const sections = input.sections ?? buildSections(SECTION_TEMPLATE);
    const tempo = input.targetTempo ?? 120;
    const stages = musicStages(tempo);
    return {
      ...base,
      type: "music",
      sections,
      targetTempo: tempo,
      stages,
      milestones:
        input.milestones ??
        buildMusicMilestones(
          sections.map((s) => s.name),
          stages,
        ),
    };
  }
  if (input.type === "exam") {
    return {
      ...base,
      type: "exam",
      targetDate: input.targetDate || undefined,
      milestones: input.milestones ?? buildSimpleMilestones(EXAM_TEMPLATE),
    };
  }
  return {
    ...base,
    type: "habit",
    milestones: input.milestones ?? buildSimpleMilestones(HABIT_TEMPLATE),
  };
}
