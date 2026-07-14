// タイマー画面: ポモドーロ / シンプルタイマーの設定・実行・履歴
// T5: 経過時間はタイムスタンプ差分で計算し、復帰時に自動補正する(ロジックは ../timer.ts)
// T6: 実行中は省電力運用 — Wake Lock で自動ロック防止、黒背景の暗転表示、1秒1回の描画更新
import { useEffect, useState } from "react";
import type { Goal, TimerLog, TimerMode } from "../types";
import {
  advance,
  fmtClock,
  fmtDateTime,
  fmtDuration,
  phaseDurationMs,
  phaseElapsedMs,
  plannedWorkMs,
  workElapsedMs,
  type TimerConfig,
  type TimerSession,
} from "../timer";
import { loadTimerSession, saveTimerSession } from "../storage";
import { notify, unlockAudio, type BeepKind } from "../alerts";
import {
  acquireWakeLock,
  consumeWakeLockNotice,
  releaseWakeLock,
  wakeLockSupported,
} from "../wakelock";
import { uid } from "../util";
import ProgressBar from "./ProgressBar";

interface Props {
  goals: Goal[];
  logs: TimerLog[];
  onAddLog: (log: TimerLog) => void;
  onDeleteLog: (id: string) => void;
  /** 実行中かどうかをタブバーのインジケーター表示用に通知する */
  onActiveChange: (active: boolean) => void;
}

/** 保存確認ダイアログに渡す、確定済みの実行結果 */
interface PendingResult {
  completed: boolean;
  actualSeconds: number;
  completedSets?: number;
  config: TimerConfig;
  startedAt: string;
}

const MODE_LABEL: Record<TimerMode, string> = {
  pomodoro: "🍅 ポモドーロ",
  simple: "⏱ シンプル",
};

/** T6e: 通知時の画面全体の色変化(黒 → 明色) */
const FLASH_COLOR: Record<BeepKind, string> = {
  "work-end": "#199e70", // 作業終了 → 休憩(緑)
  "break-end": "#3987e5", // 休憩終了 → 作業(青)
  finish: "#f8fafc", // 完走(明るい白)
};

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** セッションから表示用の値をまとめて導出する(通常表示・暗転表示で共用) */
function sessionView(session: TimerSession, now: number) {
  const cfg = session.config;
  const dur = phaseDurationMs(session);
  const elapsed = phaseElapsedMs(session, now);
  const paused = session.phaseStartedEpoch === null;
  const isBreak = session.phase === "break";
  const over = cfg.mode === "simple" && cfg.overrun && elapsed >= dur;
  const timeText = over
    ? `+${fmtClock(Math.max(0, Math.floor((elapsed - dur) / 1000)))}`
    : fmtClock(Math.max(0, Math.ceil((dur - elapsed) / 1000)));
  const statusText =
    cfg.mode === "pomodoro"
      ? `${isBreak ? "休憩中" : "作業中"} セット${session.set}/${cfg.sets}`
      : over
        ? "超過中"
        : "計測中";
  return { cfg, dur, elapsed, paused, isBreak, over, timeText, statusText };
}

