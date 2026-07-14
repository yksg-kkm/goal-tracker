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

/** マイルストーン(目標を構成する中間ステップ。追加・編集・削除・並べ替え自由) */
export interface Milestone {
  id: string;
  title: string;
  /** 所属する区間・カテゴリ(任意。例: "A", "コーダ") */
  section?: string;
  done: boolean;
  /** 達成日時(旧データは "YYYY-MM-DD"、新規は "YYYY-MM-DD HH:MM"。両形式とも有効) */
  doneDate?: string;
  /** 表示順 */
  order: number;
  /** 補足メモ(任意) */
  note?: string;
  /** 達成条件の項目名(任意。例: "テンポ", "正答率%") */
  targetLabel?: string;
  /** 達成条件の数値(任意。例: 132, 80) */
  targetValue?: number;
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

// ===== タイマー(ポモドーロ / シンプル) =====

/** タイマーの種類 */
export type TimerMode = "pomodoro" | "simple";

/** タイマー実行1回ごとの記録(T3) */
export interface TimerLog {
  id: string;
  /** 開始日時(ISO 8601) */
  startedAt: string;
  mode: TimerMode;
  /** 設定時間(分)。ポモドーロは作業時間の合計(作業分 × セット数) */
  plannedMinutes: number;
  /** 実績時間(秒)。ポモドーロは作業時間のみ(休憩を含まない)、超過継続型は超過分込みの合計 */
  actualSeconds: number;
  /** 完走したか(false = 途中停止) */
  completed: boolean;
  /** メモ(何をしたか・省略可) */
  note: string;
  /** 紐付けた目標のID(任意) */
  goalId?: string;
  /** ポモドーロの内訳(表示用) */
  workMinutes?: number;
  breakMinutes?: number;
  totalSets?: number;
  /** 完了したセット数(途中停止時の参考) */
  completedSets?: number;
}

/** エクスポートファイルの形式(端末間データ移行用) */
export interface ExportFile {
  app: "GoalTracker";
  /** 1: 目標のみ / 2: タイマー記録(timerLogs)を含む */
  version: 1 | 2;
  exportedAt: string;
  goals: Goal[];
  /** version 2 以降 */
  timerLogs?: TimerLog[];
}
