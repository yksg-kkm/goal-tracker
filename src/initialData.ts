// ===== 初期データ =====
// コード内の初期値としてのみ保持する(S2: 個人の練習ログは含めない)。
// 初回起動時に localStorage が空の場合だけ適用される。
import type { Goal } from "./types";
import { buildMusicMilestones } from "./templates";

/** ノクターン Op.9-2 の練習区間(A / A' / B / A'' / コーダ) */
const CHOPIN_SECTIONS = ["A", "A'", "B", "A''", "コーダ"];

export function initialGoals(): Goal[] {
  return [
    {
      id: "goal-chopin-op9-2",
      type: "music",
      title: "ショパン ノクターン第2番 Op.9-2 を弾けるようになる",
      createdAt: "2026-07-14",
      sections: CHOPIN_SECTIONS,
      targetTempo: 132,
      // 区間ごとに「譜読み完了 → ♩=60 → ♩=100 → 目標テンポ♩=132」の4段階 × 5区間 = 20件
      milestones: buildMusicMilestones(CHOPIN_SECTIONS, 132),
      logs: [],
    },
  ];
}
