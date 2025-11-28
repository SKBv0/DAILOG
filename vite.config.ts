import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === "production" ? "production" : mode === "test" ? "test" : "development";

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    },
  };
});
