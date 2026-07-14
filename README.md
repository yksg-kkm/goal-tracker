# 🎯 GoalTracker — 目標達成トラッカー

目標(Goal)→ マイルストーン(Milestone)→ 日々の記録(Log)の3層で
進捗を管理するPWA。iPhoneのホーム画面に追加してオフラインでも使えます。

## 特徴

- **3つの目標タイプ**: 🎵 楽曲習得型 / 📝 試験型 / 🔁 継続型(タイプ別テンプレート付き)
- **進捗の可視化**: 進捗バー + Recharts によるグラフ(達成テンポの推移など)
- **プライバシー重視**: 進捗データは端末内の localStorage のみに保存。
  外部送信は一切なし。端末間の移行は JSON エクスポート/インポートで行う
- **PWA**: オフライン起動・ホーム画面追加対応

## 開発

```bash
npm ci        # 依存関係のインストール
npm run dev   # 開発サーバー(http://localhost:5173/goal-tracker/)
npm run build # 型チェック + 本番ビルド
```

## デプロイ

`main` ブランチへの push で GitHub Actions が自動的に GitHub Pages へデプロイします。

## 技術スタック

React 18 / TypeScript / Vite / Tailwind CSS / Recharts / vite-plugin-pwa
