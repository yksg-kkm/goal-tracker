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
  Section,
  TimerLog,
  TimerMode,
} from "./types";
import type { TimerSession } from "./timer";
import { musicStages } from "./templates";
import { uid } from "./util";

const STORAGE_KEY = "goaltracker.v1";
const TIMER_LOGS_KEY = "goaltracker.timerlogs.v1";
const TIMER_SESSION_KEY = "goaltracker.timersession.v1";

/** localStorage から全目標を読み込む(未保存・破損時は null)。旧形式は自動変換する */
export function loadGoals(): Goal[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGoalArray(parsed) ? parsed.map(migrateGoal) : null;
  } catch {
    return null;
  }
}

/**
 * 旧形式(〜v2)のデータを現行形式へ自動変換する(P2/M4: マイグレーション)。
 * - 区間: string[](旧)→ Section[](新)
 * - music のテンポ段階(stages)が無ければ targetTempo から補完
 * - ログの区間: 単一 section(旧)→ 複数 sections(新)
 */
function migrateGoal(goal: Goal): Goal {
  let g = goal;
  const secs: unknown = g.sections;
  if (Array.isArray(secs) && secs.some((s) => typeof s === "string")) {
    g = {
      ...g,
      sections: (secs as (string | Section)[]).map((s, i) =>
        typeof s === "string" ? { id: uid(), name: s, order: i } : s,
      ),
    };
  }
  if (g.type === "music" && g.stages === undefined) {
    g = { ...g, stages: musicStages(g.targetTempo ?? 120) };
  }
  if (g.logs.some((l) => l.section !== undefined && l.sections === undefined)) {
    g = {
      ...g,
      logs: g.logs.map((l) =>
        l.section !== undefined && l.sections === undefined
          ? { ...l, sections: [l.section] }
          : l,
      ),
    };
  }
  return g;
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
    version: 3,
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

/** インポートしたテキストを検証して返す(不正な形式なら null)。旧バージョン(1・2)も自動変換して受け付ける */
export function parseImport(text: string): ImportedData | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    const file = parsed as Partial<ExportFile>;
    if (file.app !== "GoalTracker") return null;
    if (!isGoalArray(file.goals)) return null;
    if (file.timerLogs !== undefined && !isTimerLogArray(file.timerLogs))
      return null;
    return { goals: file.goals.map(migrateGoal), timerLogs: file.timerLogs ?? [] };
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
    g.logs.every(isLog) &&
    // 区間: 旧形式(string)と新形式(Section)の両方を受け付ける(migrateGoal が変換)
    (g.sections === undefined ||
      (Array.isArray(g.sections) &&
        g.sections.every((s) => typeof s === "string" || isSection(s)))) &&
    (g.stages === undefined ||
      (Array.isArray(g.stages) &&
        g.stages.every((s) => typeof s === "string")))
  );
}

function isSection(v: unknown): v is Section {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.order === "number" &&
    (s.bars === undefined || typeof s.bars === "string") &&
    (s.note === undefined || typeof s.note === "string")
  );
}

function isMilestone(v: unknown): v is Milestone {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.title === "string" &&
    typeof m.done === "boolean" &&
    typeof m.order === "number" &&
    // 任意フィールド(旧形式には存在しない = undefined でも有効。M4)
    (m.section === undefined || typeof m.section === "string") &&
    (m.doneDate === undefined || typeof m.doneDate === "string") &&
    (m.note === undefined || typeof m.note === "string") &&
    (m.targetLabel === undefined || typeof m.targetLabel === "string") &&
    (m.targetValue === undefined || typeof m.targetValue === "number")
  );
}

function isLog(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.id === "string" &&
    typeof l.date === "string" &&
    typeof l.note === "string" &&
    (l.section === undefined || typeof l.section === "string") &&
    (l.sections === undefined ||
      (Array.isArray(l.sections) &&
        l.sections.every((s) => typeof s === "string")))
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
    typeof t.note === "string" &&
    (t.section === undefined || typeof t.section === "string")
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
    (cfg.section === undefined || typeof cfg.section === "string") &&
    typeof s.startedAt === "string" &&
    (s.phase === "work" || s.phase === "break") &&
    typeof s.set === "number" &&
    typeof s.phaseAccumMs === "number" &&
    (s.phaseStartedEpoch === null || typeof s.phaseStartedEpoch === "number") &&
    typeof s.workDoneMs === "number" &&
    typeof s.notifiedOver === "boolean"
  );
}
