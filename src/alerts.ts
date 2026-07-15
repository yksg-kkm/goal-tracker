// ===== 終了通知(ビープ音 + バイブレーション + の呼び出し口) =====
// T4: 音源ファイルや追加npm依存は使わず、Web Audio API でビープ音を合成する(S1)。
//     バイブレーションは対応環境(主にAndroid)でのみ動作する。

let audioCtx: AudioContext | null = null;

/** AudioContext コンストラクタを取得する(iOS 旧版の webkitAudioContext にも対応) */
function getAudioCtor(): typeof AudioContext | undefined {
  if (typeof AudioContext !== "undefined") return AudioContext;
  return (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
}

/**
 * iOS対策: 音はユーザー操作(タップ)中に AudioContext を生成・再開しておかないと鳴らせない。
 * 開始・再開・画面タップのハンドラ内で必ず呼ぶこと。単一インスタンスを使い回す。
 * iOS Safari は resume() だけでは解錠されないことがあるため、無音の1サンプルを
 * その場で再生してオーディオ経路を確実にアンロックする。
 */
export function unlockAudio(): void {
  try {
    if (audioCtx === null) {
      const Ctor = getAudioCtor();
      if (!Ctor) return; // Web Audio 非対応環境では無音のまま続行する
      audioCtx = new Ctor();
    }
    // suspended / interrupted(iOS)いずれも再開対象。closed のみ除外する
    if (audioCtx.state !== "running" && audioCtx.state !== "closed") {
      void audioCtx.resume();
    }
    // 無音バッファを再生して iOS のオーディオをアンロックする
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
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
  const ctx = audioCtx;
  if (!ctx) return; // unlockAudio 前は鳴らせない
  if (ctx.state === "closed") return; // 破棄済みなら何もしない
  const emit = () => {
    for (const [freq, at] of TONES[kind]) tone(ctx, freq, at);
  };
  // 再生直前に state を確認。suspended / interrupted(iOSのバックグラウンド復帰直後など)は
  // resume() してから鳴らす
  if (ctx.state !== "running") {
    void ctx.resume().then(emit).catch(() => {});
  } else {
    emit();
  }
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
