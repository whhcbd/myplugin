import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.esm.js",
    },
    rollupOptions: {
      external: ["react"],
      output: {
        globals: { react: "React" },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
