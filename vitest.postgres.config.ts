import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/prototypes/m0-postgres.proof.ts"],
    testTimeout: 25000,
    hookTimeout: 25000,
  },
});
