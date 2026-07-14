// ===== タイマーのコアロジック(純関数) =====
// T5: 経過時間は setInterval の積算ではなく「開始時刻タイムスタンプとの差分」で計算する。
//     iOSのバックグラウンド・画面ロックでJSが止まっても、復帰時に現在時刻から正しく補正される。
import type { TimerMode } from "./types";

/** タイマーの設定(開始前に決める内容) */
export interface TimerConfig {
  mode: TimerMode;
  /** 作業時間(分)。シンプルモードでは設定時間そのもの */
  workMinutes: number;
  /** 休憩時間(分・ポモドーロのみ) */
  breakMinutes: number;
  /** セット数(ポモドーロのみ) */
  sets: number;
  /** シンプルのみ: true = 超過継続型 / false = 強制終了型 */
  overrun: boolean;
  /** 紐付ける目標のID(任意) */
  goalId?: string;
  /** 紐付ける練習区間名(music用・任意。P4) */
  section?: string;
}

/** 実行中のセッション。localStorage にも保存し、復帰・再起動時に現在時刻から補正する */
export interface TimerSession {
  config: TimerConfig;
  /** 開始日時(記録用・ISO 8601) */
  startedAt: string;
  /** 現在のフェーズ(シンプルは常に work) */
  phase: "work" | "break";
  /** 何セット目か(1始まり) */
  set: number;
  /** 現フェーズの、一時停止までに経過した累積ミリ秒 */
  phaseAccumMs: number;
  /** 現フェーズの計測(再)開始時刻(epoch ms)。null は一時停止中 */
  phaseStartedEpoch: number | null;
  /** 完了済み作業フェーズの合計ミリ秒(現フェーズ分は含まない) */
  workDoneMs: number;
  /** 超過継続型で「設定時間到達」を通知済みか */
  notifiedOver: boolean;
}

/** フェーズ切替時に発火するイベント(通知音の種類に対応) */
export type TimerEvent = "work-end" | "break-end";

export interface AdvanceResult {
  session: TimerSession;
  events: TimerEvent[];
  /** 完走した(ポモドーロ全セット終了 / 強制終了型が設定時間到達) */
  finished: boolean;
}

/** 現フェーズの規定時間(ms) */
export function phaseDurationMs(s: TimerSession): number {
  const min = s.phase === "work" ? s.config.workMinutes : s.config.breakMinutes;
  return min * 60_000;
}

/** 現フェーズの経過ミリ秒(タイムスタンプ差分方式) */
export function phaseElapsedMs(s: TimerSession, now: number): number {
  return (
    s.phaseAccumMs +
    (s.phaseStartedEpoch !== null ? Math.max(0, now - s.phaseStartedEpoch) : 0)
  );
}

/** 実績の作業ミリ秒(休憩は含めない。シンプルは全経過時間) */
export function workElapsedMs(s: TimerSession, now: number): number {
  return s.workDoneMs + (s.phase === "work" ? phaseElapsedMs(s, now) : 0);
}

/** 設定上の作業時間合計(ms)。ポモドーロは作業 × セット数、シンプルは設定時間 */
export function plannedWorkMs(c: TimerConfig): number {
  return (c.mode === "pomodoro" ? c.workMinutes * c.sets : c.workMinutes) * 60_000;
}

/**
 * 現在時刻に合わせてセッションを進める。
 * 長時間バックグラウンドにいた場合も、複数フェーズをまとめて正しく送り進める。
 * 変化がなければ同じオブジェクトをそのまま返す(呼び出し側は参照比較で更新を判定できる)。
 */
export function advance(s: TimerSession, now: number): AdvanceResult {
  const events: TimerEvent[] = [];
  let cur = s;

  if (cur.config.mode === "simple") {
    const elapsed = phaseElapsedMs(cur, now);
    const dur = phaseDurationMs(cur);
    if (!cur.config.overrun) {
      // 強制終了型: 設定時間到達で完走(自動停止は呼び出し側が行う)
      return { session: cur, events, finished: elapsed >= dur };
    }
    // 超過継続型: 停止までカウントを続け、設定時間到達の瞬間だけ1回通知する
    if (elapsed >= dur && !cur.notifiedOver) {
      events.push("work-end");
      return { session: { ...cur, notifiedOver: true }, events, finished: false };
    }
    return { session: cur, events, finished: false };
  }

  // ポモドーロ: フェーズ超過分は次フェーズへ持ち越しながらループで進める
  for (;;) {
    const dur = phaseDurationMs(cur);
    const elapsed = phaseElapsedMs(cur, now);
    if (elapsed < dur) return { session: cur, events, finished: false };
    const carry = elapsed - dur;
    const epoch = cur.phaseStartedEpoch !== null ? now : null;
    if (cur.phase === "work") {
      if (cur.set >= cur.config.sets) {
        // 最終セットの作業終了 = 完走(最後の休憩は行わない)。実績計算のため作業フェーズのまま固定する
        return {
          session: { ...cur, phaseAccumMs: dur, phaseStartedEpoch: null },
          events,
          finished: true,
        };
      }
      events.push("work-end");
      cur = {
        ...cur,
        phase: "break",
        workDoneMs: cur.workDoneMs + dur,
        phaseAccumMs: carry,
        phaseStartedEpoch: epoch,
      };
    } else {
      events.push("break-end");
      cur = {
        ...cur,
        phase: "work",
        set: cur.set + 1,
        phaseAccumMs: carry,
        phaseStartedEpoch: epoch,
      };
    }
  }
}

// ---- 表示用フォーマット ----

/** 秒 → "MM:SS"(60分超も分のまま。例: 120:00) */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 秒 → 「X時間Y分」(累計表示用) */
export function fmtDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  const h = Math.floor(mins / 60);
  if (h === 0) return `${mins}分`;
  return `${h}時間${mins % 60}分`;
}

/** ISO日時 → 「M/D HH:MM」(履歴一覧用) */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}
