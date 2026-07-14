// ===== データ設計(3層構造): Goal(目標) → Milestone(マイルストーン) → LogEntry(日々の記録) =====
// S2: このデータは localStorage のみに保存する。サーバー送信は行わない。

/** 目標の種類 */
export type GoalType = "music" | "exam" | "habit";

/** 日々の記録(ログ) */
export interface LogEntry {
  id: string;
  /** 日付(YYYY-MM-DD) */
  date: string;
  /** 練習区間(music用) */
  section?: string;
  /** 達成テンポ ♩=n(music用) */
  tempo?: number;
  /** メモ */
  note: string;
}

/** マイルストーン(目標を構成する中間ステップ) */
export interface Milestone {
  id: string;
  title: string;
  /** 所属する区間(music用。例: "A", "コーダ") */
  section?: string;
  done: boolean;
  /** 達成日(YYYY-MM-DD) */
  doneDate?: string;
  /** 表示順 */
  order: number;
}

/** 目標 */
export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  /** 作成日(YYYY-MM-DD) */
  createdAt: string;
  /** 目標日(試験日など・任意) */
  targetDate?: string;
  /** 練習区間の一覧(music用) */
  sections?: string[];
  /** 目標テンポ(music用) */
  targetTempo?: number;
  milestones: Milestone[];
  logs: LogEntry[];
}

/** エクスポートファイルの形式(端末間データ移行用) */
export interface ExportFile {
  app: "GoalTracker";
  version: 1;
  exportedAt: string;
  goals: Goal[];
}
