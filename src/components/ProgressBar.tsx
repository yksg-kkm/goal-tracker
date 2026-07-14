// 進捗バー(0〜100%)
interface Props {
  percent: number;
}

export default function ProgressBar({ percent }: Props) {
  const p = Math.round(Math.min(100, Math.max(0, percent)));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700"
        role="progressbar"
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${p}%`, backgroundColor: "#3987e5" }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-slate-400">
        {p}%
      </span>
    </div>
  );
}
