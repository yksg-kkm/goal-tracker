// 汎用ユーティリティ
import type { Goal } from "./types";

/** 一意なIDを生成する */
export function uid(): string {
  return crypto.randomUUID();
}

/** 今日の日付を YYYY-MM-DD(ローカル時刻基準)で返す */
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 現在日時を YYYY-MM-DD HH:MM(ローカル時刻基準)で返す(マイルストーン達成日時の記録用) */
export function nowStr(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${todayStr()} ${hh}:${mm}`;
}

/** YYYY-MM-DD → 「M/D」表示(グラフ軸用) */
export function formatDateShort(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

/** 目標の進捗率(達成マイルストーン数 ÷ 全体)を 0〜100 で返す */
export function goalProgress(goal: Goal): number {
  if (goal.milestones.length === 0) return 0;
  const done = goal.milestones.filter((m) => m.done).length;
  return (done / goal.milestones.length) * 100;
}
