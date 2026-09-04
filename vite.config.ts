import { defineConfig } from "vite";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [assetpackPlugin()],
  server: {
    port: 8080,
    open: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
