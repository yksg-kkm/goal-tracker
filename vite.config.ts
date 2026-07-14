// Vite 設定 — GitHub Pages 配信 + PWA
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages のサブパス(https://<user>.github.io/goal-tracker/)に対応
  base: "/goal-tracker/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-180.png"],
      manifest: {
        name: "GoalTracker — 目標達成トラッカー",
        short_name: "GoalTracker",
        description: "目標・マイルストーン・日々の記録をオフラインで管理するPWA",
        lang: "ja",
        display: "standalone",
        start_url: "/goal-tracker/",
        scope: "/goal-tracker/",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // アプリ本体(HTML/JS/CSS/アイコン)を事前キャッシュしオフライン起動可能に
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
      },
    }),
  ],
});
