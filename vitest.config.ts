import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
        "dist/",
        "build/",
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        // Critical paths need higher coverage
        "src/domain/**": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "src/services/**": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Test file patterns - exclude E2E tests
    include: [
      "src/tests/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "src/tests/e2e/**", // E2E tests are handled by Playwright
      "node_modules/",
    ],
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
    // Reporter configuration
    reporter: process.env.CI
      ? ["verbose", "github-actions"]
      : ["verbose", "html"],
    outputFile: {
      html: "./coverage/vitest-report.html",
      json: "./coverage/vitest-results.json",
    },
    // Mock configuration
    deps: {
      inline: ["@testing-library/jest-dom"],
    },
    // Performance settings
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
});