import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors tsconfig.json's "@/*" -> "./*" mapping. Needed now that a directly
  // unit-tested component (tests/providers/selection.test.ts renders
  // AnalysisProviderControls) imports app/_components/t and lib/i18n via "@/" —
  // the same alias every other swept component already uses.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Pure logic only in this phase — no DOM, no React. Node environment keeps the
    // contract/validation/normalization tests honest about their dependencies.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      // Fixtures and pure type modules carry no branch logic worth covering.
      exclude: ["lib/**/fixtures/**", "lib/**/types.ts", "lib/contracts/**/*.ts"],
    },
  },
});
