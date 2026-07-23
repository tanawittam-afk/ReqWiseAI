import { defineConfig } from "vitest/config";

export default defineConfig({
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
