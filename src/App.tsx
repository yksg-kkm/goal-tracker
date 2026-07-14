// アプリ本体: 下部タブ(目標 / タイマー)と画面遷移・状態管理
import { useEffect, useState, type ReactNode } from "react";
import type { Goal, TimerLog } from "./types";
import { initialGoals } from "./initialData";
import {
  downloadExport,
  loadGoals,
  loadTimerLogs,
  parseImport,
  saveGoals,
  saveTimerLogs,
} from "./storage";
import { createGoal, type NewGoalInput } from "./templates";
import GoalCard from "./components/GoalCard";
import GoalDetail from "./components/GoalDetail";
import GoalForm from "./components/GoalForm";
import TimerScreen from "./components/TimerScreen";

type View =
  | { name: "home" }
  | { name: "detail"; goalId: string }
  | { name: "new" };

type Tab = "goals" | "timer";

export default function App() {
  // 初回起動時のみ初期データ(ショパン ノクターン)を適用
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals() ?? initialGoals());
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>(() => loadTimerLogs());
  const [view, setView] = useState<View>({ name: "home" });
  const [tab, setTab] = useState<Tab>("goals");
  const [timerActive, setTimerActive] = useState(false);

  // 変更のたびに localStorage へ保存(S2: 保存先はこの端末内のみ)
  useEffect(() => {
    saveGoals(goals);
  }, [goals]);
  useEffect(() => {
    saveTimerLogs(timerLogs);
  }, [timerLogs]);

  function updateGoal(id: string, updater: (g: Goal) => Goal) {
    setGoals((gs) => gs.map((g) => (g.id === id ? updater(g) : g)));
  }

  function handleCreate(input: NewGoalInput) {
    const goal = createGoal(input);
    setGoals((gs) => [...gs, goal]);
    setView({ name: "detail", goalId: goal.id });
  }

  function handleDelete(id: string) {
    setGoals((gs) => gs.filter((g) => g.id !== id));
    setView({ name: "home" });
  }

  function handleImportFile(file: File) {
    void file.text().then((text) => {
      const imported = parseImport(text);
      if (!imported) {
        window.alert(
          "インポートに失敗しました。GoalTrackerのエクスポートファイル(goaltracker-YYYYMMDD.export.json)を選択してください。",
        );
        return;
      }
      if (
        !window.confirm(
          `目標${imported.goals.length}件・タイマー記録${imported.timerLogs.length}件を読み込み、現在のデータを置き換えます。よろしいですか?`,
        )
      )
        return;
      setGoals(imported.goals);
      setTimerLogs(imported.timerLogs);
      setView({ name: "home" });
    });
  }

  // ---- 目標タブの中身 ----
  const detailGoal =
    view.name === "detail" ? goals.find((g) => g.id === view.goalId) : undefined;

  let goalsContent: ReactNode;
  if (detailGoal) {
    goalsContent = (
      <GoalDetail
        goal={detailGoal}
        timerSeconds={timerLogs
          .filter((t) => t.goalId === detailGoal.id)
          .reduce((sum, t) => sum + t.actualSeconds, 0)}
        onBack={() => setView({ name: "home" })}
        onUpdate={(updater) => updateGoal(detailGoal.id, updater)}
        onDelete={() => handleDelete(detailGoal.id)}
      />
    );
  } else if (view.name === "new") {
    goalsContent = (
      <GoalForm onCreate={handleCreate} onBack={() => setView({ name: "home" })} />
    );
  } else {
    goalsContent = (
      <>
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold">🎯 GoalTracker</h1>
          <button
            onClick={() => setView({ name: "new" })}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white active:opacity-80"
            style={{ backgroundColor: "#3987e5" }}
          >
            + 目標を追加
          </button>
        </header>

        <main className="space-y-3">
          {goals.length === 0 ? (
            <p className="rounded-xl bg-slate-900 p-6 text-center text-sm text-slate-400">
              目標がまだありません。「+ 目標を追加」から始めましょう。
            </p>
          ) : (
            goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onOpen={() => setView({ name: "detail", goalId: g.id })}
              />
            ))
          )}
        </main>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-300">データ管理</h2>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            進捗データはこの端末のブラウザ内(localStorage)にのみ保存され、外部への送信は一切行いません。端末間の移行にはエクスポート/インポートを使ってください。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadExport(goals, timerLogs)}
              className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-200 active:bg-slate-800"
            >
              エクスポート
            </button>
            <label className="flex-1 cursor-pointer rounded-lg border border-slate-700 py-2 text-center text-sm text-slate-200 active:bg-slate-800">
              インポート
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-6">
      <div className={tab === "goals" ? "" : "hidden"}>{goalsContent}</div>
      {/* タイマーはタブを離れても動き続けるよう、非表示時もマウントしたままにする */}
      <div className={tab === "timer" ? "" : "hidden"}>
        <TimerScreen
          goals={goals}
          logs={timerLogs}
          onAddLog={(log) => setTimerLogs((ls) => [...ls, log])}
          onDeleteLog={(id) => setTimerLogs((ls) => ls.filter((l) => l.id !== id))}
          onActiveChange={setTimerActive}
        />
      </div>

      {/* 下部タブバー */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-2">
          <button
            onClick={() => setTab("goals")}
            className={`py-3 text-sm font-semibold ${
              tab === "goals" ? "text-[#3987e5]" : "text-slate-400"
            }`}
          >
            🎯 目標
          </button>
          <button
            onClick={() => setTab("timer")}
            className={`py-3 text-sm font-semibold ${
              tab === "timer" ? "text-[#3987e5]" : "text-slate-400"
            }`}
          >
            ⏱ タイマー
            {timerActive && (
              <span className="ml-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#199e70] align-middle" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
