// ===== 永続化とデータ移行 =====
// S2: 進捗データは localStorage のみに保存する。
//     外部通信(fetch / XHR / beacon 等)はこのアプリのどこにも存在しない。
//     エクスポートはブラウザのダウンロードとしてのみ出力する。
import type { ExportFile, Goal, GoalType, LogEntry, Milestone } from "./types";

const STORAGE_KEY = "goaltracker.v1";

/** localStorage から全目標を読み込む(未保存・破損時は null) */
export function loadGoals(): Goal[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGoalArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 全目標を localStorage に保存する */
export function saveGoals(goals: Goal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // 容量超過など。ユーザーデータを失わないようコンソールに痕跡を残す
    console.error("進捗データの保存に失敗しました");
  }
}

/** S2: エクスポートファイル名は goaltracker-YYYYMMDD.export.json 形式に固定 */
export function exportFileName(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `goaltracker-${y}${m}${d}.export.json`;
}

/** JSONエクスポート: ブラウザのダウンロードとして出力(リポジトリ内には生成しない) */
export function downloadExport(goals: Goal[]): void {
  const file: ExportFile = {
    app: "GoalTracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    goals,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  a.click();
  URL.revokeObjectURL(url);
}

/** インポートしたテキストを検証し、目標配列を返す(不正な形式なら null) */
export function parseImport(text: string): Goal[] | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    const file = parsed as Partial<ExportFile>;
    if (file.app !== "GoalTracker") return null;
    if (!isGoalArray(file.goals)) return null;
    return file.goals;
  } catch {
    return null;
  }
}

// ---- 型ガード(インポートデータの構造検証) ----
const GOAL_TYPES: readonly GoalType[] = ["music", "exam", "habit"];

function isGoalArray(v: unknown): v is Goal[] {
  return Array.isArray(v) && v.every(isGoal);
}

function isGoal(v: unknown): v is Goal {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    typeof g.title === "string" &&
    typeof g.createdAt === "string" &&
    GOAL_TYPES.includes(g.type as GoalType) &&
    Array.isArray(g.milestones) &&
    g.milestones.every(isMilestone) &&
    Array.isArray(g.logs) &&
    g.logs.every(isLog)
  );
}

function isMilestone(v: unknown): v is Milestone {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.title === "string" &&
    typeof m.done === "boolean" &&
    typeof m.order === "number"
  );
}

function isLog(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.id === "string" &&
    typeof l.date === "string" &&
    typeof l.note === "string"
  );
}
