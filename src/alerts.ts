// ===== 終了通知(ビープ音 + バイブレーション + の呼び出し口) =====
// T4: 音源ファイルや追加npm依存は使わず、Web Audio API でビープ音を合成する(S1)。
//     バイブレーションは対応環境(主にAndroid)でのみ動作する。

let audioCtx: AudioContext | null = null;

/**
 * iOS対策: 音はユーザー操作(タップ)中に AudioContext を生成・再開しておかないと鳴らせない。
 * 開始・再開ボタンのハンドラ内で必ず呼ぶこと。
 */
export function unlockAudio(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    // Web Audio 非対応環境では無音のまま続行する
  }
}

export type BeepKind = "work-end" | "break-end" | "finish";

/** 種類別のビープ音パターン: [周波数Hz, 開始オフセット秒] の列 */
const TONES: Record<BeepKind, [number, number][]> = {
  "work-end": [
    // 作業終了 → 休憩へ(下降音)
    [660, 0],
    [523, 0.25],
  ],
  "break-end": [
    // 休憩終了 → 作業へ(上昇音)
    [523, 0],
    [660, 0.25],
  ],
  finish: [
    // 完走(上昇3音)
    [660, 0],
    [830, 0.2],
    [1046, 0.4],
  ],
};

/** ビープ音を鳴らし、対応環境ではバイブレーションも行う */
export function notify(kind: BeepKind): void {
  playBeep(kind);
  vibrate(kind);
}

function playBeep(kind: BeepKind): void {
  if (!audioCtx || audioCtx.state !== "running") return; // unlockAudio 前は鳴らせない
  for (const [freq, at] of TONES[kind]) tone(audioCtx, freq, at);
}

/** 単音を1つ鳴らす(クリックノイズ防止のためゲインをなだらかに変化させる) */
function tone(ctx: AudioContext, freq: number, at: number, dur = 0.18): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t = ctx.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function vibrate(kind: BeepKind): void {
  if (!("vibrate" in navigator)) return;
  navigator.vibrate(kind === "finish" ? [300, 100, 300, 100, 300] : [200, 100, 200]);
}
