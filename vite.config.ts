import { defineConfig } from "vite";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin.ts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [assetpackPlugin()],
  resolve: {
    alias:
      mode === "production"
        ? {
            // Stub out the 249KB boardgame.io Debug UI (Svelte) in production.
            // It's statically imported by boardgame.io/client but unused when debug: false.
            "./Debug-8242c26e.js": new URL(
              "src/stubs/bgio-debug-stub.ts",
              import.meta.url,
            ).pathname,
          }
        : {},
  },
  server: {
    port: 8080,
    open: true,
    proxy: {
      "/games": "http://localhost:8000",
    },
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
  build: {
    chunkSizeWarningLimit: 1500,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/pixi.js") || id.includes("node_modules/@pixi")) {
            return "vendor-pixi";
          }
          if (
            id.includes("node_modules/boardgame.io") ||
            id.includes("node_modules/socket.io") ||
            id.includes("node_modules/socket.io-client")
          ) {
            return "vendor-bgio";
          }
          if (id.includes("node_modules/motion")) {
            return "vendor-motion";
          }
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
