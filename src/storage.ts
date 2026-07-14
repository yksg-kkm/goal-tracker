// ===== 永続化とデータ移行 =====
// S2: 進捗データは localStorage のみに保存する。
//     外部通信(fetch / XHR / beacon 等)はこのアプリのどこにも存在しない。
//     エクスポートはブラウザのダウンロードとしてのみ出力する。
import type {
  ExportFile,
  Goal,
  GoalType,
  LogEntry,
  Milestone,
  TimerLog,
  TimerMode,
} from "./types";
import type { TimerSession } from "./timer";

const STORAGE_KEY = "goaltracker.v1";
const TIMER_LOGS_KEY = "goaltracker.timerlogs.v1";
const TIMER_SESSION_KEY = "goaltracker.timersession.v1";

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

/** タイマー記録を localStorage から読み込む(未保存・破損時は空配列) */
export function loadTimerLogs(): TimerLog[] {
  try {
    const raw = localStorage.getItem(TIMER_LOGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isTimerLogArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** タイマー記録を localStorage に保存する */
export function saveTimerLogs(logs: TimerLog[]): void {
  try {
    localStorage.setItem(TIMER_LOGS_KEY, JSON.stringify(logs));
  } catch {
    console.error("タイマー記録の保存に失敗しました");
  }
}

/** 実行中タイマーセッションを読み込む(T5: 再起動後も残り時間を補正して継続するため) */
export function loadTimerSession(): TimerSession | null {
  try {
    const raw = localStorage.getItem(TIMER_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTimerSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 実行中タイマーセッションを保存する(null で削除) */
export function saveTimerSession(session: TimerSession | null): void {
  try {
    if (session === null) localStorage.removeItem(TIMER_SESSION_KEY);
    else localStorage.setItem(TIMER_SESSION_KEY, JSON.stringify(session));
  } catch {
    console.error("タイマーセッションの保存に失敗しました");
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
export function downloadExport(goals: Goal[], timerLogs: TimerLog[]): void {
  const file: ExportFile = {
    app: "GoalTracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    goals,
    timerLogs,
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

/** インポートの解析結果 */
export interface ImportedData {
  goals: Goal[];
  timerLogs: TimerLog[];
}

/** インポートしたテキストを検証して返す(不正な形式なら null)。version 1(タイマー記録なし)も受け付ける */
export function parseImport(text: string): ImportedData | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    const file = parsed as Partial<ExportFile>;
    if (file.app !== "GoalTracker") return null;
    if (!isGoalArray(file.goals)) return null;
    if (file.timerLogs !== undefined && !isTimerLogArray(file.timerLogs))
      return null;
    return { goals: file.goals, timerLogs: file.timerLogs ?? [] };
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

const TIMER_MODES: readonly TimerMode[] = ["pomodoro", "simple"];

function isTimerLogArray(v: unknown): v is TimerLog[] {
  return Array.isArray(v) && v.every(isTimerLog);
}

function isTimerLog(v: unknown): v is TimerLog {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.startedAt === "string" &&
    TIMER_MODES.includes(t.mode as TimerMode) &&
    typeof t.plannedMinutes === "number" &&
    typeof t.actualSeconds === "number" &&
    typeof t.completed === "boolean" &&
    typeof t.note === "string"
  );
}

function isTimerSession(v: unknown): v is TimerSession {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  const c = s.config;
  if (typeof c !== "object" || c === null) return false;
  const cfg = c as Record<string, unknown>;
  return (
    TIMER_MODES.includes(cfg.mode as TimerMode) &&
    typeof cfg.workMinutes === "number" &&
    typeof cfg.breakMinutes === "number" &&
    typeof cfg.sets === "number" &&
    typeof cfg.overrun === "boolean" &&
    typeof s.startedAt === "string" &&
    (s.phase === "work" || s.phase === "break") &&
    typeof s.set === "number" &&
    typeof s.phaseAccumMs === "number" &&
    (s.phaseStartedEpoch === null || typeof s.phaseStartedEpoch === "number") &&
    typeof s.workDoneMs === "number" &&
    typeof s.notifiedOver === "boolean"
  );
}
