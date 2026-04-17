import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages: vividbooks.github.io/FOXasistent/
export default defineConfig({
  plugins: [react()],
  base: "/FOXasistent/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
