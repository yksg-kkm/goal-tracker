// アプリ本体: 画面遷移(ホーム / 目標詳細 / 目標追加)と状態管理
import { useEffect, useState } from "react";
import type { Goal } from "./types";
import { initialGoals } from "./initialData";
import { downloadExport, loadGoals, parseImport, saveGoals } from "./storage";
import { createGoal, type NewGoalInput } from "./templates";
import GoalCard from "./components/GoalCard";
import GoalDetail from "./components/GoalDetail";
import GoalForm from "./components/GoalForm";

type View =
  | { name: "home" }
  | { name: "detail"; goalId: string }
  | { name: "new" };

export default function App() {
  // 初回起動時のみ初期データ(ショパン ノクターン)を適用
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals() ?? initialGoals());
  const [view, setView] = useState<View>({ name: "home" });

  // 変更のたびに localStorage へ保存(S2: 保存先はこの端末内のみ)
  useEffect(() => {
    saveGoals(goals);
  }, [goals]);

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
          `${imported.length}件の目標を読み込み、現在のデータを置き換えます。よろしいですか?`,
        )
      )
        return;
      setGoals(imported);
      setView({ name: "home" });
    });
  }

  // ---- 目標詳細 ----
  if (view.name === "detail") {
    const goal = goals.find((g) => g.id === view.goalId);
    if (goal) {
      return (
        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
          <GoalDetail
            goal={goal}
            onBack={() => setView({ name: "home" })}
            onUpdate={(updater) => updateGoal(goal.id, updater)}
            onDelete={() => handleDelete(goal.id)}
          />
        </div>
      );
    }
    // 目標が見つからない場合はホームへ(下にフォールスルー)
  }

  // ---- 目標追加 ----
  if (view.name === "new") {
    return (
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
        <GoalForm
          onCreate={handleCreate}
          onBack={() => setView({ name: "home" })}
        />
      </div>
    );
  }

  // ---- ホーム: 全目標のカード一覧 ----
  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
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
            onClick={() => downloadExport(goals)}
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
    </div>
  );
}