export default function TimerScreen({
  goals,
  logs,
  onAddLog,
  onDeleteLog,
  onActiveChange,
}: Props) {
  // ---- 設定(開始前の入力値) ----
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [sets, setSets] = useState(4);
  const [overrun, setOverrun] = useState(true); // シンプル: true=超過継続型
  const [goalId, setGoalId] = useState("");
  const [sectionName, setSectionName] = useState(""); // P4: 紐付ける区間(任意)

  // ---- 実行状態(localStorage から復元し、現在時刻基準で補正する) ----
  const [session, setSession] = useState<TimerSession | null>(() =>
    loadTimerSession(),
  );
  const [pending, setPending] = useState<PendingResult | null>(null);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // ---- 省電力表示(T6b/c) ----
  const [viewMode, setViewMode] = useState<"dim" | "normal">("dim");
  const [lastTouch, setLastTouch] = useState(0);
  const [wakeNotice, setWakeNotice] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // 通知時の全画面色変化

  useEffect(() => {
    onActiveChange(session !== null);
  }, [session, onActiveChange]);

  // T6a: 実行中は Wake Lock を保持する。ページ非表示で自動解放されるため復帰時に取り直す
  const lockDesired = session !== null && pending === null;
  useEffect(() => {
    if (!lockDesired) return;
    const request = () => {
      if (document.visibilityState === "visible") void acquireWakeLock();
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      releaseWakeLock(); // 停止・完了時に必ず解放する
    };
  }, [lockDesired]);

  // 表示更新用の時計(T6d: 更新は1秒1回)。復帰時は即時更新して残り時間を補正する
  useEffect(() => {
    const sync = () => setNow(Date.now());
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    let id: number | undefined;
    if (session !== null && session.phaseStartedEpoch !== null && !pending) {
      id = window.setInterval(sync, 1000);
    }
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      if (id !== undefined) window.clearInterval(id);
    };
  }, [session, pending]);

  // 現在時刻に合わせてフェーズを進め、切替・完走を検知する
  useEffect(() => {
    if (!session || pending || session.phaseStartedEpoch === null) return;
    const r = advance(session, now);
    if (r.events.length > 0) {
      // 複数フェーズをまたいで復帰した場合も通知は直近の1回だけ
      notifyAndFlash(r.events[r.events.length - 1]);
    }
    if (r.session !== session) {
      setSession(r.session);
      saveTimerSession(r.session);
    }
    if (r.finished) {
      notifyAndFlash("finish");
      openResult(r.session, now, true);
    }
  }, [now, session, pending]);

  // T6c: 通常表示は10秒間無操作で自動的に暗転へ戻る
  useEffect(() => {
    if (!session || pending || viewMode !== "normal") return;
    const id = window.setTimeout(() => setViewMode("dim"), 10_000);
    return () => window.clearTimeout(id);
  }, [session, pending, viewMode, lastTouch]);

  /** T6e: ビープ音 + バイブレーション + 画面全体の色変化 */
  function notifyAndFlash(kind: BeepKind) {
    notify(kind);
    setFlash(FLASH_COLOR[kind]);
    window.setTimeout(() => setFlash(null), 1200);
  }

  /** 計測を止めた状態のセッションを返す(経過時間を積算に固定する) */
  function freeze(s: TimerSession, at: number): TimerSession {
    if (s.phaseStartedEpoch === null) return s;
    return { ...s, phaseAccumMs: phaseElapsedMs(s, at), phaseStartedEpoch: null };
  }

  /** 実行結果を確定して保存確認ダイアログを開く(T2: 自動保存はしない) */
  function openResult(s: TimerSession, at: number, finished: boolean) {
    const cfg = s.config;
    const frozen = freeze(s, at);
    const planned = plannedWorkMs(cfg);
    let actualMs = workElapsedMs(frozen, at);
    let completed = finished;
    if (cfg.mode === "simple" && cfg.overrun) {
      // 超過継続型: 設定時間に到達していれば完走扱い(実績は超過込みの合計時間)
      completed = actualMs >= planned;
    }
    if (finished && !(cfg.mode === "simple" && cfg.overrun)) {
      // 完走時は tick 誤差を丸めて実績を設定時間ちょうどにする
      actualMs = planned;
    }
    const completedSets =
      cfg.mode === "pomodoro"
        ? finished
          ? cfg.sets
          : frozen.phase === "work"
            ? frozen.set - 1
            : frozen.set
        : undefined;
    setSession(frozen);
    saveTimerSession(frozen);
    setViewMode("normal");
    setPending({
      completed,
      actualSeconds: Math.round(actualMs / 1000),
      completedSets,
      config: cfg,
      startedAt: s.startedAt,
    });
  }

  function handleStart() {
    unlockAudio(); // iOS: ユーザー操作中に AudioContext を有効化しておく(T4)
    const w = clampInt(workMinutes, 5, 120);
    setWorkMinutes(w);
    const config: TimerConfig = {
      mode,
      workMinutes: w,
      breakMinutes,
      sets,
      overrun,
      goalId: goalId || undefined,
      section: goalId && sectionName ? sectionName : undefined,
    };
    const s: TimerSession = {
      config,
      startedAt: new Date().toISOString(),
      phase: "work",
      set: 1,
      phaseAccumMs: 0,
      phaseStartedEpoch: Date.now(),
      workDoneMs: 0,
      notifiedOver: false,
    };
    setNote("");
    setSession(s);
    saveTimerSession(s);
    setNow(Date.now());
    // T6a: 非対応環境では1回だけ案内を出す(見せるため通常表示から開始)
    if (!wakeLockSupported() && consumeWakeLockNotice()) {
      setWakeNotice(true);
      setViewMode("normal");
      setLastTouch(Date.now());
    } else {
      setViewMode("dim"); // T6b: 開始したら暗転表示
    }
  }

  function handlePauseResume() {
    if (!session) return;
    const at = Date.now();
    let next: TimerSession;
    if (session.phaseStartedEpoch === null) {
      unlockAudio(); // 再開もユーザー操作なので音を有効化し直す
      next = { ...session, phaseStartedEpoch: at };
    } else {
      next = freeze(session, at);
    }
    setSession(next);
    saveTimerSession(next);
    setNow(at);
  }

  function handleStop() {
    if (!session) return;
    const at = Date.now();
    // バックグラウンド中のフェーズ遷移・完走を反映してから確定する
    const r = advance(session, at);
    openResult(r.session, at, r.finished);
  }

  /** ダイアログの選択結果を反映(save=false は破棄) */
  function closeResult(save: boolean) {
    if (!pending) return;
    if (!save && !window.confirm("この記録を破棄します。よろしいですか?")) return;
    if (save) {
      const cfg = pending.config;
      onAddLog({
        id: uid(),
        startedAt: pending.startedAt,
        mode: cfg.mode,
        plannedMinutes:
          cfg.mode === "pomodoro" ? cfg.workMinutes * cfg.sets : cfg.workMinutes,
        actualSeconds: pending.actualSeconds,
        completed: pending.completed,
        note: note.trim(),
        goalId: cfg.goalId,
        section: cfg.section,
        ...(cfg.mode === "pomodoro"
          ? {
              workMinutes: cfg.workMinutes,
              breakMinutes: cfg.breakMinutes,
              totalSets: cfg.sets,
              completedSets: pending.completedSets,
            }
          : {}),
      });
    }
    setPending(null);
    setNote("");
    setSession(null);
    saveTimerSession(null);
    setWakeNotice(false);
  }

  const wClamped = clampInt(workMinutes, 5, 120);
  const pomodoroTotalSec = (wClamped * sets + breakMinutes * (sets - 1)) * 60;

  // P4: 紐付け先が区間を持つ music 目標なら、区間の選択肢を出す
  const linkedGoal = goals.find((g) => g.id === goalId);
  const linkedSections =
    linkedGoal?.type === "music"
      ? [...(linkedGoal.sections ?? [])].sort((a, b) => a.order - b.order)
      : [];

  const view = session ? sessionView(session, now) : null;

  return (
    <div className="space-y-4">
      <h1 className="mb-5 text-xl font-bold">⏱ タイマー</h1>

      {session && view ? (
        /* 通常表示(T6c: タップで暗転と切替。操作ボタンはこちらにのみ置く) */
        <div onClick={() => setLastTouch(Date.now())}>
          {wakeNotice && (
            <p className="mb-3 rounded-lg border border-amber-700 bg-amber-950 p-3 text-xs leading-relaxed text-amber-300">
              この環境では画面ロックの自動防止(Wake Lock)が使えません。端末の設定で自動ロックをオフにしてください。
            </p>
          )}
          <RunningCard
            session={session}
            now={now}
            onPauseResume={handlePauseResume}
            onStop={handleStop}
            onDim={() => setViewMode("dim")}
          />
        </div>
      ) : (
        <section className="space-y-4 rounded-2xl bg-slate-800 p-4">
          {/* モード選択 */}
          <div className="grid grid-cols-2 gap-2">
            {(["pomodoro", "simple"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl border py-3 text-sm font-semibold ${
                  mode === m
                    ? "border-[#3987e5] bg-[#3987e5]/15 text-white"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* 時間設定: スライダー(5分刻み)+ 直接入力 */}
          <div>
            <label className="mb-1 flex items-center justify-between text-sm text-slate-300">
              <span>{mode === "pomodoro" ? "作業時間" : "時間"}(5〜120分)</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={workMinutes}
                  onChange={(e) => setWorkMinutes(Number(e.target.value))}
                  onBlur={() => setWorkMinutes((v) => clampInt(v, 5, 120))}
                  className="w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right text-sm"
                />
                分
              </span>
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={wClamped}
              onChange={(e) => setWorkMinutes(Number(e.target.value))}
              className="w-full accent-[#3987e5]"
            />
          </div>

          {mode === "pomodoro" ? (
            <>
              {/* 休憩時間(5〜10分・1分刻み) */}
              <div>
                <label className="mb-1 flex items-center justify-between text-sm text-slate-300">
                  <span>休憩時間(5〜10分)</span>
                  <span className="font-semibold text-slate-200">
                    {breakMinutes}分
                  </span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={10}
                  step={1}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="w-full accent-[#199e70]"
                />
              </div>
              {/* セット数(1〜8) */}
              <div>
                <p className="mb-1 text-sm text-slate-300">セット数</p>
                <div className="grid grid-cols-8 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSets(n)}
                      className={`rounded-lg border py-2 text-sm font-semibold ${
                        sets === n
                          ? "border-[#3987e5] bg-[#3987e5]/15 text-white"
                          : "border-slate-700 text-slate-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {wClamped}分作業 + {breakMinutes}分休憩 × {sets}セット(合計{" "}
                {fmtDuration(pomodoroTotalSec)}・最後の休憩なし)
              </p>
            </>
          ) : (
            /* シンプル: 終了時の挙動を開始前に選択(T1b) */
            <fieldset>
              <legend className="mb-1 text-sm text-slate-300">終了時の挙動</legend>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 rounded-lg border border-slate-700 p-2.5 text-sm">
                  <input
                    type="radio"
                    name="overrun"
                    checked={overrun}
                    onChange={() => setOverrun(true)}
                    className="mt-0.5 accent-[#3987e5]"
                  />
                  <span>
                    <span className="font-semibold text-slate-200">超過継続型</span>
                    <span className="block text-xs leading-relaxed text-slate-400">
                      設定時間の後も停止するまで計測し、超過分を +MM:SS
                      で表示(実績は超過込みの合計時間)
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-slate-700 p-2.5 text-sm">
                  <input
                    type="radio"
                    name="overrun"
                    checked={!overrun}
                    onChange={() => setOverrun(false)}
                    className="mt-0.5 accent-[#3987e5]"
                  />
                  <span>
                    <span className="font-semibold text-slate-200">強制終了型</span>
                    <span className="block text-xs leading-relaxed text-slate-400">
                      設定時間に達したら自動的に停止する
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          {/* 目標への紐付け(T3・任意) */}
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              目標に紐付け(任意)
              <select
                value={goalId}
                onChange={(e) => {
                  setGoalId(e.target.value);
                  setSectionName("");
                }}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
              >
                <option value="">紐付けなし</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            {/* P4: 区間の選択(music目標のみ・任意) */}
            {linkedSections.length > 0 && (
              <label className="mt-2 block text-sm text-slate-300">
                練習区間(任意)
                <select
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm"
                >
                  <option value="">指定なし</option>
                  {linkedSections.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            onClick={handleStart}
            className="w-full rounded-xl py-3 text-base font-bold text-white active:opacity-80"
            style={{ backgroundColor: "#3987e5" }}
          >
            ▶ 開始
          </button>
        </section>
      )}

      {!session && <TimerHistory logs={logs} goals={goals} onDelete={onDeleteLog} />}

      {/* T6b/c: 暗転表示(黒背景+暗めのグレーの数字のみ。タップで通常表示へ) */}
      {session && view && !pending && viewMode === "dim" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: "#000000" }}
          onClick={() => {
            unlockAudio();
            setViewMode("normal");
            setLastTouch(Date.now());
          }}
        >
          <p className="text-sm" style={{ color: "#4b5563" }}>
            {view.statusText}
            {view.paused && "・一時停止中"}
          </p>
          <p
            className="font-mono text-7xl font-bold tabular-nums"
            style={{ color: "#6b7280" }}
          >
            {view.timeText}
          </p>
          <p className="text-xs" style={{ color: "#374151" }}>
            タップで操作を表示
          </p>
        </div>
      )}

      {/* T6e: 通知時の全画面色変化(黒 → 明色) */}
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{ backgroundColor: flash }}
        />
      )}

      {pending && (
        <ResultDialog
          pending={pending}
          note={note}
          onNote={setNote}
          goals={goals}
          onClose={closeResult}
        />
      )}
    </div>
  );
}

// ---- 通常表示(操作ボタンあり。10秒無操作で暗転へ戻る) ----
interface RunningProps {
  session: TimerSession;
  now: number;
  onPauseResume: () => void;
  onStop: () => void;
  onDim: () => void;
}

function RunningCard({ session, now, onPauseResume, onStop, onDim }: RunningProps) {
  const v = sessionView(session, now);
  const cfg = v.cfg;
  const phaseColor = v.isBreak ? "#199e70" : v.over ? "#f59e0b" : "#3987e5";
  const phaseLabel =
    cfg.mode === "pomodoro"
      ? v.isBreak
        ? "☕ 休憩中"
        : "🔥 作業中"
      : v.over
        ? "⏰ 超過中"
        : "⏱ 計測中";

  return (
    <section className="rounded-2xl bg-slate-800 p-6 text-center">
      <p className="text-lg font-bold" style={{ color: phaseColor }}>
        {phaseLabel}
      </p>
      {cfg.mode === "pomodoro" && (
        <p className="mt-1 text-2xl font-bold text-slate-100">
          セット {session.set} / {cfg.sets}
        </p>
      )}
      <p
        className={`my-4 font-mono text-6xl font-bold tabular-nums ${
          v.paused ? "text-slate-500" : ""
        }`}
        style={v.paused ? undefined : { color: v.over ? "#f59e0b" : "#f1f5f9" }}
      >
        {v.timeText}
      </p>
      <ProgressBar percent={Math.min(100, (v.elapsed / v.dur) * 100)} />
      <p className="mt-2 text-xs text-slate-400">
        {cfg.mode === "pomodoro"
          ? v.isBreak
            ? `この後: セット${session.set + 1}の作業 ${cfg.workMinutes}分`
            : session.set >= cfg.sets
              ? "この後: 終了"
              : `この後: 休憩 ${cfg.breakMinutes}分`
          : cfg.overrun
            ? "設定時間の後も停止するまで計測を続けます"
            : "設定時間で自動的に終了します"}
      </p>
      {v.paused && (
        <p className="mt-2 text-sm font-semibold text-amber-400">一時停止中</p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          onClick={onPauseResume}
          className="flex-1 rounded-lg border border-slate-600 py-3 text-sm font-semibold text-slate-200 active:bg-slate-700"
        >
          {v.paused ? "▶ 再開" : "⏸ 一時停止"}
        </button>
        <button
          onClick={onStop}
          className="flex-1 rounded-lg border border-red-900 py-3 text-sm font-semibold text-red-400 active:bg-red-950"
        >
          ⏹ 停止
        </button>
      </div>
      <button
        onClick={onDim}
        className="mt-2 w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-400 active:bg-slate-700"
      >
        🌙 暗転表示に戻す(10秒無操作でも自動で戻ります)
      </button>
    </section>
  );
}

// ---- 保存確認ダイアログ(T2: 保存/破棄を必ず操作者が選ぶ) ----
interface DialogProps {
  pending: PendingResult;
  note: string;
  onNote: (v: string) => void;
  goals: Goal[];
  onClose: (save: boolean) => void;
}

function ResultDialog({ pending, note, onNote, goals, onClose }: DialogProps) {
  const cfg = pending.config;
  const goal = cfg.goalId ? goals.find((g) => g.id === cfg.goalId) : undefined;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-slate-800 p-5">
        <h3 className="text-base font-bold">
          {pending.completed
            ? "🎉 完了!お疲れさまでした"
            : "タイマーを途中で停止しました"}
        </h3>
        <div className="rounded-lg bg-slate-900 p-3 text-sm text-slate-300">
          <p>
            {MODE_LABEL[cfg.mode]} / 設定{" "}
            {cfg.mode === "pomodoro"
              ? `${cfg.workMinutes}分 × ${cfg.sets}セット`
              : `${cfg.workMinutes}分`}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-100">
            実績 {fmtClock(pending.actualSeconds)}
          </p>
          {cfg.mode === "pomodoro" && (
            <p className="text-xs text-slate-400">
              完了セット {pending.completedSets} / {cfg.sets}
            </p>
          )}
          {goal && (
            <p className="mt-1 text-xs text-slate-400">
              🎯 {goal.title}
              {cfg.section && `(${cfg.section})`} に紐付け
            </p>
          )}
        </div>
        <label className="block text-sm text-slate-300">
          メモ(何をしたか・省略可)
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={2}
            placeholder="例: ノクターン Bセクションの部分練習"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onClose(false)}
            className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-300 active:bg-slate-700"
          >
            破棄する
          </button>
          <button
            onClick={() => onClose(true)}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white active:opacity-80"
            style={{ backgroundColor: "#3987e5" }}
          >
            記録を保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- タイマー履歴(日付降順) ----
interface HistoryProps {
  logs: TimerLog[];
  goals: Goal[];
  onDelete: (id: string) => void;
}

function TimerHistory({ logs, goals, onDelete }: HistoryProps) {
  const sorted = [...logs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <section className="rounded-xl bg-slate-800 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-300">
        タイマー履歴({logs.length}件)
      </h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">まだ記録がありません</p>
      ) : (
        <ul className="divide-y divide-slate-700">
          {sorted.map((t) => {
            const goal = t.goalId
              ? goals.find((g) => g.id === t.goalId)
              : undefined;
            return (
              <li key={t.id} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-slate-400">
                    {fmtDateTime(t.startedAt)}
                  </span>
                  <span className="shrink-0">
                    {t.mode === "pomodoro" ? "🍅" : "⏱"}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 text-xs ${
                      t.completed
                        ? "bg-emerald-900 text-emerald-300"
                        : "bg-amber-900 text-amber-300"
                    }`}
                  >
                    {t.completed ? "完走" : "途中"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">
                    {fmtClock(t.actualSeconds)}
                    <span className="ml-1 text-xs text-slate-500">
                      / 設定{t.plannedMinutes}分
                      {t.totalSets !== undefined &&
                        `(${t.workMinutes}分×${t.totalSets})`}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm("この履歴を削除しますか?")) onDelete(t.id);
                    }}
                    aria-label="この履歴を削除"
                    className="shrink-0 px-1 text-slate-500 active:text-red-400"
                  >
                    ✕
                  </button>
                </div>
                {(goal !== undefined || t.note !== "") && (
                  <p className="mt-1 text-xs text-slate-400">
                    {goal && (
                      <span className="mr-1 rounded bg-slate-700 px-1 text-slate-300">
                        🎯 {goal.title}
                        {t.section && `(${t.section})`}
                      </span>
                    )}
                    {t.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
