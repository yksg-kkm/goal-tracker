// ===== Screen Wake Lock(T6a): タイマー実行中の画面自動ロック防止 =====
// ブラウザ標準APIのみ使用(S1: 追加npm依存なし)

let sentinel: WakeLockSentinel | null = null;

/** この環境で Wake Lock が使えるか */
export function wakeLockSupported(): boolean {
  return "wakeLock" in navigator;
}

/**
 * Wake Lock を取得する(タイマー開始時・バックグラウンド復帰時)。
 * ページが非表示になると自動解放されるため、復帰のたびに取り直す必要がある。
 * @returns 取得できたら true(非対応・拒否時は false)
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (!wakeLockSupported()) return false;
  try {
    const s = await navigator.wakeLock.request("screen");
    if (sentinel !== null && sentinel !== s) {
      void sentinel.release().catch(() => undefined);
    }
    sentinel = s;
    return true;
  } catch {
    return false;
  }
}

/** Wake Lock を解放する(停止・完了時に必ず呼ぶ) */
export function releaseWakeLock(): void {
  if (sentinel === null) return;
  void sentinel.release().catch(() => undefined);
  sentinel = null;
}

const NOTICE_KEY = "goaltracker.wakelocknotice.v1";

/**
 * 非対応環境向けの案内(「自動ロックをオフにしてください」)を表示すべきか。
 * 一度 true を返したらフラグを保存し、以後は false(T6a: 1回だけ案内)
 */
export function consumeWakeLockNotice(): boolean {
  try {
    if (localStorage.getItem(NOTICE_KEY) !== null) return false;
    localStorage.setItem(NOTICE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
